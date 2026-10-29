import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareAdãoTrufasMappingPlan } from '../src/shopee-trufas-adao-mapping-plan.mjs';
test('60 official rows prepared with exact physical identities, without writes',()=>{
 const result=prepareAdãoTrufasMappingPlan([]);
 assert.equal(result.selected,60);
 assert.equal(result.missing,60);
 assert.equal(result.writes,false);
 assert.equal(result.authorizedForWrite,false);
 assert.equal(result.plan.filter(p=>p.historical_quarantine_required).length,6);
 assert.equal(result.plan.reduce((s,p)=>s+p.components.length,0),120);
 assert.equal(result.plan.filter(p=>p.seller_sku_observed===null).length,1);
 assert.ok(result.blockers.includes('temporal_guard_runtime_not_verified'));
 for(const entry of result.plan){
  assert.equal(entry.components.reduce((s,c)=>s+c.physical_multiplier,0),entry.commercial_quantity_per_unit);
 }
});
test('existing identity is manual review; still no writes with deployed flag',()=>{
 const first=prepareAdãoTrufasMappingPlan([]).plan[0];
 const mapping={marketplace:'shopee',channel_account_id:first.account_id,
  external_item_id:first.item_id,external_model_id:first.model_id};
 const r=prepareAdãoTrufasMappingPlan([mapping],{historicalProtectionDeployed:true});
 assert.equal(r.missing,59);
 assert.equal(r.plan[0].action,'manual_review');
 assert.ok(r.blockers.includes('existing_mapping_physics_not_verified'));
 assert.equal(r.authorizedForWrite,false);
});
