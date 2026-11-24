import test from 'node:test';
import assert from 'node:assert/strict';
import {assessCelivioC4FIntakeReadiness,CELIVIO_C4F_PILOT,CELIVIO_C4F_RAW_ID}
 from '../src/shopee-celivio-c4f-intake-readiness.mjs';

const ACCOUNT='d26c7a30-aa4a-4441-8012-600d70453689';
const mapping={
 channel_account_id:ACCOUNT,
 external_item_id:'23794618391',
 external_model_id:'229430912329',
 product_id:'c70dd4b4-bc59-4d88-81ef-1a8c47315560',
 variant_id:'1a3d59a6-4712-4afd-811a-5a72aad76fa9',
 physical_multiplier:400,
};
const raw=()=>({
 id:CELIVIO_C4F_RAW_ID,
 source:'shopee_open_platform',environment:'live',
 channel_account_id:ACCOUNT,
 endpoint:'/api/v2/order/get_order_detail',
 external_entity_type:'order',external_entity_id:CELIVIO_C4F_PILOT,
 payload:{response:{order_list:[{
  order_sn:CELIVIO_C4F_PILOT,order_status:'PROCESSED',
  create_time:1795206809,
  item_list:[{
   item_id:'23794618391',model_id:'229430912329',
   model_quantity_purchased:1,
   item_name:'Chocolate Cobertura Meio Amargo ou Branco Diehl | Variação 400g a 2kg | SH-004-027',
   model_name:'400 GR,COBERTURA MEIO AMARGO'
  }]
 }]}}
});
const input=()=>({raw:raw(),mappingMatches:[mapping],
 physicalConversionHomologated:true,duplicateChecked:true,existingOrder:null});

test('real Celivio C4-E Raw meets C4-C structural facts but C4-F holds money, current status and shipping',()=>{
 const r=assessCelivioC4FIntakeReadiness(input());
 assert.equal(r.advisoryStructuralCandidate,true);
 assert.equal(r.nextGateReady,false);
 assert.deepEqual(r.blockers,[
  'monetary_evidence_missing_or_unverified',
  'shipping_context_unverified',
  'current_external_status_not_rechecked',
 ]);
 for(const flag of ['writerAuthorized','operationalWrites','rawWrites','orderWrites',
  'itemWrites','separationAuthorized','inventoryActionAuthorized',
  'labelActionAuthorized','tokenRefreshAuthorized']) assert.equal(r[flag],false,flag);
});

test('no fabricated Shopee money: explicit confirmation flag cannot invent absent amounts',()=>{
 const r=assessCelivioC4FIntakeReadiness({...input(),
  monetaryEvidenceConfirmed:true,shippingContextConfirmed:true,
  latestExternalStatusConfirmed:true});
 assert.equal(r.nextGateReady,false);
 assert.ok(r.blockers.includes('monetary_evidence_missing_or_unverified'));
});

test('even hypothetical complete independently confirmed evidence is not writer authorization',()=>{
 const i=input();
 i.raw.payload.response.order_list[0].total_amount=22.84;
 i.raw.payload.response.order_list[0].item_list[0].model_discounted_price=22.84;
 const r=assessCelivioC4FIntakeReadiness({...i,
  monetaryEvidenceConfirmed:true,shippingContextConfirmed:true,
  latestExternalStatusConfirmed:true});
 assert.equal(r.nextGateReady,true);
 assert.equal(r.writerAuthorized,false);
 assert.equal(r.orderWrites,false);
 assert.equal(r.itemWrites,false);
 assert.equal(r.separationAuthorized,false);
});

test('raw identity or account mismatch, wrong model, paid-status regression and duplication block',()=>{
 const changed=[
  [x=>{x.raw.id='some-other-id'},'raw_identity_not_verified'],
  [x=>{x.raw.channel_account_id='b4027369-5abf-4ac1-ab24-862334fae892'},'celivio_identity_mismatch'],
  [x=>{x.raw.payload.response.order_list[0].item_list[0].model_id='0'},'official_mapping_not_resolved'],
  [x=>{x.raw.payload.response.order_list[0].order_status='UNPAID'},'external_status_not_intake_eligible'],
  [x=>{x.existingOrder={id:'existing'}},'already_imported'],
  [x=>{x.duplicateChecked=false},'duplicate_check_not_proven'],
  [x=>{x.mappingMatches=[mapping,mapping]},'ambiguous_official_mapping'],
  [x=>{x.raw.payload.response.order_list[0].order_sn='OTHERORDER123'},'real_raw_scope_or_shape_unverified'],
 ];
 for(const [fn,blocker] of changed){
  const i=input();fn(i);
  const r=assessCelivioC4FIntakeReadiness(i);
  assert.ok(r.blockers.includes(blocker),blocker);
  assert.equal(r.nextGateReady,false,blocker);
  assert.equal(r.writerAuthorized,false,blocker);
 }
});

test('PII, secrets and caller-provided order ids never appear in decision',()=>{
 const i=input();i.raw.payload.response.order_list[0].recipient_address={name:'PRIVATE TEST'};
 i.accessToken='SECRET';i.orderSn='FORGED123';
 const r=assessCelivioC4FIntakeReadiness(i);
 const serialized=JSON.stringify(r);
 assert.equal(serialized.includes('PRIVATE TEST'),false);
 assert.equal(serialized.includes('SECRET'),false);
 assert.equal(serialized.includes('FORGED123'),false);
 assert.equal(r.orderSn,CELIVIO_C4F_PILOT);
});
