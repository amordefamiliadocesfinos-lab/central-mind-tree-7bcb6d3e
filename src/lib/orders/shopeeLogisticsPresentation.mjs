// A shipping document in the Core and the Shopee logistics state are distinct
// facts. Never infer that Seller Center shipment was organized from a PDF alone.
export const SHOPEE_LOGISTICS_PRESENTATION = Object.freeze({
  AGUARDANDO_ORGANIZACAO: { label: 'Aguardando organização na Shopee', tone: 'warning' },
  ENVIO_JA_ORGANIZADO: { label: 'Envio organizado na Shopee', tone: 'info' },
  EXPEDIDO: { label: 'Expedido pela Shopee', tone: 'neutral' },
  BLOQUEADO: { label: 'Logística bloqueada', tone: 'warning' },
  INDETERMINADO: { label: 'Situação logística não confirmada', tone: 'neutral' },
});

export function presentShopeeLogistics(selection, orderSn, channelAccountId) {
  if (channelAccountId !== 'b4027369-5abf-4ac1-ab24-862334fae892'
    || typeof orderSn !== 'string' || !/^[A-Za-z0-9]{8,100}$/.test(orderSn)
    || selection?.ok !== true || selection?.account !== 'adao'
    || !Array.isArray(selection.selected)) return null;
  const matches = selection.selected.filter(entry => entry?.order_sn === orderSn);
  if (matches.length !== 1) return null;
  const entry = matches[0];
  const presentation = SHOPEE_LOGISTICS_PRESENTATION[entry.state];
  if (!presentation || entry.auto_arrangement_authorized !== false
    || entry.create_shipping_document_authorized !== false
    || entry.inventory_mutation_authorized !== false) return null;
  return { ...presentation, state: entry.state, reason: entry.reason ?? null,
    // Never offer dispatch, write or stock actions from a read-only classification.
    canArrange: false, canCreateDocument: false, canMutateInventory: false };
}
