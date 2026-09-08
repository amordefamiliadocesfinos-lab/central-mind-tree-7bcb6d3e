export const BOM_IMPORT_HEADERS = [
  'produto_sku',
  'produto_variante_sku',
  'componente_sku',
  'componente_variante_sku',
  'quantidade',
  'observacao',
] as const;

export type BomImportRow = Record<(typeof BOM_IMPORT_HEADERS)[number], string> & { rowNumber: number };

export type BomImportProduct = {
  id: string;
  sku: string | null;
  name: string;
  variation_mode: 'sem_variacao' | 'variacoes_fisicas' | null;
  is_active?: boolean | null;
};

export type BomImportVariant = {
  id: string;
  product_id: string;
  sku: string | null;
  variant_name: string;
  is_active?: boolean | null;
};

export type BomImportExisting = {
  id: string;
  product_id: string;
  product_variant_id: string | null;
  component_id: string;
  variant_id: string | null;
  qty_per_unit: number;
  notes: string | null;
};

export type BomImportState = 'NOVO' | 'ATUALIZAR' | 'SEM_ALTERACAO' | 'ERRO';

export type BomImportLine = {
  rowNumber: number;
  state: BomImportState;
  details: string;
  finalLabel: string;
  componentLabel: string;
  quantity?: number;
  notes?: string | null;
  existingId?: string;
  payload?: {
    product_id: string;
    product_variant_id: string | null;
    component_id: string;
    variant_id: string | null;
    qty_per_unit: number;
    notes: string | null;
  };
};

export type BomImportAnalysis = {
  lines: BomImportLine[];
  changes: number;
  unchanged: number;
  errors: number;
};

const sku = (value: string | null | undefined) => String(value || '').trim();
const text = (value: string | null | undefined) => {
  const normalized = String(value || '').replace(/\r\n?/g, '\n').trim();
  return normalized || null;
};
const identity = (productId: string, productVariantId: string | null, componentId: string, componentVariantId: string | null) =>
  [productId, productVariantId || '', componentId, componentVariantId || ''].join('|');
const label = (product: BomImportProduct, variant?: BomImportVariant | null) => variant ? `${product.name} · ${variant.variant_name}` : product.name;

function parseQuantity(value: string) {
  const normalized = String(value || '').trim().replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolveIdentity(
  productSku: string,
  variantSku: string,
  role: 'final' | 'component',
  productsBySku: Map<string, BomImportProduct[]>,
  variantsBySku: Map<string, BomImportVariant[]>,
) {
  const matches = productsBySku.get(sku(productSku)) || [];
  if (!sku(productSku)) return { error: `SKU do ${role === 'final' ? 'produto final' : 'componente'} é obrigatório.` };
  if (matches.length !== 1) return { error: `SKU ${productSku} não identifica um único ${role === 'final' ? 'produto final' : 'componente'} ativo.` };
  const product = matches[0];
  const requiresVariant = product.variation_mode === 'variacoes_fisicas';
  if (requiresVariant && !sku(variantSku)) return { error: `${product.name} é Produto Mestre e exige SKU de variante física.` };
  if (!requiresVariant && sku(variantSku)) return { error: `${product.name} é produto simples e não aceita SKU de variante.` };
  if (!requiresVariant) return { product, variant: null };
  const variants = (variantsBySku.get(sku(variantSku)) || []).filter(variant => variant.product_id === product.id);
  if (variants.length !== 1) return { error: `SKU de variante ${variantSku} não pertence de forma única a ${product.name}.` };
  return { product, variant: variants[0] };
}

/**
 * Analisa o arquivo sem gravar nada. A identidade da linha é sempre
 * produto + variante final + componente + variante do componente.
 */
export function analyzeBomImport(
  rows: BomImportRow[],
  products: BomImportProduct[],
  variants: BomImportVariant[],
  existing: BomImportExisting[],
): BomImportAnalysis {
  const productsBySku = new Map<string, BomImportProduct[]>();
  products.filter(product => product.is_active !== false).forEach(product => {
    const key = sku(product.sku);
    if (!key) return;
    productsBySku.set(key, [...(productsBySku.get(key) || []), product]);
  });
  const variantsBySku = new Map<string, BomImportVariant[]>();
  variants.filter(variant => variant.is_active !== false).forEach(variant => {
    const key = sku(variant.sku);
    if (!key) return;
    variantsBySku.set(key, [...(variantsBySku.get(key) || []), variant]);
  });
  const existingByIdentity = new Map(existing.map(item => [identity(item.product_id, item.product_variant_id, item.component_id, item.variant_id), item]));
  const seen = new Set<string>();
  const lines = rows.map(row => {
    const final = resolveIdentity(row.produto_sku, row.produto_variante_sku, 'final', productsBySku, variantsBySku);
    const component = resolveIdentity(row.componente_sku, row.componente_variante_sku, 'component', productsBySku, variantsBySku);
    const quantity = parseQuantity(row.quantidade);
    if ('error' in final) return { rowNumber: row.rowNumber, state: 'ERRO' as const, details: final.error, finalLabel: row.produto_sku || 'Produto final', componentLabel: row.componente_sku || 'Componente' };
    if ('error' in component) return { rowNumber: row.rowNumber, state: 'ERRO' as const, details: component.error, finalLabel: label(final.product, final.variant), componentLabel: row.componente_sku || 'Componente' };
    if (!quantity) return { rowNumber: row.rowNumber, state: 'ERRO' as const, details: 'Quantidade deve ser numérica e maior que zero.', finalLabel: label(final.product, final.variant), componentLabel: label(component.product, component.variant) };
    const key = identity(final.product.id, final.variant?.id || null, component.product.id, component.variant?.id || null);
    if (seen.has(key)) return { rowNumber: row.rowNumber, state: 'ERRO' as const, details: 'A mesma identidade física está repetida no arquivo.', finalLabel: label(final.product, final.variant), componentLabel: label(component.product, component.variant) };
    seen.add(key);
    const previous = existingByIdentity.get(key);
    // Observação vazia em uma linha existente significa "preservar", como no
    // importador de catálogo. Somente uma observação preenchida substitui a nota.
    const importedNotes = text(row.observacao);
    const notes = importedNotes ?? text(previous?.notes);
    const payload = { product_id: final.product.id, product_variant_id: final.variant?.id || null, component_id: component.product.id, variant_id: component.variant?.id || null, qty_per_unit: quantity, notes };
    const isSame = previous && Number(previous.qty_per_unit) === quantity && text(previous.notes) === notes;
    return {
      rowNumber: row.rowNumber,
      state: (isSame ? 'SEM_ALTERACAO' : previous ? 'ATUALIZAR' : 'NOVO') as BomImportState,
      details: isSame ? 'Identidade e valores já correspondem ao cadastro.' : previous ? 'Quantidade e/ou observação será atualizada.' : 'Nova composição será criada.',
      finalLabel: label(final.product, final.variant),
      componentLabel: label(component.product, component.variant),
      quantity,
      notes,
      existingId: previous?.id,
      payload,
    };
  });
  return {
    lines,
    changes: lines.filter(line => line.state === 'NOVO' || line.state === 'ATUALIZAR').length,
    unchanged: lines.filter(line => line.state === 'SEM_ALTERACAO').length,
    errors: lines.filter(line => line.state === 'ERRO').length,
  };
}
