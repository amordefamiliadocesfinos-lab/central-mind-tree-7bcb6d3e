import { buildShopeeImportItems, buildShopeePreview, normalizeShopeeShippingRows } from './shopeeShippingXlsx';

function expect(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

const rows = [
  { 'ID do pedido': '2608220THGM468', 'Nome do produto': 'Trufa SH-002-040', 'Nome da variação': 'Morango', Quantidade: 3, 'Nome do destinatário': 'Comprador Shopee', 'Valor Total': '21.00', CEP: '12345000' },
  { 'ID do pedido': '2608220THGM468', 'Nome do produto': 'Trufa SH-002-040', 'Nome da variação': 'Maracujá', Quantidade: 1 },
  { 'ID do pedido': '2608220THGM469', 'Nome do produto': 'Trufa SH-002-009', Quantidade: 2 },
];
const orders = normalizeShopeeShippingRows(rows, 'Conta teste');
expect(orders.length === 2, 'IDs distintos devem permanecer pedidos separados');
expect(orders[0].items.length === 2, 'Linhas do mesmo ID devem formar um pedido com dois itens');
expect(orders[0].customerName === 'Comprador Shopee', 'Nome do destinatário deve enriquecer o pedido');
expect(orders[0].commercialTotal === 21, 'Valor comercial do pedido deve ser preservado');
const preview = buildShopeePreview(orders, [{ external_item_key: orders[0].items[0].externalItemKey, product_id: 'produto-1', physical_multiplier: 7 }], new Set(['2608220THGM469']));
expect(preview[0].items[0].physicalQuantity === 21, '3 x 7 deve resultar em 21 unidades físicas');
expect(preview[0].items[1].mappingStatus === 'needs_mapping', 'Item sem mapa deve pedir associação');
expect(preview[1].duplicateStatus === 'already_imported', 'Pedido existente deve ser identificado na prévia');
let invalidRaised = false;
try { normalizeShopeeShippingRows([{ 'ID do pedido': '', 'Nome do produto': 'X', Quantidade: 1 }], 'Conta teste'); } catch { invalidRaised = true; }
expect(invalidRaised, 'Arquivo inválido deve falhar sem efeitos operacionais');

// Composição comercial múltipla
const multi = buildShopeePreview(orders, [{
  external_item_key: orders[0].items[0].externalItemKey,
  product_id: 'p1', physical_multiplier: 1,
  components: [
    { product_id: 'p1', variant_id: 'v1', physical_multiplier: 10, position: 0 },
    { product_id: 'p1', variant_id: 'v2', physical_multiplier: 10, position: 1 },
    { product_id: 'p1', variant_id: 'v3', physical_multiplier: 10, position: 2 },
  ],
}], new Set());
expect(multi[0].items[0].components.length === 3, 'Composição deve manter 3 componentes');
expect(multi[0].items[0].components[2].physicalQuantity === 30, 'Qtd Shopee 3 × 10 = 30 físicas');
const physical = buildShopeeImportItems(multi[0]);
const composed = physical.filter(i => i.external_item_key === orders[0].items[0].externalItemKey);
expect(composed.length === 3, 'Item comercial deve expandir em 3 itens físicos');
expect(composed[0].unit_price === orders[0].items[0].unitPrice && composed[1].unit_price === 0 && composed[2].unit_price === 0, 'Valor comercial não pode ser multiplicado');
expect(composed.every(i => i.commercial_quantity === 3), 'Quantidade comercial preservada por componente');
console.log('shopee composition tests ok');
