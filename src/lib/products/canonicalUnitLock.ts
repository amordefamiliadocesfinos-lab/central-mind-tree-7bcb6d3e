import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

export const CANONICAL_UNIT_LOCK_MESSAGE = 'Esta unidade física já está em uso por Estoque, BOM, Produção, Compras ou Pedidos. Alterar a unidade agora mudaria o significado histórico das quantidades.';

export type PhysicalIdentity = { productId: string; variantId: string | null };

export function normalizePhysicalUnit(unit: string | null | undefined) {
  return String(unit ?? '').trim().toLocaleLowerCase();
}

function matchesIdentity(query: any, identity: PhysicalIdentity, productColumn = 'product_id', variantColumn = 'variant_id') {
  const byProduct = query.eq(productColumn, identity.productId);
  return identity.variantId ? byProduct.eq(variantColumn, identity.variantId) : byProduct.is(variantColumn, null);
}

async function hasEvidence(query: any) {
  const { data, error } = await query.limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

/** Recebimentos são cobertos por purchase_order_items: cada receipt item referencia um item de compra. */
export async function getPhysicalIdentityUsage(identity: PhysicalIdentity) {
  const checks: Array<[string, Promise<boolean>]> = [
    ['Estoque', hasEvidence(matchesIdentity(db.from('inventory').select('id'), identity))],
    ['Movimentos de estoque', hasEvidence(matchesIdentity(db.from('inventory_movements').select('id'), identity))],
    ['Compras/recebimentos', hasEvidence(matchesIdentity(db.from('purchase_order_items').select('id'), identity))],
    ['Ordens de produção', hasEvidence(matchesIdentity(db.from('production_orders').select('id'), identity))],
    ['Pedidos', hasEvidence(matchesIdentity(db.from('order_items').select('id'), identity))],
    ['BOM como componente', hasEvidence(matchesIdentity(db.from('product_components').select('id'), identity, 'component_id'))],
    ['BOM como produto final', hasEvidence(matchesIdentity(db.from('product_components').select('id'), identity, 'product_id', 'product_variant_id'))],
  ];
  const resolved = await Promise.all(checks.map(async ([label, check]) => [label, await check] as const));
  return resolved.filter(([, used]) => used).map(([label]) => label);
}

export async function assertPhysicalIdentityUnitCanChange(identity: PhysicalIdentity) {
  if ((await getPhysicalIdentityUsage(identity)).length) throw new Error(CANONICAL_UNIT_LOCK_MESSAGE);
}

/** A alteração do mestre afeta a identidade simples e variantes, ativas ou não, que herdam sua unidade. */
export async function assertProductUnitCanChange(productId: string, currentUnit: string | null | undefined, nextUnit: string | null | undefined) {
  if (normalizePhysicalUnit(currentUnit) === normalizePhysicalUnit(nextUnit)) return;
  const { data: inheritedVariants, error } = await db.from('product_variants').select('id').eq('product_id', productId).is('unit', null);
  if (error) throw error;
  const identities: PhysicalIdentity[] = [{ productId, variantId: null }, ...(inheritedVariants ?? []).map((variant: { id: string }) => ({ productId, variantId: variant.id }))];
  const usage = await Promise.all(identities.map(getPhysicalIdentityUsage));
  if (usage.some(item => item.length)) throw new Error(CANONICAL_UNIT_LOCK_MESSAGE);
}
