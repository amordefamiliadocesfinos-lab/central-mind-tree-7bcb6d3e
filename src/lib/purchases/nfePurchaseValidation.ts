import type { PurchaseItem, PurchaseOrder } from '@/hooks/usePurchases';
import type { NfeItem, NfeParsedData } from './nfePdfParser';
import { compactTaxDocument } from './nfePdfParser';

export interface NfeItemMatch {
  invoice_item: NfeItem;
  purchase_item_id: string | null;
  matched: boolean;
}

export interface NfePurchaseValidation {
  can_apply: boolean;
  supplier_matches: boolean;
  total_matches: boolean;
  freight_matches: boolean;
  installments_match_total: boolean;
  item_matches: NfeItemMatch[];
  errors: string[];
}

const EPSILON = 0.02;

function closeEnough(a: number, b: number, tolerance = EPSILON) {
  return Math.abs(a - b) <= tolerance;
}

function normalizedTokens(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(token => token.length >= 2);
}

function descriptionScore(invoice: NfeItem, item: PurchaseItem) {
  const invoiceTokens = new Set(normalizedTokens(invoice.description));
  const catalogText = [
    item.product?.name ?? '',
    item.variant?.variant_name ?? '',
    item.presentation_snapshot?.name ?? '',
  ].join(' ');
  const catalogTokens = normalizedTokens(catalogText);
  return catalogTokens.reduce((score, token) => score + (invoiceTokens.has(token) ? 1 : 0), 0);
}

function purchaseTotal(order: PurchaseOrder) {
  const itemsTotal = (order.items ?? []).reduce((sum, item) => {
    const price = Number(item.unit_price);
    const qty = Number(item.ordered_purchase_qty);
    if (!Number.isFinite(price) || !Number.isFinite(qty)) return sum;
    return sum + (price * qty);
  }, 0);
  return itemsTotal + Number(order.freight_amount || 0);
}

export function validateNfeAgainstPurchase(
  invoice: NfeParsedData,
  order: PurchaseOrder,
  supplierDocument: string | null,
): NfePurchaseValidation {
  const errors: string[] = [];

  const supplierMatches = Boolean(
    invoice.issuer_document
      && supplierDocument
      && compactTaxDocument(invoice.issuer_document) === compactTaxDocument(supplierDocument),
  );
  if (!supplierMatches) errors.push('O CNPJ do emitente da NF-e não confere com o fornecedor desta compra.');

  const orderTotal = purchaseTotal(order);
  const totalMatches = invoice.total_note !== null && closeEnough(invoice.total_note, orderTotal);
  if (!totalMatches) {
    errors.push(`O total da NF-e (${invoice.total_note ?? 'não identificado'}) difere do total da compra (${orderTotal.toFixed(2)}).`);
  }

  const invoiceFreight = invoice.freight ?? 0;
  const orderFreight = Number(order.freight_amount || 0);
  const freightMatches = closeEnough(invoiceFreight, orderFreight);
  if (!freightMatches) errors.push('O frete da NF-e difere do frete registrado na compra.');

  const installmentsTotal = invoice.installments.reduce((sum, installment) => sum + installment.value, 0);
  const installmentsMatchTotal = invoice.installments.length > 0
    && invoice.total_note !== null
    && closeEnough(installmentsTotal, invoice.total_note);
  if (!installmentsMatchTotal) errors.push('As parcelas da NF-e não fecham com o valor total da nota.');

  const unused = new Set((order.items ?? []).map(item => item.id));
  const itemMatches: NfeItemMatch[] = invoice.items.map(invoiceItem => {
    const candidates = (order.items ?? [])
      .filter(item => unused.has(item.id))
      .filter(item => {
        const qty = Number(item.ordered_purchase_qty);
        const unitPrice = Number(item.unit_price);
        return Number.isFinite(qty)
          && Number.isFinite(unitPrice)
          && closeEnough(qty, invoiceItem.quantity, 0.000001)
          && closeEnough(unitPrice, invoiceItem.unit_price);
      })
      .sort((a, b) => descriptionScore(invoiceItem, b) - descriptionScore(invoiceItem, a));

    const match = candidates[0] ?? null;
    if (match) unused.delete(match.id);

    return {
      invoice_item: invoiceItem,
      purchase_item_id: match?.id ?? null,
      matched: Boolean(match),
    };
  });

  if (invoice.items.length === 0) errors.push('Nenhum item foi reconhecido no DANFE.');
  if (itemMatches.some(item => !item.matched) || unused.size > 0 || invoice.items.length !== (order.items ?? []).length) {
    errors.push('Os itens/quantidades/preços da NF-e não conferem integralmente com o pedido.');
  }

  if (!invoice.invoice_number) errors.push('Número da NF-e não identificado.');
  if (!invoice.issue_date) errors.push('Data de emissão da NF-e não identificada.');
  if (!invoice.access_key) errors.push('Chave de acesso da NF-e não identificada.');

  return {
    can_apply: errors.length === 0,
    supplier_matches: supplierMatches,
    total_matches: totalMatches,
    freight_matches: freightMatches,
    installments_match_total: installmentsMatchTotal,
    item_matches: itemMatches,
    errors,
  };
}
