import { createGuardedShopeeShipOrder } from './shopee-ship-order-guard.mjs';
import { createShopeeShippingPreflight } from './shopee-shipping-preflight.mjs';
import { readLiveShopeeOauthConnection } from './core-bridge.mjs';

// The live Adão scheduler reuses exactly the existing Core-claimed one-shot
// simple-dropoff shipping operation, never the legacy single-pilot environment.
// No new scheduler, no ship_order on old/finalized orders, no Viviane traffic.
export const ADAO_AUTO_SHIP_ACCOUNT_ID = 'b4027369-5abf-4ac1-ab24-862334fae892';
export const ADAO_AUTO_SHIP_SHOP_ID = 1156446003;

// Administrative test cleanup completed 2026-11-11. No order created before
// this boundary can be picked up by an automatic shipping writer.
export const ADAO_AUTO_SHIP_HISTORY_CUTOFF = Date.parse('2026-11-11T13:22:00Z') / 1000;

export function isAdaoNewShippingCandidate({ order_sn, create_time } = {}) {
  return typeof order_sn === 'string' && /^[A-Za-z0-9]{8,100}$/.test(order_sn)
    && Number.isSafeInteger(create_time)
    && create_time > ADAO_AUTO_SHIP_HISTORY_CUTOFF;
}

export function createAdaoAutomaticShip({
  getEnv = key => process.env[key],
  makePreflight = createShopeeShippingPreflight,
  makeShip = createGuardedShopeeShipOrder,
} = {}) {
  return async function arrangeNewAdaoOrder(orderSn) {
    if (getEnv('SHOPEE_ADAO_AUTO_SHIP_ENABLED') !== 'true') {
      return { ok: false, code: 'adao_auto_ship_disabled' };
    }
    if (typeof orderSn !== 'string' || !/^[A-Za-z0-9]{8,100}$/.test(orderSn)) {
      return { ok: false, code: 'invalid_order_identity' };
    }
    const scopedEnv = key => {
      if (key === 'SHOPEE_LIVE_CHANNEL_ACCOUNT_ID') return ADAO_AUTO_SHIP_ACCOUNT_ID;
      if (key === 'SHOPEE_LIVE_SHIPPING_PREFLIGHT_ORDER_SN') return orderSn;
      if (key === 'SHOPEE_LIVE_SHIPPING_FISCAL_MODE') return 'cpf_no_invoice_step';
      if (key === 'SHOPEE_LIVE_SHIP_ORDER_ENABLED') return 'true';
      return getEnv(key);
    };
    // Adão Core OAuth reads have demonstrated latency beyond the shared 5s
    // budget. Keep this adjustment private to the Adão scheduler.
    const readConnection = data => readLiveShopeeOauthConnection(data, { timeoutMs: 12_000 });
    const preflight = makePreflight({ getEnv: scopedEnv, readConnection });
    const ship = makeShip({
      getEnv: scopedEnv,
      preflight,
      readConnection,
      automaticScope: {
        orderSn, channelAccountId: ADAO_AUTO_SHIP_ACCOUNT_ID,
        shopId: ADAO_AUTO_SHIP_SHOP_ID, fiscalMode: 'cpf_no_invoice_step',
      },
    });
    const result = await ship();
    // This code never claims physical dispatch or an actual stock event.
    return result?.ok === true && result.code === 'ship_order_api_acknowledged_not_collected'
      ? { ok: true, code: 'ship_order_api_acknowledged_not_collected' }
      : { ok: false, code: typeof result?.code === 'string'
          && /^[a-z][a-z0-9_]{0,79}$/.test(result.code)
        ? result.code : 'ship_order_unavailable' };
  };
}

export const arrangeAdaoNewOrderOnce = createAdaoAutomaticShip();
