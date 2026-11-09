import { createShopeeMinimumCycle } from './shopee-minimum-cycle.mjs';
import { ADAO_CYCLE_ACCOUNT } from './shopee-cycle-scope.mjs';
import { createAdaoReadyLabelSync } from './shopee-adao-ready-label-sync.mjs';
import { createAdaoScopedIntake, createAdaoOauthConnectionReader } from './shopee-adao-automatic-intake.mjs';
import { createShopeeLiveOrdersReader } from './shopee-live-orders.mjs';

// Same existing cycle, Core lease and checkpoint as Viviane. Not a worker or
// scheduler. Disabled by default until the standalone Adão intake is retired.
export function createAdaoCycle({
  getEnv = k => process.env[k], runCycle = createShopeeMinimumCycle,
  intake = createAdaoScopedIntake(), syncLabel = createAdaoReadyLabelSync({ getEnv }),
  readOrders = null,
} = {}) {
  return async function runAdaoCycle() {
    if (getEnv('SHOPEE_ADAO_CYCLE_ENABLED') !== 'true') {
      return { ok: false, code: 'adao_cycle_not_enabled' };
    }
    // The existing standalone importer is a competing writer for the same account.
    if (getEnv('SHOPEE_ADAO_AUTO_INTAKE_ENABLED') === 'true') {
      return { ok: false, code: 'adao_standalone_intake_active' };
    }
    if (getEnv('SHOPEE_ADAO_LABEL_SYNC_ENABLED') !== 'true') {
      return { ok: false, code: 'adao_label_sync_disabled' };
    }
    const overlay = key => {
      if (key === 'SHOPEE_LIVE_CHANNEL_ACCOUNT_ID') return ADAO_CYCLE_ACCOUNT.account;
      if (key === 'SHOPEE_LIVE_CYCLE_ENABLED'
          || key === 'SHOPEE_LIVE_AUTO_COMMIT_ENABLED'
          || key === 'SHOPEE_LIVE_LABEL_CREATE_ENABLED'
          || key === 'SHOPEE_LIVE_LABEL_SYNC_ENABLED') return 'true';
      return getEnv(key);
    };
    const reader = readOrders ?? createShopeeLiveOrdersReader({
      getEnv: overlay,
      expectedShopId: ADAO_CYCLE_ACCOUNT.shop,
      readConnection: createAdaoOauthConnectionReader(),
      allowRefresh: getEnv('SHOPEE_LIVE_OAUTH_REFRESH_ENABLED') === 'true',
    });
    return runCycle({
      accountScope: ADAO_CYCLE_ACCOUNT,
      getEnv: overlay,
      readOrders: reader,
      intake,
      labelForOrder: orderSn => syncLabel(orderSn),
    })();
  };
}

export const runAdaoCycle = createAdaoCycle();
