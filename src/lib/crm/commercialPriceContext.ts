import { supabase } from '@/integrations/supabase/client';

/**
 * Leitura comercial de unidades físicas, não de simulações de margem, custos,
 * anúncios de marketplace ou apresentações de kits sem preço aprovado.
 * A ausência de preço é um resultado válido: nunca preencher por inferência.
 */
export interface CrmCommercialPriceRow {
  name: string;
  price: number | string | null;
  is_active: boolean;
  deleted_at?: string | null;
  variants?: Array<{ is_active: boolean; price_override: number | string | null }>;
}

const DIRECT_TRUFFLE_NAMES = ['TRUFA ARTESANAL 30G', 'TRUFA ARTESANAL 40G'] as const;

function positivePrice(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && Math.abs(Math.round(n * 100) - n * 100) < 0.000001 ? n : null;
}

export function getVerifiedDirectTrufflePrices(rows: CrmCommercialPriceRow[]): string | null {
  const amounts: string[] = [];
  for (const name of DIRECT_TRUFFLE_NAMES) {
    const matches = rows.filter(row => row.name === name && row.is_active && !row.deleted_at);
    if (matches.length !== 1) return null;
    const item = matches[0];
    const base = positivePrice(item.price);
    const variants = (item.variants ?? []).filter(v => v.is_active);
    const explicit = [...new Set(variants.map(v => positivePrice(v.price_override)).filter((v): v is number => v !== null))];
    // Sobrescritas diferentes tornam a pergunta genérica ambígua por sabor.
    if (explicit.length > 1 || (explicit.length === 1 && base !== null && explicit[0] !== base)) return null;
    const resolved = base ?? (variants.length > 0 && variants.every(v => positivePrice(v.price_override) === explicit[0]) ? explicit[0] : null);
    if (resolved === null) return null;
    const weight = name.endsWith('30G') ? '30g' : '40g';
    amounts.push('Trufa ' + weight + ': R$ ' + resolved.toFixed(2).replace('.', ',') + ' por unidade');
  }
  return amounts.join('; ');
}

export async function lookupDirectTrufflePrices(): Promise<string | null> {
  const { data, error } = await supabase
    .from('products')
    .select('name,price,is_active,deleted_at,variants:product_variants(is_active,price_override)')
    .in('name', [...DIRECT_TRUFFLE_NAMES])
    .eq('is_active', true)
    .is('deleted_at', null);
  if (error) throw error;
  return getVerifiedDirectTrufflePrices((data ?? []) as CrmCommercialPriceRow[]);
}
