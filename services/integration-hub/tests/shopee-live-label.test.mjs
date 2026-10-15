import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createShopeeLabelSynchronizer } from '../src/shopee-live-label.mjs';
import { handleRequest } from '../src/app.mjs';
import { getShippingDocumentResult, downloadShippingDocument } from '../src/connectors/shopee-protocol.mjs';

const target = '261013HKHWK3V7';
const pkg = 'OFG245605119132474';
const channel = '8a8ad166-0317-4597-8be6-e43fb46b4d1b';
const pdf = Buffer.from('%PDF-1.4\n1 0 obj\nendobj\n%%EOF\n');
const storageUrl = 'https://xkskyutmtlhivvpfxkjg.supabase.co/storage/v1/object/upload/sign/shopee-labels/a.pdf?token=dummy';
const env = {
  SHOPEE_LIVE_PARTNER_ID: '2047685',
  SHOPEE_LIVE_PARTNER_KEY: 'fake-partner-key',
  SHOPEE_LIVE_CHANNEL_ACCOUNT_ID: channel,
  SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY: 'fake-encryption-key',
  SHOPEE_LIVE_LABEL_ORDER_SN: target,
};

function fixtures(overrides = {}) {
  const calls = [];
  const deps = {
    getEnv: key => env[key],
    now: () => Date.parse('2026-10-15T12:00:00.000Z'),
    readConnection: async () => ({
      ok: true,
      payload: {
        partner_id: 2047685, shop_id: 531736366,
        access_token_expires_at: '2026-10-15T16:00:00.000Z',
        access_token_ciphertext: 'encrypted-not-exposed',
      },
    }),
    decryptToken: async () => 'token-mock',
    readOrderDetail: async () => ({
      response: { ok: true },
      payload: { response: { order_list: [{ order_sn: target, package_list: [{ package_number: pkg }] }] } },
    }),
    readParameter: async () => ({
      response: { ok: true },
      payload: { response: { result_list: [{
        order_sn: target, package_number: pkg,
        selectable_shipping_document_type: ['NORMAL_AIR_WAYBILL', 'THERMAL_AIR_WAYBILL'],
      }] } },
    }),
    readDocumentResult: async input => {
      calls.push(['result', input]);
      return {
        response: { ok: true },
        payload: { response: { result_list: [{ order_sn: target, package_number: pkg, status: 'READY' }] } },
      };
    },
    downloadDocument: async input => {
      calls.push(['download', input]);
      return { response: new Response(pdf, { headers: { 'content-type': 'application/pdf' } }) };
    },
    callCore: async input => {
      calls.push(['core', input]);
      return input.action === 'shopee.shipping_label.prepare'
        ? { ok: true, payload: { status: 'ok', upload_url: storageUrl, already_exists: false } }
        : { ok: true, payload: { status: 'ok', document_id: 'saved-id', already_exists: false } };
    },
    uploadFetch: async (url, options) => {
      calls.push(['upload', { url: url.toString(), method: options.method, bytes: options.body.length }]);
      return { ok: true };
    },
    ...overrides,
  };
  return { calls, inspect: createShopeeLabelSynchronizer(deps) };
}

test('O.2b attaches only READY PDF to canonical storage, no ship/create calls', async () => {
  const { calls, inspect } = fixtures();
  const result = await inspect();
  assert.equal(result.ok, true);
  assert.equal(result.code, 'label_attached');
  assert.deepEqual(calls.map(entry => entry[0]), ['result', 'download', 'core', 'upload', 'core']);
  assert.equal(calls[0][1].packageNumber, pkg);
  assert.equal(calls[1][1].shippingDocumentType, 'NORMAL_AIR_WAYBILL');
  const metadata = calls[2][1].data;
  assert.equal(metadata.channel_account_id, channel);
  assert.equal(metadata.order_sn, target);
  assert.equal(metadata.shop_id, 531736366);
  assert.equal(metadata.file_size, pdf.length);
  assert.equal(metadata.sha256, createHash('sha256').update(pdf).digest('hex'));
  assert.equal(calls[3][1].method, 'PUT');
  assert.equal(calls[4][1].action, 'shopee.shipping_label.commit');
});

test('O.2b PROCESSING stops before binary and Core writes', async () => {
  let downstream = 0;
  const { inspect } = fixtures({
    readDocumentResult: async () => ({
      response: { ok: true },
      payload: { response: { result_list: [{ order_sn: target, package_number: pkg, status: 'PROCESSING' }] } },
    }),
    downloadDocument: async () => { downstream++; throw Error('should not run'); },
    callCore: async () => { downstream++; throw Error('should not run'); },
  });
  assert.deepEqual(await inspect(), { ok: false, code: 'document_processing' });
  assert.equal(downstream, 0);
});

test('O.2b expired token never decrypts or calls Shopee', async () => {
  let externalReads = 0;
  const { inspect } = fixtures({
    readConnection: async () => ({
      ok: true,
      payload: { shop_id: 531736366, partner_id: 2047685, access_token_expires_at: '2026-10-15T11:59:00Z' },
    }),
    decryptToken: async () => { externalReads++; throw Error('unexpected'); },
    readOrderDetail: async () => { externalReads++; throw Error('unexpected'); },
  });
  assert.equal((await inspect()).code, 'access_token_expired_read_only');
  assert.equal(externalReads, 0);
});

test('O.2b multi-package order is blocked instead of silently selecting first package', async () => {
  const { inspect } = fixtures({
    readOrderDetail: async () => ({
      response: { ok: true }, payload: { response: { order_list: [
        { order_sn: target, package_list: [{ package_number: 'PK1' }, { package_number: 'PK2' }] },
      ] } },
    }),
    readParameter: async () => { throw Error('must not run'); },
  });
  assert.equal((await inspect()).code, 'multiple_packages_not_supported');
});

test('O.2b rejects non-PDF body and never uploads it', async () => {
  let sideEffects = 0;
  const { inspect } = fixtures({
    downloadDocument: async () => ({
      response: new Response(JSON.stringify({ error: 'failed' }), { headers: { 'content-type': 'application/json' } }),
    }),
    callCore: async () => { sideEffects++; throw Error('unexpected'); },
  });
  assert.equal((await inspect()).code, 'document_pdf_invalid_or_unavailable');
  assert.equal(sideEffects, 0);
});

test('O.2b existing document is idempotent and does not upload', async () => {
  const { inspect, calls } = fixtures({
    callCore: async input => {
      calls.push(['core', input]);
      return { ok: true, payload: { status: 'ok', already_exists: true, document_id: 'existing' } };
    },
    uploadFetch: async () => { throw Error('unexpected upload'); },
  });
  assert.equal((await inspect()).code, 'already_available');
  assert.equal(calls.filter(x => x[0] === 'core').length, 1);
});

test('O.2b retry recovers an uploaded PDF after metadata persistence failed, without overwrite', async () => {
  let stored = false;
  let commits = 0;
  let uploads = 0;
  const { inspect } = fixtures({
    uploadFetch: async () => {
      uploads++;
      if (stored) return { ok: false, status: 409 };
      stored = true;
      return { ok: true };
    },
    callCore: async input => {
      if (input.action === 'shopee.shipping_label.prepare') {
        return { ok: true, payload: { status: 'ok', upload_url: storageUrl, already_exists: false } };
      }
      commits++;
      return commits === 1
        ? { ok: false, payload: { error: 'label_document_persistence_failed' } }
        : { ok: true, payload: { status: 'ok', document_id: 'recovered', already_exists: false } };
    },
  });
  assert.equal((await inspect()).code, 'core_label_commit_failed');
  const retry = await inspect();
  assert.equal(retry.ok, true);
  assert.equal(retry.document_id, 'recovered');
  assert.equal(uploads, 2);
  assert.equal(commits, 2);
});

test('O.2b failed upload cannot attach an absent or unverified object', async () => {
  const { inspect } = fixtures({
    uploadFetch: async () => ({ ok: false, status: 403 }),
    callCore: async input => input.action.endsWith('.prepare')
      ? { ok: true, payload: { status: 'ok', upload_url: storageUrl } }
      : { ok: false, payload: { error: 'label_integrity_mismatch' } },
  });
  assert.deepEqual(await inspect(), { ok: false, code: 'private_storage_upload_failed' });
});

for (const [description, body, headers] of [
  ['unbounded stream', Buffer.concat([pdf, Buffer.alloc(4 * 1024 * 1024)]), {}],
  ['lying Content-Length', Buffer.concat([pdf, Buffer.alloc(4 * 1024 * 1024)]), { 'content-length': '20' }],
  ['oversized declared length', pdf, { 'content-length': String(4 * 1024 * 1024 + 1) }],
  ['HTML with PDF content type', Buffer.from('<html>not a PDF</html>'), {}],
]) {
  test('O.2b rejects ' + description + ' before preparing Storage', async () => {
    const { inspect } = fixtures({
      downloadDocument: async () => ({ response: new Response(body, { headers: { 'content-type': 'application/pdf', ...headers } }) }),
      callCore: async () => { throw Error('no Storage preparation allowed'); },
    });
    assert.equal((await inspect()).code, 'document_pdf_invalid_or_unavailable');
  });
}

for (const [description, orderSn, packageNumber] of [
  ['foreign order', 'OTHERORDER123', pkg],
  ['foreign package', target, 'OTHERPACKAGE'],
]) {
  test('O.2b rejects document status for ' + description, async () => {
    const { inspect } = fixtures({
      readDocumentResult: async () => ({ response: { ok: true }, payload: { response: { result_list: [{ order_sn: orderSn, package_number: packageNumber, status: 'READY' }] } } }),
      downloadDocument: async () => { throw Error('must not download'); },
    });
    assert.equal((await inspect()).code, 'document_status_identity_mismatch');
  });
}

test('O.2b FAILED is terminal and never downloads or creates a document', async () => {
  const { inspect } = fixtures({
    readDocumentResult: async () => ({ response: { ok: true }, payload: { response: { result_list: [{ order_sn: target, package_number: pkg, status: 'FAILED' }] } } }),
    downloadDocument: async () => { throw Error('must not download'); },
  });
  assert.equal((await inspect()).code, 'document_failed');
});

test('O.2b refuses signed upload URL outside canonical Storage', async () => {
  const { inspect } = fixtures({
    callCore: async () => ({ ok: true, payload: { status: 'ok', upload_url: 'https://untrusted.invalid/upload' } }),
    uploadFetch: async () => { throw Error('must not upload'); },
  });
  assert.equal((await inspect()).code, 'upload_url_untrusted');
});

test('O.2b private route is fail-closed by default and POST-only', async () => {
  let count = 0;
  const deps = {
    handleShopeeLive: async () => null,
    syncShopeeLabel: async () => { count++; return { ok: true, code: 'label_attached', document_id: 'doc' }; },
    getEnv: () => undefined,
  };
  const path = '/internal/shopee/live/logistics/label/sync-once';
  assert.equal((await handleRequest({ method: 'GET', path, query: {} }, deps)).status, 405);
  assert.equal((await handleRequest({ method: 'POST', path, query: {} }, deps)).status, 503);
  assert.equal(count, 0);
  const enabled = { ...deps, getEnv: name => (
    name === 'SHOPEE_LIVE_LABEL_SYNC_ENABLED' ? 'true' :
    name === 'SHOPEE_LIVE_LABEL_ORDER_SN' ? target : undefined
  ) };
  assert.equal((await handleRequest({ method: 'POST', path, query: { order_sn: 'evil' } }, enabled)).status, 400);
  const result = await handleRequest({ method: 'POST', path, query: {} }, enabled);
  assert.equal(result.status, 200);
  assert.deepEqual(JSON.parse(result.body), {
    status: 'ok', mode: 'label_sync_once', code: 'label_attached',
    document_type: 'shipping_label', document_id: 'doc',
  });
  assert.equal(count, 1);
});

test('O.2b document result uses signed POST and download leaves binary intact', async () => {
  const observed = [];
  const base = {
    apiBaseUrl: 'https://partner.shopeemobile.com',
    partnerId: 2047685, partnerKey: 'fake-key', accessToken: 'access', shopId: 531736366,
    orderSn: target, packageNumber: pkg, timestamp: 1700000000,
    fetchImpl: async (url, options) => {
      observed.push({ url: new URL(url), method: options.method, body: JSON.parse(options.body) });
      return observed.length === 1
        ? new Response(JSON.stringify({ error: '', response: { result_list: [] } }), { headers: { 'content-type': 'application/json' } })
        : new Response(pdf, { headers: { 'content-type': 'application/pdf' } });
    },
  };
  await getShippingDocumentResult({ ...base, shippingDocumentResultPath: '/api/v2/logistics/get_shipping_document_result' });
  const downloaded = await downloadShippingDocument({ ...base, downloadShippingDocumentPath: '/api/v2/logistics/download_shipping_document' });
  assert.equal(observed[0].method, 'POST');
  assert.equal(observed[1].method, 'POST');
  assert.deepEqual(observed[0].body.order_list, [{ order_sn: target, package_number: pkg, shipping_document_type: 'NORMAL_AIR_WAYBILL' }]);
  assert.deepEqual(observed[1].body, { order_list: [{ order_sn: target, package_number: pkg }], shipping_document_type: 'NORMAL_AIR_WAYBILL' });
  assert.ok(observed[0].url.searchParams.get('sign'));
  assert.ok(observed[1].url.searchParams.get('sign'));
  assert.deepEqual(Buffer.from(await downloaded.response.arrayBuffer()), pdf);
});
