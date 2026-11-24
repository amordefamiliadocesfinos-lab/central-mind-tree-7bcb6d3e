import test from 'node:test';
import assert from 'node:assert/strict';
import {assessCelivioC4CPreflight, CELIVIO_C4C_ACCOUNT_ID, CELIVIO_C4C_SHOP_ID}
  from '../src/shopee-celivio-c4c-preflight.mjs';
import {mappingPhysicalBlocker} from '../src/shopee-mapping-physical-guard.mjs';

// Real, redacted C4-E evidence inspected in Core on 2026-11-24.
// This is a stable TEST FIXTURE, not a live Core query and not an authorization
// to create orders, generate labels, update stock, or replay the Shopee read.
// Raw id: 90ebdbb3-1bc5-4043-9d45-d78b77c0ea1a
// Mapping id: 2dafa27a-4c5b-4c99-b98d-f341d7203b70
const order = Object.freeze({
  order_sn:'261121TBS6BHE6',order_status:'PROCESSED',create_time:1795206809,
  item_list:[{item_id:'23794618391',model_id:'229430912329',
    model_quantity_purchased:1,
    item_name:'Chocolate Cobertura Meio Amargo ou Branco Diehl | Variação 400g a 2kg | SH-004-027',
    model_name:'400 GR,COBERTURA MEIO AMARGO'}],
});
const mapping = Object.freeze({
  channel_account_id:CELIVIO_C4C_ACCOUNT_ID,
  external_item_id:'23794618391',external_model_id:'229430912329',
  product_id:'c70dd4b4-bc59-4d88-81ef-1a8c47315560',
  variant_id:'1a3d59a6-4712-4afd-811a-5a72aad76fa9',
  physical_multiplier:400,
  physical_identity:{active:true,unit:'g',presentation_factors:[400,1000,1]},
});
const item = order.item_list[0];
const realEvidence = {
  channelAccountId:CELIVIO_C4C_ACCOUNT_ID, shopId:CELIVIO_C4C_SHOP_ID,
  orderSn:order.order_sn,externalStatus:order.order_status,
  itemId:item.item_id,modelId:item.model_id,
  quantity:item.model_quantity_purchased,
  mappingMatches:[mapping],
  rawOrderDetailPersisted:true,
  physicalConversionHomologated:true,
  existingOrder:null,duplicateChecked:true,
};

test('C4-C real 400g Celivio Raw candidate passes consultative gate; writers remain blocked',()=>{
  assert.equal(mappingPhysicalBlocker({
    itemId:item.item_id,modelId:item.model_id,
    itemName:item.item_name,modelName:item.model_name,
    quantity:item.model_quantity_purchased
  },mapping,{channelAccountId:CELIVIO_C4C_ACCOUNT_ID}),null);
  assert.equal(item.model_quantity_purchased * mapping.physical_multiplier,400);
  const result=assessCelivioC4CPreflight(realEvidence);
  assert.equal(result.candidateForNextGate,true);
  assert.deepEqual(result.blockers,[]);
  for(const flag of ['writerAuthorized','operationalWrites','rawWrites',
    'separationAuthorized','inventoryActionAuthorized']){
    assert.equal(result[flag],false,flag);
  }
});

test('C4-C blocks status regression, missing Raw, missing duplicate check, duplicate order',()=>{
  const changes=[
    [{externalStatus:'UNPAID'},'external_status_not_intake_eligible'],
    [{rawOrderDetailPersisted:false},'raw_order_detail_not_persisted'],
    [{duplicateChecked:false},'duplicate_check_not_proven'],
    [{existingOrder:{id:'present'}},'already_imported'],
    [{modelId:'239430912885'},'official_mapping_not_resolved'],
    [{mappingMatches:[mapping,mapping]},'ambiguous_official_mapping'],
    [{channelAccountId:'b4027369-5abf-4ac1-ab24-862334fae892'},'celivio_identity_mismatch'],
  ];
  for(const [change,blocker] of changes){
    const result=assessCelivioC4CPreflight({...realEvidence,...change});
    assert.equal(result.candidateForNextGate,false,blocker);
    assert.ok(result.blockers.includes(blocker),blocker);
    assert.equal(result.writerAuthorized,false);
  }
});

test('C4-C blocks physical mismatch for Celivio 400g model',()=>{
  const i={itemId:item.item_id,modelId:item.model_id,
    itemName:item.item_name,modelName:item.model_name,quantity:1};
  const scope={channelAccountId:CELIVIO_C4C_ACCOUNT_ID};
  assert.equal(mappingPhysicalBlocker(i,{...mapping,physical_multiplier:5000},scope),'physical_multiplier_mismatch');
  assert.equal(mappingPhysicalBlocker(i,{...mapping,physical_identity:{active:true,unit:'g',presentation_factors:[1000]}},scope),'physical_presentation_unverified');
});
