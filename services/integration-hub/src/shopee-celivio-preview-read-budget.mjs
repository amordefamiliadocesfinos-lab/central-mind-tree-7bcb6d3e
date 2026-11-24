// Celivio-only reuse of Adão's proven 12s Core batch read budget.
// No new endpoint, scheduler, Shopee call or operational write authority.
import { readLiveShopeeOrderIntakeBatch } from './core-bridge.mjs';
import { createShopeeControlledAutoIntake } from './shopee-order-auto-intake.mjs';
import { CELIVIO_C4C_ACCOUNT_ID } from './shopee-celivio-c4c-preflight.mjs';

export const CELIVIO_PREVIEW_BATCH_READ_TIMEOUT_MS = 12_000;

export function createCelivioPreviewBatchReader(readBatch = readLiveShopeeOrderIntakeBatch) {
  return data => {
    if (data?.channel_account_id !== CELIVIO_C4C_ACCOUNT_ID)
      return { ok:false, status:409, payload:null };
    return readBatch(data, { timeoutMs:CELIVIO_PREVIEW_BATCH_READ_TIMEOUT_MS });
  };
}

export function createCelivioPreview({
  readBatch = readLiveShopeeOrderIntakeBatch,
} = {}) {
  // The injected writer must never be invoked, even if the generic pipeline
  // changes its preview semantics. This adapter never exposes a commit mode.
  const intake=createShopeeControlledAutoIntake({
    readBatch:createCelivioPreviewBatchReader(readBatch),
    persistOrder:async () => { throw new Error('celivio_preview_writer_forbidden'); },
  });
  return ({channelAccountId,limit=5,mode='preview'}={}) => {
    if (channelAccountId!==CELIVIO_C4C_ACCOUNT_ID || mode!=='preview')
      return {ok:false,code:'celivio_preview_scope_invalid',selected:0,ready:0,blocked:0,written:0,results:[]};
    return intake({channelAccountId,limit,mode:'preview'});
  };
}

export const runCelivioPreview=createCelivioPreview();
