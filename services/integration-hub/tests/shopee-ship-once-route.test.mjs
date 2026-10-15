import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/app.mjs';

const PATH = '/internal/shopee/live/logistics/shipping/ship-once';
const noLive = async () => null;
const enabled = {
  SHOPEE_LIVE_SHIP_ORDER_ROUTE_ENABLED: 'true',
  SHOPEE_LIVE_SHIP_ORDER_ENABLED: 'true',
};
function fixture(env = enabled, outcome = { ok: true, code: 'ship_order_api_acknowledged_not_collected' }) {
  const called = [];
  const run = async (request = {}) => handleRequest({
    method: 'POST', path: PATH, query: {}, headers: {}, ...request,
  }, {
    handleShopeeLive: noLive,
    getEnv: name => env[name],
    shipShopeeOrderOnce: async () => { called.push('ship'); return outcome; },
    makeRunId: () => 'test-only-run',
    now: () => '2026-10-15T20:00:00Z',
    logEvent: event => called.push(['log',event]),
  });
  return { called, run };
}

test('both writer gate and private route gate are required', async () => {
  for (const env of [
    {}, { SHOPEE_LIVE_SHIP_ORDER_ENABLED: 'true' },
    { SHOPEE_LIVE_SHIP_ORDER_ROUTE_ENABLED: 'true' },
    { SHOPEE_LIVE_SHIP_ORDER_ROUTE_ENABLED: 'false', SHOPEE_LIVE_SHIP_ORDER_ENABLED: 'true' },
  ]) {
    const { run,called } = fixture(env);
    const result = await run();
    assert.equal(result.status,503);
    assert.equal(JSON.parse(result.body).error,'ship_order_not_enabled');
    assert.deepEqual(called,[]);
  }
});

test('route accepts POST without payload/query and sanitizes acknowledgment', async () => {
  const { run,called } = fixture();
  const response = await run();
  assert.equal(response.status,200);
  assert.deepEqual(JSON.parse(response.body), {
    status:'ok', mode:'single_pilot_ship_order',
    code:'ship_order_api_acknowledged_not_collected',
    physical_handoff_confirmed:false,
  });
  assert.equal(called[0],'ship');
  assert.equal(called[1][0],'log');
  assert.equal(called[1][1].event,'shopee_ship_order_once');
  assert.equal(called[1][1].status,'api_acknowledged');
  assert.equal(JSON.stringify(called).includes('access_token'),false);
});

test('GET or arbitrary query/body cannot invoke ship once', async () => {
  const { run,called }=fixture();
  for (const request of [
    { method:'GET' }, { method:'DELETE' },
    { query:{order_sn:'different'} },
    { headers:{'content-length':'3'} },
    { headers:{'transfer-encoding':'chunked'} },
  ]) {
    const res=await run(request);
    assert.ok([400,405].includes(res.status));
  }
  assert.deepEqual(called,[]);
});

test('Claim duplicate and uncertain return blocked, never false 200', async () => {
  for (const code of ['already_claimed','already_succeeded','uncertain_requires_reconciliation',
    'preflight_not_eligible','ship_order_uncertain_requires_reconciliation']) {
    const { run,called }=fixture(enabled,{ok:false,code});
    const result=await run();
    assert.equal(result.status,409);
    assert.equal(JSON.parse(result.body).code,code);
    assert.equal(JSON.parse(result.body).physical_handoff_confirmed,false);
    assert.equal(called[1][1].status,'blocked');
  }
});

test('Core failure or expiry return unavailable and sanitize the error', async () => {
  for (const code of ['ship_order_window_inactive','shipping_claim_not_acquired',
    'sent_but_core_confirmation_missing','preflight_unavailable']) {
    const {run}=fixture(enabled,{ok:false,code});
    assert.equal((await run()).status,503);
  }
});

test('unknown returned code never discloses secrets or claims success', async () => {
  const secret='private-refresh-token-internal-only';
  const { run }=fixture(enabled,{ok:true,code:secret,shop_id:531736366});
  const response=await run();
  assert.equal(response.status,503);
  assert.equal(JSON.parse(response.body).code,'runtime_exception');
  assert.equal(response.body.includes(secret),false);
});

test('thrown exception produces sanitized 503 and no retries', async () => {
  const called=[];
  const response=await handleRequest({
    method:'POST',path:PATH,query:{},headers:{},
  },{
    handleShopeeLive:noLive,
    getEnv:name=>enabled[name],
    shipShopeeOrderOnce:async()=>{called.push('ship');throw Error('sensitive-key');},
    logEvent:()=>{},
  });
  assert.equal(response.status,503);
  assert.deepEqual(called,['ship']);
  assert.equal(response.body.includes('sensitive-key'),false);
});

test('health path stays independent of ship gate and no shipping call is made', async () => {
  const response=await handleRequest({method:'GET',path:'/health',query:{}},{
    handleShopeeLive:noLive,
    getEnv:()=>undefined,
    shipShopeeOrderOnce:()=>{throw Error('must not invoke');},
  });
  assert.equal(response.status,200);
});
