// Celivio C4-G: narrowly scoped pilot commit-one through the EXISTING Core writer.
// No new route, scheduler, OAuth action, inventory, logistics, OP or finance.
import { readLiveShopeeOrderIntakeBatch } from './core-bridge.mjs';
import { createShopeeControlledAutoIntake } from './shopee-order-auto-intake.mjs';
import { persistShopeeOrderContract } from './shopee-order-writer.mjs';
import { CELIVIO_C4C_ACCOUNT_ID } from './shopee-celivio-c4c-preflight.mjs';
import { createCelivioPreviewBatchReader } from './shopee-celivio-preview-read-budget.mjs';

import { CELIVIO_NEW_PILOT_ORDER_SN } from './shopee-celivio-c4e-raw-once.mjs';

export const CELIVIO_C4G_PILOT_ORDER_SN = '261121TBS6BHE6';
// C6: separately discovered and previewed order. Exact allowlist, no batch unlock.
export const CELIVIO_C6_ORDER_SN = '2611258Y00VM5U';
const CELIVIO_ALLOWED_COMMIT_ORDERS = new Set([
  CELIVIO_C4G_PILOT_ORDER_SN, CELIVIO_C6_ORDER_SN,
]);

export function createCelivioPilotCommitOne({
  readBatch = readLiveShopeeOrderIntakeBatch,
  persistOrder = persistShopeeOrderContract,
  getEnv = k => process.env[k],
} = {}) {
  const intake = createShopeeControlledAutoIntake({
    readBatch: createCelivioPreviewBatchReader(readBatch),
    persistOrder,
  });

  return ({ channelAccountId, expectedOrderSn, mode, limit } = {}) => {
    if (channelAccountId !== CELIVIO_C4C_ACCOUNT_ID
      || !(CELIVIO_ALLOWED_COMMIT_ORDERS.has(expectedOrderSn)
        || (expectedOrderSn === CELIVIO_NEW_PILOT_ORDER_SN
          && getEnv('SHOPEE_CELIVIO_NEW_PILOT_COMMIT_ENABLED') === 'true'
          && getEnv('SHOPEE_LIVE_CHANNEL_ACCOUNT_ID') === CELIVIO_C4C_ACCOUNT_ID
          && getEnv('SHOPEE_LIVE_COMMIT_ORDER_SN') === expectedOrderSn))
      || mode !== 'commit'
      || limit !== 5) {
      return {
        ok: false, code: 'celivio_c4g_scope_invalid',
        mode: 'commit', selected: 0, ready: 0, blocked: 0, written: 0, results: [],
      };
    }
    return intake({
      channelAccountId: CELIVIO_C4C_ACCOUNT_ID,
      expectedOrderSn,
      limit: 5,
      mode: 'commit',
      verifyExisting: true,
    });
  };
}

export const runCelivioPilotCommitOne = createCelivioPilotCommitOne();
