import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { claimShopeeShippingArrangement, resolveShopeeShippingArrangement, CORE_BRIDGE_URL } from '../src/core-bridge.mjs';
import { shipOrderSimpleDropoff } from '../src/connectors/shopee-protocol.mjs';
import { createGuardedShopeeShipOrder } from '../src/shopee-ship-order-guard.mjs';
import { handleRequest } from '../src/app.mjs';

const channel = '8a8ad166-0317-4597-8be6-e43fb46b4d1b';
const order = '261014HX0XSUQU';
const pkg = 'OFG245605119132474';
const shop = 531736366;
const activeEnv = {
  SHOPEE_LIVE_SHIP_ORDER_ENABLED: 'true',
  SHOPEE_LIVE_SHIPPING_PREFLIGHT_ORDER_SN: order,
  SHOPEE_LIVE_CHANNEL_ACCOUNT_ID: channel,
  SHOPEE_LIVE_SHIPPING_FISCAL_MODE: 'pj_shopee_issuer',
  SHOPEE_LIVE_SHIP_ORDER_PILOT_ORDER_SN: order,
  SHOPEE_LIVE_SHIP_ORDER_PILOT_PACKAGE_NUMBER: pkg,
  SHOPEE_LIVE_SHIP_ORDER_PILOT_ACCOUNT_ID: channel,
  SHOPEE_LIVE_SHIP_ORDER_PILOT_SHOP_ID: String(shop),
  SHOPEE_LIVE_SHIP_ORDER_PILOT_FISCAL_MODE: 'pj_shopee_issuer',
  SHOPEE_LIVE_SHIP_ORDER_WINDOW_EXPIRES_AT: '2026-10-15T18:15:00Z',
  SHOPEE_LIVE_PARTNER_ID: '2047685',
  SHOPEE_LIVE_PARTNER_KEY: 'fake-key',
  SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY: 'fake-encryption-key',
};

function fixture(overrides = {}) {
  const calls = [];
  const deps = {
    getEnv: name => (overrides.env ?? activeEnv)[name],
    now: () => Date.parse('2026-10-15T18:00:00.000Z'),
    preflight: async () => {
      calls.push('preflight');
      return { ok: true, order_sn: order, package_number: pkg, shop_id: shop,
        order_status: 'READY_TO_SHIP', package_logistics_status: 'LOGISTICS_READY',
        fiscal: 'fiscal_valid',
        modes: ['dropoff'], simple_dropoff_confirmed: true };
    },
    readConnection: async () => {
      calls.push('oauth_read');
      return { ok: true, payload: {
        partner_id: 2047685, shop_id: shop, access_token_ciphertext: 'fake-ciphertext',
        access_token_expires_at: '2026-10-15T22:00:00Z',
      } };
    },
    decryptToken: async () => { calls.push('decrypt'); return 'synthetic-access-token'; },
    claim: async data => {
      calls.push(['claim', data]);
      return { ok: true, payload: {
        status: 'claimed', fresh: true, attempt_id: '123e4567-e89b-42d3-a456-426614174000',
      } };
    },
    ship: async ({ fetchImpl, ...details }) => {
      calls.push(['ship', details]);
      await fetchImpl(new URL('https://partner.shopeemobile.com/api/v2/logistics/ship_order'),
        { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
      return { response: { ok: true, status: 200 }, payload: { error: '', response: {} } };
    },
    fetchImpl: async (_url, options) => {
      calls.push(['transport', options]);
      return new Response('{}');
    },
    resolve: async data => {
      calls.push(['resolve', data]);
      return { ok: true, payload: { status: 'resolved', state: data.outcome } };
    },
    ...overrides,
  };
  return { calls, run: createGuardedShopeeShipOrder(deps) };
}

test('gate OFF refuses before OAuth, Core and Shopee', async () => {
  const { calls, run } = fixture({ env: {} });
  assert.deepEqual(await run(), { ok: false, code: 'ship_order_disabled' });
  assert.equal(calls.length, 0);
});

test('one fresh Core claim precedes exactly one Shopee POST; Core resolves success', async () => {
  const { calls, run } = fixture();
  const result = await run();
  assert.deepEqual(result, { ok: true, code: 'ship_order_api_acknowledged_not_collected' });
  assert.deepEqual(calls.map(c => typeof c === 'string' ? c : c[0]),
    ['preflight', 'oauth_read', 'decrypt', 'claim', 'ship', 'transport', 'resolve']);
  const expected = {
    order_sn: order, package_number: pkg, dropoff: {},
  };
  const requestHash = createHash('sha256').update(JSON.stringify(expected)).digest('hex');
  assert.equal(calls.find(c => c[0] === 'claim')[1].request_hash, requestHash);
  assert.equal(calls.find(c => c[0] === 'resolve')[1].request_hash, requestHash);
  assert.equal(calls.find(c => c[0] === 'resolve')[1].outcome, 'succeeded');
  assert.equal(calls.find(c => c[0] === 'ship')[1].orderSn, order);
  assert.equal(calls.find(c => c[0] === 'ship')[1].packageNumber, pkg);
  const transport = calls.find(c => c[0] === 'transport')[1];
  assert.equal(transport.method, 'POST');
  assert.equal(transport.redirect, 'error');
  assert.ok(transport.signal instanceof AbortSignal);
});

for (const proof of [
  { ok: false },
  { ok: true, order_sn: 'OTHER', package_number: pkg, shop_id: shop, modes: ['dropoff'], simple_dropoff_confirmed: true },
  { ok: true, order_sn: order, package_number: null, shop_id: shop, modes: ['dropoff'], simple_dropoff_confirmed: true },
  { ok: true, order_sn: order, package_number: pkg, shop_id: shop, modes: ['pickup'], simple_dropoff_confirmed: true },
  { ok: true, order_sn: order, package_number: pkg, shop_id: shop, modes: ['dropoff', 'pickup'], simple_dropoff_confirmed: true },
  { ok: true, order_sn: order, package_number: pkg, shop_id: shop, modes: ['dropoff'], simple_dropoff_confirmed: false },
]) {
  test('invalid preflight blocks all Core claims and Shopee writes: ' + JSON.stringify(proof), async () => {
    const { calls, run } = fixture({ preflight: async () => {
      calls.push('preflight'); return proof;
    } });
    assert.equal((await run()).code, 'preflight_not_eligible');
    assert.deepEqual(calls, ['preflight']);
  });
}

test('OAuth partner mismatch refuses BEFORE Core claim', async () => {
  const { calls, run } = fixture({ readConnection: async () => ({
    ok: true, payload: { partner_id: 999, shop_id: shop },
  }) });
  assert.equal((await run()).code, 'connection_identity_mismatch');
  assert.equal(calls.some(c => c?.[0] === 'claim'), false);
});

test('expired OAuth access token refuses; no automatic refresh', async () => {
  const { calls, run } = fixture({
    readConnection: async () => ({
      ok: true, payload: { partner_id: 2047685, shop_id: shop,
        access_token_expires_at: '2026-10-15T17:00:00Z' },
    }),
    decryptToken: async () => { throw new Error('must not decrypt'); },
  });
  assert.equal((await run()).code, 'access_token_expired_no_refresh');
  assert.equal(calls.some(c => c?.[0] === 'ship'), false);
});

for (const blockedStatus of [
  'already_claimed', 'already_succeeded', 'uncertain_requires_reconciliation',
  'claim_fingerprint_mismatch',
]) {
  test('existing claim ' + blockedStatus + ' cannot ship again', async () => {
    const { calls, run } = fixture({ claim: async data => {
      calls.push(['claim', data]);
      return { ok: false, payload: { status: 'blocked', code: blockedStatus } };
    } });
    assert.equal((await run()).code, blockedStatus);
    assert.equal(calls.some(c => c?.[0] === 'ship'), false);
    assert.equal(calls.some(c => c?.[0] === 'resolve'), false);
  });
}

test('claim Core timeout after insert never causes Shopee POST', async () => {
  const { calls, run } = fixture({ claim: async () => {
    calls.push('claim_timeout');
    return { ok: false, status: 503 };
  } });
  assert.equal((await run()).code, 'shipping_claim_not_acquired');
  assert.equal(calls.some(c => c?.[0] === 'ship'), false);
});

test('transport timeout marks attempt uncertain, does not retry', async () => {
  const { calls, run } = fixture({
    ship: async () => { calls.push(['ship']); throw Error('timeout'); },
  });
  assert.equal((await run()).code, 'ship_order_uncertain_requires_reconciliation');
  assert.equal(calls.filter(c => c?.[0] === 'ship').length, 1);
  assert.equal(calls.find(c => c?.[0] === 'resolve')[1].outcome, 'uncertain');
});

test('Shopee error response stays uncertain, not a success', async () => {
  const { calls, run } = fixture({
    ship: async () => {
      calls.push(['ship']);
      return { response: { ok: true, status: 200 }, payload: { error: 'logistics.lack_of_invoice_data', response: {} } };
    },
  });
  assert.equal((await run()).code, 'ship_order_uncertain_requires_reconciliation');
  assert.equal(calls.find(c => c?.[0] === 'resolve')[1].outcome, 'uncertain');
});

test('missing Core resolution after Shopee confirmation never reports success', async () => {
  const { calls, run } = fixture({ resolve: async () => {
    calls.push('resolve_timeout');
    return { ok: false, status: 503 };
  } });
  assert.deepEqual(await run(), { ok: false, code: 'sent_but_core_confirmation_missing' });
  assert.equal(calls.filter(c => c?.[0] === 'ship').length, 1);
});

test('untrusted redirect host is blocked and outcome remains uncertain', async () => {
  const { calls, run } = fixture({
    ship: async ({ fetchImpl }) => {
      calls.push(['ship']);
      await fetchImpl('https://attacker.example.invalid/capture', { method: 'POST' });
      throw Error('should not succeed');
    },
  });
  assert.equal((await run()).code, 'ship_order_uncertain_requires_reconciliation');
  assert.equal(calls.some(c => c?.[0] === 'transport'), false);
});

test('HTTP route is protected by disabled gates by default', async () => {
  const response = await handleRequest({
    method: 'POST', path: '/internal/shopee/live/logistics/shipping/ship-once', query: {},
  }, { handleShopeeLive: async () => null });
  assert.equal(response.status, 503);
});


test('pilot window missing or expired cannot touch preflight or Core', async () => {
  for(const expire of [undefined,'2026-10-15T17:59:00Z','2026-10-15T18:00:30Z',
    '2026-10-15T18:31:00Z','not-date']) {
    const env={...activeEnv,SHOPEE_LIVE_SHIP_ORDER_WINDOW_EXPIRES_AT:expire};
    const {calls,run}=fixture({env});
    assert.equal((await run()).code,expire===undefined?'ship_order_pilot_not_configured':'ship_order_window_inactive');
    assert.deepEqual(calls,[]);
  }
});

test('pilot configured order, account or profile mismatch stops before preflight', async () => {
  const changes=[
    {SHOPEE_LIVE_SHIP_ORDER_PILOT_ORDER_SN:'OTHERORDER123'},
    {SHOPEE_LIVE_SHIP_ORDER_PILOT_ACCOUNT_ID:'00000000-0000-4000-8000-000000000001'},
    {SHOPEE_LIVE_SHIP_ORDER_PILOT_FISCAL_MODE:'cpf_no_invoice_step'},
  ];
  for(const update of changes) {
    const {calls,run}=fixture({env:{...activeEnv,...update}});
    assert.equal((await run()).code,'ship_order_pilot_scope_mismatch');
    assert.deepEqual(calls,[]);
  }
});

test('pilot package or shop mismatch is detected by fresh preflight before claim', async () => {
  for (const update of [
    { SHOPEE_LIVE_SHIP_ORDER_PILOT_PACKAGE_NUMBER: 'OTHERPKG' },
    { SHOPEE_LIVE_SHIP_ORDER_PILOT_SHOP_ID: '1234' },
  ]) {
    const { calls, run } = fixture({ env: { ...activeEnv, ...update } });
    assert.equal((await run()).code, 'preflight_not_eligible');
    assert.deepEqual(calls, ['preflight']);
  }
});

test('invalid calendar date cannot create an authorization window by Date.parse rollover', async () => {
  const { calls, run } = fixture({
    now: () => Date.parse('2026-03-02T18:00:00Z'),
    env: { ...activeEnv, SHOPEE_LIVE_SHIP_ORDER_WINDOW_EXPIRES_AT: '2026-02-30T18:15:00Z' },
  });
  assert.equal((await run()).code, 'ship_order_window_inactive');
  assert.deepEqual(calls, []);
});

test('window expiring during request preparation blocks the actual transport', async () => {
  let clock = Date.parse('2026-10-15T18:00:00Z');
  const { calls, run } = fixture({
    now: () => clock,
    ship: async ({ fetchImpl }) => {
      calls.push(['ship']);
      clock = Date.parse('2026-10-15T18:16:00Z');
      await fetchImpl('https://partner.shopeemobile.com/api/v2/logistics/ship_order', { method: 'POST' });
      return { response: { ok: true, status: 200 }, payload: { error: '', response: {} } };
    },
  });
  assert.equal((await run()).code, 'ship_order_uncertain_requires_reconciliation');
  assert.equal(calls.some(x => x?.[0] === 'transport'), false);
  assert.equal(calls.find(x => x?.[0] === 'resolve')[1].outcome, 'uncertain');
});

for (const [expiry, eligible] of [
  ['2026-10-15T18:30:00Z', true],
  ['2026-10-15T18:30:00.001Z', false],
  ['2026-10-15T18:01:00Z', false],
  ['2026-10-15T15:15:00-03:00', false],
  ['2026-10-15T18:15:00', false],
]) {
  test('UTC window boundary: ' + expiry, async () => {
    const { calls, run } = fixture({ env: { ...activeEnv, SHOPEE_LIVE_SHIP_ORDER_WINDOW_EXPIRES_AT: expiry } });
    const result = await run();
    assert.equal(result.ok, eligible);
    if (!eligible) assert.deepEqual(calls, []);
  });
}

test('real HMAC Core wrappers and signed Shopee primitive preserve claim-before-ship order', async () => {
  const events = [];
  const coreOptions = {
    url: CORE_BRIDGE_URL, secret: 'synthetic-core-key', logger: () => {},
    fetchImpl: async (_url, options) => {
      const h = options.headers;
      const hash = createHash('sha256').update(options.body).digest('hex');
      const canonical = `v1\n${h['X-Integration-Hub-Timestamp']}\n${h['X-Integration-Hub-Request-Id']}\n${hash}`;
      assert.equal(h['X-Integration-Hub-Signature'], createHmac('sha256', 'synthetic-core-key').update(canonical).digest('hex'));
      const payload = JSON.parse(options.body);
      const claiming = payload.action.endsWith('.claim');
      events.push(claiming ? 'claim' : 'resolve');
      const body = claiming
        ? { status: 'claimed', fresh: true, attempt_id: '123e4567-e89b-42d3-a456-426614174000' }
        : { status: 'resolved', state: payload.outcome };
      return new Response(JSON.stringify({ ...body, request_id: h['X-Integration-Hub-Request-Id'] }), { headers: { 'content-type': 'application/json' } });
    },
  };
  const { run } = fixture({
    preflight: async () => { events.push('preflight'); return {
      ok: true, order_sn: order, package_number: pkg, shop_id: shop,
      order_status: 'READY_TO_SHIP', package_logistics_status: 'LOGISTICS_READY',
      fiscal: 'fiscal_valid', modes: ['dropoff'], simple_dropoff_confirmed: true,
    }; },
    claim: data => claimShopeeShippingArrangement(data, coreOptions),
    resolve: data => resolveShopeeShippingArrangement(data, coreOptions),
    ship: shipOrderSimpleDropoff,
    fetchImpl: async (url, options) => {
      events.push('ship_order');
      assert.equal(options.method, 'POST');
      assert.deepEqual(JSON.parse(options.body), { order_sn: order, package_number: pkg, dropoff: {} });
      const parsed = new URL(url);
      const canonical = '2047685/api/v2/logistics/ship_order' + parsed.searchParams.get('timestamp') + 'synthetic-access-token' + shop;
      assert.equal(parsed.searchParams.get('sign'), createHmac('sha256', 'fake-key').update(canonical).digest('hex'));
      return new Response(JSON.stringify({ error: '', response: {} }));
    },
  });
  assert.equal((await run()).ok, true);
  assert.deepEqual(events, ['preflight', 'claim', 'ship_order', 'resolve']);
});

test('100 concurrent invocations and lost resolution cannot cause a second dispatch', async () => {
  let reserved = false, dispatches = 0;
  const { run } = fixture({
    claim: async () => {
      if (reserved) return { ok: false, payload: { code: 'already_claimed' } };
      reserved = true;
      return { ok: true, payload: { status: 'claimed', fresh: true, attempt_id: '123e4567-e89b-42d3-a456-426614174000' } };
    },
    ship: async () => { dispatches++; throw Error('timeout without known outcome'); },
    resolve: async () => { throw Error('confirmation lost'); },
  });
  const results = await Promise.all(Array.from({ length: 100 }, () => run()));
  assert.equal(dispatches, 1);
  assert.equal(results.filter(r => r.code === 'sent_but_core_confirmation_missing').length, 1);
  assert.equal((await run()).code, 'already_claimed');
  assert.equal(dispatches, 1);
});

test('logistics pickup retry may pass read-only preflight but cannot execute first-time ship_order', async () => {
  const {calls,run}=fixture({preflight: async()=>{
    calls.push('preflight');
    return {ok:true,order_sn:order,package_number:pkg,shop_id:shop,
      order_status:'READY_TO_SHIP',package_logistics_status:'LOGISTICS_PICKUP_RETRY',
      fiscal:'fiscal_valid',modes:['dropoff'],simple_dropoff_confirmed:true};
  }});
  assert.equal((await run()).code,'preflight_not_eligible');
  assert.deepEqual(calls,['preflight']);
});

test('pilot cannot claim if preflight proves different package, shop or fiscal status', async () => {
  const original={ok:true,order_sn:order,package_number:pkg,shop_id:shop,
    order_status:'READY_TO_SHIP',package_logistics_status:'LOGISTICS_READY',
    fiscal:'fiscal_valid',modes:['dropoff'],simple_dropoff_confirmed:true};
  for(const change of [
    {package_number:'OTHERPKG'},{shop_id:321},{fiscal:'invoice_pending_in_seller_center'},
    {order_status:'SHIPPED'}, {package_logistics_status:undefined},
  ]) {
    const {calls,run}=fixture({preflight:async()=>{calls.push('preflight');return {...original,...change};}});
    assert.equal((await run()).code,'preflight_not_eligible');
    assert.deepEqual(calls,['preflight']);
  }
});

test('CPF profile is allowed only on explicitly scoped CPF pilot with corresponding fiscal proof', async () => {
  const env={...activeEnv,
    SHOPEE_LIVE_SHIPPING_FISCAL_MODE:'cpf_no_invoice_step',
    SHOPEE_LIVE_SHIP_ORDER_PILOT_FISCAL_MODE:'cpf_no_invoice_step',
  };
  const {run}=fixture({env,preflight:async()=>({
    ok:true,order_sn:order,package_number:pkg,shop_id:shop,
    order_status:'READY_TO_SHIP',package_logistics_status:'LOGISTICS_READY',
    fiscal:'cpf_flow_fiscal_check_passed',modes:['dropoff'],simple_dropoff_confirmed:true,
  })});
  assert.equal((await run()).code,'ship_order_api_acknowledged_not_collected');
});

test('window expiring during slow read-only preflight stops before any durable claim', async () => {
  let clock=Date.parse('2026-10-15T18:00:00Z');
  const {calls,run}=fixture({
    now:()=>clock,
    preflight:async()=>{
      calls.push('preflight');
      clock=Date.parse('2026-10-15T18:14:45Z');
      return {ok:true,order_sn:order,package_number:pkg,shop_id:shop,
        order_status:'READY_TO_SHIP',package_logistics_status:'LOGISTICS_READY',
        fiscal:'fiscal_valid',modes:['dropoff'],simple_dropoff_confirmed:true};
    },
  });
  assert.equal((await run()).code,'ship_order_window_inactive');
  assert.equal(calls.some(x=>x?.[0]==='claim'),false);
  assert.equal(calls.some(x=>x?.[0]==='ship'),false);
});


test('window expiration after durable claim refuses shipping and leaves a locked uncertain attempt', async () => {
  let clock=Date.parse('2026-10-15T18:00:00Z');
  const {calls,run}=fixture({
    now:()=>clock,
    claim:async data=>{
      calls.push(['claim',data]);
      clock=Date.parse('2026-10-15T18:16:00Z');
      return {ok:true,payload:{
        status:'claimed',fresh:true,attempt_id:'123e4567-e89b-42d3-a456-426614174000',
      }};
    },
  });
  assert.equal((await run()).code,'ship_order_uncertain_requires_reconciliation');
  assert.equal(calls.filter(x=>x?.[0]==='claim').length,1);
  assert.equal(calls.some(x=>x?.[0]==='ship'),false);
  assert.equal(calls.find(x=>x?.[0]==='resolve')?.[1].outcome,'uncertain');
});

test('official ship_order success without response object is acknowledged exactly once', async () => {
  const events = [];
  let dispatches = 0;
  const { calls, run } = fixture({
    logDiagnostic: entry => events.push(entry),
    ship: async ({ fetchImpl }) => {
      dispatches += 1;
      await fetchImpl('https://partner.shopeemobile.com/api/v2/logistics/ship_order', {
        method: 'POST', body: '{}',
      });
      return { response: { ok: true, status: 200 }, payload: {
        error: '', message: '', request_id: 'test-request-id',
      } };
    },
  });
  const result = await run();
  assert.equal(result.code, 'ship_order_api_acknowledged_not_collected');
  assert.equal(dispatches, 1);
  assert.equal(calls.find(entry => entry?.[0] === 'resolve')[1].outcome, 'succeeded');
  assert.deepEqual(events.map(entry => entry.phase),
    ['preparation', 'fetch_invoked', 'headers_received', 'body_read']);
  const last = events.at(-1);
  assert.equal(last.category, 'api_acknowledged');
  assert.equal(last.external_http_status, 200);
  assert.equal(last.attempt_id, '123e4567-e89b-42d3-a456-426614174000');
  for (const entry of events) {
    assert.deepEqual(Object.keys(entry).sort(), [
      'attempt_id', 'category', 'duration_ms', 'event', 'exception_name',
      'external_http_status', 'phase', 'shopee_error_code',
    ].sort());
    assert.equal(entry.event, 'shopee_ship_order_diagnostic');
    assert.equal(JSON.stringify(entry).includes('test-request-id'), false);
    assert.equal(JSON.stringify(entry).includes('synthetic-access-token'), false);
    assert.equal(JSON.stringify(entry).includes('partner.shopeemobile.com'), false);
  }
});

for (const [caseName, simulated, expectedCategory, safeError] of [
  ['HTTP 403', { response: { ok: false, status: 403 },
    payload: { error: 'error_permission' } }, 'http_rejected', 'error_permission'],
  ['official API error on HTTP 200', { response: { ok: true, status: 200 },
    payload: { error: 'logistics.ship_order_need_branch_id', message: 'SECRET SHIPPING DETAIL' } },
    'shopee_error', 'logistics.ship_order_need_branch_id'],
  ['invalid JSON', { response: { ok: true, status: 200 },
    payload: { error: 'invalid_json', message: 'PRIVATE RESPONSE BODY' } }, 'invalid_json', null],
  ['missing error', { response: { ok: true, status: 200 },
    payload: { message: 'PRIVATE RESPONSE BODY', request_id: 'secret' } }, 'unexpected_response', null],
  ['null response object', { response: { ok: true, status: 200 },
    payload: { error: '', response: null } }, 'unexpected_response', null],
  ['unrecognized error', { response: { ok: true, status: 200 },
    payload: { error: 'private_dynamic_secret_or_new_code', message: 'PRIVATE' } },
    'shopee_error', null],
  ['non-empty whitespace error', { response: { ok: true, status: 200 },
    payload: { error: '  ' } }, 'shopee_error', null],
  ['HTTP 200 with missing HTTP status', { response: { ok: true },
    payload: { error: '' } }, 'http_rejected', null],
]) {
  test('uncertain response classified without retry or data leakage: ' + caseName, async () => {
    const events = [];
    let dispatches = 0;
    const { calls, run } = fixture({
      logDiagnostic: entry => events.push(entry),
      ship: async () => { dispatches++; return simulated; },
    });
    assert.equal((await run()).code, 'ship_order_uncertain_requires_reconciliation');
    assert.equal(dispatches, 1);
    assert.equal(calls.find(entry => entry?.[0] === 'resolve')[1].outcome, 'uncertain');
    const last = events.at(-1);
    assert.equal(last.phase, 'body_read');
    assert.equal(last.category, expectedCategory);
    assert.equal(last.shopee_error_code, safeError);
    const payloadText = JSON.stringify(events);
    for (const privateText of ['PRIVATE', 'secret_or_new_code', 'secret', 'test-access-token']) {
      assert.equal(payloadText.includes(privateText), false);
    }
  });
}

test('transport diagnostic distinguishes fetch invoked from confirmed headers without leaking error text', async () => {
  const events = [];
  let dispatches = 0;
  const { calls, run } = fixture({
    logDiagnostic: entry => events.push(entry),
    ship: async ({ fetchImpl }) => {
      dispatches++;
      await fetchImpl('https://partner.shopeemobile.com/api/v2/logistics/ship_order', { method: 'POST' });
    },
    fetchImpl: async () => { throw new TypeError('PRIVATE BODY OR SIGNED URL'); },
  });
  assert.equal((await run()).code, 'ship_order_uncertain_requires_reconciliation');
  assert.equal(dispatches, 1);
  assert.deepEqual(events.map(e => e.phase), ['preparation', 'fetch_invoked', 'exception']);
  assert.equal(events.at(-1).category, 'transport_exception');
  assert.equal(events.at(-1).exception_name, 'TypeError');
  assert.equal(JSON.stringify(events).includes('PRIVATE BODY'), false);
  assert.equal(calls.find(entry => entry?.[0] === 'resolve')[1].outcome, 'uncertain');
});

test('diagnostic logger failure does not block one-shot shipping or change ledger outcome', async () => {
  let called = 0;
  const { calls, run } = fixture({
    logDiagnostic: () => { throw new Error('LOGGER FAILS'); },
    ship: async () => { called++; return {
      response: { ok: true, status: 200 },
      payload: { error: '', message: '' },
    }; },
  });
  assert.equal((await run()).code, 'ship_order_api_acknowledged_not_collected');
  assert.equal(called, 1);
  assert.equal(calls.find(entry => entry?.[0] === 'resolve')[1].outcome, 'succeeded');
});

test('pre-transport failure retains uncertain claim and proves no external fetch occurred', async () => {
  const events = [];
  let networkCalls = 0;
  const { calls, run } = fixture({
    logDiagnostic: entry => events.push(entry),
    ship: async () => { throw new Error('LOCAL SIGNING PRIVATE DATA'); },
    fetchImpl: async () => { networkCalls++; return new Response('{}'); },
  });
  assert.equal((await run()).code, 'ship_order_uncertain_requires_reconciliation');
  assert.equal(networkCalls, 0);
  assert.deepEqual(events.map(entry => entry.phase), ['preparation', 'exception']);
  assert.equal(events.at(-1).category, 'pre_transport_exception');
  assert.equal(calls.find(entry => entry?.[0] === 'resolve')[1].outcome, 'uncertain');
});
