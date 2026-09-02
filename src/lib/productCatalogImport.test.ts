import { analyzeProductCatalog, type CatalogProduct, type CatalogVariant, type ProductCatalogRow } from './productCatalogImport';

const product: CatalogProduct = { id: '11111111-1111-1111-1111-111111111111', sku: 'BROWNIE-40', name: 'Brownie 40g', category: 'Doces', unit: 'un', cost: 2, price: 5, min_stock: 10, description: 'Original', attributes: { sabor: 'chocolate' }, expiry_days: null, is_active: true, height_cm: null, width_cm: null, length_cm: null, weight_g: 40 };
const variant: CatalogVariant = { id: '22222222-2222-2222-2222-222222222222', product_id: product.id, sku: 'BROWNIE-40-MORANGO', variant_name: 'Morango', attributes: { sabor: 'morango', peso: '40g' }, unit: null, cost_override: null, price_override: null, is_active: true, height_cm: null, width_cm: null, length_cm: null, weight_g: null };
const row = (patch: Partial<ProductCatalogRow>): ProductCatalogRow => ({ rowNumber: 2, tipo_registro: 'PRODUTO', produto_id: product.id, produto_sku: product.sku, produto_nome: product.name, categoria: 'Doces', unidade: 'un', custo: '2', preco: '5', estoque_minimo: '10', descricao: 'Original', produto_atributos: 'sabor=chocolate', validade_dias: '', produto_status: 'Ativo', produto_altura_cm: '', produto_largura_cm: '', produto_comprimento_cm: '', produto_peso_g: '40', variante_id: '', variante_sku: '', variante_nome: '', variante_atributos: '', variante_unidade: '', variante_custo_override: '', variante_preco_override: '', variante_status: '', variante_altura_cm: '', variante_largura_cm: '', variante_comprimento_cm: '', variante_peso_g: '', familia: '', modo_variacao: '', comprado: '', fabricado: '', intermediario: '', ...patch });
const expect = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };

const unchanged = analyzeProductCatalog([row({})], [product], [variant], ['Doces']);
expect(unchanged.errors === 0 && unchanged.unchanged === 1 && unchanged.changes === 0, 'produto exportado deve reimportar sem alteração');
const blankPreserves = analyzeProductCatalog([row({ preco: '', descricao: '' })], [product], [variant], ['Doces']);
expect(blankPreserves.changes === 0, 'células vazias devem preservar valores existentes');
const changed = analyzeProductCatalog([row({ preco: '6,50' })], [product], [variant], ['Doces']);
expect(changed.changes === 1 && changed.payload.products[0].price === 6.5, 'preço deve gerar alteração explícita');
const lineBreakOnly = analyzeProductCatalog([row({ descricao: 'Original\r\ncom quebra' })], [{ ...product, description: 'Original\ncom quebra' }], [variant], ['Doces']);
expect(lineBreakOnly.changes === 0, 'CRLF e LF na descrição devem ser semanticamente equivalentes');
const newMasterWithVariant = analyzeProductCatalog([row({ rowNumber: 2, produto_id: '', produto_sku: 'NOVO-01', produto_nome: 'Novo', custo: '', preco: '' }), row({ rowNumber: 3, tipo_registro: 'VARIACAO', produto_id: '', produto_sku: 'NOVO-01', produto_nome: 'Novo', variante_id: '', variante_sku: 'NOVO-01-A', variante_nome: 'A', variante_atributos: 'peso=40g; sabor=morango', variante_status: 'Ativo' })], [product], [variant], ['Doces']);
expect(newMasterWithVariant.errors === 0 && newMasterWithVariant.changes === 2 && newMasterWithVariant.payload.variants[0].product_sku === 'NOVO-01', 'novo mestre e variação devem compor lote atômico');
const duplicate = analyzeProductCatalog([row({}), row({ rowNumber: 3, produto_id: '', produto_nome: 'Duplicado' })], [product], [variant], ['Doces']);
expect(duplicate.errors === 1, 'SKU duplicado no arquivo deve bloquear');
const missingMaster = analyzeProductCatalog([row({ tipo_registro: 'VARIACAO', produto_id: '', produto_sku: 'INEXISTENTE', variante_id: '', variante_sku: 'NOVA-VAR', variante_nome: 'Nova' })], [product], [variant], ['Doces']);
expect(missingMaster.errors === 1, 'variação sem mestre deve bloquear');
console.log('productCatalogImport tests: ok');
