import { formatVariantAttributes, parseVariantAttributes } from '@/lib/productVariants';

export const PRODUCT_CATALOG_HEADERS = [
  'tipo_registro', 'produto_id', 'produto_sku', 'produto_nome', 'categoria', 'unidade', 'custo', 'preco', 'estoque_minimo', 'descricao', 'produto_atributos', 'validade_dias', 'produto_status', 'produto_altura_cm', 'produto_largura_cm', 'produto_comprimento_cm', 'produto_peso_g',
  'variante_id', 'variante_sku', 'variante_nome', 'variante_atributos', 'variante_unidade', 'variante_custo_override', 'variante_preco_override', 'variante_status', 'variante_altura_cm', 'variante_largura_cm', 'variante_comprimento_cm', 'variante_peso_g',
  'familia', 'modo_variacao', 'comprado', 'fabricado', 'intermediario',
] as const;

export type ProductCatalogRow = Record<(typeof PRODUCT_CATALOG_HEADERS)[number], string> & { rowNumber: number };
export type CatalogProduct = { id: string; sku: string; name: string; category: string | null; family_name?: string | null; variation_mode?: 'sem_variacao' | 'variacoes_fisicas' | null; is_purchased?: boolean; is_manufactured?: boolean; is_intermediate?: boolean; unit: string | null; cost: number | null; price: number | null; min_stock: number | null; description: string | null; attributes: Record<string, unknown> | null; expiry_days: number | null; is_active: boolean; height_cm: number | null; width_cm: number | null; length_cm: number | null; weight_g: number | null };
export type CatalogVariant = { id: string; product_id: string; sku: string; variant_name: string; attributes: Record<string, unknown> | null; unit: string | null; cost_override: number | null; price_override: number | null; is_active: boolean; height_cm: number | null; width_cm: number | null; length_cm: number | null; weight_g: number | null };
export type CatalogState = 'NOVO' | 'ALTERAR' | 'SEM_ALTERACAO' | 'ERRO' | 'ATENCAO';
export type CatalogPreviewLine = { rowNumber: number; kind: 'PRODUTO' | 'VARIACAO'; state: CatalogState; title: string; details: string; changes: string[] };
export type CatalogImportPayload = { products: Record<string, unknown>[]; variants: Record<string, unknown>[] };
export type CatalogAnalysis = { lines: CatalogPreviewLine[]; payload: CatalogImportPayload; errors: number; changes: number; unchanged: number; attention: number };

const text = (value: unknown) => String(value ?? '').trim();
const rawText = (value: unknown) => String(value ?? '');
const normalizeLineEndings = (value: string) => value.replace(/\r\n?/g, '\n');
const key = (value: string) => value.trim().toLocaleLowerCase();
const sameFieldValue = (field: string, before: unknown, after: unknown) => field === 'attributes'
  ? formatVariantAttributes(before as Record<string, unknown> | null) === formatVariantAttributes(after as Record<string, unknown> | null)
  : !different(before, after);
const numberValue = (value: string, label: string, errors: string[]) => {
  if (!text(value)) return undefined;
  const parsed = Number(value.replace(',', '.'));
  if (!Number.isFinite(parsed)) { errors.push(`${label} inválido`); return undefined; }
  return parsed;
};
const optional = <T>(fileValue: string, current: T) => text(fileValue) ? fileValue : current;
const numberOptional = (fileValue: string, current: number | null, label: string, errors: string[]) => text(fileValue) ? (numberValue(fileValue, label, errors) ?? current) : current;
const stateValue = (value: string, current: boolean, errors: string[]) => {
  if (!text(value)) return current;
  const normalized = key(value);
  if (['ativo', 'active', 'sim', 'true'].includes(normalized)) return true;
  if (['inativo', 'inactive', 'não', 'nao', 'false'].includes(normalized)) return false;
  errors.push('status deve ser Ativo ou Inativo');
  return current;
};
const booleanValue = (value: string, current: boolean, errors: string[]) => {
  if (!text(value)) return current;
  const normalized = key(value);
  if (['sim', 'true', '1'].includes(normalized)) return true;
  if (['não', 'nao', 'false', '0'].includes(normalized)) return false;
  errors.push('capacidade deve ser Sim ou Não');
  return current;
};
const different = (before: unknown, after: unknown) => JSON.stringify(before ?? null) !== JSON.stringify(after ?? null);

export function toCatalogRows(products: CatalogProduct[], variants: CatalogVariant[]): ProductCatalogRow[] {
  const productRows = products.map(product => ({
    tipo_registro: 'PRODUTO', produto_id: product.id, produto_sku: product.sku, produto_nome: product.name, categoria: product.category ?? '', unidade: product.unit ?? '', custo: product.cost == null ? '' : String(product.cost), preco: product.price == null ? '' : String(product.price), estoque_minimo: product.min_stock == null ? '' : String(product.min_stock), descricao: product.description ?? '', produto_atributos: formatVariantAttributes(product.attributes), validade_dias: product.expiry_days == null ? '' : String(product.expiry_days), produto_status: product.is_active ? 'Ativo' : 'Inativo', produto_altura_cm: product.height_cm == null ? '' : String(product.height_cm), produto_largura_cm: product.width_cm == null ? '' : String(product.width_cm), produto_comprimento_cm: product.length_cm == null ? '' : String(product.length_cm), produto_peso_g: product.weight_g == null ? '' : String(product.weight_g), variante_id: '', variante_sku: '', variante_nome: '', variante_atributos: '', variante_unidade: '', variante_custo_override: '', variante_preco_override: '', variante_status: '', variante_altura_cm: '', variante_largura_cm: '', variante_comprimento_cm: '', variante_peso_g: '', familia: product.family_name ?? product.category ?? '', modo_variacao: product.variation_mode ?? 'sem_variacao', comprado: product.is_purchased ? 'Sim' : 'Não', fabricado: product.is_manufactured ? 'Sim' : 'Não', intermediario: product.is_intermediate ? 'Sim' : 'Não',
  }));
  const variantRows = variants.map(variant => {
    const product = products.find(item => item.id === variant.product_id);
    return { tipo_registro: 'VARIACAO', produto_id: product?.id || variant.product_id, produto_sku: product?.sku || '', produto_nome: product?.name || '', categoria: '', unidade: '', custo: '', preco: '', estoque_minimo: '', descricao: '', produto_atributos: '', validade_dias: '', produto_status: '', produto_altura_cm: '', produto_largura_cm: '', produto_comprimento_cm: '', produto_peso_g: '', variante_id: variant.id, variante_sku: variant.sku, variante_nome: variant.variant_name, variante_atributos: formatVariantAttributes(variant.attributes), variante_unidade: variant.unit ?? '', variante_custo_override: variant.cost_override == null ? '' : String(variant.cost_override), variante_preco_override: variant.price_override == null ? '' : String(variant.price_override), variante_status: variant.is_active ? 'Ativo' : 'Inativo', variante_altura_cm: variant.height_cm == null ? '' : String(variant.height_cm), variante_largura_cm: variant.width_cm == null ? '' : String(variant.width_cm), variante_comprimento_cm: variant.length_cm == null ? '' : String(variant.length_cm), variante_peso_g: variant.weight_g == null ? '' : String(variant.weight_g), familia: '', modo_variacao: '', comprado: '', fabricado: '', intermediario: '' };
  });
  return [...productRows, ...variantRows] as ProductCatalogRow[];
}

export function analyzeProductCatalog(rows: ProductCatalogRow[], products: CatalogProduct[], variants: CatalogVariant[], categories: string[]): CatalogAnalysis {
  const lines: CatalogPreviewLine[] = []; const payload: CatalogImportPayload = { products: [], variants: [] };
  const errors: CatalogPreviewLine[] = []; const seenSku = new Map<string, number>();
  const productById = new Map(products.map(product => [product.id, product])); const productBySku = new Map(products.map(product => [key(product.sku), product])); const variantById = new Map(variants.map(variant => [variant.id, variant])); const variantBySku = new Map(variants.map(variant => [key(variant.sku), variant])); const categoriesByKey = new Map(categories.map(category => [key(category), category]));
  const fileProductSkus = new Set(rows.filter(row => key(row.tipo_registro) === 'produto').map(row => key(row.produto_sku)).filter(Boolean));
  for (const row of rows) {
    const kind = key(row.tipo_registro) === 'variacao' || key(row.tipo_registro) === 'variação' ? 'VARIACAO' : key(row.tipo_registro) === 'produto' ? 'PRODUTO' : null;
    const rowErrors: string[] = [];
    if (!kind) rowErrors.push('tipo_registro deve ser PRODUTO ou VARIACAO');
    const sku = kind === 'PRODUTO' ? text(row.produto_sku) : text(row.variante_sku);
    const name = kind === 'PRODUTO' ? rawText(row.produto_nome) : rawText(row.variante_nome);
    if (!sku) rowErrors.push('SKU obrigatório'); if (!name) rowErrors.push('nome obrigatório');
    if (sku) { const skuKey = key(sku); if (seenSku.has(skuKey)) rowErrors.push(`SKU duplicado no arquivo (linha ${seenSku.get(skuKey)})`); else seenSku.set(skuKey, row.rowNumber); }
    if (kind === 'PRODUTO' && text(row.categoria) && !categoriesByKey.has(key(row.categoria))) rowErrors.push('categoria inexistente');
    const allNumeric = kind === 'PRODUTO' ? [['custo', row.custo], ['preço', row.preco], ['estoque mínimo', row.estoque_minimo], ['validade', row.validade_dias], ['altura', row.produto_altura_cm], ['largura', row.produto_largura_cm], ['comprimento', row.produto_comprimento_cm], ['peso', row.produto_peso_g]] : [['custo override', row.variante_custo_override], ['preço override', row.variante_preco_override], ['altura', row.variante_altura_cm], ['largura', row.variante_largura_cm], ['comprimento', row.variante_comprimento_cm], ['peso', row.variante_peso_g]];
    allNumeric.forEach(([label, value]) => numberValue(value, label, rowErrors));
    if (kind === 'PRODUTO') {
      const existing = text(row.produto_id) ? productById.get(text(row.produto_id)) : productBySku.get(key(sku));
      const keepsOwnSku = Boolean(existing && key(existing.sku) === key(sku));
      const collisionVariant = variantBySku.get(key(sku)); if (collisionVariant && !keepsOwnSku) rowErrors.push('SKU já pertence a uma variação');
      if (text(row.produto_id) && !existing) rowErrors.push('produto_id não encontrado');
      if (existing && productBySku.get(key(sku)) && productBySku.get(key(sku))?.id !== existing.id) rowErrors.push('SKU já pertence a outro produto');
      if (rowErrors.length) { errors.push({ rowNumber: row.rowNumber, kind: 'PRODUTO', state: 'ERRO', title: sku || 'Produto sem SKU', details: rowErrors.join(' · '), changes: [] }); continue; }
      const variationMode = text(row.modo_variacao) || existing?.variation_mode || 'sem_variacao';
      if (!['sem_variacao', 'variacoes_fisicas'].includes(variationMode)) rowErrors.push('modo_variacao inválido');
      const next = { id: existing?.id || null, sku, name, category: text(row.categoria) ? categoriesByKey.get(key(row.categoria)) : (existing?.category ?? null), family_name: text(row.familia) || existing?.family_name || null, variation_mode: variationMode, is_purchased: booleanValue(row.comprado, existing?.is_purchased ?? false, rowErrors), is_manufactured: booleanValue(row.fabricado, existing?.is_manufactured ?? false, rowErrors), is_intermediate: booleanValue(row.intermediario, existing?.is_intermediate ?? false, rowErrors), unit: optional(row.unidade, existing?.unit ?? 'un'), cost: numberOptional(row.custo, existing?.cost ?? null, 'custo', rowErrors), price: numberOptional(row.preco, existing?.price ?? null, 'preço', rowErrors), min_stock: numberOptional(row.estoque_minimo, existing?.min_stock ?? 0, 'estoque mínimo', rowErrors), description: text(row.descricao) ? normalizeLineEndings(row.descricao) : (existing?.description ?? null), attributes: text(row.produto_atributos) ? parseVariantAttributes(row.produto_atributos) : (existing?.attributes ?? {}), expiry_days: numberOptional(row.validade_dias, existing?.expiry_days ?? null, 'validade', rowErrors), is_active: stateValue(row.produto_status, existing?.is_active ?? true, rowErrors), height_cm: numberOptional(row.produto_altura_cm, existing?.height_cm ?? null, 'altura', rowErrors), width_cm: numberOptional(row.produto_largura_cm, existing?.width_cm ?? null, 'largura', rowErrors), length_cm: numberOptional(row.produto_comprimento_cm, existing?.length_cm ?? null, 'comprimento', rowErrors), weight_g: numberOptional(row.produto_peso_g, existing?.weight_g ?? null, 'peso', rowErrors) };
      if (next.is_intermediate && !next.is_manufactured) rowErrors.push('intermediário exige produto fabricado');
      const changes = existing ? Object.entries(next).filter(([field, value]) => field !== 'id' && !sameFieldValue(field, (existing as any)[field], value)).map(([field]) => field) : [];
      const state: CatalogState = !existing ? 'NOVO' : changes.length ? 'ALTERAR' : 'SEM_ALTERACAO'; lines.push({ rowNumber: row.rowNumber, kind: 'PRODUTO', state, title: `${sku} · ${name}`, details: existing ? 'Produto existente' : 'Novo produto', changes }); if (state !== 'SEM_ALTERACAO') payload.products.push(next);
    } else if (kind === 'VARIACAO') {
      const existing = text(row.variante_id) ? variantById.get(text(row.variante_id)) : variantBySku.get(key(sku)); const master = text(row.produto_id) ? productById.get(text(row.produto_id)) : productBySku.get(key(row.produto_sku)); const masterSku = text(row.produto_sku);
      const keepsOwnSku = Boolean(existing && key(existing.sku) === key(sku));
      if (!master && !fileProductSkus.has(key(masterSku))) rowErrors.push('Produto mestre não encontrado'); if (text(row.variante_id) && !existing) rowErrors.push('variante_id não encontrado'); const collisionProduct = productBySku.get(key(sku)); if (collisionProduct && !keepsOwnSku) rowErrors.push('SKU já pertence a um produto mestre'); if (existing && variantBySku.get(key(sku)) && variantBySku.get(key(sku))?.id !== existing.id) rowErrors.push('SKU já pertence a outra variação');
      if (rowErrors.length) { errors.push({ rowNumber: row.rowNumber, kind: 'VARIACAO', state: 'ERRO', title: sku || 'Variação sem SKU', details: rowErrors.join(' · '), changes: [] }); continue; }
      const next = { id: existing?.id || null, product_id: master?.id || null, product_sku: masterSku, sku, variant_name: name, attributes: text(row.variante_atributos) ? parseVariantAttributes(row.variante_atributos) : (existing?.attributes ?? {}), unit: optional(row.variante_unidade, existing?.unit ?? null), cost_override: numberOptional(row.variante_custo_override, existing?.cost_override ?? null, 'custo override', rowErrors), price_override: numberOptional(row.variante_preco_override, existing?.price_override ?? null, 'preço override', rowErrors), is_active: stateValue(row.variante_status, existing?.is_active ?? true, rowErrors), height_cm: numberOptional(row.variante_altura_cm, existing?.height_cm ?? null, 'altura', rowErrors), width_cm: numberOptional(row.variante_largura_cm, existing?.width_cm ?? null, 'largura', rowErrors), length_cm: numberOptional(row.variante_comprimento_cm, existing?.length_cm ?? null, 'comprimento', rowErrors), weight_g: numberOptional(row.variante_peso_g, existing?.weight_g ?? null, 'peso', rowErrors) };
      const changes = existing ? Object.entries(next).filter(([field, value]) => !['id', 'product_sku'].includes(field) && !sameFieldValue(field, (existing as any)[field], value)).map(([field]) => field) : [];
      const state: CatalogState = !existing ? 'NOVO' : changes.length ? 'ALTERAR' : 'SEM_ALTERACAO'; lines.push({ rowNumber: row.rowNumber, kind: 'VARIACAO', state, title: `${sku} · ${name}`, details: `Mestre: ${master?.sku || masterSku}`, changes }); if (state !== 'SEM_ALTERACAO') payload.variants.push(next);
    }
  }
  lines.push(...errors); return { lines, payload, errors: errors.length, changes: payload.products.length + payload.variants.length, unchanged: lines.filter(line => line.state === 'SEM_ALTERACAO').length, attention: lines.filter(line => line.state === 'ATENCAO').length };
}
