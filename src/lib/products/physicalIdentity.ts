export type VariationMode = 'sem_variacao' | 'variacoes_fisicas';

export type ProductIdentityRecord = {
  id: string;
  variation_mode?: VariationMode | null;
};

export type ProductVariantIdentityRecord = {
  id: string;
  product_id: string;
  is_active?: boolean;
};

export class PhysicalIdentityError extends Error {}

/**
 * Contrato único da identidade física. Este helper é puro para que todas as
 * telas e escritores tenham a mesma decisão antes da proteção no banco.
 */
export function validatePhysicalIdentity(
  product: ProductIdentityRecord,
  variantId: string | null | undefined,
  variant?: ProductVariantIdentityRecord | null,
  options: { requireActiveVariant?: boolean } = {},
) {
  const mode: VariationMode = product.variation_mode === 'variacoes_fisicas'
    ? 'variacoes_fisicas'
    : 'sem_variacao';
  const normalizedVariantId = variantId || null;

  if (mode === 'sem_variacao') {
    if (normalizedVariantId) {
      throw new PhysicalIdentityError('Produto simples não aceita variante física.');
    }
    return { product_id: product.id, variant_id: null, variation_mode: mode } as const;
  }

  if (!normalizedVariantId) {
    throw new PhysicalIdentityError('Selecione a variante física deste Produto Mestre.');
  }
  if (!variant || variant.id !== normalizedVariantId || variant.product_id !== product.id) {
    throw new PhysicalIdentityError('A variante selecionada não pertence ao Produto Mestre.');
  }
  if (options.requireActiveVariant && variant.is_active === false) {
    throw new PhysicalIdentityError('A variante física selecionada está inativa.');
  }
  return { product_id: product.id, variant_id: normalizedVariantId, variation_mode: mode } as const;
}

/** Consulta mínima compartilhada para escritores do cliente. O banco continua
 * soberano; esta validação oferece erro funcional antes da RPC/escrita. */
export async function resolvePhysicalIdentity(productId: string, variantId?: string | null) {
  const { supabase } = await import('@/integrations/supabase/client');
  const { data: product, error: productError } = await (supabase.from('products') as any)
    .select('id, variation_mode')
    .eq('id', productId)
    .maybeSingle();
  if (productError || !product) throw new PhysicalIdentityError('Produto não encontrado.');

  let variant: ProductVariantIdentityRecord | null = null;
  if (variantId) {
    const { data, error } = await supabase.from('product_variants')
      .select('id, product_id, is_active')
      .eq('id', variantId)
      .maybeSingle();
    if (error || !data) throw new PhysicalIdentityError('Variante física não encontrada.');
    variant = data;
  }
  return validatePhysicalIdentity(product, variantId, variant, { requireActiveVariant: true });
}
