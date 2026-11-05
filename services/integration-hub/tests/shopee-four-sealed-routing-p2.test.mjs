import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectFourSealedPhysicalRouting as inspect,P2_FOUR_SEALED_PRESENTATIONS as rows} from '../src/shopee-four-sealed-routing-p2.mjs';

test('all five physical commercial presentations route by official ID, never by title or grams',()=>{
 assert.equal(rows.length,5);
 for(const row of rows){
  const result=inspect({kind:'sale',productId:row.productId,presentationId:row.commercialId,
   commercialQuantity:2,operationalQuantity:2*row.factor});
  assert.equal(result.recognized,true,row.presentation);
  assert.equal(result.blocked,false,row.presentation);
  assert.equal(result.stockState,row.stockState);
  assert.equal(result.gramsEquivalent,2*row.factor);
  assert.equal(result.requiresVerifiedPhysicalLedger,true);
  assert.equal(result.operationalWrites,false);
 }
});
test('purchase originals are not automatically credited as loose grams',()=>{
 for(const row of rows.filter(x=>x.purchaseId)){
  const r=inspect({kind:'purchase',productId:row.productId,presentationId:row.purchaseId,
   commercialQuantity:1,operationalQuantity:row.factor});
  assert.equal(r.blocked,false,row.presentation);
  assert.equal(r.operationalWrites,false);
 }
 const ml1=rows.find(x=>x.presentation==='ML1_intact_unit');
 assert.equal(inspect({kind:'purchase',productId:ml1.productId,
  presentationId:ml1.commercialId,commercialQuantity:1,operationalQuantity:395}).blocked,true);
});
test('ML2 and ML1 identities require distinct future physical source states',()=>{
 const ml1=rows[1],ml2=rows[0];
 assert.equal(inspect({kind:'sale',productId:ml2.productId,presentationId:ml1.commercialId,
   commercialQuantity:27,operationalQuantity:10665}).stockState,'intactUnits395');
 assert.equal(inspect({kind:'sale',productId:ml2.productId,presentationId:ml2.commercialId,
   commercialQuantity:1,operationalQuantity:10665}).stockState,'originalBoxes27');
 // The two physically distinct states must never share a source.
 assert.notEqual(ml1.stockState,ml2.stockState);
});
test('acid commercial kg is exact original package identity, not a loose-gram fallback',()=>{
 const acid=rows.find(x=>x.family==='acido');
 assert.equal(inspect({kind:'sale',productId:acid.productId,presentationId:acid.commercialId,
   commercialQuantity:1,operationalQuantity:1000}).stockState,'originalPackages1kg');
 for(const bad of [null,'kg',undefined,'wrong-present']){
  assert.equal(inspect({kind:'sale',productId:acid.productId,presentationId:bad,
   commercialQuantity:1,operationalQuantity:1000}).blocked,true);
 }
});
test('fail closed for cross-product ID, unknown presentation, missing variant or invalid quantity',()=>{
 for(const row of rows){
  const other=rows.find(x=>x.productId!==row.productId);
  const base={kind:'sale',productId:row.productId,presentationId:row.commercialId,
   commercialQuantity:1,operationalQuantity:row.factor};
  assert.equal(inspect({...base,presentationId:other.commercialId}).blocked,true);
  assert.equal(inspect({...base,presentationId:null}).blocked,true);
  assert.equal(inspect({...base,variantId:'some-variant'}).blocked,true);
  for(const n of [0,-1,1.2,NaN,Infinity,'1']){
   assert.equal(inspect({...base,commercialQuantity:n}).blocked,true);
  }
  assert.equal(inspect({...base,operationalQuantity:row.factor+1}).blocked,true);
 }
 assert.equal(inspect({kind:'sale',productId:'unrelated',presentationId:'other'}).blocked,false);
 assert.equal(inspect({kind:'unknown',productId:rows[0].productId}).blocked,true);
});
