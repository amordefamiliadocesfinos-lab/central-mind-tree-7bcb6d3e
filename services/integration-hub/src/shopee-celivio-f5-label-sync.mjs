import { createShopeeLabelSynchronizer } from './shopee-live-label.mjs';
import { readLiveShopeeOauthConnection, readShopeeLogisticsTombstones } from './core-bridge.mjs';
import { createShopeeLiveLogisticsInspector } from './shopee-live-logistics.mjs';

// F5: One Celivio real-order proof using the PROVEN Adão synchronizer.
// This is an adapter, not a second label pipeline. Core's durable document
// claim/resolve and private PDF storage remain entirely in shopee-live-label.
const ACCOUNT = 'd26c7a30-aa4a-4441-8012-600d70453689';
const SHOP = 1357031949;
const PARTNER = 2047685;
const ORDER = '261121TBS6BHE6';
const PACKAGE = 'OFG248906009827069';
const CARRIER = 'Retirada pelo Comprador';
const PDF_TYPE = 'NORMAL_AIR_WAYBILL';
// Scoped to this Core tombstone lookup; never change the global 5 s timeout.
const TOMBSTONE_READ_TIMEOUT_MS = 12_000;

const safeCode = value => typeof value === 'string' && /^[a-z][a-z0-9_]{0,79}$/.test(value)
  ? value : 'unknown';

export function createCelivioPilotLabelSync({
  getEnv = name => process.env[name],
  readTombstones = readShopeeLogisticsTombstones,
  readConnection = readLiveShopeeOauthConnection,
  makeInspector = createShopeeLiveLogisticsInspector,
  makeSync = createShopeeLabelSynchronizer,
} = {}) {
  return async function syncCelivioPilotLabelOnce() {
    if (getEnv('SHOPEE_CELIVIO_F5_LABEL_SYNC_ENABLED') !== 'true') {
      return { ok: false, code: 'celivio_f5_label_sync_disabled' };
    }
    if (getEnv('SHOPEE_LIVE_CHANNEL_ACCOUNT_ID') !== ACCOUNT
      || String(getEnv('SHOPEE_LIVE_PARTNER_ID')) !== String(PARTNER)
      || getEnv('SHOPEE_LIVE_LOGISTICS_PROBE_ORDER_SN') !== ORDER) {
      return { ok: false, code: 'celivio_f5_scope_mismatch' };
    }

    const tombstones = await readTombstones({
      channel_account_id: ACCOUNT,
      order_sns: [ORDER],
    }, { timeoutMs: TOMBSTONE_READ_TIMEOUT_MS });
    if (!tombstones?.ok || !Array.isArray(tombstones.payload?.deleted_order_sns)) {
      return { ok: false, code: 'tombstone_unavailable' };
    }
    if (tombstones.payload.deleted_order_sns.includes(ORDER)) {
      return { ok: false, code: 'order_deleted' };
    }

    const readOnly = makeInspector({ getEnv });
    const inspection = await readOnly({ orderSn: ORDER });
    if (!inspection?.ok) return { ok: false, code: 'live_inspection_unavailable' };

    // The unusual "Retirada pelo Comprador" carrier was observed Live.
    // Do not arrange shipping or assert its fiscal/legal meaning. Only permit
    // document task preparation if the exact existing package is still
    // identified and the Shopee PDF format is explicitly selectable.
    const order = inspection.order ?? {};
    const doc = inspection.shipping_document_parameter;
    const selectable = doc?.results;
    if (order.order_sn !== ORDER
      || order.package_count !== 1
      || order.package_number !== PACKAGE
      || order.order_status !== 'PROCESSED'
      || order.package_logistics_status !== 'LOGISTICS_REQUEST_CREATED'
      || order.shipping_carrier !== CARRIER
      || order.invoice_status !== 'valid'
      || doc?.ok !== true
      || !Array.isArray(selectable) || selectable.length !== 1
      || selectable[0]?.order_sn !== ORDER
      || selectable[0]?.package_number !== PACKAGE
      || !selectable[0]?.selectable_shipping_document_type?.includes(PDF_TYPE)) {
      return { ok: false, code: 'celivio_f5_live_state_not_eligible' };
    }

    const scopedEnv = name => {
      if (name === 'SHOPEE_LIVE_CHANNEL_ACCOUNT_ID') return ACCOUNT;
      if (name === 'SHOPEE_LIVE_LABEL_ORDER_SN') return ORDER;
      if (name === 'SHOPEE_LIVE_LABEL_SHOP_ID') return String(SHOP);
      if (name === 'SHOPEE_LIVE_LABEL_PACKAGE_NUMBER') return PACKAGE;
      return getEnv(name);
    };
    const sync = makeSync({
      getEnv: scopedEnv,
      readConnection,
      prepareMissingDocument: true,
    });
    const result = await sync();
    if (!result?.ok) {
      const code = safeCode(result?.code);
      return {
        ok: false, code,
        ...(code === 'document_status_rejected' ? {
          diagnostic: {
            upstream_http_status: result?.diagnostic?.upstream_http_status ?? null,
            upstream_error_code:
              typeof result?.diagnostic?.upstream_error_code === 'string'
              && /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(result.diagnostic.upstream_error_code)
                ? result.diagnostic.upstream_error_code : 'unavailable',
          },
        } : {}),
      };
    }
    if (!['label_attached', 'already_available'].includes(result.code)) {
      return { ok: false, code: 'unexpected_label_result' };
    }
    return {
      ok: true, code: result.code,
      document_id: typeof result.document_id === 'string' ? result.document_id : null,
    };
  };
}

export const syncCelivioPilotLabelOnce = createCelivioPilotLabelSync();
