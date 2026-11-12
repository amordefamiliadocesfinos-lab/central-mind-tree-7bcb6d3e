import test from 'node:test';
import assert from 'node:assert/strict';
import {createBridgeHandler} from '../../../supabase/functions/integration-core-bridge/handler.mjs';
import {runF12NonmutatingRpcContractProbe} from '../src/f12-3-core-bridge-nonmutating-contract.mjs';
import {CORE_BRIDGE_URL} from '../src/core-bridge.mjs';

const secret='test-only-hmac-32-byte-secret-synthetic';
const quiet=()=>{};
test('F12.3: native Bridge rejects foreign account before dispatch and bad leases in SQL-like executor',async()=>{
  let backendActions=[];
  const bridge=createBridgeHandler({
    getSecret:()=>secret,
    checkCore:async()=>true,
    logger:quiet,
    executeAction:async payload=>{
      backendActions.push(payload.action);
      if(payload.action==='shopee.adao_f12.stage')
        return {status:409,body:{status:'blocked',code:'stale_lease'}};
      if(payload.action==='shopee.adao_f12.ack')
        return {status:409,body:{status:'blocked',code:'stale_or_staged_requires_reconciliation'}};
      throw Error('unexpected action reached RPC');
    },
  });
  const report=await runF12NonmutatingRpcContractProbe({
    secret,fetchImpl:(url,init)=>{
      assert.equal(url,CORE_BRIDGE_URL);
      const body=JSON.parse(init.body);
      assert.equal(init.method,'POST');
      assert.ok(body.action.startsWith('shopee.adao_f12.'));
      if(body.action.endsWith('acquire')||body.action.endsWith('resume'))
        assert.notEqual(body.channel_account_id,'b4027369-5abf-4ac1-ab24-862334fae892');
      else assert.equal(body.lease_id,'00000000-0000-1000-8000-000000000000');
      return bridge(new Request(url,init));
    },
  });
  assert.equal(report.ok,true,JSON.stringify(report));
  assert.deepEqual(backendActions,['shopee.adao_f12.stage','shopee.adao_f12.ack']);
  assert.equal(JSON.stringify(report).includes(secret),false);
  assert.equal(JSON.stringify(report).includes('26111200000001'),false);
});

test('F12.3: mismatched response immediately stops before any later action',async()=>{
  let calls=0;
  const report=await runF12NonmutatingRpcContractProbe({
    secret,call:async()=>{calls++;return {status:200,payload:{status:'acquired'}};},
  });
  assert.equal(report.ok,false);
  assert.equal(report.code,'contract_mismatch');
  assert.equal(calls,1);
});

test('F12.3: unset secret causes zero requests',async()=>{
  let calls=0;
  const r=await runF12NonmutatingRpcContractProbe({
    secret:'',call:async()=>{calls++;throw Error('must not run');},
  });
  assert.equal(r.code,'hmac_secret_unavailable');
  assert.equal(calls,0);
});
