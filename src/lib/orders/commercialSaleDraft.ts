import type { CommercialPresentation } from '@/lib/products/commercialPresentation';

/**
 * Item de entrada comercial (CRM ou Operações), ANTES da expansão física.
 * Não grava Pedido, preço, estoque, financeiro ou Resultado.
 */
export interface CommercialSaleDraftLine {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  commercial_quantity: number;
  unit_price: number;
  commercial_presentation: CommercialPresentation | null;
  _unit_price_text?: string;
}

/**
 * Copia um item para lançar outro sabor da MESMA família.
 * Apresentações atreladas à variante física anterior NÃO podem ser herdadas.
 * Apresentações independentes ou composições fixas podem ser reaproveitadas.
 * A escolha da nova variante continua obrigatória no formulário/contrato.
 * Preserva a quantidade comercial somente quando a apresentação for compatível.\n * Se remover apresentação vinculada ao sabor, reinicia a quantidade para não trocar caixas por unidades.\n * Não altera a linha original.
 */
export function duplicateCommercialSaleLine<T extends CommercialSaleDraftLine>(
  lines: readonly T[],
  index: number,
): T[] {
  const source = lines[index];
  if (!source?.product_id) return [...lines];
  const presentation = source.commercial_presentation;
  const safePresentation = presentation?.composition_mode === 'composite'
    || !presentation?.variant_id ? presentation : null;
  // Se a apresentação vinculada ao sabor anterior foi removida,
  // manter "3 caixas" como "3 unidades" mudaria silenciosamente o Pedido.
  // Nesse caso, exigir a nova apresentação e a quantidade novamente.
  const presentationWasDropped = Boolean(presentation && !safePresentation);
  const commercialQuantity = !presentationWasDropped
    && Number.isFinite(source.commercial_quantity) && source.commercial_quantity > 0
    ? source.commercial_quantity : 1;

  const duplicate = {
    ...source,
    variant_id: null,
    commercial_presentation: safePresentation,
    commercial_quantity: commercialQuantity,
    quantity: commercialQuantity * (safePresentation?.conversion_factor ?? 1),
    _unit_price_text: undefined,
  } as T;
  return [...lines.slice(0, index + 1), duplicate, ...lines.slice(index + 1)];
}
