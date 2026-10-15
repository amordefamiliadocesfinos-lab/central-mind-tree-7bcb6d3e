import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
      return { response: { ok: true }, payload: { error: '', response: {} } };
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
      return { response: { ok: true }, payload: { error: 'logistics.lack_of_invoice_data', response: {} } };
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

test('no executable HTTP route or scheduler is exposed', async () => {
  const response = await handleRequest({
    method: 'POST', path: '/internal/shopee/live/logistics/shipping/ship-once', query: {},
  }, { handleShopeeLive: async () => null });
  assert.equal(response.status, 404);
});
