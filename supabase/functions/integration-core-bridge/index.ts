import { createClient } from 'npm:@supabase/supabase-js@2';
import { createBridgeHandler } from './handler.mjs';
import { executeCycleAction, verifyCycleOrder } from './cycle.mjs';
import { attachMappingPhysicalCatalog } from './mapping-physical-catalog.mjs';

const CORE_ORIGIN = 'https://xkskyutmtlhivvpfxkjg.supabase.co';
const LIVE = 'live';
const SHOP_INFO_ENDPOINT = '/api/v2/shop/get_shop_info';
const ORDER_LIST_ENDPOINT = '/api/v2/order/get_order_list';
const ORDER_DETAIL_ENDPOINT = '/api/v2/order/get_order_detail';

function coreClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || new URL(url).origin !== CORE_ORIGIN || !serviceRole) return null;
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

// deno-lint-ignore no-explicit-any
type CoreClient = any;

async function activeChannelAccount(core: CoreClient, channelAccountId: string) {
  const { data, error } = await core
    .from('channel_accounts')
    .select('id,is_active')
    .eq('id', channelAccountId)
    .maybeSingle();
  if (error) return { ok: false, unavailable: true };
  return { ok: data?.is_active === true, unavailable: false };
}


const INTAKE_ELIGIBLE_STATUSES = new Set(['PROCESSED', 'READY_TO_SHIP']);
const INTAKE_MAX_SCAN = 100;

function nullableString(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized === '' ? null : normalized;
}

function sanitizeIntakeItem(item: Record<string, unknown>) {
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

function sanitizeIntakeOrder(order: Record<string, unknown>) {
  const itemList = Array.isArray(order.item_list)
    ? order.item_list.filter((item) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item) => sanitizeIntakeItem(item as Record<string, unknown>))
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
    shipping_carrier: order.shipping_carrier ?? null,
    item_list: itemList,
  };
}

function sanitizeIntakeSnapshot(snapshot: Record<string, unknown>) {
  const payload = snapshot.payload && typeof snapshot.payload === 'object' && !Array.isArray(snapshot.payload)
    ? snapshot.payload as Record<string, unknown>
    : {};
  const response = payload.response && typeof payload.response === 'object' && !Array.isArray(payload.response)
    ? payload.response as Record<string, unknown>
    : {};
  const orders = Array.isArray(response.order_list)
    ? response.order_list.filter((order) => order && typeof order === 'object' && !Array.isArray(order))
      .map((order) => sanitizeIntakeOrder(order as Record<string, unknown>))
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

async function canonicalShopeeChannelAccount(core: CoreClient, channelAccountId: string) {
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

async function readShopeeIntakeBatch(core: CoreClient, channelAccountId: string, limit: number, orderSnTarget: string | null = null) {
  const canonical = await canonicalShopeeChannelAccount(core, channelAccountId);
  if (canonical.unavailable) return { status: 503, body: { error: 'core_unavailable' } };
  if (!canonical.account) return { status: 409, body: { error: 'channel_account_unavailable' } };

  const scanLimit = Math.min(INTAKE_MAX_SCAN, Math.max(limit * 10, 20));
  let rawQuery = core
    .from('marketplace_raw_snapshots')
    .select('channel_account_id,external_entity_id,observed_at,created_at,payload')
    .eq('source', 'shopee_open_platform')
    .eq('environment', LIVE)
    .eq('channel_account_id', channelAccountId)
    .eq('external_entity_type', 'order')
    .eq('endpoint', ORDER_DETAIL_ENDPOINT)
    .order('created_at', { ascending: false })
    .limit(scanLimit);
  if (orderSnTarget) rawQuery = rawQuery.eq('external_entity_id', orderSnTarget);
  const { data: rawRows, error: rawError } = await rawQuery;

  if (rawError) return { status: 503, body: { error: 'intake_raw_read_failed' } };

  const latestByOrder = new Map<string, Record<string, unknown>>();
  for (const row of rawRows ?? []) {
    const orderSn = nullableString(row.external_entity_id);
    if (orderSn && !latestByOrder.has(orderSn)) latestByOrder.set(orderSn, row);
  }

  const orderNumbers = [...latestByOrder.keys()];
  let existingOrders = new Set<string>();
  if (orderNumbers.length > 0) {
    const { data: existing, error: existingError } = await core
      .from('orders')
      .select('order_number')
      .eq('channel', 'shopee')
      .eq('channel_account_id', channelAccountId)
      // Include soft-deleted orders: they must never reenter separation automatically.
      .in('order_number', orderNumbers);
    if (existingError) return { status: 503, body: { error: 'intake_existing_order_read_failed' } };
    existingOrders = new Set((existing ?? []).map((row: { order_number: string | null }) => String(row.order_number)));
  }

  const snapshots: Record<string, unknown>[] = [];
  let skippedExisting = 0;
  let skippedStatus = 0;
  let skippedMalformed = 0;

  for (const [orderSn, row] of latestByOrder) {
    if (existingOrders.has(orderSn)) {
      skippedExisting += 1;
      continue;
    }

    const sanitized = sanitizeIntakeSnapshot(row);
    const orderList = (sanitized.payload as { response?: { order_list?: Record<string, unknown>[] } })
      ?.response?.order_list ?? [];
    if (orderList.length !== 1 || nullableString(orderList[0]?.order_sn) !== orderSn) {
      skippedMalformed += 1;
      continue;
    }

    const status = nullableString(orderList[0]?.order_status);
    if (!status || !INTAKE_ELIGIBLE_STATUSES.has(status)) {
      skippedStatus += 1;
      continue;
    }

    snapshots.push(sanitized);
    if (snapshots.length >= limit) break;
  }

  const mappingQueries = await Promise.all([
    core
      .from('marketplace_product_mappings')
      .select('id,marketplace,marketplace_account,external_item_key,external_item_id,external_model_id,product_id,variant_id,physical_multiplier,channel_account_id')
      .eq('marketplace', 'shopee')
      .eq('channel_account_id', channelAccountId)
      .limit(200),
    core
      .from('marketplace_product_mappings')
      .select('id,marketplace,marketplace_account,external_item_key,external_item_id,external_model_id,product_id,variant_id,physical_multiplier,channel_account_id')
      .eq('marketplace', 'shopee')
      .is('channel_account_id', null)
      .eq('marketplace_account', canonical.account.name)
      .limit(200),
  ]);

  if (mappingQueries.some((query) => query.error)) {
    return { status: 503, body: { error: 'intake_mapping_read_failed' } };
  }

  const mappingById = new Map<string, Record<string, unknown>>();
  for (const query of mappingQueries) {
    for (const mapping of query.data ?? []) mappingById.set(String(mapping.id), mapping);
  }
  if (mappingById.size >= 200) {
    return { status: 409, body: { error: 'intake_mapping_catalog_too_large' } };
  }

  const mappingIds = [...mappingById.keys()];
  const componentsByMapping = new Map<string, Record<string, unknown>[]>();
  if (mappingIds.length > 0) {
    const { data: components, error: componentError } = await core
      .from('marketplace_product_mapping_items')
      .select('mapping_id,product_id,variant_id,physical_multiplier,position')
      .in('mapping_id', mappingIds)
      .order('position', { ascending: true });
    if (componentError) return { status: 503, body: { error: 'intake_mapping_component_read_failed' } };
    for (const component of components ?? []) {
      const mappingId = String(component.mapping_id);
      const list = componentsByMapping.get(mappingId) ?? [];
      list.push(component);
      componentsByMapping.set(mappingId, list);
    }
  }

  const mappings = [...mappingById.values()].map((mapping) => ({
    ...mapping,
    components: componentsByMapping.get(String(mapping.id)) ?? [],
  }));
  const physicalCatalog = await attachMappingPhysicalCatalog(core, mappings);
  if (physicalCatalog.error) return { status: 503, body: { error: physicalCatalog.error } };

  return {
    status: 200,
    body: {
      status: 'ok',
      action: 'shopee.order_intake_batch.read',
      channel_account_id: channelAccountId,
      marketplace_account: canonical.account.name,
      eligible_statuses: [...INTAKE_ELIGIBLE_STATUSES],
      snapshots,
      mappings: physicalCatalog.mappings,
      counts: {
        selected: snapshots.length,
        skipped_existing: skippedExisting,
        skipped_status: skippedStatus,
        skipped_malformed: skippedMalformed,
      },
    },
  };
}

async function persistRawSnapshot(
  core: CoreClient,
  payload: Record<string, unknown>,
  { externalEntityType, endpoint }: { externalEntityType: string; endpoint: string },
) {
  const channelAccountId = String(payload.channel_account_id);
  const account = await activeChannelAccount(core, channelAccountId);
  if (account.unavailable) return { status: 503, body: { error: 'core_unavailable' } };
  if (!account.ok) return { status: 409, body: { error: 'channel_account_unavailable' } };

  const { error } = await core.from('marketplace_raw_snapshots').upsert({
    source: 'shopee_open_platform',
    environment: LIVE,
    channel_account_id: channelAccountId,
    external_entity_type: externalEntityType,
    external_entity_id: String(payload.external_entity_id),
    endpoint,
    request_id: payload.request_id == null ? null : String(payload.request_id),
    observed_at: String(payload.observed_at),
    payload: payload.payload,
    payload_hash: String(payload.payload_hash),
  }, {
    onConflict: 'source,environment,channel_account_id,external_entity_type,external_entity_id,endpoint,payload_hash',
    ignoreDuplicates: true,
  });

  return error
    ? { status: 503, body: { error: 'raw_snapshot_persistence_failed' } }
    : { status: 200, body: { status: 'ok', action: payload.action } };
}


const LABEL_BUCKET = 'shopee-labels';
const LABEL_MAX_BYTES = 4 * 1024 * 1024;

type LabelDocumentLocator =
  | { status: number; error: string }
  | { orderId: string; storagePath: string; existingId: string | null };

async function labelDocumentLocator(
  core: CoreClient, payload: Record<string, unknown>,
): Promise<LabelDocumentLocator> {
  const channelAccountId = String(payload.channel_account_id);
  const shopId = Number(payload.shop_id);
  const orderSn = String(payload.order_sn);
  const packageNumber = payload.package_number === null ? null : String(payload.package_number);

  const account = await activeChannelAccount(core, channelAccountId);
  if (account.unavailable) return { status: 503, error: 'core_unavailable' };
  if (!account.ok) return { status: 409, error: 'channel_account_unavailable' };

  const [oauth, found] = await Promise.all([
    core.from('shopee_oauth_connections').select('shop_id')
      .eq('channel_account_id', channelAccountId).eq('environment', LIVE).maybeSingle(),
    core.from('orders').select('id,order_number')
      .eq('channel_account_id', channelAccountId)
      .eq('order_number', orderSn)
      .eq('sale_origin', 'shopee_open_platform')
      .limit(2),
  ]);
  if (oauth.error || found.error) return { status: 503, error: 'label_reference_lookup_failed' };
  if (Number(oauth.data?.shop_id) !== shopId || (found.data ?? []).length !== 1) {
    return { status: 409, error: 'label_order_account_mismatch' };
  }

  const orderId = String(found.data[0].id);
  const keyBytes = new TextEncoder().encode([channelAccountId, shopId, orderSn, packageNumber ?? ''].join(':'));
  const digest = await crypto.subtle.digest('SHA-256', keyBytes);
  const key = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const storagePath = orderId + '/shopee-' + key + '.pdf';
  const existing = await core.from('order_documents')
    .select('id,order_id,document_type,source').eq('storage_bucket', LABEL_BUCKET)
    .eq('storage_path', storagePath).limit(2);
  if (existing.error) return { status: 503, error: 'label_document_lookup_failed' };
  if ((existing.data ?? []).length > 1) return { status: 409, error: 'label_document_duplicate' };
  if (existing.data?.length === 1 && (
    existing.data[0].order_id !== orderId
    || existing.data[0].document_type !== 'shipping_label'
    || existing.data[0].source !== 'shopee_open_platform'
  )) return { status: 409, error: 'label_document_conflict' };
  return { orderId, storagePath, existingId: existing.data?.[0]?.id ?? null };
}

async function executeLabelAction(core: CoreClient, payload: Record<string, unknown>) {
  const locator = await labelDocumentLocator(core, payload);
  if ('error' in locator) return { status: locator.status, body: { error: locator.error } };
  if (locator.existingId) {
    return {
      status: 200,
      body: { status: 'ok', action: payload.action, already_exists: true, document_id: locator.existingId },
    };
  }

  if (payload.action === 'shopee.shipping_label.prepare') {
    const { data, error } = await core.storage.from(LABEL_BUCKET).createSignedUploadUrl(locator.storagePath);
    if (error || !data?.signedUrl) {
      return { status: 503, body: { error: 'label_upload_prepare_failed' } };
    }
    return {
      status: 200,
      body: { status: 'ok', action: payload.action, already_exists: false,
        upload_url: data.signedUrl, storage_path: locator.storagePath },
    };
  }

  // Commit somente depois de ler o arquivo privado e verificar integridade e identidade.
  const downloaded = await core.storage.from(LABEL_BUCKET).download(locator.storagePath);
  if (downloaded.error || !downloaded.data) {
    return { status: 409, body: { error: 'label_upload_missing' } };
  }
  const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
  if (bytes.length !== Number(payload.file_size)
      || bytes.length > LABEL_MAX_BYTES || bytes.length < 16
      || String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') {
    return { status: 409, body: { error: 'label_pdf_invalid' } };
  }
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const actualHash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (actualHash !== payload.sha256) {
    return { status: 409, body: { error: 'label_integrity_mismatch' } };
  }

  const inserted = await core.from('order_documents').insert({
    order_id: locator.orderId,
    document_type: 'shipping_label',
    file_url: null,
    file_name: 'shopee-' + String(payload.order_sn) + '.pdf',
    source: 'shopee_open_platform',
    storage_bucket: LABEL_BUCKET,
    storage_path: locator.storagePath,
    mime_type: 'application/pdf',
    file_size: bytes.length,
  }).select('id').single();
  if (inserted.error || !inserted.data?.id) {
    // Unique storage locator constraint makes concurrent duplicates fail closed.
    return { status: 503, body: { error: 'label_document_persistence_failed' } };
  }
  return { status: 200, body: { status: 'ok', action: payload.action,
    already_exists: false, document_id: String(inserted.data.id) } };
}

async function executeAction(payload: Record<string, unknown>) {
  const core = coreClient();
  if (!core) return { status: 503, body: { error: 'core_unavailable' } };

  if (payload.action === 'shopee.cycle.acquire' || payload.action === 'shopee.cycle.finish') {
    return executeCycleAction(core, payload);
  }

  if (payload.action === 'shopee.shipping_document.claim' || payload.action === 'shopee.shipping_document.resolve') {
    const claiming = payload.action === 'shopee.shipping_document.claim';
    const { data, error } = await core.rpc(claiming ? 'claim_shopee_shipping_document' : 'resolve_shopee_shipping_document',
      claiming ? {
        p_channel_account_id: String(payload.channel_account_id), p_shop_id: Number(payload.shop_id),
        p_order_sn: String(payload.order_sn), p_package_number: String(payload.package_number),
        p_document_type: String(payload.document_type), p_request_hash: String(payload.request_hash),
      } : { p_attempt_id: String(payload.attempt_id), p_request_hash: String(payload.request_hash), p_outcome: String(payload.outcome) });
    if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
      return { status: 503, body: { error: 'document_ledger_unavailable' } };
    }
    if (claiming && ['claimed','already_succeeded'].includes(data.status)
        && data.fresh === (data.status === 'claimed') && typeof data.attempt_id === 'string') {
      return { status: 200, body: { status: data.status, fresh: data.fresh, attempt_id: data.attempt_id } };
    }
    if (!claiming && ['resolved','already_resolved'].includes(data.status) && ['succeeded','uncertain'].includes(data.state)) {
      return { status: 200, body: { status: data.status, state: data.state } };
    }
    const blocked = ['already_claimed','uncertain_requires_reconciliation','claim_fingerprint_mismatch',
      'account_or_shop_mismatch','order_not_unique_or_missing','invalid_request','attempt_missing','transition_forbidden',
      'duplicate_documents_require_reconciliation','existing_document_requires_reconciliation'];
    return blocked.includes(data.status)
      ? { status: 409, body: { status: 'blocked', code: data.status } }
      : { status: 503, body: { error: 'document_ledger_unavailable' } };
  }


  // F6-O.2e.2c — ledger-only actions. SQL RPCs perform all identity checks
  // and uniqueness atomically; no Shopee API transport occurs in the Core.
  if (payload.action === 'shopee.shipping_arrangement.claim') {
    const { data, error } = await core.rpc('claim_shopee_shipping_arrangement', {
      p_channel_account_id: String(payload.channel_account_id),
      p_shop_id: Number(payload.shop_id),
      p_order_sn: String(payload.order_sn),
      p_package_number: String(payload.package_number),
      p_request_hash: String(payload.request_hash),
    });
    if (error || !data || typeof data !== 'object' || Array.isArray(data)
        || typeof data.status !== 'string') {
      return { status: 503, body: { error: 'shipping_claim_core_unavailable' } };
    }
    if (data.status === 'claimed' && data.fresh === true && typeof data.attempt_id === 'string') {
      return { status: 200, body: {
        status: 'claimed', fresh: true, attempt_id: data.attempt_id,
      } };
    }
    const allowedBlocked = [
      'already_claimed', 'already_succeeded', 'uncertain_requires_reconciliation',
      'claim_fingerprint_mismatch', 'account_or_shop_mismatch',
      'order_not_unique_or_missing', 'invalid_request',
    ];
    return allowedBlocked.includes(data.status)
      ? { status: 409, body: { status: 'blocked', code: data.status } }
      : { status: 503, body: { error: 'shipping_claim_core_unavailable' } };
  }

  if (payload.action === 'shopee.shipping_arrangement.resolve') {
    const { data, error } = await core.rpc('resolve_shopee_shipping_arrangement', {
      p_attempt_id: String(payload.attempt_id),
      p_request_hash: String(payload.request_hash),
      p_outcome: String(payload.outcome),
    });
    if (error || !data || typeof data !== 'object' || Array.isArray(data)
        || typeof data.status !== 'string') {
      return { status: 503, body: { error: 'shipping_resolution_core_unavailable' } };
    }
    if (data.status === 'resolved' || data.status === 'already_resolved') {
      return { status: 200, body: {
        status: data.status, state: data.state,
      } };
    }
    const allowedBlocked = [
      'invalid_request', 'attempt_missing', 'claim_fingerprint_mismatch', 'transition_forbidden',
    ];
    return allowedBlocked.includes(data.status)
      ? { status: 409, body: { status: 'blocked', code: data.status } }
      : { status: 503, body: { error: 'shipping_resolution_core_unavailable' } };
  }

  if (payload.action === 'shopee.shipping_label.prepare' || payload.action === 'shopee.shipping_label.commit') {
    return executeLabelAction(core, payload);
  }

  if (payload.action === 'shopee.oauth_state.create') {
    const channelAccountId = String(payload.channel_account_id);
    const account = await activeChannelAccount(core, channelAccountId);
    if (account.unavailable) return { status: 503, body: { error: 'core_unavailable' } };
    if (!account.ok) return { status: 409, body: { error: 'channel_account_unavailable' } };

    const { error } = await core.from('shopee_oauth_states').upsert({
      state_hash: String(payload.state_hash),
      channel_account_id: channelAccountId,
      environment: LIVE,
      expires_at: String(payload.expires_at),
    }, {
      onConflict: 'state_hash',
      ignoreDuplicates: true,
    });

    return error
      ? { status: 503, body: { error: 'oauth_state_persistence_failed' } }
      : { status: 200, body: { status: 'ok', action: payload.action } };
  }

  if (payload.action === 'shopee.oauth_state.consume') {
    const usedAt = new Date().toISOString();
    const { data, error } = await core
      .from('shopee_oauth_states')
      .update({ used_at: usedAt })
      .eq('state_hash', String(payload.state_hash))
      .eq('environment', LIVE)
      .is('used_at', null)
      .gt('expires_at', usedAt)
      .select('channel_account_id')
      .maybeSingle();

    if (error) return { status: 503, body: { error: 'oauth_state_consume_failed' } };
    if (!data?.channel_account_id) return { status: 409, body: { error: 'oauth_state_invalid_or_consumed' } };

    return {
      status: 200,
      body: {
        status: 'ok',
        action: payload.action,
        channel_account_id: String(data.channel_account_id),
      },
    };
  }

  if (payload.action === 'shopee.oauth_connection.read') {
    const channelAccountId = String(payload.channel_account_id);
    const account = await activeChannelAccount(core, channelAccountId);
    if (account.unavailable) return { status: 503, body: { error: 'core_unavailable' } };
    if (!account.ok) return { status: 409, body: { error: 'channel_account_unavailable' } };

    const { data, error } = await core
      .from('shopee_oauth_connections')
      .select('partner_id,shop_id,access_token_ciphertext,refresh_token_ciphertext,access_token_expires_at,refresh_token_expires_at,last_refreshed_at')
      .eq('channel_account_id', channelAccountId)
      .eq('environment', LIVE)
      .maybeSingle();

    if (error) return { status: 503, body: { error: 'oauth_connection_read_failed' } };
    if (
      !data
      || data.shop_id == null
      || !data.access_token_ciphertext
      || !data.refresh_token_ciphertext
    ) {
      return { status: 409, body: { error: 'oauth_connection_unavailable' } };
    }

    return {
      status: 200,
      body: {
        partner_id: data.partner_id,
        shop_id: data.shop_id,
        access_token_ciphertext: data.access_token_ciphertext,
        refresh_token_ciphertext: data.refresh_token_ciphertext,
        access_token_expires_at: data.access_token_expires_at,
        refresh_token_expires_at: data.refresh_token_expires_at,
        last_refreshed_at: data.last_refreshed_at,
      },
    };
  }

  if (payload.action === 'shopee.oauth_connection.refresh') {
    const channelAccountId = String(payload.channel_account_id);
    const account = await activeChannelAccount(core, channelAccountId);
    if (account.unavailable) return { status: 503, body: { error: 'core_unavailable' } };
    if (!account.ok) return { status: 409, body: { error: 'channel_account_unavailable' } };

    const refreshedAt = String(payload.last_refreshed_at);
    const { data, error } = await core
      .from('shopee_oauth_connections')
      .update({
        access_token_ciphertext: String(payload.access_token_ciphertext),
        refresh_token_ciphertext: String(payload.refresh_token_ciphertext),
        access_token_expires_at: String(payload.access_token_expires_at),
        refresh_token_expires_at: String(payload.refresh_token_expires_at),
        last_refreshed_at: refreshedAt,
        updated_at: refreshedAt,
      })
      .eq('channel_account_id', channelAccountId)
      .eq('environment', LIVE)
      .select('id')
      .maybeSingle();

    if (error) return { status: 503, body: { error: 'oauth_connection_refresh_failed' } };
    if (!data?.id) return { status: 409, body: { error: 'oauth_connection_unavailable' } };
    return { status: 200, body: { status: 'ok', action: payload.action } };
  }

  if (payload.action === 'shopee.oauth_connection.upsert') {
    const channelAccountId = String(payload.channel_account_id);
    const account = await activeChannelAccount(core, channelAccountId);
    if (account.unavailable) return { status: 503, body: { error: 'core_unavailable' } };
    if (!account.ok) return { status: 409, body: { error: 'channel_account_unavailable' } };

    const now = new Date().toISOString();
    const { error } = await core.from('shopee_oauth_connections').upsert({
      channel_account_id: channelAccountId,
      environment: LIVE,
      partner_id: Number(payload.partner_id),
      shop_id: Number(payload.shop_id),
      main_account_id: payload.main_account_id == null ? null : Number(payload.main_account_id),
      merchant_id: payload.merchant_id == null ? null : Number(payload.merchant_id),
      access_token_ciphertext: String(payload.access_token_ciphertext),
      refresh_token_ciphertext: String(payload.refresh_token_ciphertext),
      access_token_expires_at: payload.access_token_expires_at == null ? null : String(payload.access_token_expires_at),
      refresh_token_expires_at: payload.refresh_token_expires_at == null ? null : String(payload.refresh_token_expires_at),
      authorization_expires_at: payload.authorization_expires_at == null ? null : String(payload.authorization_expires_at),
      shop_name: payload.shop_name == null ? null : String(payload.shop_name),
      region: payload.region == null ? null : String(payload.region),
      shop_status: payload.shop_status == null ? null : String(payload.shop_status),
      last_authenticated_at: String(payload.last_authenticated_at),
      last_refreshed_at: payload.last_refreshed_at == null ? null : String(payload.last_refreshed_at),
      updated_at: now,
    }, {
      onConflict: 'channel_account_id,environment',
    });

    if (error?.code === '23505') return { status: 409, body: { error: 'oauth_connection_conflict' } };
    return error
      ? { status: 503, body: { error: 'oauth_connection_persistence_failed' } }
      : { status: 200, body: { status: 'ok', action: payload.action } };
  }

  if (payload.action === 'shopee.order_intake_batch.read') {
    const channelAccountId = String(payload.channel_account_id);
    const limit = payload.limit == null ? 5 : Number(payload.limit);
    return readShopeeIntakeBatch(core, channelAccountId, limit, payload.order_sn == null ? null : String(payload.order_sn));
  }

  if (payload.action === 'shopee.order.create') {
    const channelAccountId = String(payload.channel_account_id);
    const account = await activeChannelAccount(core, channelAccountId);
    if (account.unavailable) return { status: 503, body: { error: 'core_unavailable' } };
    if (!account.ok) return { status: 409, body: { error: 'channel_account_unavailable' } };

    const { data, error } = await core.rpc('create_shopee_api_order', {
      p_order: {
        channel_account_id: channelAccountId,
        marketplace_account: String(payload.marketplace_account),
        order_number: String(payload.order_number),
        order_date: String(payload.order_date),
        total_value: payload.total_value,
        payment_method: payload.payment_method,
        external_status: payload.external_status,
        buyer_message: payload.buyer_message ?? null,
      },
      p_items: payload.items,
    });

    if (error) {
      const semanticConflict = error.code === '23505'
        || error.code === '22P02'
        || error.code === 'P0001';
      return {
        status: semanticConflict ? 409 : 503,
        body: { error: semanticConflict ? 'shopee_order_rejected' : 'shopee_order_persistence_failed' },
      };
    }

    if (!data || typeof data !== 'object' || Array.isArray(data) || !data.order_id) {
      return { status: 503, body: { error: 'shopee_order_persistence_failed' } };
    }

    if (payload.verify_existing === true && !(await verifyCycleOrder(core, String(data.order_id), payload))) {
      return { status: 409, body: { error: 'canonical_order_integrity_mismatch' } };
    }
    return {
      status: 200,
      body: {
        status: 'ok',
        action: payload.action,
        order_id: String(data.order_id),
        separation_id: data.separation_id == null ? null : String(data.separation_id),
        already_registered: data.already_registered === true,
      },
    };
  }

  if (payload.action === 'shopee.raw_shop_snapshot.upsert') {
    return persistRawSnapshot(core, payload, {
      externalEntityType: 'shop',
      endpoint: SHOP_INFO_ENDPOINT,
    });
  }

  if (payload.action === 'shopee.raw_order_list_snapshot.upsert') {
    return persistRawSnapshot(core, payload, {
      externalEntityType: 'order_list',
      endpoint: ORDER_LIST_ENDPOINT,
    });
  }

  if (payload.action === 'shopee.raw_order_snapshot.upsert') {
    return persistRawSnapshot(core, payload, {
      externalEntityType: 'order',
      endpoint: ORDER_DETAIL_ENDPOINT,
    });
  }

  return { status: 400, body: { error: 'unsupported_action' } };
}

Deno.serve(createBridgeHandler({
  getSecret: () => Deno.env.get('INTEGRATION_HUB_CORE_BRIDGE_HMAC_SECRET'),
  checkCore: async () => {
    const core = coreClient();
    if (!core) return false;
    const { error } = await core
      .from('channel_accounts')
      .select('id')
      .limit(1)
      .abortSignal(AbortSignal.timeout(4000));
    return error === null;
  },
  executeAction,
  logger: (entry) => console.info(JSON.stringify(entry)),
}));
