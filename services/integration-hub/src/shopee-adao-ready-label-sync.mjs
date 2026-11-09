import { createShopeeLabelSynchronizer } from './shopee-live-label.mjs';
import { readLiveShopeeOauthConnection, readShopeeLogisticsTombstones } from './core-bridge.mjs';
import { ADAO_CHANNEL_ACCOUNT_ID } from './shopee-adao-easter-commit-guard.mjs';

// Real-use Adão label synchronization for individual Shopee orders.
// No create_shipping_document, ship_order, arrangement, stock or separation changes.
// Core verifies the order/account identity before storing the official PDF.
const ORDER_RE = /^[A-Za-z0-9]{8,100}$/;
const SHOP = 1156446003;
const PARTNER = 2047685;
const TOKEN_READ_TIMEOUT_MS = 12_000;
const safeCode = value => typeof value === 'string' && /^[a-z][a-z0-9_]{0,79}$/.test(value)
  ? value : 'unknown';

export function createAdaoReadyLabelSync({
  getEnv = key => process.env[key],
  readConnection = readLiveShopeeOauthConnection,
  readTombstones = readShopeeLogisticsTombstones,
  makeSync = createShopeeLabelSynchronizer,
} = {}) {
  return async function syncAdaoReadyLabel(orderSn) {
    if (getEnv('SHOPEE_ADAO_LABEL_SYNC_ENABLED') !== 'true') {
      return { ok: false, code: 'adao_label_sync_disabled' };
    }
    if (typeof orderSn !== 'string' || !ORDER_RE.test(orderSn)) {
      return { ok: false, code: 'invalid_order_identity' };
    }
    if (Number(getEnv('SHOPEE_LIVE_PARTNER_ID')) !== PARTNER) {
      return { ok: false, code: 'partner_identity_mismatch' };
    }
    const tombstones = await readTombstones({
      channel_account_id: ADAO_CHANNEL_ACCOUNT_ID,
      order_sns: [orderSn],
    });
    if (!tombstones?.ok || !Array.isArray(tombstones.payload?.deleted_order_sns)) {
      return { ok: false, code: 'tombstone_unavailable' };
    }
    if (tombstones.payload.deleted_order_sns.includes(orderSn)) {
      return { ok: false, code: 'order_deleted' };
    }
    const scopedEnv = key => {
      if (key === 'SHOPEE_LIVE_CHANNEL_ACCOUNT_ID') return ADAO_CHANNEL_ACCOUNT_ID;
      if (key === 'SHOPEE_LIVE_LABEL_ORDER_SN') return orderSn;
      if (key === 'SHOPEE_LIVE_LABEL_SHOP_ID') return String(SHOP);
      // Do not inherit Viviane's fixed pilot package number. Adão's exact
      // package identity is independently read from Shopee order detail,
      // checked for singularity and matched in each document response.
      if (key === 'SHOPEE_LIVE_LABEL_PACKAGE_NUMBER') return undefined;
      return getEnv(key);
    };
    const synchronizer = makeSync({
      getEnv: scopedEnv,
      readConnection: data => readConnection(data, { timeoutMs: TOKEN_READ_TIMEOUT_MS }),
    });
    const result = await synchronizer();
    if (!result?.ok) {
      const code = safeCode(result?.code);
      return {
        ok: false, code,
        ...(code === 'document_status_rejected' ? {
          diagnostic: {
            upstream_http_status: result?.diagnostic?.upstream_http_status ?? null,
            upstream_error_code: safeCode(result?.diagnostic?.upstream_error_code),
          },
        } : {}),
      };
    }
    if (!['label_attached', 'already_available'].includes(result.code)) {
      return { ok: false, code: 'unexpected_label_result' };
    }
    return { ok: true, code: result.code,
      document_id: typeof result.document_id === 'string' ? result.document_id : null };
  };
}

export const syncAdaoReadyLabelOnce = createAdaoReadyLabelSync();
