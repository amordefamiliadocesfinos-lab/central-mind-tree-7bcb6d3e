import { readLiveShopeeOrderIntakeBatch } from './core-bridge.mjs';
import { normalizeShopeeOrderRawSnapshot } from './shopee-order-normalizer.mjs';
import { buildShopeeMappingPreview } from './shopee-mapping-preview.mjs';
import { buildShopeeOrderProjectionPreview } from './shopee-order-projection-preview.mjs';
import { applyShopeeInternalOrderContract } from './shopee-internal-order-contract.mjs';
import { persistShopeeOrderContract } from './shopee-order-writer.mjs';

const MODES = new Set(['preview', 'commit']);

function sanitizeResult(result = {}) {
  return {
    ok: result?.ok === true,
    status: Number.isFinite(Number(result?.status)) ? Number(result.status) : null,
    orderId: typeof result?.payload?.order_id === 'string' ? result.payload.order_id : null,
    separationId: typeof result?.payload?.separation_id === 'string' ? result.payload.separation_id : null,
    alreadyRegistered: result?.payload?.already_registered === true,
  };
}

export function createShopeeControlledAutoIntake({
  readBatch = readLiveShopeeOrderIntakeBatch,
  persistOrder = persistShopeeOrderContract,
} = {}) {
  return async function runShopeeControlledAutoIntake({
    channelAccountId,
    limit = 5,
    mode = 'preview',
  } = {}) {
    if (typeof channelAccountId !== 'string' || channelAccountId.trim() === '') {
      throw new TypeError('channelAccountId is required');
    }
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20) {
      throw new TypeError('limit must be an integer between 1 and 20');
    }
    if (!MODES.has(mode)) throw new TypeError('mode must be preview or commit');

    const batch = await readBatch({
      channel_account_id: channelAccountId.trim(),
      limit,
    });
    if (!batch?.ok) {
      return {
        ok: false,
        code: 'intake_batch_unavailable',
        status: batch?.status ?? null,
        mode,
        selected: 0,
        ready: 0,
        blocked: 0,
        written: 0,
        results: [],
      };
    }

    const payload = batch.payload;
    if (!payload || !Array.isArray(payload.snapshots) || !Array.isArray(payload.mappings)) {
      return {
        ok: false,
        code: 'intake_batch_invalid',
        status: batch?.status ?? null,
        mode,
        selected: 0,
        ready: 0,
        blocked: 0,
        written: 0,
        results: [],
      };
    }

    const marketplaceAccount = typeof payload.marketplace_account === 'string'
      ? payload.marketplace_account.trim()
      : '';
    if (!marketplaceAccount) {
      return {
        ok: false,
        code: 'intake_account_missing',
        status: batch?.status ?? null,
        mode,
        selected: payload.snapshots.length,
        ready: 0,
        blocked: payload.snapshots.length,
        written: 0,
        results: [],
      };
    }

    const results = [];
    let ready = 0;
    let blocked = 0;
    let written = 0;

    for (const snapshot of payload.snapshots) {
      let orderSn = typeof snapshot?.external_entity_id === 'string'
        ? snapshot.external_entity_id
        : null;
      try {
        const normalized = normalizeShopeeOrderRawSnapshot(snapshot);
        if (normalized.orders.length !== 1) {
          blocked += 1;
          results.push({
            orderSn,
            status: 'blocked',
            blockers: ['snapshot_order_count_mismatch'],
            write: null,
          });
          continue;
        }

        orderSn = normalized.orders[0]?.orderSn ?? orderSn;
        const mapping = buildShopeeMappingPreview(normalized, payload.mappings, {
          channelAccountId: normalized.channelAccountId,
          marketplaceAccount,
        });
        const projection = buildShopeeOrderProjectionPreview(normalized, mapping, {
          marketplaceAccount,
          existingExternalOrderIds: new Set(),
        });
        const projected = projection.orders[0];

        if (!projected || projected.projectionStatus !== 'ready') {
          blocked += 1;
          results.push({
            orderSn,
            status: 'blocked',
            blockers: Array.isArray(projected?.blockers) ? projected.blockers : ['projection_missing'],
            write: null,
          });
          continue;
        }

        const contract = applyShopeeInternalOrderContract(projected, {
          channelAccountId: normalized.channelAccountId,
          marketplaceAccount,
        });
        ready += 1;

        if (mode === 'preview') {
          results.push({
            orderSn,
            status: 'ready',
            blockers: [],
            write: null,
          });
          continue;
        }

        const persisted = await persistOrder(contract);
        const safeWrite = sanitizeResult(persisted);
        if (!safeWrite.ok) {
          results.push({
            orderSn,
            status: 'write_failed',
            blockers: ['writer_rejected'],
            write: safeWrite,
          });
          continue;
        }

        written += 1;
        results.push({
          orderSn,
          status: safeWrite.alreadyRegistered ? 'already_registered' : 'written',
          blockers: [],
          write: safeWrite,
        });
      } catch {
        blocked += 1;
        results.push({
          orderSn,
          status: 'blocked',
          blockers: ['pipeline_exception'],
          write: null,
        });
      }
    }

    return {
      ok: true,
      mode,
      channelAccountId: channelAccountId.trim(),
      marketplaceAccount,
      selected: payload.snapshots.length,
      ready,
      blocked,
      written,
      sourceCounts: payload.counts ?? null,
      results,
    };
  };
}

export const runShopeeControlledAutoIntake = createShopeeControlledAutoIntake();

export const SHOPEE_CONTROLLED_AUTO_INTAKE_CONTRACT = Object.freeze({
  defaultMode: 'preview',
  commitRequiresExplicitMode: true,
  eligibleStatusesAreServerControlled: true,
  rawSelectionIsServerControlled: true,
  writes: Object.freeze(['orders', 'order_items', 'order_separation']),
  prohibitedWrites: Object.freeze([
    'inventory',
    'inventory_movements',
    'financial_entries',
    'financial_movements',
    'contacts',
    'contact_history',
    'service_conversations',
    'production_orders',
  ]),
});
