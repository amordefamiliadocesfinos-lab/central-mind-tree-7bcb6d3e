import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

// The production Hub image intentionally excludes migration sources. Run the
// source-bound verification on the checked-out repository; omit it in Docker.
const migrationUrl = new URL('../../../supabase/migrations/20261111180000_f11_adao_rejected_shipping_recovery.sql', import.meta.url);
const sql = existsSync(migrationUrl) ? readFileSync(migrationUrl, 'utf8') : null;

test('original attempts and rejection evidence remain immutable with a second sequence', { skip: !sql }, () => {
  assert.match(sql, /ADD COLUMN attempt_sequence smallint NOT NULL DEFAULT 1/);
  assert.match(sql, /CHECK \(attempt_sequence BETWEEN 1 AND 2\)/);
  assert.match(sql, /UNIQUE\(channel_account_id,order_sn,package_number,operation,attempt_sequence\)/);
  assert.match(sql, /ORDER BY attempt_sequence DESC/);
  assert.match(sql, /v_existing\.state='uncertain'/);
  assert.match(sql, /v_existing\.request_hash <> p_request_hash/);
  assert.match(sql, /VALUES \(p_channel_account_id,v_order_ids\[1\],p_shop_id,p_order_sn,p_package_number,p_request_hash,2\)/);
});

test('recovery authorizations start disabled and are restricted to two real rejected Adão attempts', { skip: !sql }, () => {
  assert.match(sql, /enabled boolean NOT NULL DEFAULT false/);
  assert.match(sql, /NOT ar\.consumed/);
  assert.match(sql, /SET consumed=true, consumed_at=now\(\)/);
  assert.match(sql, /56bda5e6-e72b-49b7-902d-2ffc0997a17a/);
  assert.match(sql, /5a62107c-c500-4406-abe5-19c4c88baa25/);
  assert.match(sql, /logistics\.ship_order_not_need_pacakge_number/);
  assert.doesNotMatch(sql, /UPDATE public\.shopee_shipping_arrangement_attempts SET/);
  assert.doesNotMatch(sql, /enabled\s*=\s*true/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.claim_shopee_shipping_arrangement/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.claim_shopee_shipping_arrangement.*TO service_role/);
});
