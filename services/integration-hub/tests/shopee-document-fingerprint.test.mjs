import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  vivianeShippingDocumentFingerprint,
  adaoShippingDocumentFingerprint,
} from '../src/shopee-document-fingerprint.mjs';

const oldHash = data => createHash('sha256').update(JSON.stringify(data)).digest('hex');

test('F5-U1 Viviane claim hash is byte-identical to the historical request body', () => {
  const orderSn = '2610203UYY7N0T';
  const packageNumber = 'OFG246133145190444';
  const trackingNumber = 'BR262168766782H';
  const shippingDocumentType = 'NORMAL_AIR_WAYBILL';
  const before = oldHash({ order_list: [{
    order_sn: orderSn, package_number: packageNumber,
    tracking_number: trackingNumber, shipping_document_type: shippingDocumentType,
  }] });
  assert.equal(vivianeShippingDocumentFingerprint({
    orderSn, packageNumber, trackingNumber, shippingDocumentType,
  }), before);
});

test('F5-U1 Adão claim hash is byte-identical to historical metadata format', () => {
  const channelAccountId = 'b4027369-5abf-4ac1-ab24-862334fae892';
  const shopId = 1156446003;
  const orderSn = '261108PWWQ4K95';
  const packageNumber = 'OFG247788050127214';
  const documentType = 'NORMAL_AIR_WAYBILL';
  const trackingNumber = 'SPX1234567';
  const metadata = {
    channel_account_id: channelAccountId, shop_id: shopId,
    order_sn: orderSn, package_number: packageNumber, document_type: documentType,
  };
  const before = oldHash({ ...metadata, tracking_number: trackingNumber });
  assert.equal(adaoShippingDocumentFingerprint({
    channelAccountId, shopId, orderSn, packageNumber, documentType, trackingNumber,
  }), before);
});

test('F5-U1 historic account strategies stay distinct and tracking-sensitive', () => {
  const fields = {
    orderSn: '261108PWWQ4K95', packageNumber: 'OFG247788050127214',
    trackingNumber: 'SPX1234567',
  };
  const a = adaoShippingDocumentFingerprint({
    ...fields, channelAccountId: 'b4027369-5abf-4ac1-ab24-862334fae892',
    shopId: 1156446003, documentType: 'NORMAL_AIR_WAYBILL',
  });
  const v = vivianeShippingDocumentFingerprint({
    ...fields, shippingDocumentType: 'NORMAL_AIR_WAYBILL',
  });
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.match(v, /^[0-9a-f]{64}$/);
  assert.notEqual(a, v);
  assert.notEqual(a, adaoShippingDocumentFingerprint({
    ...fields, trackingNumber: 'SPX999',
    channelAccountId: 'b4027369-5abf-4ac1-ab24-862334fae892',
    shopId: 1156446003, documentType: 'NORMAL_AIR_WAYBILL',
  }));
});
