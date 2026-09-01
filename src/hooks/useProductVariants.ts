import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  variant_name: string;
  attributes: Record<string, unknown>;
  unit: string | null;
  is_active: boolean;
  cost_override: number | null;
  price_override: number | null;
  weight_g: number | null;
  height_cm: number | null;
  width_cm: number | null;
  length_cm: number | null;
  created_at: string;
  updated_at: string;
}

export type ProductVariantInput = Omit<ProductVariant, 'id' | 'product_id' | 'created_at' | 'updated_at'>;

export function useProductVariants(productId: string | null) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchVariants = useCallback(async () => {
    if (!productId) {
      setVariants([]);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', productId)
      .order('is_active', { ascending: false })
      .order('variant_name');

    if (error) {
      console.error('Erro ao carregar variações:', error);
      toast.error('Não foi possível carregar as variações');
    } else {
      setVariants((data || []) as ProductVariant[]);
    }
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    fetchVariants();
  }, [fetchVariants]);

  const validateSku = useCallback(async (sku: string, variantId?: string) => {
    const normalizedSku = sku.trim();
    if (!normalizedSku) {
      toast.error('Informe o SKU da variação');
      return false;
    }

    const [{ data: masterProduct, error: masterError }, { data: matchingVariants, error: variantError }] = await Promise.all([
      supabase.from('products').select('id').eq('sku', normalizedSku).limit(1),
      supabase.from('product_variants').select('id').eq('sku', normalizedSku).limit(1),
    ]);

    if (masterError || variantError) {
      toast.error('Não foi possível validar o SKU');
      return false;
    }

    if ((masterProduct || []).length > 0 || (matchingVariants || []).some((variant) => variant.id !== variantId)) {
      toast.error('Este SKU já está em uso por um produto ou variação');
      return false;
    }

    return true;
  }, []);

  const createVariant = useCallback(async (input: ProductVariantInput) => {
    if (!productId || !input.variant_name.trim() || !(await validateSku(input.sku))) return false;

    const { data: parent, error: parentError } = await (supabase.from('products') as any)
      .select('variation_mode')
      .eq('id', productId)
      .maybeSingle();
    if (parentError || !parent) { toast.error('Produto não encontrado'); return false; }
    if (parent.variation_mode !== 'variacoes_fisicas') {
      const [inventory, orders, production, mappings, bom] = await Promise.all([
        supabase.from('inventory').select('id').eq('product_id', productId).limit(1),
        supabase.from('order_items').select('id').eq('product_id', productId).limit(1),
        supabase.from('production_orders').select('id').eq('product_id', productId).limit(1),
        supabase.from('marketplace_product_mappings').select('id').eq('product_id', productId).limit(1),
        supabase.from('product_components').select('id').or(`product_id.eq.${productId},component_id.eq.${productId}`).limit(1),
      ]);
      if ([inventory, orders, production, mappings, bom].some(result => (result.data || []).length > 0)) {
        toast.error('Produto com histórico não pode virar Mestre automaticamente. Use a migração assistida.');
        return false;
      }
      const { error } = await (supabase.from('products') as any).update({ variation_mode: 'variacoes_fisicas' }).eq('id', productId);
      if (error) { toast.error('Não foi possível preparar o Produto Mestre'); return false; }
    }

    const { error } = await supabase.from('product_variants').insert({
      ...input,
      product_id: productId,
      sku: input.sku.trim(),
      variant_name: input.variant_name.trim(),
    } as any);

    if (error) {
      console.error('Erro ao criar variação:', error);
      toast.error('Não foi possível criar a variação');
      return false;
    }

    toast.success('Variação criada');
    await fetchVariants();
    return true;
  }, [fetchVariants, productId, validateSku]);

  const updateVariant = useCallback(async (variantId: string, input: ProductVariantInput) => {
    if (!input.variant_name.trim() || !(await validateSku(input.sku, variantId))) return false;

    const { error } = await supabase.from('product_variants').update({
      ...input,
      sku: input.sku.trim(),
      variant_name: input.variant_name.trim(),
    } as any).eq('id', variantId);

    if (error) {
      console.error('Erro ao atualizar variação:', error);
      toast.error('Não foi possível atualizar a variação');
      return false;
    }

    toast.success('Variação atualizada');
    await fetchVariants();
    return true;
  }, [fetchVariants, validateSku]);

  const setVariantActive = useCallback(async (variantId: string, isActive: boolean) => {
    const { error } = await supabase.from('product_variants').update({ is_active: isActive }).eq('id', variantId);
    if (error) {
      toast.error('Não foi possível atualizar o estado da variação');
      return false;
    }

    await fetchVariants();
    return true;
  }, [fetchVariants]);

  return { variants, loading, createVariant, updateVariant, setVariantActive };
}
