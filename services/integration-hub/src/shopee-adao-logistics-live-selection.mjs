import { readShopeeLogisticsTombstones } from './core-bridge.mjs';
import { selectAdaoLogisticsOrders, ADAO_LOGISTICS_ACCOUNT } from './shopee-adao-logistics-selection.mjs';

// Both dependencies are mandatory trusted read-only adapters. Do not fall back
// to an empty tombstone set if Core is unavailable.
export async function selectAdaoLiveLogistics({
  readDetails, readCanonicalTombstones, orderSns,
} = {}) {
  if (typeof readDetails !== 'function' || typeof readCanonicalTombstones !== 'function'
      || !Array.isArray(orderSns) || orderSns.length === 0 || orderSns.length > 20
      || new Set(orderSns).size !== orderSns.length) {
    return { ok:false, code:'invalid_read_scope', selected:[] };
  }
  try {
    const tombstones = await readCanonicalTombstones({
      channel_account_id: ADAO_LOGISTICS_ACCOUNT.channel_account_id,
      order_sns:orderSns,
    });
    if (!tombstones?.ok || !Array.isArray(tombstones.deleted_order_sns)
      || tombstones.deleted_order_sns.some(sn => typeof sn !== 'string' || !orderSns.includes(sn))) {
      return {ok:false,code:'tombstone_lookup_unavailable',selected:[]};
    }
    const deleted = new Set(tombstones.deleted_order_sns);
    const activeSns = orderSns.filter(sn => !deleted.has(sn));
    const detail = activeSns.length ? await readDetails({
      channel_account_id:ADAO_LOGISTICS_ACCOUNT.channel_account_id,
      shop_id:ADAO_LOGISTICS_ACCOUNT.shop_id,
      order_sns:activeSns,
    }) : {ok:true,orders:[]};
    if (!detail?.ok || !Array.isArray(detail.orders) || detail.orders.length !== activeSns.length
        || detail.orders.some(o => !activeSns.includes(o?.order_sn))) {
      return {ok:false,code:'order_detail_unavailable',selected:[]};
    }
    const deletedPlaceholders = orderSns.filter(sn=>deleted.has(sn)).map(order_sn=>({order_sn,deleted_at:'known'}));
    return selectAdaoLogisticsOrders({
      channelAccountId:ADAO_LOGISTICS_ACCOUNT.channel_account_id,
      shopId:ADAO_LOGISTICS_ACCOUNT.shop_id,
      orders:[...detail.orders,...deletedPlaceholders],
      deletedOrderSns:deleted,
    });
  } catch {
    return {ok:false,code:'read_only_selection_failed',selected:[]};
  }
}

export async function selectAdaoLiveWithCore({
  orderSns, readDetails, readTombstones = readShopeeLogisticsTombstones,
} = {}) {
  return selectAdaoLiveLogistics({
    orderSns, readDetails,
    readCanonicalTombstones: async ({ channel_account_id, order_sns }) => {
      const response = await readTombstones({ channel_account_id, order_sns });
      return {
        ok: response?.ok === true && response.payload?.status === 'ok',
        deleted_order_sns: response?.payload?.deleted_order_sns,
      };
    },
  });
}
