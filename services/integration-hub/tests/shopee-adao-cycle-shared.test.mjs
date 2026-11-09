import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdaoCycle } from '../src/shopee-adao-cycle.mjs';
import { ADAO_CYCLE_ACCOUNT, SHOPEE_CYCLE_ACCOUNT, validCycleScope } from '../src/shopee-cycle-scope.mjs';
import { handleRequest } from '../src/app.mjs';
import { executeCycleAction } from '../../../supabase/functions/integration-core-bridge/cycle.mjs';

const config = {
  SHOPEE_ADAO_CYCLE_ENABLED: 'true',
  SHOPEE_ADAO_AUTO_INTAKE_ENABLED: 'false',
  SHOPEE_ADAO_LABEL_SYNC_ENABLED: 'true',
  SHOPEE_LIVE_PARTNER_ID: '2047685',
};
const getEnv = k => config[k];

test('F5-U2: Adão adapter stays disabled unless specifically activated', async () => {
  let calls = 0;
  const runner = createAdaoCycle({
    getEnv: () => undefined,
    runCycle: () => { calls++; throw Error('must not run'); },
  });
  assert.equal((await runner()).code, 'adao_cycle_not_enabled');
  assert.equal(calls, 0);
});

test('F5-U2: active standalone Adão importer prevents a competing cycle', async () => {
  let calls = 0;
  const runner = createAdaoCycle({
    getEnv: k => k === 'SHOPEE_ADAO_AUTO_INTAKE_ENABLED' ? 'true' : getEnv(k),
    runCycle: () => { calls++; throw Error('must not run'); },
  });
  assert.equal((await runner()).code, 'adao_standalone_intake_active');
  assert.equal(calls, 0);
});

test('F5-U2/U3: scoped Adão uses the existing lease runner and homologated label adapter', async () => {
  let opts;
  const orders = ['261108PVDNUPFH'];
  const seen = [];
  const runner = createAdaoCycle({
    getEnv,
    readOrders: async () => ({ ok: true, shop_id: ADAO_CYCLE_ACCOUNT.shop, order_sns: orders }),
    intake: async data => { seen.push(['intake', data]); return { ok: true }; },
    syncLabel: async orderSn => { seen.push(['label', orderSn]); return { ok: true, code: 'label_attached' }; },
    runCycle: params => {
      opts = params;
      return async () => {
        await params.intake({ channelAccountId: ADAO_CYCLE_ACCOUNT.account });
        await params.labelForOrder(orders[0]);
        return { ok: true, code: 'cycle_completed' };
      };
    },
  });
  assert.equal((await runner()).code, 'cycle_completed');
  assert.deepEqual(opts.accountScope, ADAO_CYCLE_ACCOUNT);
  assert.equal(opts.getEnv('SHOPEE_LIVE_CHANNEL_ACCOUNT_ID'), ADAO_CYCLE_ACCOUNT.account);
  assert.equal(opts.getEnv('SHOPEE_LIVE_CYCLE_ENABLED'), 'true');
  assert.equal(opts.getEnv('SHOPEE_LIVE_AUTO_COMMIT_ENABLED'), 'true');
  assert.equal(opts.getEnv('SHOPEE_LIVE_LABEL_CREATE_ENABLED'), 'true');
  assert.deepEqual(seen, [
    ['intake', { channelAccountId: ADAO_CYCLE_ACCOUNT.account }],
    ['label', orders[0]],
  ]);
  assert.equal(validCycleScope({ ...ADAO_CYCLE_ACCOUNT, order: orders[0], package: 'PKG001' }, ADAO_CYCLE_ACCOUNT), true);
  assert.equal(validCycleScope({ ...ADAO_CYCLE_ACCOUNT, order: orders[0], package: 'PKG001' }), false);
  assert.equal(validCycleScope({ ...SHOPEE_CYCLE_ACCOUNT, order: orders[0], package: 'PKG001' }), true);
});

test('F5-U2: private Adão cycle endpoint is default-off and refuses body/query', async () => {
  const request = { path: '/internal/shopee/adao/cycle/run', method: 'POST', headers: {}, query: {} };
  let called = 0;
  const deps = {
    handleShopeeLive: async () => null,
    runAdaoAccountCycle: async () => { called++; return { ok: true, code: 'cycle_discovered' }; },
    getEnv: () => undefined,
  };
  assert.equal((await handleRequest(request, deps)).status, 503);
  assert.equal(called, 0);
  for (const patch of [{ method: 'GET' }, { body: '{}' }, { query: { order: 'SYNTHETIC001' } }]) {
    assert.ok([400,405].includes((await handleRequest({ ...request, ...patch }, deps)).status));
  }
  const result = await handleRequest(request, { ...deps, getEnv: k => k === 'SHOPEE_ADAO_CYCLE_ENABLED' ? 'true' : undefined });
  assert.equal(result.status, 200);
  assert.equal(JSON.parse(result.body).account, 'adao');
  assert.equal(called, 1);
});

test('F5-U2: Core cycle refuses unrelated accounts before any DB operation', async () => {
  let calls = 0;
  const core = { rpc: async () => { calls++; throw Error('unexpected DB call'); } };
  const result = await executeCycleAction(core, {
    action: 'shopee.cycle.acquire', channel_account_id: '00000000-0000-0000-0000-000000000000',
  });
  assert.equal(result.status, 409);
  assert.equal(calls, 0);
});

test('F5-U2: Core acquires only account-selected lease for Adão', async () => {
  const calls = [];
  const core = { rpc: async (name, params) => {
    calls.push([name, params]);
    return { data: { status: 'acquired', candidate_order_sn: null }, error: null };
  } };
  const result = await executeCycleAction(core, {
    action: 'shopee.cycle.acquire', channel_account_id: ADAO_CYCLE_ACCOUNT.account,
  });
  assert.equal(result.status, 200);
  assert.deepEqual(calls, [['acquire_shopee_cycle', { p_channel_account_id: ADAO_CYCLE_ACCOUNT.account }]]);
});
