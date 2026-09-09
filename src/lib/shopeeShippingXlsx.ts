import * as XLSX from 'xlsx';

export interface ShopeeShippingItem {
  rowNumber: number;
  externalItemKey: string;
  productTitle: string;
  variation: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface ShopeeShippingOrder {
  marketplace: 'shopee';
  account: string;
  externalOrderId: string;
  externalStatus: string;
  trackingNumber: string;
  createdAt: string;
  paidAt: string;
  shippingAt: string;
  customerName: string;
  buyerUsername: string;
  document: string;
  customerContact: string;
  address: string;
  addressNumber: string;
  addressComplement: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  commercialTotal: number;
  sellerDiscount: number;
  shippingFee: number;
  items: ShopeeShippingItem[];
}

/** Uma linha física da composição comercial de um anúncio. */
export interface ShopeeMappingComponent {
  product_id: string;
  variant_id?: string | null;
  physical_multiplier: number;
  position?: number;
}

export interface ShopeeProductMapping {
  external_item_key: string;
  /** Cabeçalho legado (1 produto/variante). Mantido para compatibilidade. */
  product_id?: string | null;
  variant_id?: string | null;
  physical_multiplier?: number | null;
  /** Composição comercial completa. Quando ausente, usa o cabeçalho legado. */
  components?: ShopeeMappingComponent[] | null;
}

export interface ShopeePreviewComponent {
  productId: string;
  variantId: string | null;
  physicalMultiplier: number;
  physicalQuantity: number;
}

export interface ShopeePreviewItem extends ShopeeShippingItem {
  masterProductId: string | null;
  variantId: string | null;
  physicalMultiplier: number | null;
  physicalQuantity: number | null;
  components: ShopeePreviewComponent[];
  mappingStatus: 'recognized' | 'needs_mapping' | 'error';
}


export interface ShopeePreviewOrder extends Omit<ShopeeShippingOrder, 'items'> {
  items: ShopeePreviewItem[];
  duplicateStatus: 'new' | 'already_imported';
}

const HEADER_ALIASES = {
  orderId: ['id do pedido', 'order id', 'numero do pedido', 'número do pedido'],
  status: ['status do pedido', 'order status', 'status'],
  tracking: ['numero de rastreamento', 'número de rastreamento', 'tracking number', 'numero de tracking'],
  createdAt: ['data de criacao', 'data de criação', 'created time', 'data do pedido', 'data de criação do pedido'],
  paidAt: ['data de pagamento', 'paid time', 'payment time', 'hora do pagamento do pedido'],
  shippingAt: ['data de envio', 'shipping time', 'prazo de envio', 'tempo de envio', 'data prevista de envio'],
  product: ['nome do produto', 'product name', 'produto'],
  variation: ['nome da variacao', 'nome da variação', 'variation name', 'variacao', 'variação'],
  quantity: ['quantidade', 'quantity', 'qty'],
  unitPrice: ['preco', 'preço', 'unit price', 'preco unitario', 'preço unitário', 'preco acordado', 'preço acordado', 'preco original', 'preço original'],
  subtotal: ['subtotal', 'total do produto', 'product subtotal'],
  // The delivery recipient is the operational name shown on the order. The
  // buyer username is marketplace metadata and must not replace it.
  customer: ['nome do destinatário', 'nome do destinatario', 'destinatário', 'destinatario', 'recipient name', 'nome do cliente'],
  buyerUsername: ['nome de usuário comprador', 'nome de usuario comprador', 'buyer username', 'comprador'],
  document: ['cpf do comprador', 'cpf', 'documento', 'document number'],
  phone: ['telefone', 'phone', 'telefone do comprador'],
  address: ['endereco', 'endereço', 'shipping address', 'endereço de entrega'],
  addressNumber: ['numero', 'número', 'número do endereço', 'numero do endereço'],
  addressComplement: ['complemento', 'address complement'],
  neighborhood: ['bairro', 'neighborhood'],
  city: ['cidade 1', 'cidade', 'city'],
  state: ['uf', 'estado', 'state'],
  zipCode: ['cep', 'zip code', 'postal code'],
  commercialTotal: ['valor total', 'order total', 'total value'],
  sellerDiscount: ['desconto do vendedor', 'seller discount'],
  shippingFee: ['taxa de envio pagas pelo comprador', 'shipping fee paid by buyer'],
  sku: ['numero de referencia sku', 'número de referência sku', 'sku reference no.', 'sku', 'no de referencia sku', 'nº de referencia do sku principal', 'nº de referência do sku principal'],
};

const normalizeHeader = (value: unknown) => String(value ?? '')
  .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

const text = (value: unknown) => String(value ?? '').trim();

export function parseShopeeNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  let source = text(value).replace(/R\$|\s/g, '');
  if (!source) return 0;
  if (source.includes(',') && source.includes('.')) source = source.replace(/\./g, '').replace(',', '.');
  else if (source.includes(',')) source = source.replace(',', '.');
  const parsed = Number(source.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function findValue(row: Record<string, unknown>, aliases: string[]): string {
  const entry = Object.entries(row).find(([header]) => {
    const normalized = normalizeHeader(header);
    return aliases.some(alias => normalized === normalizeHeader(alias));
  });
  return text(entry?.[1]);
}

export function buildShopeeExternalItemKey(productTitle: string, variation: string, sku: string): string {
  const variationKey = normalizeHeader(variation);
  const normalizedSku = normalizeHeader(sku).replace(/ /g, '-');
  if (normalizedSku) return `sku:${normalizedSku}|variation:${variationKey}`;
  const code = `${productTitle} ${variation}`.match(/\bSH-\d+(?:-\d+)+\b/i)?.[0];
  if (code) return `code:${code.toUpperCase()}|variation:${variationKey}`;
  return `title:${normalizeHeader(productTitle)}|${normalizeHeader(variation)}`;
}

export function normalizeShopeeShippingRows(rows: Record<string, unknown>[], account: string): ShopeeShippingOrder[] {
  const grouped = new Map<string, ShopeeShippingOrder>();
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const externalOrderId = findValue(row, HEADER_ALIASES.orderId);
    const productTitle = findValue(row, HEADER_ALIASES.product);
    const quantity = parseShopeeNumber(findValue(row, HEADER_ALIASES.quantity));
    if (!externalOrderId && !productTitle) return;
    if (!externalOrderId || !productTitle || quantity <= 0) {
      errors.push(`Linha ${index + 2}: ID do pedido, produto e quantidade são obrigatórios.`);
      return;
    }
    const variation = findValue(row, HEADER_ALIASES.variation);
    const sku = findValue(row, HEADER_ALIASES.sku);
    const current = grouped.get(externalOrderId) || {
      marketplace: 'shopee' as const, account, externalOrderId,
      externalStatus: findValue(row, HEADER_ALIASES.status), trackingNumber: findValue(row, HEADER_ALIASES.tracking),
      createdAt: findValue(row, HEADER_ALIASES.createdAt), paidAt: findValue(row, HEADER_ALIASES.paidAt),
      shippingAt: findValue(row, HEADER_ALIASES.shippingAt), customerName: findValue(row, HEADER_ALIASES.customer),
      buyerUsername: findValue(row, HEADER_ALIASES.buyerUsername), document: findValue(row, HEADER_ALIASES.document),
      customerContact: findValue(row, HEADER_ALIASES.phone), address: findValue(row, HEADER_ALIASES.address),
      addressNumber: findValue(row, HEADER_ALIASES.addressNumber), addressComplement: findValue(row, HEADER_ALIASES.addressComplement),
      neighborhood: findValue(row, HEADER_ALIASES.neighborhood), city: findValue(row, HEADER_ALIASES.city),
      state: findValue(row, HEADER_ALIASES.state), zipCode: findValue(row, HEADER_ALIASES.zipCode),
      commercialTotal: parseShopeeNumber(findValue(row, HEADER_ALIASES.commercialTotal)),
      sellerDiscount: parseShopeeNumber(findValue(row, HEADER_ALIASES.sellerDiscount)),
      shippingFee: parseShopeeNumber(findValue(row, HEADER_ALIASES.shippingFee)), items: [],
    };
    current.items.push({ rowNumber: index + 2, externalItemKey: buildShopeeExternalItemKey(productTitle, variation, sku), productTitle, variation, sku, quantity, unitPrice: parseShopeeNumber(findValue(row, HEADER_ALIASES.unitPrice)), subtotal: parseShopeeNumber(findValue(row, HEADER_ALIASES.subtotal)) });
    grouped.set(externalOrderId, current);
  });

  if (errors.length) throw new Error(errors.slice(0, 3).join(' '));
  if (!grouped.size) throw new Error('Arquivo Shopee inválido: nenhuma linha de pedido enviada foi identificada.');
  return [...grouped.values()];
}

export async function parseShopeeShippingXlsx(file: File, account: string): Promise<ShopeeShippingOrder[]> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Selecione um arquivo XLSX exportado pela Shopee.');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
  const sheetName = workbook.SheetNames.find(name => {
    const sheetRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[name], { defval: '' });
    return sheetRows.some(row => Boolean(findValue(row, HEADER_ALIASES.orderId)));
  });
  if (!sheetName) throw new Error('Arquivo Shopee inválido: não foi encontrada a coluna “ID do pedido”.');
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '' });
  return normalizeShopeeShippingRows(rows, account);
}

export function buildShopeePreview(
  orders: ShopeeShippingOrder[],
  mappings: ShopeeProductMapping[],
  existingExternalOrderIds: Set<string>,
): ShopeePreviewOrder[] {
  const mappingByKey = new Map(mappings.map(mapping => [mapping.external_item_key, mapping]));
  return orders.map(order => ({
    ...order,
    duplicateStatus: existingExternalOrderIds.has(order.externalOrderId) ? 'already_imported' : 'new',
    items: order.items.map(item => {
      const mapping = mappingByKey.get(item.externalItemKey);
      const multiplier = Number(mapping?.physical_multiplier);
      const validMultiplier = Number.isFinite(multiplier) && multiplier > 0;
      return { ...item, masterProductId: mapping?.product_id || null, variantId: mapping?.variant_id || null, physicalMultiplier: validMultiplier ? multiplier : null, physicalQuantity: validMultiplier ? item.quantity * multiplier : null, mappingStatus: mapping && validMultiplier ? 'recognized' : 'needs_mapping' };
    }),
  }));
}
