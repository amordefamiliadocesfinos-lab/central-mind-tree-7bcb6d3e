import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { resolvePhysicalIdentity } from '@/lib/products/physicalIdentity';
import type { CommercialPresentation, CommercialPresentationInput } from '@/lib/products/commercialPresentation';

const db = supabase as any;

export type UpdateCommercialPresentationInput = Partial<Omit<CommercialPresentationInput, 'product_id' | 'variant_id'>> & {
  is_active?: boolean;
};

function validatePresentation(input: Pick<CommercialPresentationInput, 'name' | 'commercial_unit_label' | 'conversion_factor'>) {
  if (!input.name.trim() || !input.commercial_unit_label.trim() || !Number.isFinite(input.conversion_factor) || input.conversion_factor <= 0) {
    throw new Error('Informe nome, unidade comercial e um fator de conversão maior que zero.');
  }
}

/** Escritor único da configuração comercial. Não cria operação nem quantidade física. */
export function useCommercialPresentations() {
  const list = useCallback(async (productId: string, variantId: string | null, includeInactive = true) => {
    let query = db.from('commercial_presentations').select('*').eq('product_id', productId);
    query = variantId ? query.eq('variant_id', variantId) : query.is('variant_id', null);
    if (!includeInactive) query = query.eq('is_active', true);
    const { data, error } = await query.order('name');
    if (error) throw error;
    return (data ?? []) as CommercialPresentation[];
  }, []);

  const create = useCallback(async (input: CommercialPresentationInput) => {
    validatePresentation(input);
    await resolvePhysicalIdentity(input.product_id, input.variant_id);
    const { data, error } = await db.from('commercial_presentations').insert({
      ...input,
      name: input.name.trim(),
      commercial_unit_label: input.commercial_unit_label.trim(),
      notes: input.notes?.trim() || null,
      is_active: true,
    }).select().single();
    if (error) throw error;
    return data as CommercialPresentation;
  }, []);

  const update = useCallback(async (id: string, input: UpdateCommercialPresentationInput) => {
    if (input.name !== undefined || input.commercial_unit_label !== undefined || input.conversion_factor !== undefined) {
      const { data: current, error: currentError } = await db
        .from('commercial_presentations')
        .select('name,commercial_unit_label,conversion_factor')
        .eq('id', id)
        .single();
      if (currentError) throw currentError;
      validatePresentation({
        name: input.name ?? current.name,
        commercial_unit_label: input.commercial_unit_label ?? current.commercial_unit_label,
        conversion_factor: input.conversion_factor ?? Number(current.conversion_factor),
      });
    }
    const updates = {
      ...input,
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.commercial_unit_label !== undefined ? { commercial_unit_label: input.commercial_unit_label.trim() } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    };
    const { data, error } = await db.from('commercial_presentations').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data as CommercialPresentation;
  }, []);

  return { list, create, update };
}
