import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const bridge = readFileSync(new URL('../../../supabase/functions/integration-core-bridge/index.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../../../supabase/migrations/20261026143000_block_deleted_shopee_order_reimport.sql', import.meta.url), 'utf8');

test('intake lookup considers previously deleted Shopee orders', () => {
  const start = bridge.indexOf("const { data: existing, error: existingError }");
  const end = bridge.indexOf("if (existingError)", start);
  assert.ok(start > 0 && end > start);
  const query = bridge.slice(start, end);
  assert.match(query, /\.eq\('channel_account_id', channelAccountId\)/);
  assert.match(query, /\.in\('order_number', orderNumbers\)/);
  assert.doesNotMatch(query, /\.is\('deleted_at', null\)/);
});

test('writer rejects a soft-deleted record before creating a new order', () => {
  assert.match(migration, /SELECT id, deleted_at INTO v_existing_id, v_existing_deleted_at/);
  assert.match(migration, /v_existing_id IS NOT NULL AND v_existing_deleted_at IS NOT NULL/);
  assert.match(migration, /RAISE EXCEPTION 'F6-Q\.6D\.1:/);
  assert.ok(migration.indexOf("RAISE EXCEPTION 'F6-Q.6D.1:") < migration.indexOf('INSERT INTO public.orders'));
  assert.match(migration, /already_registered', true/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.create_shopee_api_order/);
});
