import type { CommercialPresentation } from '@/lib/products/commercialPresentation';

export const TRUFA_PACK_MASTER_ID = 'af7fe3c4-863c-4d1f-9fcd-b4ecb92e5322';

/** Only the original sealed 100-unit, single-flavor presentation consumes P100. */
export function isTrufaSealedP100(
  productId: string,
  variantId: string | null | undefined,
  presentation?: CommercialPresentation | null,
): boolean {
  return productId === TRUFA_PACK_MASTER_ID && Boolean(variantId && presentation?.is_active &&
    presentation.product_id === TRUFA_PACK_MASTER_ID && presentation.variant_id === variantId &&
    presentation.composition_mode === 'single' &&
    Number(presentation.conversion_factor) === 100 &&
    presentation.commercial_unit_label === 'pacote');
}

export function sumTrufaSealedStock(
  rows: Array<{ variant_id: string; packs: number | string | null }>,
): Record<string, number> {
  return rows.reduce<Record<string, number>>((result, row) => {
    const value = Number(row.packs);
    if (Number.isFinite(value) && value >= 0)
      result[row.variant_id] = (result[row.variant_id] ?? 0) + value;
    return result;
  }, {});
}
