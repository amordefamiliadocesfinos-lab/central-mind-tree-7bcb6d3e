import { getPhysicalIdentityUnit } from '@/lib/productVariants';
import {
  directCommercialPresentation,
  type CommercialPresentation,
} from '@/lib/products/commercialPresentation';

export type CommercialOrderItemSnapshot = {
  commercial_presentation_id?: string | null;
  commercial_presentation_name?: string | null;
  commercial_unit_label?: string | null;
  commercial_conversion_factor?: number | null;
  commercial_quantity?: number | null;
  physical_unit_label?: string | null;
};

type PhysicalProduct = { id: string; unit?: string | null };
type PhysicalVariant = { id: string; product_id?: string; unit?: string | null; price_override?: number | null } | null | undefined;

/** Price for one commercial unit. The catalog/variant price remains physical. */
export function getDefaultCommercialUnitPrice(
  product: PhysicalProduct & { price?: number | null },
  variant?: PhysicalVariant,
  presentation?: Pick<CommercialPresentation, 'conversion_factor'> | null,
) {
  const physicalUnitPrice = variant?.price_override ?? product.price ?? 0;
  const factor = Number(presentation?.conversion_factor ?? 1);
  return Number.isFinite(factor) && factor > 0 ? Number(physicalUnitPrice) * factor : Number(physicalUnitPrice);
}

/**
 * Converts the commercial entry to the physical quantity used by stock,
 * separation and MRP. `unit_price` remains the price of one commercial unit.
 */
export function buildCommercialOrderItem(
  product: PhysicalProduct,
  variant: PhysicalVariant,
  commercialQuantity: number,
  unitPrice: number,
  presentation?: CommercialPresentation | null,
  notes?: string | null,
) {
  const selected = presentation ?? directCommercialPresentation(product, variant);
  const factor = Number(selected.conversion_factor);
  if (!Number.isFinite(commercialQuantity) || commercialQuantity <= 0) {
    throw new Error('Informe uma quantidade comercial maior que zero.');
  }
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new Error('A apresentação comercial possui fator de conversão inválido.');
  }
  return {
    product_id: product.id,
    variant_id: variant?.id ?? null,
    quantity: commercialQuantity * factor,
    unit_price: unitPrice,
    notes: notes ?? null,
    commercial_presentation_id: presentation?.id ?? null,
    commercial_presentation_name: selected.name,
    commercial_unit_label: selected.commercial_unit_label,
    commercial_conversion_factor: factor,
    commercial_quantity: commercialQuantity,
    physical_unit_label: getPhysicalIdentityUnit(product, variant),
  };
}

/** Legacy rows have no snapshot and remain direct physical entries. */
export function getCommercialQuantity(item: { quantity: number; commercial_quantity?: number | null }) {
  return Number(item.commercial_quantity ?? item.quantity ?? 0);
}

export function getOrderItemLineTotal(item: { quantity: number; unit_price?: number | null; commercial_quantity?: number | null }) {
  return getCommercialQuantity(item) * Number(item.unit_price ?? 0);
}

export function formatCommercialQuantity(item: { quantity: number; commercial_quantity?: number | null; commercial_unit_label?: string | null; commercial_conversion_factor?: number | null; physical_unit_label?: string | null }) {
  const commercialQuantity = item.commercial_quantity;
  const factor = item.commercial_conversion_factor;
  if (commercialQuantity != null && factor != null && factor !== 1) {
    return `${commercialQuantity} ${item.commercial_unit_label ?? 'un'} × ${factor} = ${item.quantity} ${item.physical_unit_label ?? 'un'}`;
  }
  return `${item.quantity} ${item.physical_unit_label ?? item.commercial_unit_label ?? 'un'}`;
}
