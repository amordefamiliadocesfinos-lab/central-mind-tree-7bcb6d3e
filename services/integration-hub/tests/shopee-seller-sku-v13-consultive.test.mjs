import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/app.mjs';
import { CORE_BRIDGE_ACTIONS } from '../src/core-bridge.mjs';

const CHANNEL = 'd26c7a30-aa4a-4441-8012-600d70453689';
const ITEM = '23094148715';
const MODEL = '129843489972';
const MAPPING = '980cb680-5296-4342-b83d-4e09584a3fe0';
const PATH = '/internal/shopee/live/sku-registry/preview';
const env = Object.freeze({
  SHOPEE_SKU_REGISTRY_PREVIEW_ENABLED: 'true',
  SHOPEE_SKU_REGISTRY_CHANNEL_ACCOUNT_ID: CHANNEL,
  SHOPEE_SKU_REGISTRY_ITEM_ID: ITEM,
  SHOPEE_SKU_REGISTRY_MODEL_ID: MODEL,
});
const response = (override = {}) => ({
  ok: true,
  payload: {
    status: 'ok', action: CORE_BRIDGE_ACTIONS.SHOPEE_SELLER_SKU_REGISTRY_READ,
    channel_account_id: CHANNEL, item_id: ITEM, model_id: MODEL,
    mapping_found: true, registry_found: true, mapping_id: MAPPING,
    canonical_sku: 'AF-TRF30-KT-030-BRG',
    observed_sku: null,
    observation_kind: 'UNKNOWN',
    reconciliation_status: 'PREPARADO_NO_CORE',
    revision: 1, written: 0,
    ...override,
  },
});
function request(overrides = {}) {
  return { method: 'POST', path: PATH, headers: { 'content-length': '0' }, query: {}, ...overrides };
}
async function run({ enabled = true, vars = env, upstream = response(), requestOverrides = {} } = {}) {
  const calls = [];
  const reply = await handleRequest(request(requestOverrides), {
    handleShopeeLive: async () => null,
    getEnv: name => enabled ? vars[name] : undefined,
    readSellerSkuRegistry: async data => { calls.push(data); return upstream; },
  });
  return { ...JSON.parse(reply.body), http: reply.status, calls };
}

test('E05: route is default-off and cannot read Core without explicit flag', async () => {
  const r = await run({ enabled: false });
  assert.equal(r.http, 503);
  assert.equal(r.code, 'sku_registry_preview_disabled');
  assert.equal(r.written, 0);
  assert.equal(r.calls.length, 0);
});
test('E05: refuses method, query, payload and transfer-encoding', async () => {
  const requests = [
    { method: 'GET' },
    { query: { channel_account_id: CHANNEL } },
    { body: '{"anything":"no"}', headers: { 'content-length': '17' } },
    { headers: { 'transfer-encoding': 'chunked' } },
  ];
  for (const requestOverrides of requests) {
    const r = await run({ requestOverrides });
    assert.ok([400,405].includes(r.http));
    assert.equal(r.calls.length,0);
  }
});
test('E05: rejects incomplete or malformed env scope without contacting Core', async () => {
  for (const vars of [
    { ...env, SHOPEE_SKU_REGISTRY_CHANNEL_ACCOUNT_ID: 'bad' },
    { ...env, SHOPEE_SKU_REGISTRY_ITEM_ID: '' },
    { ...env, SHOPEE_SKU_REGISTRY_MODEL_ID: 'non-numeric' },
  ]) {
    const r = await run({ vars });
    assert.equal(r.http, 503);
    assert.equal(r.code, 'sku_registry_scope_invalid');
    assert.equal(r.calls.length, 0);
  }
});
test('E05: provides distinct planned/observed state, scoped and without writing', async () => {
  const r=await run();
  assert.equal(r.http,200);
  assert.equal(r.mode,'read_only');
  assert.equal(r.mapping_id,MAPPING);
  assert.equal(r.canonical_sku,'AF-TRF30-KT-030-BRG');
  assert.equal(r.observed_sku,null);
  assert.equal(r.observation_kind,'UNKNOWN');
  assert.equal(r.reconciliation_status,'PREPARADO_NO_CORE');
  assert.equal(r.written,0);
  assert.deepEqual(r.calls,[{channel_account_id:CHANNEL,item_id:ITEM,model_id:MODEL}]);
});
test('E05: preserves legacy VIV observation without rewriting to AF', async () => {
  const r=await run({upstream:response({observed_sku:'VIV-TR30-030-BRG',
    observation_kind:'VALUE',reconciliation_status:'LEGADO_PRESERVADO'})});
  assert.equal(r.http,200);
  assert.equal(r.canonical_sku,'AF-TRF30-KT-030-BRG');
  assert.equal(r.observed_sku,'VIV-TR30-030-BRG');
  assert.equal(r.written,0);
});
test('E05: treats mapping without registry as unprepared, not as published', async () => {
  const r=await run({upstream:response({registry_found:false,canonical_sku:null,
    observed_sku:null,observation_kind:'UNKNOWN',reconciliation_status:'NAO_PREPARADO',revision:null})});
  assert.equal(r.http,200);
  assert.equal(r.registry_found,false);
  assert.equal(r.canonical_sku,null);
  assert.equal(r.reconciliation_status,'NAO_PREPARADO');
});
test('E05: blocks echoed cross-account, Item or Model response', async () => {
  for(const mismatch of [
    {channel_account_id:'8a8ad166-0317-4597-8be6-e43fb46b4d1b'},
    {item_id:'999999999999'},
    {model_id:'999999999999'},
    {written:1},
    {action:'shopee.order.create'},
    {mapping_found:false,registry_found:true},
  ]){
    const r=await run({upstream:response(mismatch)});
    assert.equal(r.http,503);
    assert.equal(r.written,0);
    assert.equal(r.code,'sku_registry_preview_unavailable');
  }
});
test('E05: rejects malformed upsteam, no accidental positive claims', async () => {
  const r=await run({upstream:{ok:true,payload:{status:'ok',action:
   CORE_BRIDGE_ACTIONS.SHOPEE_SELLER_SKU_REGISTRY_READ,channel_account_id:CHANNEL,
   item_id:ITEM,model_id:MODEL,registry_found:true,mapping_found:true,written:0}}});
  assert.equal(r.http,503);
  assert.equal(r.code,'sku_registry_preview_unavailable');
});
test('E05: upstream failures do not leak internal response', async () => {
  const r=await run({upstream:{ok:false,payload:{secret:'do_not_expose'}}});
  assert.equal(r.http,503);
  assert.equal(JSON.stringify(r).includes('do_not_expose'),false);
});
