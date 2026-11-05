/**
 * Operações — fonte canônica de precificação comercial para venda direta.
 * Reutiliza exclusivamente products.attributes.crm_direct_whatsapp_price_table.
 * Nenhuma condição especial é presumida: ela só poderá entrar por fonte
 * aprovada, com escopo e vigência próprios, em evolução posterior.
 */
export type DirectCommercialUnit = 'unit' | 'bandeja';
export type DirectPriceTier = {
  level: string; min_qty: number; max_qty: number | null; price_brl: number;
};
export type DirectPriceTable = {
  version: number; channel: string; valid_from: string; valid_until: string | null;
  approved_on: string; unit: DirectCommercialUnit; prices: DirectPriceTier[];
};
export type DirectCommercialRow = {
  name: string; is_active: boolean; deleted_at?: string | null;
  attributes?: { crm_direct_whatsapp_price_table?: DirectPriceTable } | null;
};
export type CommercialLineForPricing = {
  product_id: string; commercial_quantity: number;
  commercial_presentation: {
    commercial_unit_label: string; conversion_factor: number;
  } | null;
};
export type DirectPriceReference = {
  source: 'products.attributes.crm_direct_whatsapp_price_table';
  channel: 'whatsapp_direto'; productName: string;
  unit: DirectCommercialUnit; quantity: number; tier: string; unitPrice: number;
  validFrom: string; validUntil: string | null; requiresConfirmation: boolean;
};
export const DIRECT_COMMERCIAL_SOURCE =
  'products.attributes.crm_direct_whatsapp_price_table' as const;

export function validateDirectPriceTable(
  table: DirectPriceTable | undefined, quantity: number, today: string,
): DirectPriceTier | null {
  if (!table || table.version !== 1 || table.channel !== 'whatsapp_direto'
    || !['unit', 'bandeja'].includes(table.unit)
    || !/^\d{4}-\d{2}-\d{2}$/.test(table.valid_from)
    || table.valid_from > today
    || (table.valid_until !== null && (
      !/^\d{4}-\d{2}-\d{2}$/.test(table.valid_until) || table.valid_until < today))
    || !Array.isArray(table.prices) || table.prices.length !== 6
    || !Number.isSafeInteger(quantity) || quantity < 1) return null;
  const sorted = [...table.prices].sort((a,b) => a.min_qty - b.min_qty);
  if (sorted[0].min_qty !== 1 || sorted[5].max_qty !== null) return null;
  for (let i=0;i<sorted.length;i++) {
    const tier = sorted[i];
    if (!Number.isSafeInteger(tier.min_qty) || tier.min_qty < 1
      || !Number.isFinite(tier.price_brl) || tier.price_brl <= 0
      || (tier.max_qty !== null && (!Number.isSafeInteger(tier.max_qty)
        || tier.max_qty < tier.min_qty))
      || (i>0 && sorted[i-1].max_qty !== tier.min_qty-1)) return null;
  }
  return sorted.find(tier => quantity >= tier.min_qty
    && (tier.max_qty === null || quantity <= tier.max_qty)) ?? null;
}

export function resolveDirectPriceReference(
  rows: DirectCommercialRow[], productName: string, commercialQuantity: number,
  today = new Date().toISOString().slice(0,10),
): DirectPriceReference | null {
  const matches = rows.filter(row => row.name === productName && row.is_active && !row.deleted_at);
  if (matches.length !== 1) return null;
  const table = matches[0].attributes?.crm_direct_whatsapp_price_table;
  const tier = validateDirectPriceTable(table, commercialQuantity, today);
  if (!tier || !table) return null;
  return {
    source: DIRECT_COMMERCIAL_SOURCE,
    channel: 'whatsapp_direto', productName, unit: table.unit,
    quantity: commercialQuantity, tier: tier.level, unitPrice: tier.price_brl,
    validFrom: table.valid_from, validUntil: table.valid_until,
    requiresConfirmation: false,
  };
}

export function matchesDirectCommercialUnit(
  item: CommercialLineForPricing, unit: DirectCommercialUnit,
): boolean {
  const presentation = item.commercial_presentation;
  if (unit === 'bandeja') {
    return presentation?.commercial_unit_label === 'bandeja'
      && Number(presentation.conversion_factor) === 18;
  }
  return presentation === null || (presentation.commercial_unit_label === 'un'
    && Number(presentation.conversion_factor) === 1);
}

/**
 * Sums only same-product/same-commercial-unit lines. No cross-family mixing,
 * no implicit division of physical grams/units, and no price overwrites.
 */
export function resolveDirectSalePriceAdvice(
  rows: DirectCommercialRow[], product: {id:string; name:string},
  current: CommercialLineForPricing, lines: CommercialLineForPricing[],
  today = new Date().toISOString().slice(0,10),
): DirectPriceReference | null {
  if (current.product_id !== product.id) return null;
  const row = rows.find(x => x.name === product.name && x.is_active && !x.deleted_at);
  const unit = row?.attributes?.crm_direct_whatsapp_price_table?.unit;
  if (unit !== 'unit' && unit !== 'bandeja') return null;
  if (!matchesDirectCommercialUnit(current, unit)) return null;
  const quantity = lines.filter(x => x.product_id === product.id
    && matchesDirectCommercialUnit(x, unit))
    .reduce((sum,x) => sum + Number(x.commercial_quantity), 0);
  return resolveDirectPriceReference(rows, product.name, quantity, today);
}

/**
 * Customer-specific prices are NOT registered by this module.
 * This discriminant avoids treating an unknown customer as an approved special.
 */
export type SpecialPriceDecision =
  | { kind: 'not_configured' }
  | { kind: 'approved'; unitPrice: number; sourceId: string; validFrom: string; validUntil: string | null };
export function resolveUnconfiguredSpecialCondition(): SpecialPriceDecision {
  return { kind: 'not_configured' };
}
