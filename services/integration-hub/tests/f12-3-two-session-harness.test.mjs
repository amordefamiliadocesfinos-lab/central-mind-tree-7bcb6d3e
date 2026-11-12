import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const uri=new URL('../../../scripts/f12-3-postgres-two-session-rollback.sh',import.meta.url);
const contractTest=existsSync(uri)?test:test.skip;
const script=existsSync(uri)?readFileSync(uri,'utf8'):'';

contractTest('F12.3 two-session test only uses rollback and expects actual lock timeout',()=>{
  assert.match(script,/--two-session-rollback/);
  assert.match(script,/psql[^\n]*F12_PG_CONNECTION_URI/);
  assert.match(script,/SET LOCAL request\.jwt\.claims/);
  assert.match(script,/SET LOCAL lock_timeout/);
  assert.match(script,/55P03/);
  assert.match(script,/PRIMARY_ACQUIRED/);
  assert.match(script,/remaining_checkpoints/);
  assert.equal((script.match(/^ROLLBACK;$/gm)||[]).length,2);
  assert.doesNotMatch(script,/^COMMIT;/m);
  assert.doesNotMatch(script,/ship_order|shipping_arrangement|stock_movements|create_shopee_api_order/);
});
