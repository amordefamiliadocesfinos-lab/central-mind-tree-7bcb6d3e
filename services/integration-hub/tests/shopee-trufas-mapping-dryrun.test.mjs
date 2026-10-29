import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTrufasMappingDryRun} from '../src/shopee-trufas-mapping-dryrun.mjs';
test('preflight describes all 60 rows and never writes',()=>{
 const p=buildTrufasMappingDryRun([]);
 assert.equal(p.selected,60); assert.equal(p.componentRows,120);
 assert.equal(p.writes,false);assert.match(p.sql,/BEGIN READ ONLY/);
 assert.match(p.sql,/ROLLBACK/);
 assert.doesNotMatch(p.sql,/\b(INSERT|UPDATE|DELETE|COMMIT|TRUNCATE)\b/i);
 assert.match(p.sql,/item:20999760944\|model:238786420976/);
});
test('cannot claim readiness when any official mapping exists',()=>{
 const first={marketplace:'shopee',channel_account_id:'b4027369-5abf-4ac1-ab24-862334fae892',
  external_item_id:'19799761406',external_model_id:'219175660379'};
 assert.throws(()=>buildTrufasMappingDryRun([first]),/re-audit required/);
});
