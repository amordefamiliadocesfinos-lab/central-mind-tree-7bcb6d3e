import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTrufasTransactionalInsertScript} from '../src/shopee-trufas-transactional-insert.mjs';
test('approval and deploy verification are mandatory',()=>{
 assert.throws(()=>buildTrufasTransactionalInsertScript([]),/approval required/);
 assert.throws(()=>buildTrufasTransactionalInsertScript([],{historicalProtectionDeployed:true}),/approval required/);
});
test('SQL is atomic and validates exact 60/120 cardinality',()=>{
 const sql=buildTrufasTransactionalInsertScript([],{historicalProtectionDeployed:true,approved:true});
 assert.ok(sql.startsWith('BEGIN;'));
 assert.ok(sql.trimEnd().endsWith('COMMIT;'));
 assert.match(sql,/IF n<>60/);
 assert.match(sql,/IF m<>60 OR parts<>120/);
 assert.match(sql,/v.is_active IS DISTINCT FROM TRUE/);
 assert.match(sql,/ON COMMIT DROP/);
 assert.doesNotMatch(sql,/undefined/);
 assert.match(sql,/official:item:19799761406\\|model:219175660379/);
 assert.match(sql,/parent_product,parent_variant/);
 assert.match(sql,/parent_multiplier,parent_product,parent_variant/);
 assert.match(sql,/Invalid parent physical identities/);
});
test('existing canonical identity blocks execution plan',()=>{
 const row={marketplace:'shopee',channel_account_id:'b4027369-5abf-4ac1-ab24-862334fae892',
 external_item_id:'19799761406',external_model_id:'219175660379'};
 assert.throws(()=>buildTrufasTransactionalInsertScript([row],{historicalProtectionDeployed:true,approved:true}),/reconciliation changed/);
});
