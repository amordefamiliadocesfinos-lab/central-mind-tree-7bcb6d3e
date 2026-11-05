// Source-contract regression only: no Cloud Run runtime/digest claims.
// Operacoes 9 - P2 original sealed containers. No network and no database writes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('UI separation uses canonical role-checked finalization', () => {
  const separation = read('src/hooks/useOrderSeparation.ts');
  const stock = read('src/lib/orderStock.ts');
  assert.match(separation, /finalizeOrderSeparation\(orderId\)/);
  assert.match(stock, /rpc\('finalize_order_separation'/);
  assert.doesNotMatch(separation, /rpc\('finalize_order_separation_unguarded_01b'/);
});

test('purchases and manual Shopee imports call canonical wrappers', () => {
  assert.match(read('src/hooks/usePurchases.ts'), /rpc\('confirm_purchase_receipt'/);
  assert.match(read('src/components/operations/ShopeeOrdersImportDialog.tsx'), /'import_shopee_order_with_stock'/);
});

test('Cloud Run Core Bridge and order writer do not directly invoke physical stock RPCs', () => {
  const bridge = read('supabase/functions/integration-core-bridge/index.ts');
  const hub = read('services/integration-hub/src/shopee-order-writer.mjs');
  for (const source of [bridge, hub]) {
    assert.doesNotMatch(source, /apply_order_stock_event|finalize_order_separation_unguarded_01b|p2_four_apply_internal/);
  }
  assert.match(bridge, /'create_shopee_api_order'/);
  assert.match(hub, /createLiveShopeeOrder/);
});

test('Hub shipment and commit routes retain explicit enabling gates', () => {
  const app = read('services/integration-hub/src/app.mjs');
  assert.match(app, /SHOPEE_LIVE_SHIP_ORDER_ROUTE_ENABLED/);
  assert.match(app, /SHOPEE_LIVE_SHIP_ORDER_ENABLED/);
  assert.match(app, /SHOPEE_LIVE_COMMIT_ENABLED/);
});

test('P2 never treats the source-only contract as active physical inventory writer', () => {
  const planner = read('services/integration-hub/src/sealed-four-families-p2-contract.mjs');
  assert.doesNotMatch(planner, /\.rpc\(['"]p2_four_apply_internal/);
});
