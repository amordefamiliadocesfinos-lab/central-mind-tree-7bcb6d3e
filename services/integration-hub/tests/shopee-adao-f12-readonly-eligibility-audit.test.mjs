import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {F12_3_SCOPE} from '../src/shopee-adao-resumable-discovery.mjs';

const sql=readFileSync(new URL('../sql/f12-3-adao-raw-canonical-eligibility-readonly.sql',import.meta.url),'utf8');
test('F12.3 raw/canonical audit is scoped to Adão and only read-only SELECT',()=>{
  assert.match(sql,new RegExp(F12_3_SCOPE.account,'g'));
  assert.match(sql,/marketplace_raw_snapshots/);
  assert.match(sql,/public\.orders/);
  assert.match(sql,/shopee_adao_f12_discovery_state/);
  assert.match(sql,/external_entity_type='order'/);
  assert.match(sql,/sale_origin='shopee_open_platform'/);
  assert.match(sql,/deleted_at IS NULL/);
  assert.match(sql,/DISTINCT ON \(external_entity_id\)/);
  assert.match(sql,/observed_at DESC/);
  const code=sql.replace(/--[^\n]*/g,'');
  assert.doesNotMatch(code,/\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE|GRANT|REVOKE|CALL|DO|EXECUTE)\b/i);
  assert.equal((code.match(/\bSELECT\b/g)||[]).length>=3,true);
});
