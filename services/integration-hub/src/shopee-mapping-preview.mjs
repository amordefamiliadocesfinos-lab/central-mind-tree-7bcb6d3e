import { mappingPhysicalBlocker } from './shopee-mapping-physical-guard.mjs';

function normalizeKeyText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function nullableText(value) {
  const normalized = String(value ?? '').trim();
  return normalized === '' ? null : normalized;
}

export function buildShopeeApiExternalItemKey({
  itemName,
  modelName,
  itemSku,
  modelSku,
} = {}) {
  const variation = normalizeKeyText(modelName);
  const normalizedSku = (normalizeKeyText(modelSku) || normalizeKeyText(itemSku)).replace(/ /g, '-');
  if (normalizedSku) return `sku:${normalizedSku}|variation:${variation}`;

  const code = `${itemName ?? ''} ${modelName ?? ''}`.match(/\bSH-\d+(?:-\d+)+\b/i)?.[0];
  if (code) return `code:${code.toUpperCase()}|variation:${variation}`;

  return `title:${normalizeKeyText(itemName)}|${variation}`;
}

function mappingMatchesScope(mapping, {
  channelAccountId = null,
  marketplaceAccount = null,
} = {}) {
  if (mapping?.marketplace !== 'shopee') return false;

  const mappingChannelAccountId = nullableText(mapping?.channel_account_id);
  if (mappingChannelAccountId) {
    return mappingChannelAccountId === nullableText(channelAccountId);
  }

  const mappingAccount = nullableText(mapping?.marketplace_account);
  return mappingAccount !== null
    && marketplaceAccount !== null
    && mappingAccount === marketplaceAccount;
}

// F1.1: official Shopee identities are authoritative; legacy title/SKU keys
// remain a fallback only for mappings that do not declare official IDs.
// A missing model identifier is not equivalent to Shopee model_id='0'.
function officialMappingIdentity(mapping) {
  return {
    itemId: nullableText(mapping?.external_item_id),
    modelId: nullableText(mapping?.external_model_id),
  };
}

function findMappingCandidates(item, mappings, scope, legacyKey) {
  const scoped = mappings.filter((mapping) => mappingMatchesScope(mapping, scope));
  const itemId = nullableText(item.itemId);
  const modelId = nullableText(item.modelId);

  if (itemId !== null && modelId !== null) {
    const official = scoped.filter((mapping) => {
      const identity = officialMappingIdentity(mapping);
      return identity.itemId === itemId && identity.modelId === modelId;
    });
    if (official.length > 0) return official;
    // Never silently route another variant of a known official Item ID
    // through an older title/SKU mapping. Keep the item unresolved.
    if (scoped.some((mapping) => officialMappingIdentity(mapping).itemId === itemId)) return [];
  }

  return scoped.filter((mapping) => {
    const identity = officialMappingIdentity(mapping);
    return identity.itemId === null && identity.modelId === null
      && String(mapping?.external_item_key ?? '') === legacyKey;
  });
}

function resolveComponents(mapping) {
  if (mapping?.components != null && !Array.isArray(mapping.components)) return [];
  if (Array.isArray(mapping?.components) && mapping.components.length > 0
    && mapping.components.some((component) => (
      !nullableText(component?.product_id)
      || !Number.isFinite(Number(component?.physical_multiplier))
      || Number(component.physical_multiplier) <= 0
    ))) return [];
  const explicit = Array.isArray(mapping?.components)
    ? mapping.components
      .filter((component) => nullableText(component?.product_id) && Number(component?.physical_multiplier) > 0)
      .map((component, index) => ({
        productId: nullableText(component.product_id),
        variantId: nullableText(component.variant_id),
        physicalMultiplier: Number(component.physical_multiplier),
        position: Number.isFinite(Number(component.position)) ? Number(component.position) : index,
      }))
      .sort((a, b) => a.position - b.position)
    : [];

  if (explicit.length > 0) return explicit;

  const productId = nullableText(mapping?.product_id);
  const multiplier = Number(mapping?.physical_multiplier);
  if (!productId || !Number.isFinite(multiplier) || multiplier <= 0) return [];

  return [{
    productId,
    variantId: nullableText(mapping?.variant_id),
    physicalMultiplier: multiplier,
    position: 0,
  }];
}

function previewItem(item, mappings, scope, requirePhysicalValidation) {
  const externalItemKey = buildShopeeApiExternalItemKey({
    itemName: item.itemName,
    modelName: item.modelName,
    itemSku: item.itemSku,
    modelSku: item.modelSku,
  });

  const candidates = findMappingCandidates(item, mappings, scope, externalItemKey);

  if (candidates.length === 0) {
    return {
      ...item,
      externalItemKey,
      mappingStatus: 'needs_mapping',
      mappingId: null,
      components: [],
    };
  }

  if (candidates.length > 1) {
    return {
      ...item,
      externalItemKey,
      mappingStatus: 'ambiguous',
      mappingId: null,
      components: [],
      candidateMappingIds: candidates.map((candidate) => String(candidate.id ?? '')).filter(Boolean),
    };
  }

  const mapping = candidates[0];
  const physicalBlocker = requirePhysicalValidation ? mappingPhysicalBlocker(item, mapping) : null;
  if (physicalBlocker) return {
    ...item, externalItemKey, mappingStatus: physicalBlocker,
    mappingId: nullableText(mapping.id), components: [],
  };
  const components = resolveComponents(mapping);
  if (components.length === 0) {
    return {
      ...item,
      externalItemKey,
      mappingStatus: 'invalid_mapping',
      mappingId: nullableText(mapping.id),
      components: [],
    };
  }

  const commercialQuantity = Number(item.quantity);
  return {
    ...item,
    externalItemKey,
    mappingStatus: 'recognized',
    mappingId: nullableText(mapping.id),
    components: components.map((component) => ({
      ...component,
      commercialQuantity: Number.isFinite(commercialQuantity) ? commercialQuantity : null,
      physicalQuantity: Number.isFinite(commercialQuantity)
        ? commercialQuantity * component.physicalMultiplier
        : null,
    })),
  };
}

export function buildShopeeMappingPreview(normalizedPayload, mappings, {
  channelAccountId = normalizedPayload?.channelAccountId ?? null,
  marketplaceAccount = null,
  requirePhysicalValidation = false,
} = {}) {
  if (!normalizedPayload || !Array.isArray(normalizedPayload.orders)) {
    throw new TypeError('normalized Shopee order payload is required');
  }
  if (!Array.isArray(mappings)) throw new TypeError('mappings must be an array');

  const scope = {
    channelAccountId: nullableText(channelAccountId),
    marketplaceAccount: nullableText(marketplaceAccount),
  };

  return {
    schemaVersion: 1,
    source: normalizedPayload.source,
    environment: normalizedPayload.environment,
    channelAccountId: scope.channelAccountId,
    marketplaceAccount: scope.marketplaceAccount,
    operationalWrites: false,
    orders: normalizedPayload.orders.map((order) => {
      const items = order.items.map((item) => previewItem(item, mappings, scope, requirePhysicalValidation));
      return {
        orderSn: order.orderSn,
        externalStatus: order.externalStatus,
        items,
        recognizedItems: items.filter((item) => item.mappingStatus === 'recognized').length,
        unresolvedItems: items.filter((item) => item.mappingStatus !== 'recognized').length,
      };
    }),
  };
}

export const SHOPEE_MAPPING_PREVIEW_CONTRACT = Object.freeze({
  marketplace: 'shopee',
  operationalWrites: false,
  precedence: 'channel_account_id_then_exact_marketplace_account',
  statuses: ['recognized', 'needs_mapping', 'ambiguous', 'invalid_mapping'],
});
