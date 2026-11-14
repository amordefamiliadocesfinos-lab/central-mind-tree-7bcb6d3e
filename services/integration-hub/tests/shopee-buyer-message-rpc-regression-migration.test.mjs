import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const url=new URL('../../../supabase/migrations/20261114093000_restore_shopee_buyer_message_current_rpc.sql',import.meta.url);

test('F6 buyer note patch preserves current commercial RPC and only updates scoped metadata',t=>{
  if(!existsSync(url)){t.skip('GitHub SQL migrations are intentionally absent from Hub Docker runtime');return;}
  const sql=readFileSync(url,'utf8');
  assert.match(sql,/pg_get_functiondef\(p\.oid\)/);
  assert.match(sql,/v_patched := replace\(v_current, v_needle, v_replacement\)/);
  assert.match(sql,/buyer_message_patch_rpc_drift_refused/);
  assert.match(sql,/shopee_commercial_presentation_quantity_mismatch/);
  assert.match(sql,/v_existing_deleted_at/);
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,/message_to_seller/);
  assert.match(sql,/\{buyer_message\}/);
  assert.match(sql,/ac47714e-564f-4990-bc61-b3dfd86d5cf0/);
  assert.match(sql,/b4027369-5abf-4ac1-ab24-862334fae892/);
  assert.match(sql,/2611148HXRRP6A/);
  assert.match(sql,/o\.deleted_at IS NULL/);
  assert.match(sql,/o\.sale_origin='shopee_open_platform'/);
  // Never conflate buyer instructions with editable internal notes.
  assert.doesNotMatch(sql,/SET\s+(?:orders\.)?(?:notes|production_notes)\s*=/i);
  assert.doesNotMatch(sql,/\b(?:stock_movements|financial_entries|shipping_arrangement_attempts)\b/i);
});
