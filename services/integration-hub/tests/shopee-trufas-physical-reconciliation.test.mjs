import test from 'node:test';
import assert from 'node:assert/strict';
import {expectedTrufasComponents,validateTrufasPhysicalMappings} from '../src/shopee-trufas-physical-reconciliation.mjs';
import {SHOPEE_TRUFAS_ADAO_REFERENCE_20261029 as REF,SHOPEE_TRUFAS_ADAO_ACCOUNT_ID as ACCOUNT} from '../src/shopee-trufas-adao-reference-20261029.mjs';
test('60 canonical commercial configurations expand into correct physical variants',()=>{
 const rows=expectedTrufasComponents();
 assert.equal(rows.length,60);
 assert.equal(rows.filter(r=>r.family==='T30').length,30);
 assert.equal(rows.filter(r=>r.family==='T40').length,30);
 assert.equal(rows.reduce((n,r)=>n+r.components.length,0),120);
 for(const r of rows){
  assert.equal(r.components.reduce((s,c)=>s+c.physical_multiplier,0),r.qty);
  assert.ok(r.components.every(c=>c.product_id&&c.variant_id));
  for(const c of r.components)if(c.flavor==='AMD'){
   assert.equal(c.product_id,'141908ce-a550-47c6-b19a-095cd3ee18e7');
   assert.equal(c.variant_id,'efeadaea-134f-4e4b-af53-7bfa1a7136f4');
  }
 }
});
test('all sixty mappings match only when physical components match exactly',()=>{
 const rows=expectedTrufasComponents();
 const mappings=rows.map(r=>({marketplace:'shopee',channel_account_id:ACCOUNT,
  external_item_id:r.item_id,external_model_id:r.model_id,
  components:r.components.map(c=>({...c}))}));
 let out=validateTrufasPhysicalMappings(mappings,ACCOUNT);
 assert.equal(out.selected,60);assert.equal(out.physicalMatched,60);
 assert.equal(out.physicalMismatches,0);assert.equal(out.missing,0);
 assert.equal(out.writes,false);
 mappings[0].components[0].physical_multiplier+=1;
 out=validateTrufasPhysicalMappings(mappings,ACCOUNT);
 assert.equal(out.physicalMismatches,1);
 assert.equal(out.physicalMatched,59);
});
test('missing records are not misrepresented as physically validated',()=>{
 const out=validateTrufasPhysicalMappings([],ACCOUNT);
 assert.equal(out.missing,60);assert.equal(out.physicalMatched,0);
 assert.equal(out.rows.every(r=>r.physicalStatus==='not_checked'),true);
});
