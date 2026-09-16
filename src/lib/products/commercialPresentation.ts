import { getPhysicalIdentityUnit } from '@/lib/productVariants';

type PhysicalProduct = { id: string; unit?: string | null } | null | undefined;
type PhysicalVariant = { id: string; unit?: string | null } | null | undefined;

export type CommercialPresentation = {
  id: string;
  product_id: string;
  variant_id: string | null;
  name: string;
  commercial_unit_label: string;
  conversion_factor: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CommercialPresentationInput = Pick<
  CommercialPresentation,
  'product_id' | 'variant_id' | 'name' | 'commercial_unit_label' | 'conversion_factor' | 'notes'
>;

/** Apresentação implícita: não exige cadastro e representa uma unidade física. */
export function directCommercialPresentation(product: PhysicalProduct, variant?: PhysicalVariant) {
  const unit = getPhysicalIdentityUnit(product, variant);
  return {
    id: null,
    product_id: product?.id ?? '',
    variant_id: variant?.id ?? null,
    name: `Unidade direta (${unit})`,
    commercial_unit_label: unit,
    conversion_factor: 1,
    is_active: true,
    notes: null,
  };
}

export function formatCommercialPresentation(presentation: Pick<CommercialPresentation, 'commercial_unit_label' | 'conversion_factor'>, product: PhysicalProduct, variant?: PhysicalVariant) {
  return `1 ${presentation.commercial_unit_label} = ${presentation.conversion_factor} ${getPhysicalIdentityUnit(product, variant)}`;
}
