// Extracted without changing the existing intake projection or identity checks.
const LIVE = 'live';
const ORDER_DETAIL_ENDPOINT = '/api/v2/order/get_order_detail';

function sanitizeIntakeItem(item) {
  return {
    item_id: item.item_id ?? null,
    model_id: item.model_id ?? null,
    item_sku: item.item_sku ?? null,
    model_sku: item.model_sku ?? null,
    item_name: item.item_name ?? null,
    model_name: item.model_name ?? null,
    model_quantity_purchased: item.model_quantity_purchased ?? null,
    model_original_price: item.model_original_price ?? null,
    model_discounted_price: item.model_discounted_price ?? null,
    weight: item.weight ?? null,
  };
}

function sanitizeIntakeOrder(order) {
  const itemList = Array.isArray(order.item_list)
    ? order.item_list.filter((item) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item) => sanitizeIntakeItem(item))
    : [];

  return {
    order_sn: order.order_sn ?? null,
    order_status: order.order_status ?? null,
    create_time: order.create_time ?? null,
    update_time: order.update_time ?? null,
    pay_time: order.pay_time ?? null,
    ship_by_date: order.ship_by_date ?? null,
    currency: order.currency ?? null,
    total_amount: order.total_amount ?? null,
    payment_method: order.payment_method ?? null,
    // Shopee buyer note is required on the combined picking sheet.
    // Preserve the upstream field through Core's sanitized snapshot; the
    // normalizer and order writer already support it.
    message_to_seller: typeof order.message_to_seller === 'string'
      ? order.message_to_seller.slice(0, 4000) : null,
    shipping_carrier: order.shipping_carrier ?? null,
    item_list: itemList,
  };
}

export function sanitizeIntakeSnapshot(snapshot) {
  const payload = snapshot.payload && typeof snapshot.payload === 'object' && !Array.isArray(snapshot.payload)
    ? snapshot.payload
    : {};
  const response = payload.response && typeof payload.response === 'object' && !Array.isArray(payload.response)
    ? payload.response
    : {};
  const orders = Array.isArray(response.order_list)
    ? response.order_list.filter((order) => order && typeof order === 'object' && !Array.isArray(order))
      .map((order) => sanitizeIntakeOrder(order))
    : [];

  return {
    source: 'shopee_open_platform',
    environment: LIVE,
    channel_account_id: snapshot.channel_account_id,
    external_entity_type: 'order',
    external_entity_id: snapshot.external_entity_id,
    endpoint: ORDER_DETAIL_ENDPOINT,
    observed_at: snapshot.observed_at,
    created_at: snapshot.created_at,
    payload: {
      request_id: payload.request_id ?? null,
      response: { order_list: orders },
    },
  };
}

export async function canonicalShopeeChannelAccount(core, channelAccountId) {
  const { data, error } = await core
    .from('channel_accounts')
    .select('id,name,is_active,platform_id')
    .eq('id', channelAccountId)
    .maybeSingle();
  if (error) return { unavailable: true, account: null };
  if (!data?.id || data.is_active !== true) return { unavailable: false, account: null };

  const { data: platform, error: platformError } = await core
    .from('digital_platforms')
    .select('id,name,group_type,parent_id,is_active')
    .eq('id', data.platform_id)
    .maybeSingle();
  if (platformError) return { unavailable: true, account: null };

  const isShopee = platform?.is_active === true
    && platform?.group_type === 'marketplace'
    && platform?.parent_id == null
    && String(platform?.name ?? '').toLowerCase().startsWith('shopee');

  return {
    unavailable: false,
    account: isShopee ? { id: String(data.id), name: String(data.name) } : null,
  };
}

