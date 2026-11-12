import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

// Prevent accidental weakening of the already frozen F12.3 migration when
// editing it. These are source-level contract tests; they DO NOT replace
// a live PostgreSQL permission / concurrency test after deployment.
const migrationUrl = new URL(
  '../../../supabase/migrations/20261112180000_shopee_adao_f12_resumable_checkpoint.sql',
  import.meta.url);
// Docker runtime intentionally contains only services/integration-hub; do not
// make its independent container smoke test depend on the Supabase SQL tree.
// The contract tests run when checked out in the full GitHub workspace.
const contractTest = existsSync(migrationUrl) ? test : test.skip;
const migration = existsSync(migrationUrl) ? readFileSync(migrationUrl,'utf8') : '';
const rpcFunctions = [
  'acquire_shopee_adao_f12_discovery',
  'stage_shopee_adao_f12_discovery',
  'ack_shopee_adao_f12_discovery',
];

contractTest('F12.3 DB stage is account scoped, RLS enabled and table direct writes denied', () => {
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON public\.shopee_adao_f12_discovery_state FROM service_role/);
  assert.match(migration, /CHECK \(channel_account_id = 'b4027369-5abf-4ac1-ab24-862334fae892'::uuid\)/);
  assert.match(migration, /CHECK \(shop_id = 1156446003\)/);
  assert.match(migration, /phase='staged'.*?staged_requires_ack/);
});

contractTest('F12.3 DB role authorization requires service JWT, not definer current_user', () => {
  assert.equal((migration.match(/coalesce\(auth\.jwt\(\)->>'role', ''\) IS DISTINCT FROM 'service_role'/g)||[]).length,3);
  assert.doesNotMatch(migration,/current_user\s*=/);
  assert.doesNotMatch(migration,/current_setting\('request\.jwt\.claim\.role'/);
  for (const rpc of rpcFunctions) {
    assert.match(migration,new RegExp('REVOKE ALL ON FUNCTION public\\.'+rpc));
    assert.match(migration,new RegExp('GRANT EXECUTE ON FUNCTION public\\.'+rpc));
  }
});

contractTest('F12.3 DB stage fences by lease+generation and rejects duplicate IDs', () => {
  assert.match(migration,/FOR UPDATE/g);
  assert.match(migration,/v\.lease_id IS DISTINCT FROM p_lease_id/);
  assert.match(migration,/v\.generation IS DISTINCT FROM p_generation/);
  assert.match(migration,/distinct_count IS DISTINCT FROM total_count/);
  assert.match(migration,/checkpoint_not_monotonic/);
  assert.match(migration,/stale_or_staged_requires_reconciliation/);
});

contractTest('F12.3 migration does not invoke any order, shipping, label or stock writers', () => {
  assert.doesNotMatch(migration,/CALL\s+public\.|PERFORM\s+(?:public\.)?(?:ship|create_shopee_api_order|import_shopee_order)/i);
  assert.doesNotMatch(migration,/UPDATE\s+public\.(?:orders|order_items|stock_movements)/i);
});
