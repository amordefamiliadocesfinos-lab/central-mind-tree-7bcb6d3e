import { pathToFileURL } from 'node:url';
import { ADAO } from './read-adao-orders.mjs';
import { CORE_BRIDGE_URL, readLiveShopeeOrderIntakeBatch } from './core-bridge.mjs';
import { createShopeeControlledAutoIntake } from './shopee-order-auto-intake.mjs';

const ACTION = 'shopee.order_intake_batch.read';
const MAX_ORDERS = 5;
const VALID_ORDER_SN = /^[A-Z0-9]{10,64}$/;
const VALID_BLOCKER = /^[a-z0-9_:]{1,100}$/;

function fail(code) {
  return { ok: false, code, account_id: ADAO.channel_account_id,
    mode: 'preview', selected: 0, ready: 0, blocked: 0, written: 0 };
}

function count(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function safeResult(row) {
  return {
    order_sn: typeof row?.orderSn === 'string' && VALID_ORDER_SN.test(row.orderSn) ? row.orderSn : null,
    status: row?.status === 'ready' ? 'ready' : 'blocked',
    blockers: Array.isArray(row?.blockers)
      ? row.blockers.map(x => typeof x === 'string' && VALID_BLOCKER.test(x) ? x : 'redacted')
      : [],
  };
}

/**
 * One-shot, read-only Core preview of Adão's existing Raw Snapshot -> mapping -> candidate.
 * No Shopee API, no writer, no refresh, no scheduler, no pagination or retries.
 */
export async function previewAdaoOperationalIntake({
  env = process.env, fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof env.CORE_BRIDGE_HMAC_SECRET !== 'string' || env.CORE_BRIDGE_HMAC_SECRET.length === 0) {
    return fail('configuration_missing');
  }
  let readCalls = 0;
  const transport = async (input, init = {}) => {
    const url = new URL(input);
    if (url.href !== CORE_BRIDGE_URL || init.method !== 'POST' || ++readCalls > 1) {
      throw new Error('forbidden_request');
    }
    const body = JSON.parse(init.body);
    if (Object.keys(body).sort().join(',') !== 'action,channel_account_id,limit'
      || body.action !== ACTION
      || body.channel_account_id !== ADAO.channel_account_id
      || body.limit !== MAX_ORDERS) throw new Error('forbidden_core_action');
    return fetchImpl(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(15000) });
  };
  const readBatch = data => readLiveShopeeOrderIntakeBatch(data, {
    url: CORE_BRIDGE_URL, secret: env.CORE_BRIDGE_HMAC_SECRET,
    fetchImpl: transport, logger: () => {},
  });
  const forbiddenWrite = async () => { throw new Error('operational_write_forbidden'); };
  try {
    const preview = createShopeeControlledAutoIntake({
      readBatch,
      persistOrder: forbiddenWrite,
    });
    const report = await preview({
      channelAccountId: ADAO.channel_account_id, limit: MAX_ORDERS, mode: 'preview',
    });
    if (report?.ok !== true || report?.mode !== 'preview'
      || report?.channelAccountId !== ADAO.channel_account_id
      || report?.marketplaceAccount !== 'SHOPEE ADÃO'
      || report?.written !== 0 || !Array.isArray(report.results)) {
      return fail('preview_unavailable');
    }
    return {
      ok: true, code: 'preview_ready', account_id: ADAO.channel_account_id,
      mode: 'preview', selected: count(report.selected),
      ready: count(report.ready), blocked: count(report.blocked), written: 0,
      source_counts: {
        selected: count(report.sourceCounts?.selected),
        skipped_existing: count(report.sourceCounts?.skipped_existing),
        skipped_status: count(report.sourceCounts?.skipped_status),
        skipped_malformed: count(report.sourceCounts?.skipped_malformed),
      },
      results: report.results.map(safeResult),
    };
  } catch {
    return fail('preview_failed');
  }
}

export async function main(args = process.argv.slice(2)) {
  if (args.length !== 1 || args[0] !== '--preview-adao') {
    console.log('Usage: node services/integration-hub/src/preview-adao-operational-intake.mjs --preview-adao');
    return 2;
  }
  const report = await previewAdaoOperationalIntake();
  console.log(JSON.stringify(report));
  return report.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
