import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CORE_BRIDGE_LIVE_CONTENT_TYPE,
  CORE_BRIDGE_ACTIONS,
  buildSignedHeaders,
} from '../src/core-bridge.mjs';
import { createBridgeHandler } from '../../../supabase/functions/integration-core-bridge/handler.mjs';

const NOW = Date.parse('2026-11-25T21:00:00Z');
const SECRET = 'local-disposable-hmac-only';
const DATA = Object.freeze({
  action: CORE_BRIDGE_ACTIONS.SHOPEE_SELLER_SKU_REGISTRY_READ,
  channel_account_id:'d26c7a30-aa4a-4441-8012-600d70453689',
  item_id:'23094148715',
  model_id:'129843489972',
});
async function invoke(payload, { mediaType=CORE_BRIDGE_LIVE_CONTENT_TYPE,secret=SECRET } = {}) {
  let executions=0;
  const handler=createBridgeHandler({
    getSecret:()=>SECRET, checkCore:async()=>true,
    now:()=>NOW, logger:()=>{},
    executeAction:async data=>{
      executions++;
      return {status:200,body:{status:'ok',action:data.action,written:0}};
    },
  });
  const body=JSON.stringify(payload);
  const signed=buildSignedHeaders({
    secret,body,timestamp:Math.floor(NOW/1000),contentType:mediaType,
  });
  const response=await handler(new Request('https://example.invalid/core',{
    method:'POST', headers:signed, body,
  }));
  return {status:response.status,json:await response.json(),executions};
}
test('bridge allows exact signed consultative read without mutation',async()=>{
  const r=await invoke(DATA);
  assert.equal(r.status,200);
  assert.equal(r.executions,1);
  assert.equal(r.json.written,0);
});
test('bridge rejects extra keys and account/Item/Model invalidity before executor',async()=>{
  for (const changed of [
    {...DATA, model_sku:'AF-TRF30-KT-030-BRG'},
    {...DATA, channel_account_id:'bad'},
    {...DATA, item_id:'no'},
    {...DATA, model_id:'0x10'},
    {...DATA, model_id:''},
    {...DATA, item_id:12345},
  ]) {
    const r=await invoke(changed);
    assert.equal(r.status,400);
    assert.equal(r.executions,0);
  }
});
test('bridge refuses invalid HMAC, even for a valid consultative payload',async()=>{
  const r=await invoke(DATA,{secret:'invalid-other-secret'});
  assert.equal(r.status,401);
  assert.equal(r.executions,0);
});
test('bridge refuses media-type downgrade to legacy JSON for SKU action',async()=>{
  const r=await invoke(DATA,{mediaType:'application/json'});
  assert.equal(r.status,400);
  assert.equal(r.executions,0);
});
