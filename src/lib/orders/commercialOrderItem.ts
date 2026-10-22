import { getPhysicalIdentityUnit } from '@/lib/productVariants';
import {
  directCommercialPresentation,
  type CommercialPresentation,
} from '@/lib/products/commercialPresentation';

export type CommercialOrderItemSnapshot = {
  commercial_presentation_id?: string | null;
  commercial_group_id?: string | null;
  commercial_presentation_name?: string | null;
  commercial_unit_label?: string | null;
  commercial_conversion_factor?: number | null;
  commercial_quantity?: number | null;
  physical_unit_label?: string | null;
};

type PhysicalProduct = { id: string; unit?: string | null; variation_mode?: string | null; is_active?: boolean };
type PhysicalVariant = { id: string; product_id?: string; unit?: string | null; price_override?: number | null; is_active?: boolean } | null | undefined;
export type PhysicalCatalog = { products: PhysicalProduct[]; variants: NonNullable<PhysicalVariant>[] };

/**
 * The 75 kg Glucose container is a production-only material: its stock is
 * controlled in grams and must remain available to BOM/production, not Sales.
 * This is a commercial eligibility rule, not an is_active/stock mutation.
 */
export const GLUCODRY_PRODUCT_ID = '92088a70-8cc0-40ef-a39d-564603df6866';
export const GLUCODRY_GD2_PRESENTATION_ID = '8dd3b126-36bd-4bb2-a695-bdbfefdc8507';
export function isGlucodryGD2(presentationId: string | null | undefined): boolean {
  return presentationId === GLUCODRY_GD2_PRESENTATION_ID;
}

export const CHOCOLATE_BASE_PRODUCT_ID = 'c70dd4b4-bc59-4d88-81ef-1a8c47315560';
export const CHOCOLATE_CB3_BRANCO_ID = 'c8b30000-0000-4000-8000-000000000001';
export const CHOCOLATE_CB3_MEIO_AMARGO_ID = 'c8b30000-0000-4000-8000-000000000002';
export function isChocolateCB3(presentationId: string | null | undefined): boolean {
  return presentationId === CHOCOLATE_CB3_BRANCO_ID || presentationId === CHOCOLATE_CB3_MEIO_AMARGO_ID;
}

export const AMENDOIM_TORRADO_PRODUCT_ID = 'c177f332-a1c7-4276-9cef-7b81af920174';
export const AMENDOIM_AM3_PRESENTATION_ID = 'a3400000-0000-4000-8000-000000002400';
export const isAmendoimAM3 = (id: string | null | undefined) => id === AMENDOIM_AM3_PRESENTATION_ID;

const GLUCOSE_PRODUCT_ID = '788f7d5a-276c-49c8-8171-cccf7621e2fe';
const GLUCOSE_PRODUCTION_VARIANT_ID = '222c4ec7-45da-4a1c-961e-d61ac2a914d4';

export function isSaleVariantAllowed(productId: string, variantId: string | null | undefined): boolean {
  return !(productId === GLUCOSE_PRODUCT_ID && variantId === GLUCOSE_PRODUCTION_VARIANT_ID);
}

function assertSaleVariantAllowed(productId: string, variantId: string | null | undefined): void {
  if (!isSaleVariantAllowed(productId, variantId)) {
    throw new Error('Glucose de Milho 75 kg é exclusiva para produção e não pode ser vendida.');
  }
}

/** Price for one commercial unit. The catalog/variant price remains physical. */
export function getDefaultCommercialUnitPrice(
  product: PhysicalProduct & { price?: number | null },
  variant?: PhysicalVariant,
  presentation?: (Pick<CommercialPresentation, 'conversion_factor'> & { id?: string }) | null,
) {
  if (product.id === AMENDOIM_TORRADO_PRODUCT_ID && isAmendoimAM3(presentation?.id)) return 0;
  // The CB3 bag has a negotiated selling price, NOT the variant's per-gram cost.
  if (product.id === CHOCOLATE_BASE_PRODUCT_ID && isChocolateCB3(presentation?.id)) return 0;
  // Referência de laboratório GD2; o valor segue editável pelo operador.
  if (product.id === GLUCODRY_PRODUCT_ID && isGlucodryGD2((presentation as { id?: string } | null)?.id)) return 449;
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
  assertSaleVariantAllowed(product.id, variant?.id);
  const selected = presentation ?? directCommercialPresentation(product, variant);
  const sealedGD2 = product.id === GLUCODRY_PRODUCT_ID && isGlucodryGD2(presentation?.id);
  const sealedCB3 = product.id === CHOCOLATE_BASE_PRODUCT_ID && isChocolateCB3(presentation?.id);
  const sealedAM3 = product.id === AMENDOIM_TORRADO_PRODUCT_ID && isAmendoimAM3(presentation?.id);
  if (sealedCB3 && (!Number.isSafeInteger(commercialQuantity) || commercialQuantity<1 ||
    Number(selected.conversion_factor)!==1 || !variant ||
    (presentation?.id === CHOCOLATE_CB3_BRANCO_ID && variant.id !== 'f6588f52-6e28-4ce9-b492-a95c847d5c0c') ||
    (presentation?.id === CHOCOLATE_CB3_MEIO_AMARGO_ID && variant.id !== '1a3d59a6-4712-4afd-811a-5a72aad76fa9'))) {
    throw new Error('Chocolate CB3 exige saco original lacrado de 20 kg da cobertura correta.');
  }
  if (sealedCB3 && (!Number.isFinite(unitPrice) || unitPrice<=0)) {
    throw new Error('Informe o preço comercial do saco fechado de Chocolate CB3.');
  }
  if (sealedAM3 && (!Number.isSafeInteger(commercialQuantity) || commercialQuantity<1 ||
    Number(selected.conversion_factor)!==1 || variant != null ||
    !presentation?.is_active || presentation.product_id!==product.id ||
    presentation.commercial_unit_label!=='saco')) {
    throw new Error('AM3 exige quantidade inteira de sacos originais fechados de Amendoim 24kg.');
  }
  if (sealedAM3 && (!Number.isFinite(unitPrice) || unitPrice<=0)) {
    throw new Error('Informe o preço negociado por saco fechado de Amendoim 24kg.');
  }
  if (sealedGD2 && (commercialQuantity !== 1 || Number(selected.conversion_factor) !== 1)) {
    throw new Error('Glucodry GD2 permite somente um saco fechado de 25 kg por pedido.');
  }
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
    physical_unit_label: sealedGD2 || sealedCB3 || sealedAM3 ? 'saco' : getPhysicalIdentityUnit(product, variant),
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
    assertSaleVariantAllowed(componentProduct.id, componentVariant.id);
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
  const commercialGroupId = crypto.randomUUID();
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
      commercial_presentation_id: presentation.id,
      commercial_group_id: commercialGroupId,
      commercial_presentation_name: presentation.name,
      commercial_unit_label: presentation.commercial_unit_label,
      commercial_conversion_factor: quantity,
      commercial_quantity: commercialQuantity,
      physical_unit_label: getPhysicalIdentityUnit(componentProduct, componentVariant),
    };
  });
}
