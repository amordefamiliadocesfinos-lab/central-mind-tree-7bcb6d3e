import test from 'node:test';
import assert from 'node:assert/strict';
import {SEALED_FAMILY_CONTRACTS,planSealedPhysicalTransition,getSealedFamilyOperations} from '../src/sealed-four-families-p2-contract.mjs';

const snapshot=(family,balances)=>({
 source:'verified_sealed_ledger',productId:SEALED_FAMILY_CONTRACTS[family].productId,
 locationId:'factory',hasOpenPhysicalInventoryReconciled:true,balances,
});
const plan=(family,operation,count,balances,extra={})=>planSealedPhysicalTransition({
 family,operation,count,verifiedSnapshot:snapshot(family,balances),
 physicalEvidence:{confirmed:true,reference:'physical-event-evidence'},eventKey:'event:unique',locationId:'factory',...extra,
});
test('four canonical physical identities and exact opened quantities',()=>{
 assert.equal(Object.keys(SEALED_FAMILY_CONTRACTS).length,4);
 assert.equal(SEALED_FAMILY_CONTRACTS.italac.gramsPerUnit,395);
 assert.equal(SEALED_FAMILY_CONTRACTS.sorbato.gramsPerUnit,1000);
 assert.equal(SEALED_FAMILY_CONTRACTS.acido.gramsPerUnit,1000);
 assert.equal(SEALED_FAMILY_CONTRACTS.ivoti.gramsPerUnit,9800);
});
test('Italac original 27-unit box opens to intact units, never grams',()=>{
 const x=plan('italac','open_original_box',1,{originalBoxes27:2,intactUnits395:3,openGrams:125});
 assert.equal(x.allowed,true);
 assert.deepEqual(x.after,{originalBoxes27:1,intactUnits395:30,openGrams:125});
 assert.equal(x.operationalWrites,false);
 assert.equal(x.requiresSeparateAuthorizedTransactionalEntrypoint,true);
 const y=plan('italac','open_intact_unit',2,{originalBoxes27:1,intactUnits395:30,openGrams:125});
 assert.deepEqual(y.after,{originalBoxes27:1,intactUnits395:28,openGrams:915});
});
test('sealed 1kg bags and Ivoti 9.8kg buckets open only by confirmed physical event',()=>{
 for(const f of ['sorbato','acido']){
  const r=plan(f,'open_original_package',2,{originalPackages1kg:2,openGrams:0});
  assert.deepEqual(r.after,{originalPackages1kg:0,openGrams:2000});
 }
 const r=plan('ivoti','open_original_bucket',1,{originalBuckets98:1,openGrams:0});
 assert.deepEqual(r.after,{originalBuckets98:0,openGrams:9800});
});
test('dispatch requires the original physical identity and adequate stock',()=>{
 const a=plan('italac','dispatch_original_box',1,{originalBoxes27:0,intactUnits395:27,openGrams:0});
 assert.equal(a.allowed,false);
 assert.equal(a.reason,'sealed_insufficient_original_packages');
 const b=plan('italac','dispatch_intact_units',3,{originalBoxes27:0,intactUnits395:27,openGrams:0});
 assert.equal(b.allowed,true);
 assert.equal(b.after.intactUnits395,24);
});
test('no automatic retroactive conversion from recorded grams or channel stock',()=>{
 const x=planSealedPhysicalTransition({family:'italac',operation:'open_original_box',count:1,
 verifiedSnapshot:{source:'inventory',productId:SEALED_FAMILY_CONTRACTS.italac.productId,locationId:'factory',
 balances:{originalBoxes27:1,intactUnits395:0,openGrams:199975}},
 physicalEvidence:{confirmed:true,reference:'claim'},eventKey:'event:unique',locationId:'factory'});
 assert.equal(x.reason,'sealed_verified_snapshot_required');
 assert.equal(planSealedPhysicalTransition({family:'sorbato',operation:'open_original_package',count:1,
  verifiedSnapshot:snapshot('sorbato',{originalPackages1kg:1,openGrams:0}),
  physicalEvidence:{confirmed:false,reference:'none'},eventKey:'evt',locationId:'factory'}).allowed,false);
});
test('fail closed for all unverified, invalid or unsafe transitions',()=>{
 assert.equal(plan('italac','convert_loose_grams_to_box',1,{originalBoxes27:0,intactUnits395:0,openGrams:10665}).allowed,false);
 assert.equal(plan('ivoti','open_original_bucket',1,{originalBuckets98:0,openGrams:9800}).allowed,false);
 assert.equal(plan('sorbato','open_original_package',1.5,{originalPackages1kg:2,openGrams:0}).allowed,false);
 assert.equal(plan('sorbato','open_original_package',1,{originalPackages1kg:2,openGrams:0},{eventKey:''}).allowed,false);
 assert.equal(plan('sorbato','open_original_package',1,{originalPackages1kg:2,openGrams:0},{locationId:'other'}).allowed,false);
 assert.equal(plan('unknown','open_original_package',1,{originalPackages1kg:2,openGrams:0}).allowed,false);
 assert.deepEqual(getSealedFamilyOperations('italac'),['open_original_box','open_intact_unit','dispatch_original_box','dispatch_intact_units']);
});
