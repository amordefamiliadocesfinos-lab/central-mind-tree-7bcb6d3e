import { previewAlfajorAdaoMappings } from './shopee-alfajor-adao-mapping-diagnostic.mjs';
import { previewAdaoMappings70 } from './shopee-adao-70-mapping-diagnostic.mjs';
import { previewPortoGelVivianeMappings } from './shopee-porto-gel-mapping-diagnostic.mjs';
import { runShopeeMinimumCycle } from './shopee-minimum-cycle.mjs';
import { runAdaoAutomaticIntake } from './shopee-adao-automatic-intake.mjs';
import { runAdaoCycle } from './shopee-adao-cycle.mjs';
import { syncAdaoReadyLabelOnce } from './shopee-adao-ready-label-sync.mjs';
import { syncCelivioPilotLabelOnce } from './shopee-celivio-f5-label-sync.mjs';
import { readAdaoLogisticsReadOnly } from './shopee-adao-logistics-readonly.mjs';
import { HUB_SERVICE_NAME, HUB_VERSION } from './contracts.mjs';
import { probeCoreBridge, callCoreBridgeAction, readSellerSkuRegistryExact } from './core-bridge.mjs';
import { handleShopeeLiveOauthRequest } from './shopee-live-oauth.mjs';
import { runShopeeControlledAutoIntake } from './shopee-order-auto-intake.mjs';
import { inspectShopeeLiveLogistics } from './shopee-live-logistics.mjs';
import { refreshShopeeOauthOnce } from './shopee-oauth-refresh-once.mjs';
import { syncReadyShopeeLabel } from './shopee-live-label.mjs';
import { inspectShopeeShippingPreflight } from './shopee-shipping-preflight.mjs';
import { guardedShopeeShipOrder } from './shopee-ship-order-guard.mjs';
import { prepareShopeeLabelOnce } from './shopee-label-preparation.mjs';
import {
  SHOPEE_OPERATIONAL_COMMIT_POLICY,
  summarizeShopeeControlledRound,
} from './shopee-intake-policy.mjs';
import { randomUUID } from 'node:crypto';
import { readCelivioC4BReadOnly } from './shopee-celivio-c4b-readonly.mjs';
import { syncCelivioC7LabelOnce, CELIVIO_C7_ORDER_SN, syncCelivioNewPilotLabelOnce } from './shopee-celivio-c7-label-sync.mjs';
import { captureCelivioC4ERawOnce, captureCelivioC6RawOnce, captureCelivioNewPilotRawOnce } from './shopee-celivio-c4e-raw-once.mjs';
import { runCelivioPreview } from './shopee-celivio-preview-read-budget.mjs';
import { CELIVIO_C4C_ACCOUNT_ID } from './shopee-celivio-c4c-preflight.mjs';
import { runCelivioPilotCommitOne } from './shopee-celivio-commit-one.mjs';

import { createD10Pilot } from './shopee-d10-pilot.mjs';
import { createD11ScheduledCycle } from './shopee-d11-recurring-round.mjs';

const JSON_HEADERS = Object.freeze({
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
});

function json(status, body) {
  return {
    status,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  };
}

export async function handleRequest(
  request,
  {
    runMinimumCycle = runShopeeMinimumCycle,
    runD10 = null,
    runD11 = null,
    runAdaoIntake = runAdaoAutomaticIntake,
    runAdaoAccountCycle = runAdaoCycle,
    syncAdaoLabel = syncAdaoReadyLabelOnce,
    syncCelivioPilotLabel = syncCelivioPilotLabelOnce,
    syncCelivioC7Label = syncCelivioC7LabelOnce,
    syncCelivioNewPilotLabel = syncCelivioNewPilotLabelOnce,
    readAdaoLogistics = readAdaoLogisticsReadOnly,
    syncCore = callCoreBridgeAction,
    probeCore = probeCoreBridge,
    readSellerSkuRegistry = readSellerSkuRegistryExact,
    handleShopeeLive = handleShopeeLiveOauthRequest,
    runShopeePreview = runShopeeControlledAutoIntake,
    runCelivioReadOnlyPreview = runCelivioPreview,
    runShopeeCommit = runShopeeControlledAutoIntake,
    runCelivioCommitOne = runCelivioPilotCommitOne,
    inspectShopeeLogistics = inspectShopeeLiveLogistics,
    refreshShopeeOauth = refreshShopeeOauthOnce,
    readCelivioC4B = readCelivioC4BReadOnly,
    captureCelivioC4E = captureCelivioC4ERawOnce,
    captureCelivioC6 = captureCelivioC6RawOnce,
    captureCelivioNewPilot = captureCelivioNewPilotRawOnce,
    syncShopeeLabel = syncReadyShopeeLabel,
    inspectShippingPreflight = inspectShopeeShippingPreflight,
    shipShopeeOrderOnce = guardedShopeeShipOrder,
    prepareShopeeLabel = prepareShopeeLabelOnce,
    getEnv = (name) => process.env[name],
    makeRunId = randomUUID,
    now = () => new Date().toISOString(),
    logEvent = (event) => console.log(JSON.stringify(event)),
  } = {},
) {
  const shopeeLiveResponse = await handleShopeeLive(request);
  if (shopeeLiveResponse) return shopeeLiveResponse;

  const normalizedPath = String(request.path ?? '/');
  const normalizedMethod = String(request.method ?? 'GET').toUpperCase();

  // Private IAM-protected shared recurrence. No caller-selected account,
  // order, package, cursor, effect or mode. Disabled by default.
  if(normalizedPath==='/internal/shopee/d11/cycle/run'){
    if(normalizedMethod!=='POST')return json(405,{error:'method_not_allowed'});
    if(Object.keys(request.query??{}).length||request.headers?.['transfer-encoding']
      ||Number(request.headers?.['content-length']??0)!==0||(request.body!=null&&request.body!==''))
      return json(400,{error:'body_or_query_not_allowed'});
    if(getEnv('SHOPEE_D11_RECURRING_ENABLED')!=='true')return json(503,{status:'blocked',code:'d11_cycle_disabled'});
    try{
      const r=await (runD11??createD11ScheduledCycle({getEnv}))();
      const code=typeof r?.code==='string'&&/^[a-z][a-z0-9_]{0,99}$/.test(r.code)?r.code:'d11_cycle_unconfirmed';
      return json(r?.ok===true?200:409,{status:r?.ok===true?'ok':'blocked',code,
        orders_written:[0,1].includes(r?.ordersWritten)?r.ordersWritten:null,
        effects:[0,1].includes(r?.effects)?r.effects:null,
        queue_outcome:['pending','complete','blocked'].includes(r?.queueOutcome)?r.queueOutcome:null,
        reconciliation_required:r?.reconciliationRequired===true,physical_handoff_confirmed:false});
    }catch{return json(503,{status:'blocked',code:'d11_cycle_unconfirmed'});}
  }

  // Private D10 one-order proof. No caller-selected identity or parameters.
  if (['/internal/shopee/d10/discover','/internal/shopee/d10/inspect','/internal/shopee/d10/ship','/internal/shopee/d10/label'].includes(normalizedPath)) {
    if (normalizedMethod !== 'POST') return json(405,{error:'method_not_allowed'});
    if (Object.keys(request.query ?? {}).length || request.headers?.['transfer-encoding']
      || Number(request.headers?.['content-length'] ?? 0)!==0 || (request.body != null && request.body !== ''))
      return json(400,{error:'body_or_query_not_allowed'});
    if (getEnv('SHOPEE_D10_ENABLED')!=='true') return json(503,{status:'blocked',code:'d10_disabled'});
    try {
      const result=await (runD10??createD10Pilot({getEnv}))(normalizedPath.split('/').at(-1));
      return json(result?.ok?200:409,{...result,status:result?.ok?'ok':'blocked'});
    } catch { return json(503,{status:'blocked',code:'d10_exception_requires_review'}); }
  }


  // Default-off; no independent scheduler. The adapter refuses to run while
  // the standalone Adão importer remains active to avoid competing writers.
  if (normalizedPath === '/internal/shopee/adao/cycle/run') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (Object.keys(request.query ?? {}).length
      || Number(request.headers?.['content-length'] ?? 0) !== 0
      || request.headers?.['transfer-encoding'] || request.body) {
      return json(400, { error: 'body_or_query_not_allowed' });
    }
    if (getEnv('SHOPEE_ADAO_CYCLE_ENABLED') !== 'true') {
      return json(503, { status: 'blocked', code: 'adao_cycle_not_enabled' });
    }
    try {
      const result = await runAdaoAccountCycle();
      return json(result?.ok ? 200 : 503, {
        status: result?.ok ? 'ok' : 'blocked',
        account: 'adao',
        code: result?.code ?? 'adao_cycle_unavailable',
        document_id: result?.ok ? result.document_id ?? null : null,
      });
    } catch {
      return json(503, { status: 'blocked', account: 'adao', code: 'adao_cycle_exception' });
    }
  }

  // IAM-protected independent Adão intake: no shipping, labels or inventory effects.
  if (normalizedPath === '/internal/shopee/adao/orders/intake/auto') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (Object.keys(request.query ?? {}).length
      || Number(request.headers?.['content-length'] ?? 0) !== 0
      || request.headers?.['transfer-encoding'] || request.body) {
      return json(400, { error: 'body_or_query_not_allowed' });
    }
    try {
      const cycleStartedAt = Date.now();
      const result = await runAdaoIntake();
      const report = {
        status: result?.ok === true ? 'ok' : 'blocked',
        code: result?.code ?? 'intake_unavailable',
        account: 'adao',
        discovered: result?.discovered ?? 0,
        written: result?.written ?? 0,
        already_registered: result?.already_registered ?? 0,
        skipped: result?.skipped ?? 0,
        blocked: result?.blocked ?? 0,
        pages: result?.pages ?? 0,
        stopped: result?.stopped === true,
        labels_attached: result?.labels_attached ?? 0,
        labels_already: result?.labels_already ?? 0,
        labels_pending: result?.labels_pending ?? 0,
        labels_blocked: result?.labels_blocked ?? 0,
        shipment_acknowledged: result?.shipment_acknowledged ?? 0,
        shipment_pending: result?.shipment_pending ?? 0,
        shipment_candidates: result?.shipment_candidates ?? 0,
        // F12.1: bounded, low-cardinality observability only; no order IDs or PII.
        shipment_attempted: Number.isSafeInteger(result?.shipment_attempted)
          && result.shipment_attempted >= 0 && result.shipment_attempted <= 3
          ? result.shipment_attempted : 0,
        label_attempted: Number.isSafeInteger(result?.label_attempted)
          && result.label_attempted >= 0 && result.label_attempted <= 3
          ? result.label_attempted : 0,
        work_budget_exhausted: result?.work_budget_exhausted === true,
        ...(result?.shipment_code ? { shipment_code: result.shipment_code } : {}),
        ...(result?.label_code ? { label_code: result.label_code } : {}),
        // Runner emits only vetted low-cardinality fields; never order IDs or tokens.
        ...(result?.diagnostic ? { diagnostic: result.diagnostic } : {}),
        ...(result?.last_blocker ? { last_blocker: result.last_blocker } : {}),
      };
      // F12.1: durable, aggregate-only Cloud Logging for naturally scheduled cycles.
      // Do not log order identifiers, customer data, request payloads or OAuth secrets.
      try {
        logEvent({
          event: 'adao_auto_intake_cycle_summary',
          account: 'adao',
          outcome: result?.ok === true ? 'ok' : 'blocked',
          pages: Number.isSafeInteger(report.pages) ? report.pages : 0,
          shipment_candidates: Number.isSafeInteger(report.shipment_candidates) ? report.shipment_candidates : 0,
          shipment_attempted: report.shipment_attempted,
          label_attempted: report.label_attempted,
          shipment_acknowledged: Number.isSafeInteger(report.shipment_acknowledged) ? report.shipment_acknowledged : 0,
          labels_attached: Number.isSafeInteger(report.labels_attached) ? report.labels_attached : 0,
          work_budget_exhausted: report.work_budget_exhausted,
          duration_ms: Math.max(0, Date.now() - cycleStartedAt),
        });
      } catch { /* Logging must never affect intake or logistics outcomes. */ }
      return json(result?.ok === true ? 200 : 503, report);
    } catch {
      return json(503, { status: 'blocked', code: 'adao_intake_runtime_exception' });
    }
  }

  // IAM-only real-use sync of an existing READY Shopee PDF for one reconciled Adão order.
  // Does not create Shopee documents, arrange shipping or finalize separation.
  if (normalizedPath === '/internal/shopee/adao/logistics/label/sync-ready') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (Number(request.headers?.['content-length'] ?? 0) !== 0
        || request.headers?.['transfer-encoding'] || request.body) {
      return json(400, { error: 'body_not_allowed' });
    }
    const query = request.query ?? {};
    if (Object.keys(query).length !== 1 || typeof query.order_sn !== 'string') {
      return json(400, { error: 'order_scope_required' });
    }
    try {
      const result = await syncAdaoLabel(query.order_sn);
      return json(result?.ok ? 200 : 409, {
        status: result?.ok ? 'ok' : 'blocked',
        account: 'adao', code: result?.code ?? 'label_sync_unavailable',
        document_id: result?.ok ? result.document_id ?? null : null,
        ...(result?.ok === false && result?.code === 'document_status_rejected'
          && result?.diagnostic ? { diagnostic: result.diagnostic } : {}),
      });
    } catch {
      return json(503, { status: 'blocked', account: 'adao', code: 'label_sync_exception' });
    }
  }

  // IAM-only Cloud Run route. Never expose this endpoint through public frontend
  // until a user-authenticated server proxy is installed.
  if (normalizedPath === '/internal/shopee/live/logistics/adao/sync-once') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (Object.keys(request.query ?? {}).length || Number(request.headers?.['content-length'] ?? 0) !== 0 || request.headers?.['transfer-encoding'] || request.body) return json(400, { error: 'body_or_query_not_allowed' });
    if (getEnv('SHOPEE_ADAO_LOGISTICS_SYNC_ENABLED') !== 'true') return json(503, { error: 'sync_disabled' });
    const raw = String(getEnv('SHOPEE_ADAO_LOGISTICS_ORDER_SNS') ?? '');
    const orderSns = raw.split(',').map(sn => sn.trim());
    if (!raw || orderSns.length > 20 || orderSns.length !== new Set(orderSns).size || orderSns.some(sn => !/^[A-Za-z0-9]{8,100}$/.test(sn))) return json(503, { error: 'invalid_scope' });
    try {
      const result = await readAdaoLogistics(orderSns);
      if (!result?.ok || result.account !== 'adao' || !Array.isArray(result.selected) || result.selected.length !== orderSns.length
          || result.selected.some(entry => !orderSns.includes(entry.order_sn) || entry.auto_arrangement_authorized !== false || entry.create_shipping_document_authorized !== false || entry.inventory_mutation_authorized !== false)) return json(503, { error: 'classification_unavailable' });
      const entries = result.selected.map(entry => ({
        order_sn: entry.order_sn, state: entry.state,
        reason: typeof entry.reason === 'string' && /^[A-Za-z0-9_:-]{1,100}$/.test(entry.reason) ? entry.reason : null,
      }));
      const pushed = await syncCore({ action: 'shopee.logistics_classification.sync',
        data: { channel_account_id: 'b4027369-5abf-4ac1-ab24-862334fae892', entries } });
      return pushed?.ok && pushed.payload?.status === 'ok' ? json(200, { status: 'ok', count: entries.length }) : json(503, { error: 'sync_unavailable' });
    } catch { return json(503, { error: 'sync_unavailable' }); }
  }

  if (normalizedPath === '/internal/shopee/live/logistics/adao/read-only') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if ((request.query && Object.keys(request.query).length)
      || Number(request.headers?.['content-length'] ?? 0) !== 0 || request.headers?.['transfer-encoding']
      || (request.body != null && request.body !== '')) return json(400, { error: 'body_or_query_not_allowed' });
    if (String(getEnv('SHOPEE_ADAO_LOGISTICS_READ_ENABLED') ?? '').toLowerCase() !== 'true') {
      return json(503, { status: 'blocked', code: 'adao_logistics_read_disabled' });
    }
    const raw = String(getEnv('SHOPEE_ADAO_LOGISTICS_ORDER_SNS') ?? '').trim();
    const orderSns = raw.split(',').map(sn => sn.trim());
    if (!raw || orderSns.length > 20 || new Set(orderSns).size !== orderSns.length
      || orderSns.some(sn => !/^[A-Za-z0-9]{8,100}$/.test(sn))) {
      return json(503, { status: 'blocked', code: 'adao_logistics_read_scope_invalid' });
    }
    try {
      const result = await readAdaoLogistics(orderSns);
      if (!result?.ok || !Array.isArray(result.selected)) {
        return json(503, { status: 'blocked', code: result?.code ?? 'adao_logistics_read_unavailable' });
      }
      return json(200, { status: 'ok', mode: 'read_only', account: 'adao',
        selected: result.selected.map(entry => ({
          order_sn: entry.order_sn, state: entry.state, reason: entry.reason ?? null,
          package_count: entry.package_count ?? null,
          auto_arrangement_authorized: false,
          create_shipping_document_authorized: false,
          inventory_mutation_authorized: false,
        })) });
    } catch {
      return json(503, { status: 'blocked', code: 'adao_logistics_read_unavailable' });
    }
  }

  if (normalizedPath === '/internal/shopee/live/logistics/label/prepare-once') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (request.query && Object.keys(request.query).length) return json(400, { error: 'query_not_allowed' });
    if (Number(request.headers?.['content-length'] ?? 0) !== 0 || request.headers?.['transfer-encoding']
        || (request.body != null && request.body !== '')) return json(400, { error: 'body_not_allowed' });
    if (String(getEnv('SHOPEE_LIVE_LABEL_CREATE_ENABLED') ?? '').trim().toLowerCase() !== 'true') {
      return json(503, { error: 'label_create_not_enabled' });
    }
    if (String(getEnv('SHOPEE_LIVE_LABEL_SYNC_ENABLED') ?? '').trim().toLowerCase() !== 'true') {
      return json(503, { error: 'label_sync_not_enabled' });
    }
    try {
      const result = await prepareShopeeLabel();
      // Never serialize arbitrary connector exceptions or raw upstream payloads.
      return json(result?.ok === true ? 200 : 503, {
        status: result?.ok === true ? 'ok' : 'blocked', mode: 'label_prepare_once',
        code: result?.code ?? 'label_preparation_unavailable',
        document_id: result?.ok === true ? result.document_id ?? null : null,
      });
    } catch { return json(503, { error: 'label_preparation_unavailable' }); }
  }

  // Isolated new Celivio pilot, never callable with arbitrary target.
  if (normalizedPath === '/internal/shopee/celivio/new-pilot/raw-once') {
    if (normalizedMethod !== 'POST') return json(405, {error:'method_not_allowed'});
    if (Object.keys(request.query ?? {}).length > 0 || request.headers?.['transfer-encoding']
      || (request.headers?.['content-length'] !== undefined && request.headers['content-length'] !== '0')
      || (request.body != null && request.body !== '')) return json(400,{error:'query_or_body_not_allowed'});
    if (getEnv('SHOPEE_CELIVIO_NEW_PILOT_RAW_ENABLED') !== 'true'
      || getEnv('SHOPEE_LIVE_CHANNEL_ACCOUNT_ID') !== 'd26c7a30-aa4a-4441-8012-600d70453689'
      || getEnv('SHOPEE_LIVE_LOGISTICS_PROBE_ORDER_SN') !== '261126AB2EH6V0')
      return json(503,{status:'blocked',code:'celivio_new_pilot_scope_invalid'});
    try {
      const result = await captureCelivioNewPilot();
      return json(result?.ok ? 200 : 503, result?.ok ? {status:'ok', ...result}
        : {status:'blocked',code:result?.code ?? 'raw_unavailable'});
    } catch { return json(503,{status:'blocked',code:'raw_unavailable'}); }
  }

  // C6: one reviewed Celivio order, same C4-E Core Raw adapter.
  // Explicitly OFF by default. No caller-selected SN, no scheduler or order writes.
  if (normalizedPath === '/internal/shopee/celivio/c6/raw-once') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (Object.keys(request.query ?? {}).length > 0
      || request.headers?.['transfer-encoding']
      || (request.headers?.['content-length'] !== undefined
        && request.headers['content-length'] !== '0')
      || (request.body != null && request.body !== '')) {
      return json(400, { error: 'query_or_body_not_allowed' });
    }
    if (String(getEnv('SHOPEE_CELIVIO_C6_RAW_ONCE_ENABLED') ?? '')
      .trim().toLowerCase() !== 'true') {
      return json(503, { status:'blocked', code:'c6_not_enabled', raw_persist_attempted:0 });
    }
    try {
      const result = await captureCelivioC6();
      return json(result?.ok ? 200 : 503, result?.ok
        ? {status:'ok', ...result}
        : {status:'blocked',code:result?.code ?? 'c6_unavailable',
           raw_persist_attempted:0,orders_written:0,items_written:0});
    } catch {
      return json(503,{status:'blocked',code:'c6_unavailable',
        raw_persist_attempted:0,orders_written:0,items_written:0});
    }
  }

  // C4-E Celivio-only: explicit gate to exactly one redacted eligible-order
  // Raw snapshot. No order/stock/separation writer and no token refresh.
  if (normalizedPath === '/internal/shopee/celivio/c4e/raw-once') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (Object.keys(request.query ?? {}).length > 0
      || request.headers?.['transfer-encoding']
      || (request.headers?.['content-length'] !== undefined
        && request.headers['content-length'] !== '0')
      || (request.body != null && request.body !== '')) {
      return json(400, { error: 'query_or_body_not_allowed' });
    }
    if (String(getEnv('SHOPEE_CELIVIO_C4E_RAW_ONCE_ENABLED') ?? '')
      .trim().toLowerCase() !== 'true') {
      return json(503, { status:'blocked', code:'c4e_not_enabled', raw_persist_attempted:0 });
    }
    try {
      const result = await captureCelivioC4E();
      return json(result?.ok ? 200 : 503, result?.ok
        ? {status:'ok', ...result}
        : {status:'blocked',code:result?.code ?? 'c4e_unavailable',
           raw_persist_attempted:0,orders_written:0,items_written:0});
    } catch {
      return json(503,{status:'blocked',code:'c4e_unavailable',
        raw_persist_attempted:0,orders_written:0,items_written:0});
    }
  }

  // C4-B Celivio-only: isolated GETs to Shopee, zero Core writes.
  // Default OFF, IAM-protected internal route; no caller-selected account/order.
  if (normalizedPath === '/internal/shopee/celivio/c4b/read-only') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (Object.keys(request.query ?? {}).length > 0
      || request.headers?.['transfer-encoding']
      || (request.headers?.['content-length'] !== undefined
        && request.headers['content-length'] !== '0')
      || (request.body != null && request.body !== '')) {
      return json(400, { error: 'query_or_body_not_allowed' });
    }
    if (String(getEnv('SHOPEE_CELIVIO_C4B_READONLY_ENABLED') ?? '').toLowerCase() !== 'true') {
      return json(503, { status: 'blocked', code: 'c4b_not_enabled', written: 0 });
    }
    try {
      const result = await readCelivioC4B();
      return json(result?.ok ? 200 : 503, result?.ok
        ? { status: 'ok', ...result }
        : { status: 'blocked', code: result?.code ?? 'c4b_unavailable', written: 0 });
    } catch {
      return json(503, { status: 'blocked', code: 'c4b_unavailable', written: 0 });
    }
  }

  if (normalizedPath === '/internal/shopee/live/oauth/refresh-once') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (request.query && Object.keys(request.query).length > 0) {
      return json(400, { error: 'query_not_allowed' });
    }

    const enabled = String(getEnv('SHOPEE_LIVE_OAUTH_REFRESH_ENABLED') ?? '')
      .trim()
      .toLowerCase() === 'true';
    if (!enabled) return json(503, { error: 'oauth_refresh_not_enabled' });

    try {
      const result = await refreshShopeeOauth();
      if (!result?.ok) {
        return json(503, {
          status: 'degraded',
          mode: 'oauth_refresh_once',
          code: result?.code ?? 'unknown_error',
          shopee_status: Number(result?.shopee_status ?? 0) || null,
          shopee_error: result?.shopee_error ?? null,
          before: result?.before ?? null,
        });
      }

      return json(200, {
        status: 'ok',
        mode: 'oauth_refresh_once',
        code: result.code,
        before: result.before ?? null,
        after: result.after ?? null,
      });
    } catch {
      return json(503, {
        status: 'degraded',
        mode: 'oauth_refresh_once',
        code: 'runtime_exception',
      });
    }
  }



  // Diagnóstico fiscal/logístico read-only do pedido piloto: desligado por padrão.
  // Não chama ship_order, create_shipping_document ou escritores do Core.
  if (normalizedPath === '/internal/shopee/live/logistics/shipping/preflight-once') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (request.query && Object.keys(request.query).length > 0) {
      return json(400, { error: 'query_not_allowed' });
    }
    const enabled = String(getEnv('SHOPEE_LIVE_SHIPPING_PREFLIGHT_ENABLED') ?? '')
      .trim().toLowerCase() === 'true';
    if (!enabled) return json(503, { error: 'shipping_preflight_not_enabled' });
    const orderSn = String(getEnv('SHOPEE_LIVE_SHIPPING_PREFLIGHT_ORDER_SN') ?? '').trim();
    const fiscalMode = String(getEnv('SHOPEE_LIVE_SHIPPING_FISCAL_MODE') ?? '').trim();
    if (!orderSn || !['pj_shopee_issuer', 'cpf_no_invoice_step'].includes(fiscalMode)) {
      return json(503, { error: 'shipping_preflight_not_configured' });
    }
    try {
      const result = await inspectShippingPreflight();
      const response = {
        status: result?.ok === true ? 'ok' : 'blocked',
        mode: 'read_only',
        code: result?.code ?? 'unknown_error',
        order_status: result?.order_status ?? null,
        fiscal: result?.fiscal ?? null,
        modes: Array.isArray(result?.modes) ? result.modes : [],
        auto_arrangement_authorized: false,
      };
      return json(result?.ok === true ? 200 : 409, response);
    } catch {
      return json(503, { status: 'degraded', mode: 'read_only', code: 'runtime_exception' });
    }
  }


  // F6-O.2e.2d: private IAM one-pilot shipping. Never a scheduler or browser action.
  // Requires two independent OFF-by-default flags plus an expiring scope
  // rechecked in the guarded executor before Core claim / external POST.
  if (normalizedPath === '/internal/shopee/live/logistics/shipping/ship-once') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (request.query && Object.keys(request.query).length > 0) {
      return json(400, { error: 'query_not_allowed' });
    }
    const headers = request.headers ?? {};
    const length = headers['content-length'];
    if (headers['transfer-encoding'] !== undefined
        || (length !== undefined && length !== '0')) {
      return json(400, { error: 'body_not_allowed' });
    }
    const routeEnabled = String(getEnv('SHOPEE_LIVE_SHIP_ORDER_ROUTE_ENABLED') ?? '')
      .trim().toLowerCase() === 'true';
    const writerEnabled = String(getEnv('SHOPEE_LIVE_SHIP_ORDER_ENABLED') ?? '')
      .trim().toLowerCase() === 'true';
    if (!routeEnabled || !writerEnabled) {
      return json(503, { error: 'ship_order_not_enabled' });
    }
    const runId = makeRunId();
    const startedAt = now();
    // Only allow known, non-sensitive result codes. Never include Shopee response,
    // token, request payload, invoice, buyer details, or package address in logs.
    const knownCodes = new Set([
      'ship_order_api_acknowledged_not_collected',
      'ship_order_disabled', 'ship_order_pilot_not_configured',
      'ship_order_pilot_scope_mismatch', 'ship_order_window_inactive',
      'partner_not_configured', 'preflight_unavailable',
      'preflight_not_eligible', 'preflight_shop_missing',
      'connection_identity_mismatch', 'access_token_expired_no_refresh',
      'token_unavailable', 'shipping_claim_not_acquired',
      'already_claimed', 'already_succeeded', 'uncertain_requires_reconciliation',
      'claim_fingerprint_mismatch', 'account_or_shop_mismatch',
      'order_not_unique_or_missing', 'invalid_request',
      'ship_order_uncertain_requires_reconciliation',
      'sent_but_core_confirmation_missing',
    ]);
    let code = 'runtime_exception';
    let success = false;
    try {
      const result = await shipShopeeOrderOnce();
      code = knownCodes.has(result?.code) ? result.code : 'runtime_exception';
      success = result?.ok === true && code === 'ship_order_api_acknowledged_not_collected';
    } catch { /* Sanitized, no retry. */ }
    const status = success ? 200
      : ['runtime_exception','ship_order_pilot_not_configured','ship_order_window_inactive',
          'partner_not_configured','preflight_unavailable','shipping_claim_not_acquired',
          'sent_but_core_confirmation_missing'].includes(code) ? 503 : 409;
    try {
      logEvent({
        event: 'shopee_ship_order_once',
        runId, startedAt, finishedAt: now(),
        status: success ? 'api_acknowledged' : 'blocked',
        code,
      });
    } catch { /* Logging never changes the request outcome. */ }
    return json(status, {
      status: success ? 'ok' : 'blocked',
      mode: 'single_pilot_ship_order',
      code,
      // This is NOT proof of physical posting or stock movement.
      physical_handoff_confirmed: false,
    });
  }

  // Ação restrita ao pedido piloto configurado no runtime. Desabilitada por padrão.
  if (normalizedPath === '/internal/shopee/live/logistics/label/sync-once') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (request.query && Object.keys(request.query).length > 0) {
      return json(400, { error: 'query_not_allowed' });
    }
    const enabled = String(getEnv('SHOPEE_LIVE_LABEL_SYNC_ENABLED') ?? '').trim().toLowerCase() === 'true';
    if (!enabled) return json(503, { error: 'label_sync_not_enabled' });
    if (!String(getEnv('SHOPEE_LIVE_LABEL_ORDER_SN') ?? '').trim()) {
      return json(503, { error: 'label_target_not_configured' });
    }
    try {
      const result = await syncShopeeLabel();
      if (!result?.ok) {
        return json(503, { status: 'degraded', mode: 'label_sync_once', code: result?.code ?? 'unknown_error' });
      }
      return json(200, {
        status: 'ok', mode: 'label_sync_once', code: result.code,
        document_type: result.document_type ?? 'shipping_label',
        document_id: result.document_id ?? null,
      });
    } catch {
      return json(503, { status: 'degraded', mode: 'label_sync_once', code: 'runtime_exception' });
    }
  }

  // New Celivio pilot only; reuse existing label synchronizer.
  if (normalizedPath === '/internal/shopee/celivio/new-pilot/label/sync-once') {
    if (normalizedMethod !== 'POST') return json(405, {error:'method_not_allowed'});
    if (Object.keys(request.query ?? {}).length
        || Number(request.headers?.['content-length'] ?? 0) !== 0
        || request.headers?.['transfer-encoding'] || request.body)
      return json(400,{error:'body_or_query_not_allowed'});
    if (getEnv('SHOPEE_CELIVIO_NEW_PILOT_LABEL_ENABLED') !== 'true'
        || getEnv('SHOPEE_LIVE_CHANNEL_ACCOUNT_ID') !== CELIVIO_C4C_ACCOUNT_ID
        || getEnv('SHOPEE_LIVE_LOGISTICS_PROBE_ORDER_SN') !== '261126AB2EH6V0')
      return json(503,{status:'blocked',code:'celivio_new_pilot_label_disabled'});
    try {
      const result = await syncCelivioNewPilotLabel();
      return json(result?.ok ? 200 : 409,{
        status:result?.ok ? 'ok' : 'blocked',account:'celivio',
        code:result?.code ?? 'label_unavailable',
        document_id:result?.ok ? result.document_id ?? null : null,
      });
    } catch { return json(503,{status:'blocked',code:'celivio_new_pilot_label_exception'}); }
  }

  // C7: current Celivio order label only, after Shopee confirms shipment
  // has already been arranged. No shipping writer or OAuth refresh.
  if (normalizedPath === '/internal/shopee/celivio/c7/label/sync-once') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (Object.keys(request.query ?? {}).length
        || Number(request.headers?.['content-length'] ?? 0) !== 0
        || request.headers?.['transfer-encoding'] || request.body) {
      return json(400, { error: 'body_or_query_not_allowed' });
    }
    if (getEnv('SHOPEE_CELIVIO_C7_LABEL_SYNC_ENABLED') !== 'true'
        || getEnv('SHOPEE_LIVE_CHANNEL_ACCOUNT_ID') !== CELIVIO_C4C_ACCOUNT_ID
        || CELIVIO_C7_ORDER_SN !== '2611258Y00VM5U') {
      return json(503, { status: 'blocked', code: 'celivio_c7_label_disabled' });
    }
    try {
      const result = await syncCelivioC7Label();
      return json(result?.ok ? 200 : 409, {
        status: result?.ok ? 'ok' : 'blocked', account: 'celivio',
        code: result?.code ?? 'label_unavailable',
        document_id: result?.ok ? result.document_id ?? null : null,
      });
    } catch {
      return json(503, { status: 'blocked', code: 'celivio_c7_label_exception' });
    }
  }

  // F5: one exact Celivio pilot, reusing Adão's durable-claim PDF synchronizer.
  // No automatic scheduling, no ship_order, no general account/order input.
  if (normalizedPath === '/internal/shopee/celivio/f5/label/sync-once') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (Object.keys(request.query ?? {}).length
        || Number(request.headers?.['content-length'] ?? 0) !== 0
        || request.headers?.['transfer-encoding'] || request.body) {
      return json(400, { error: 'body_or_query_not_allowed' });
    }
    if (getEnv('SHOPEE_CELIVIO_F5_LABEL_SYNC_ENABLED') !== 'true'
        || getEnv('SHOPEE_LIVE_CHANNEL_ACCOUNT_ID') !== CELIVIO_C4C_ACCOUNT_ID
        || getEnv('SHOPEE_LIVE_LOGISTICS_PROBE_ORDER_SN') !== '261121TBS6BHE6') {
      return json(503, { status: 'blocked', code: 'celivio_f5_label_sync_disabled' });
    }
    try {
      const result = await syncCelivioPilotLabel();
      const code = result?.code ?? 'label_sync_unavailable';
      return json(result?.ok ? 200 : 409, {
        status: result?.ok ? 'ok' : 'blocked',
        account: 'celivio', code,
        document_id: result?.ok ? result.document_id ?? null : null,
        ...(code === 'document_status_rejected' && result?.diagnostic
          ? { diagnostic: result.diagnostic } : {}),
      });
    } catch {
      return json(503, { status: 'blocked', account: 'celivio', code: 'label_sync_exception' });
    }
  }

  // Read-only Celivio PDF task status; intentionally does not download or create documents.
  if (normalizedPath === '/internal/shopee/celivio/f5/document-result') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (Object.keys(request.query ?? {}).length
        || Number(request.headers?.['content-length'] ?? 0) !== 0
        || request.headers?.['transfer-encoding'] || request.body) {
      return json(400, { error: 'body_or_query_not_allowed' });
    }
    if (getEnv('SHOPEE_CELIVIO_F5_DOCUMENT_RESULT_ENABLED') !== 'true'
        || getEnv('SHOPEE_LIVE_CHANNEL_ACCOUNT_ID') !== CELIVIO_C4C_ACCOUNT_ID
        || getEnv('SHOPEE_LIVE_LOGISTICS_PROBE_ORDER_SN') !== '261121TBS6BHE6') {
      return json(503, { status: 'blocked', code: 'celivio_document_result_disabled' });
    }
    try {
      const result = await inspectShopeeLogistics({
        orderSn: '261121TBS6BHE6', celivioDocumentResultOnly: true,
      });
      return json(result?.ok ? 200 : 503, result?.ok
        ? { status: 'ok', mode: 'read_only', ...result }
        : { status: 'degraded', mode: 'read_only',
          code: result?.code ?? 'document_result_unavailable',
          ...(result?.diagnostic ? { diagnostic: result.diagnostic } : {}) });
    } catch {
      return json(503, { status: 'degraded', mode: 'read_only', code: 'runtime_exception' });
    }
  }

  if (normalizedPath === '/internal/shopee/live/logistics/inspect') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (request.query && Object.keys(request.query).length > 0) {
      return json(400, { error: 'query_not_allowed' });
    }

    const orderSn = String(getEnv('SHOPEE_LIVE_LOGISTICS_PROBE_ORDER_SN') ?? '').trim();
    if (!orderSn) return json(503, { error: 'logistics_probe_not_configured' });

    try {
      const result = await inspectShopeeLogistics({ orderSn });
      if (!result?.ok) {
        return json(503, {
          status: 'degraded',
          mode: 'read_only',
          orderSn,
          code: result?.code ?? 'unknown_error',
        });
      }

      return json(200, {
        status: 'ok',
        mode: 'read_only',
        order: result.order ?? null,
        shipping_parameter: result.shipping_parameter ?? null,
        shipping_document_parameter: result.shipping_document_parameter ?? null,
      });
    } catch {
      return json(503, {
        status: 'degraded',
        mode: 'read_only',
        orderSn,
        code: 'runtime_exception',
      });
    }
  }

  if (normalizedPath === '/internal/shopee/live/cycle/run') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if ((request.query && Object.keys(request.query).length) || Number(request.headers?.['content-length'] ?? 0) !== 0
      || request.headers?.['transfer-encoding'] || (request.body != null && request.body !== '')) return json(400, { error: 'body_or_query_not_allowed' });
    if (String(getEnv('SHOPEE_LIVE_CYCLE_ENABLED') ?? '').trim().toLowerCase() !== 'true') return json(503, { error: 'cycle_not_enabled' });
    try {
      const result = await runMinimumCycle();
      logEvent({ event: 'shopee_minimum_cycle', runId: makeRunId(), ...result });
      return json(result?.ok ? 200 : 503, result);
    } catch {
      logEvent({ event: 'shopee_minimum_cycle', code: 'cycle_checkpoint_or_runtime_failure' });
      return json(503, { ok: false, code: 'cycle_checkpoint_or_runtime_failure' });
    }
  }

  if (normalizedPath === '/internal/shopee/live/orders/intake/run') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (request.query && Object.keys(request.query).length > 0) {
      return json(400, { error: 'query_not_allowed' });
    }

    const channelAccountId = String(getEnv('SHOPEE_LIVE_CHANNEL_ACCOUNT_ID') ?? '').trim();
    const autoCommitEnabled = String(getEnv('SHOPEE_LIVE_AUTO_COMMIT_ENABLED') ?? '')
      .trim()
      .toLowerCase() === 'true';

    if (!channelAccountId || !autoCommitEnabled) {
      return json(503, { error: 'auto_commit_not_enabled' });
    }

    const runId = makeRunId();
    const startedAt = now();

    try {
      const result = await runShopeeCommit({
        channelAccountId,
        limit: SHOPEE_OPERATIONAL_COMMIT_POLICY.batchLimit,
        mode: 'commit',
      });
      const finishedAt = now();
      const summary = summarizeShopeeControlledRound(result);

      logEvent({
        event: 'shopee_intake_round',
        runId,
        startedAt,
        finishedAt,
        channelAccountId,
        ok: result?.ok === true,
        roundStopped: result?.roundStopped === true,
        stopReason: result?.stopReason ?? null,
        summary,
      });

      const sanitizedResults = Array.isArray(result?.results)
        ? result.results.map((entry) => ({
          orderSn: entry?.orderSn ?? null,
          status: entry?.status ?? null,
          blockers: Array.isArray(entry?.blockers) ? entry.blockers : [],
          alreadyRegistered: entry?.write?.alreadyRegistered === true,
        }))
        : [];

      if (!result?.ok || result?.roundStopped === true) {
        return json(503, {
          status: 'degraded',
          mode: 'commit',
          runId,
          ...summary,
          roundStopped: result?.roundStopped === true,
          stopReason: result?.stopReason ?? null,
          results: sanitizedResults,
        });
      }

      return json(200, {
        status: summary.blocked > 0 || summary.retryable > 0 ? 'attention' : 'ok',
        mode: 'commit',
        runId,
        ...summary,
        roundStopped: false,
        stopReason: null,
        results: sanitizedResults,
      });
    } catch {
      const finishedAt = now();
      logEvent({
        event: 'shopee_intake_round',
        runId,
        startedAt,
        finishedAt,
        channelAccountId,
        ok: false,
        roundStopped: true,
        stopReason: 'runtime_exception',
      });
      return json(503, {
        status: 'degraded',
        mode: 'commit',
        runId,
        selected: 0,
        ready: 0,
        blocked: 0,
        written: 0,
        success: 0,
        retryable: 0,
        unknown: 0,
        statuses: {},
        roundStopped: true,
        stopReason: 'runtime_exception',
        results: [],
      });
    }
  }

  if (normalizedPath === '/internal/shopee/live/orders/intake/commit-one') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (request.query && Object.keys(request.query).length > 0) {
      return json(400, { error: 'query_not_allowed' });
    }

    const channelAccountId = String(getEnv('SHOPEE_LIVE_CHANNEL_ACCOUNT_ID') ?? '').trim();
    const expectedOrderSn = String(getEnv('SHOPEE_LIVE_COMMIT_ORDER_SN') ?? '').trim();
    const commitEnabled = String(getEnv('SHOPEE_LIVE_COMMIT_ENABLED') ?? '').trim().toLowerCase() === 'true';

    if (!channelAccountId || !expectedOrderSn || !commitEnabled) {
      return json(503, { error: 'commit_not_enabled' });
    }

    try {
      // Celivio C4-G: only the already-previewed pilot can enter
      // the 12s account-scoped Core reader and existing idempotent writer.
      // The external commit flag and exact env order identity remain mandatory.
      const commitOne = channelAccountId === CELIVIO_C4C_ACCOUNT_ID
        ? runCelivioCommitOne : runShopeeCommit;
      const result = await commitOne({
        channelAccountId,
        limit: 5,
        mode: 'commit',
        expectedOrderSn,
      });

      const entry = Array.isArray(result?.results) ? result.results[0] : null;
      const acceptableStatus = entry?.status === 'written' || entry?.status === 'already_registered';
      const exactTarget = entry?.orderSn === expectedOrderSn;

      if (!result?.ok
        || Number(result.selected ?? 0) !== 1
        || Number(result.ready ?? 0) !== 1
        || Number(result.blocked ?? 0) !== 0
        || !entry
        || !acceptableStatus
        || !exactTarget) {
        return json(409, {
          status: 'blocked',
          mode: 'commit',
          targetOrderSn: expectedOrderSn,
          selected: Number(result?.selected ?? 0),
          ready: Number(result?.ready ?? 0),
          blocked: Number(result?.blocked ?? 0),
          written: Number(result?.written ?? 0),
          result: entry
            ? {
              orderSn: entry.orderSn ?? null,
              status: entry.status ?? null,
              blockers: Array.isArray(entry.blockers) ? entry.blockers : [],
            }
            : null,
        });
      }

      return json(200, {
        status: 'ok',
        mode: 'commit',
        targetOrderSn: expectedOrderSn,
        selected: 1,
        ready: 1,
        blocked: 0,
        written: Number(result.written ?? 0),
        result: {
          orderSn: entry.orderSn,
          status: entry.status,
          alreadyRegistered: entry?.write?.alreadyRegistered === true,
          orderId: typeof entry?.write?.orderId === 'string' ? entry.write.orderId : null,
          separationId: typeof entry?.write?.separationId === 'string' ? entry.write.separationId : null,
        },
      });
    } catch {
      return json(503, {
        status: 'degraded',
        mode: 'commit',
        selected: 0,
        ready: 0,
        blocked: 0,
        written: 0,
        result: null,
      });
    }
  }

  // IAM-only fixed-scope Adão diagnostics: no caller-provided account, IDs or body.
  if (normalizedPath === '/internal/shopee/live/mappings/adao-70/preview') {
    if (normalizedMethod !== 'POST') return json(405, {error:'method_not_allowed'});
    if (request.query && Object.keys(request.query).length>0) return json(400, {error:'query_not_allowed'});
    if (request.headers?.['transfer-encoding']
      || (request.headers?.['content-length']!==undefined && request.headers['content-length']!=='0')
      || (request.body!=null && request.body!=='')) return json(400, {error:'body_not_allowed'});
    try {
      const result=await previewAdaoMappings70();
      return json(result.ok?200:503,result);
    } catch {
      return json(503,{ok:false,code:'mapping_diagnostic_unavailable',written:0});
    }
  }

  // Private fixed-scope Alfajor Adao diagnostic; IAM handles authentication.
  if (normalizedPath === '/internal/shopee/live/mappings/alfajor-adao/preview') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (request.query && Object.keys(request.query).length > 0) return json(400, { error: 'query_not_allowed' });
    if (request.headers?.['transfer-encoding']
      || (request.headers?.['content-length'] !== undefined && request.headers['content-length'] !== '0')
      || (request.body != null && request.body !== '')) return json(400, { error: 'body_not_allowed' });
    try {
      const result = await previewAlfajorAdaoMappings();
      return json(result.ok ? 200 : 503, result.ok ? { status: 'ok', ...result }
        : { status: 'blocked', code: result.code ?? 'mapping_diagnostic_mismatch',
          written: 0, selected: result.selected ?? 0, recognized: result.recognized ?? 0,
          blocked: result.blocked ?? 0, negative_tests: result.negative_tests ?? null });
    } catch {
      return json(503, { status: 'blocked', code: 'mapping_diagnostic_unavailable', written: 0 });
    }
  }

  // Private IAM-only fixed-scope mapping diagnostic. No writes or external Shopee calls.
  if (normalizedPath === '/internal/shopee/live/mappings/porto-gel-viviane/preview') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (request.query && Object.keys(request.query).length > 0) return json(400, { error: 'query_not_allowed' });
    if (request.headers?.['transfer-encoding']
      || (request.headers?.['content-length'] !== undefined && request.headers['content-length'] !== '0')
      || (request.body != null && request.body !== '')) return json(400, { error: 'body_not_allowed' });
    try {
      const result = await previewPortoGelVivianeMappings();
      return json(result.ok ? 200 : 503, result.ok ? { status: 'ok', ...result }
        : { status: 'blocked', code: result.code, written: 0 });
    } catch {
      return json(503, { status: 'blocked', code: 'mapping_diagnostic_unavailable', written: 0 });
    }
  }

  // E05 (SKU V1.3): private, exact, default-off consultative read.
  // Never reads Shopee, never refreshes OAuth, never runs order intake.
  if (normalizedPath === '/internal/shopee/live/sku-registry/preview') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (Object.keys(request.query ?? {}).length
      || request.headers?.['transfer-encoding'] !== undefined
      || (request.headers?.['content-length'] !== undefined
        && request.headers['content-length'] !== '0')
      || (request.body !== undefined && request.body !== null && request.body !== '')) {
      return json(400, { error: 'sku_registry_request_must_be_empty' });
    }
    if (String(getEnv('SHOPEE_SKU_REGISTRY_PREVIEW_ENABLED') ?? '').toLowerCase() !== 'true') {
      return json(503, { status: 'blocked', code: 'sku_registry_preview_disabled', written: 0 });
    }
    const channelAccountId = String(getEnv('SHOPEE_SKU_REGISTRY_CHANNEL_ACCOUNT_ID') ?? '').trim();
    const itemId = String(getEnv('SHOPEE_SKU_REGISTRY_ITEM_ID') ?? '').trim();
    const modelId = String(getEnv('SHOPEE_SKU_REGISTRY_MODEL_ID') ?? '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(channelAccountId)
      || !/^[0-9]{1,30}$/.test(itemId)
      || !/^[0-9]{1,30}$/.test(modelId)) {
      return json(503, { status: 'blocked', code: 'sku_registry_scope_invalid', written: 0 });
    }
    try {
      const result = await readSellerSkuRegistry({
        channel_account_id: channelAccountId, item_id: itemId, model_id: modelId,
      });
      const payload = result?.payload;
      if (result?.ok !== true || !payload || payload.status !== 'ok'
        || payload.action !== 'shopee.seller_sku_registry.read'
        || payload.channel_account_id !== channelAccountId
        || payload.item_id !== itemId || payload.model_id !== modelId
        || typeof payload.mapping_found !== 'boolean'
        || typeof payload.registry_found !== 'boolean'
        || (payload.registry_found && !payload.mapping_found)
        || (payload.registry_found && (typeof payload.canonical_sku !== 'string'
          || !['UNKNOWN','BLANK','VALUE'].includes(payload.observation_kind)))
        || (payload.mapping_found && typeof payload.mapping_id !== 'string')
        || payload.written !== 0) {
        return json(503, { status: 'blocked', code: 'sku_registry_preview_unavailable', written: 0 });
      }
      return json(200, {
        status: 'ok', mode: 'read_only', account: channelAccountId,
        item_id: itemId, model_id: modelId,
        mapping_found: payload.mapping_found,
        registry_found: payload.registry_found,
        mapping_id: payload.mapping_found ? payload.mapping_id : null,
        canonical_sku: payload.registry_found ? payload.canonical_sku : null,
        observed_sku: payload.registry_found ? payload.observed_sku ?? null : null,
        observation_kind: payload.registry_found ? payload.observation_kind : 'UNKNOWN',
        reconciliation_status: payload.registry_found ? payload.reconciliation_status : 'NAO_PREPARADO',
        revision: payload.registry_found ? payload.revision : null,
        written: 0,
      });
    } catch {
      return json(503, { status: 'blocked', code: 'sku_registry_preview_unavailable', written: 0 });
    }
  }

  if (normalizedPath === '/internal/shopee/live/orders/intake/preview') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });

    const channelAccountId = String(getEnv('SHOPEE_LIVE_CHANNEL_ACCOUNT_ID') ?? '').trim();
    if (!channelAccountId) return json(503, { error: 'runtime_not_configured' });

    try {
      // Celivio only: bounded 12s Core batch read as already proven for Adão.
      // No changes for Priscila, Viviane, Adão or any commit endpoint.
      const preview = channelAccountId === CELIVIO_C4C_ACCOUNT_ID
        ? runCelivioReadOnlyPreview : runShopeePreview;
      const result = await preview({
        channelAccountId,
        limit: 5,
        mode: 'preview',
      });

      if (!result?.ok) {
        return json(503, {
          status: 'degraded',
          mode: 'preview',
          selected: Number(result?.selected ?? 0),
          ready: Number(result?.ready ?? 0),
          blocked: Number(result?.blocked ?? 0),
          written: 0,
          results: [],
        });
      }

      return json(200, {
        status: 'ok',
        mode: 'preview',
        marketplaceAccount: result.marketplaceAccount ?? null,
        selected: Number(result.selected ?? 0),
        ready: Number(result.ready ?? 0),
        blocked: Number(result.blocked ?? 0),
        written: 0,
        sourceCounts: result.sourceCounts ?? null,
        results: Array.isArray(result.results)
          ? result.results.map((entry) => ({
            orderSn: entry?.orderSn ?? null,
            status: entry?.status ?? null,
            blockers: Array.isArray(entry?.blockers) ? entry.blockers : [],
          }))
          : [],
      });
    } catch {
      return json(503, {
        status: 'degraded',
        mode: 'preview',
        selected: 0,
        ready: 0,
        blocked: 0,
        written: 0,
        results: [],
      });
    }
  }

  if (normalizedPath !== '/health/core') return routeRequest(request);
  if (normalizedMethod !== 'GET') {
    return json(405, { error: 'method_not_allowed' });
  }
  let available = false;
  try { available = await probeCore() === true; } catch { /* Sanitized response below. */ }
  return json(available ? 200 : 503, {
    status: available ? 'ok' : 'degraded',
    service: HUB_SERVICE_NAME,
    core_bridge: available ? 'ok' : 'unavailable',
  });
}

export function routeRequest({ method, path }) {
  const normalizedMethod = String(method ?? 'GET').toUpperCase();
  const normalizedPath = String(path ?? '/');

  if (normalizedPath === '/health') {
    if (normalizedMethod !== 'GET') {
      return json(405, { error: 'method_not_allowed' });
    }

    return json(200, {
      status: 'ok',
      service: HUB_SERVICE_NAME,
      version: HUB_VERSION,
    });
  }

  if (normalizedPath === '/') {
    if (normalizedMethod !== 'GET') {
      return json(405, { error: 'method_not_allowed' });
    }

    return json(200, {
      service: HUB_SERVICE_NAME,
      version: HUB_VERSION,
      role: 'external-integration-runtime',
    });
  }

  return json(404, { error: 'route_not_found' });
}
