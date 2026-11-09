import { createHash } from 'node:crypto';

// F5-U1: Both historic request fingerprints are part of the persisted Core
// contract. They intentionally differ and MUST NOT be silently migrated.
// Core enforces unique(account, order, package, type, operation) independently
// of the fingerprint, and rejects mismatching hashes on existing attempts.
const hex = payload => createHash('sha256').update(JSON.stringify(payload)).digest('hex');

export function vivianeShippingDocumentFingerprint({
  orderSn, packageNumber, trackingNumber, shippingDocumentType,
}) {
  // Historical Viviane format: exact Shopee create_shipping_document JSON body.
  return hex({ order_list: [{
    order_sn: orderSn,
    package_number: packageNumber,
    tracking_number: trackingNumber,
    shipping_document_type: shippingDocumentType,
  }] });
}

export function adaoShippingDocumentFingerprint({
  channelAccountId, shopId, orderSn, packageNumber, documentType, trackingNumber,
}) {
  // Historical Adão format, including property order as originally serialized.
  return hex({
    channel_account_id: channelAccountId,
    shop_id: shopId,
    order_sn: orderSn,
    package_number: packageNumber,
    document_type: documentType,
    tracking_number: trackingNumber,
  });
}
