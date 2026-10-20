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

type PhysicalProduct = { id: string; unit?: string | null; variation_mode?: string | null; is_active?: boolean };
type PhysicalVariant = { id: string; product_id?: string; unit?: string | null; price_override?: number | null; is_active?: boolean } | null | undefined;
export type PhysicalCatalog = { products: PhysicalProduct[]; variants: NonNullable<PhysicalVariant>[] };

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

/**
 * Canonical expansion. A mixed presentation owns a composition rather than
 * a physical variant. Each component becomes an independently separable line.
 * Values are allocated proportionally, preserving the negotiated tray total.
 */
export function expandCommercialOrderItem(
  product: PhysicalProduct,
  variant: PhysicalVariant,
  commercialQuantity: number,
  unitPrice: number,
  presentation?: CommercialPresentation | null,
  notes?: string | null,
  physicalCatalog?: PhysicalCatalog,
) {
  if (presentation?.composition_mode !== 'composite') {
    return [buildCommercialOrderItem(product, variant, commercialQuantity, unitPrice, presentation, notes)];
  }
  if (!physicalCatalog) throw new Error('Catálogo físico é obrigatório para expandir apresentações compostas.');
  if (!presentation.is_active || presentation.product_id !== product.id) {
    throw new Error('Apresentação composta inativa ou de outro Produto Mestre.');
  }
  if (!Number.isSafeInteger(commercialQuantity) || commercialQuantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new Error('Quantidade comercial ou preço inválido para a apresentação composta.');
  }
  const components = presentation.components ?? [];
  if (!components.length || !Number.isSafeInteger(Number(presentation.conversion_factor))) {
    throw new Error('Apresentação composta sem composição física válida.');
  }
  const resolved = components.map(component => {
    const componentProduct = physicalCatalog.products.find(candidate => candidate.id === component.product_id);
    const componentVariant = physicalCatalog.variants.find(candidate => candidate.id === component.variant_id);
    const quantity = Number(component.quantity);
    if (!componentProduct || componentProduct.is_active === false) {
      throw new Error('Componente físico inexistente ou inativo.');
    }
    if (!component.variant_id || !componentVariant || componentVariant.product_id !== componentProduct.id || componentVariant.is_active === false) {
      throw new Error('Variante física inexistente, inativa ou incompatível com o componente.');
    }
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new Error('Quantidade física inválida na composição.');
    }
    if ((componentProduct.variation_mode ?? 'variacoes_fisicas') === 'sem_variacao') {
      throw new Error('Produto simples não aceita variante física.');
    }
    return { component, componentProduct, componentVariant, quantity };
  });
  const total = resolved.reduce((n, item) => n + item.quantity, 0);
  if (total !== Number(presentation.conversion_factor)) {
    throw new Error('Apresentação composta com soma física incompatível.');
  }
  const distinct = new Set(resolved.map(item => item.component.product_id + ':' + item.component.variant_id));
  if (distinct.size !== resolved.length) {
    throw new Error('Apresentação composta com componente físico duplicado.');
  }
  const originalCents = Math.round(unitPrice * 100 * commercialQuantity);
  if (!Number.isSafeInteger(originalCents)) throw new Error('Valor total inválido.');
  const note = [notes, `Apresentação: ${presentation.name} · ${commercialQuantity} unidade(s) comercial(is)`].filter(Boolean).join(' | ');
  let allocatedCents = 0;
  return resolved.map(({ component, componentProduct, componentVariant, quantity }, index) => {
    const cents = index === resolved.length - 1
      ? originalCents - allocatedCents
      : Math.round(originalCents * quantity / total);
    allocatedCents += cents;
    return {
      product_id: componentProduct.id,
      variant_id: componentVariant.id,
      quantity: quantity * commercialQuantity,
      unit_price: cents / 100 / commercialQuantity,
      notes: note,
      commercial_presentation_id: null,
      commercial_presentation_name: presentation.name,
      commercial_unit_label: presentation.commercial_unit_label,
      commercial_conversion_factor: quantity,
      commercial_quantity: commercialQuantity,
      physical_unit_label: getPhysicalIdentityUnit(componentProduct, componentVariant),
    };
  });
}
