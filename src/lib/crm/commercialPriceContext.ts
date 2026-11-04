import { supabase } from '@/integrations/supabase/client';

type Tier = { level: string; min_qty: number; max_qty: number | null; price_brl: number };
type OfficialTable = {
  version: number; channel: string; valid_from: string; valid_until: string | null;
  approved_on: string; unit: 'unit' | 'bandeja'; prices: Tier[];
};
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
  if (!table || table.version !== 1 || table.channel !== 'whatsapp_direto'
      || table.unit !== unit || table.valid_from > today
      || (table.valid_until && table.valid_until < today)
      || !Array.isArray(table.prices) || table.prices.length !== 6) return null;
  const sorted = [...table.prices].sort((a, b) => a.min_qty - b.min_qty);
  if (sorted[0].min_qty !== 1 || sorted[5].max_qty !== null) return null;
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    if (!Number.isSafeInteger(t.min_qty) || t.min_qty < 1 ||
        !Number.isFinite(t.price_brl) || t.price_brl <= 0 ||
        (t.max_qty !== null && (!Number.isSafeInteger(t.max_qty) || t.max_qty < t.min_qty)) ||
        (i > 0 && sorted[i - 1].max_qty !== t.min_qty - 1)) return null;
  }
  // Sem quantidade, a única cotação inequívoca é o varejo (primeira faixa).
  return sorted.find(t => (qty ?? 1) >= t.min_qty && (t.max_qty === null || (qty ?? 1) <= t.max_qty)) ?? null;
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
