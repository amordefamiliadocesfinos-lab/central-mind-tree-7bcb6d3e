import { supabase } from '@/integrations/supabase/client';
import { validateDirectPriceTable, resolveDirectPriceReference, type DirectPriceTier, type DirectPriceTable } from '@/lib/operations/commercialPricing';

type Tier = DirectPriceTier;
type OfficialTable = DirectPriceTable;
export interface CrmCommercialPriceRow {
  name: string;
  is_active: boolean;
  deleted_at?: string | null;
  attributes?: { crm_direct_whatsapp_price_table?: OfficialTable } | null;
}

const FAMILIES = [
  { name: 'TRUFA ARTESANAL 30G', label: 'Trufa 30g', terms: ['trufa 30g', 'trufa 30 g'] },
  { name: 'TRUFA ARTESANAL 40G', label: 'Trufa 40g', terms: ['trufa 40g', 'trufa 40 g'] },
  { name: 'CHOCOIM ARTESANAL 34G AMENDOIM - EMBALAGEM FLOWPACK', label: 'Chocoim 34g', terms: ['chocoim'] },
  { name: 'ALFAJOR ARTESANAL 60G DOCE DE LEITE', label: 'Alfajor 60g', terms: ['alfajor'] },
  { name: 'Caseirinho Artesanal 32g Amendoim – Cobertura de Chocolate Variado', label: 'Caseirinho 32g', terms: ['caseirinho'] },
  { name: 'Pé de Moça Artesanal 35g Amendoim – Embalagem Flowpack', label: 'Pé de Moça 35g', terms: ['pe de moca'] },
  { name: 'Torrão Artesanal 70g Amendoim – Embalagem Flowpack', label: 'Torrão 70g', terms: ['torrao'] },
] as const;

export const OFFICIAL_WHATSAPP_PRODUCT_NAMES = FAMILIES.map(family => family.name);

const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const currency = (value: number) => 'R$ ' + value.toFixed(2).replace('.', ',');

function requestedFamilies(message: string) {
  const text = normalize(message);
  const named = FAMILIES.filter(f => f.terms.some(term => text.includes(term)));
  if (named.length) return named;
  if (/\btrufas?\b/.test(text)) return FAMILIES.slice(0, 2);
  return [];
}

function requestedQuantity(message: string): number | null {
  const text = normalize(message);
  const matches = [...text.matchAll(/\b(\d{1,6})\s*(unidades?|un\.?|trufas?|bandejas?)\b/g)]
    .map(m => Number(m[1])).filter(n => Number.isSafeInteger(n) && n > 0);
  return matches.length === 1 ? matches[0] : null;
}

function validateTable(table: OfficialTable | undefined, qty: number | null, unit: 'unit' | 'bandeja', today: string): Tier | null {
  if (!table || table.unit !== unit) return null;
  return validateDirectPriceTable(table, qty ?? 1, today);
}

/**
 * Consulta numérica para conferência não-invasiva da venda.
 * Não arredonda quantidade física para apresentação comercial e não
 * escolhe preço negociado automaticamente.
 */
export function getOfficialWhatsappTierPrice(
  rows: CrmCommercialPriceRow[], productName: string, commercialQuantity: number,
  today = new Date().toISOString().slice(0, 10),
): number | null {
  if (!Number.isSafeInteger(commercialQuantity) || commercialQuantity < 1) return null;
  const family = FAMILIES.find(item => item.name === productName);
  if (!family) return null;
  const matches = rows.filter(row => row.name === productName && row.is_active && !row.deleted_at);
  if (matches.length !== 1) return null;
  const unit = family.name.includes('TRUFA') || family.name.includes('CHOCOIM') ? 'unit' : 'bandeja';
  const reference = resolveDirectPriceReference(rows, productName, commercialQuantity, today);
  return reference?.unit === unit ? reference.unitPrice : null;
}

/** Consulta somente os níveis oficialmente aprovados no próprio produto. */
export function getOfficialWhatsappPriceQuote(
  rows: CrmCommercialPriceRow[], message: string, today = new Date().toISOString().slice(0, 10),
): string | null {
  const families = requestedFamilies(message);
  if (!families.length) return null;
  const qty = requestedQuantity(message);
  const lines: string[] = [];
  for (const family of families) {
    const matching = rows.filter(r => r.name === family.name && r.is_active && !r.deleted_at);
    if (matching.length !== 1) return null;
    const table = matching[0].attributes?.crm_direct_whatsapp_price_table;
    const unit = family.name.includes('TRUFA') || family.name.includes('CHOCOIM') ? 'unit' : 'bandeja';
    const tier = validateTable(table, qty, unit, today);
    if (!tier) return null;
    const description = qty === null
      ? 'varejo (' + tier.min_qty + (tier.max_qty === 1 ? '' : ' a ' + tier.max_qty) + ' ' + (unit === 'unit' ? 'unidades' : 'bandejas') + ')'
      : qty + ' ' + (unit === 'unit' ? 'unidades' : 'bandejas') + ' · ' + (tier.level === 'varejo' ? 'varejo' : tier.level.replace('_', ' '));
    lines.push(family.label + ': ' + currency(tier.price_brl) + ' por ' + (unit === 'unit' ? 'unidade' : 'bandeja') + ' — ' + description);
  }
  return lines.join('; ');
}

/** Consulta o banco ao gerar a sugestão; jamais usa preços históricos/cache. */
export async function lookupOfficialWhatsappPriceQuote(message: string): Promise<string | null> {
  const names = requestedFamilies(message).map(f => f.name);
  if (!names.length) return null;
  const { data, error } = await supabase.from('products')
    .select('name,is_active,deleted_at,attributes')
    .in('name', names).eq('is_active', true).is('deleted_at', null);
  if (error) throw error;
  return getOfficialWhatsappPriceQuote((data ?? []) as CrmCommercialPriceRow[], message);
}
