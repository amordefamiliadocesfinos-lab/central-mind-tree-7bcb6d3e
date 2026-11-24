import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeShopeeOrderRawSnapshot, buildShopeeOrderSafePreview }
  from '../src/shopee-order-normalizer.mjs';
import { buildShopeeMappingPreview } from '../src/shopee-mapping-preview.mjs';
import { buildShopeeOrderProjectionPreview } from '../src/shopee-order-projection-preview.mjs';
import { applyShopeeInternalOrderContract } from '../src/shopee-internal-order-contract.mjs';
import { assessCelivioC4CPreflight, CELIVIO_C4C_ACCOUNT_ID, CELIVIO_C4C_SHOP_ID }
  from '../src/shopee-celivio-c4c-preflight.mjs';

// Fixture reconstructed *exactly from the redacted business fields* persisted
// in Core, not a live DB read or a newly captured Shopee order.
// Verified Core on 2026-11-24:
// Raw id 90ebdbb3-1bc5-4043-9d45-d78b77c0ea1a
// Raw payload SHA256 ea3f6bbba94fe5af2eb868ff3618a6da55f33560ee095bcdea530c5e7aef5076
// Mapping id 2dafa27a-4c5b-4c99-b98d-f341d7203b70
// Core query found 0 existing internal orders for this account/order SN.
// This fixture deliberately has NO total_amount, item unit price, payment,
// buyer information, or shipping details: these were NOT persisted in C4-E.
const ACCOUNT = CELIVIO_C4C_ACCOUNT_ID;
const ORDER = '261121TBS6BHE6';
const ITEM_ID = '23794618391';
const MODEL_ID = '229430912329';
const PRODUCT_ID = 'c70dd4b4-bc59-4d88-81ef-1a8c47315560';
const VARIANT_ID = '1a3d59a6-4712-4afd-811a-5a72aad76fa9';
const snapshot = () => ({
  source:'shopee_open_platform',environment:'live',
  external_entity_type:'order',endpoint:'/api/v2/order/get_order_detail',
  channel_account_id:ACCOUNT,external_entity_id:ORDER,
  observed_at:'2026-11-24T15:22:54.873Z',
  payload:{response:{order_list:[{
    create_time:1795206809,order_sn:ORDER,order_status:'PROCESSED',
    item_list:[{
      item_id:ITEM_ID,model_id:MODEL_ID,
      item_name:'Chocolate Cobertura Meio Amargo ou Branco Diehl | Variação 400g a 2kg | SH-004-027',
      model_name:'400 GR,COBERTURA MEIO AMARGO',
      model_quantity_purchased:1,
    }]
  }]}}
});
const mapping = () => ({
  id:'2dafa27a-4c5b-4c99-b98d-f341d7203b70',
  channel_account_id:ACCOUNT,marketplace:'shopee',
  marketplace_account:'SHOPEE CELIVIO',
  external_item_id:ITEM_ID,external_model_id:MODEL_ID,
  external_item_key:'official:item:23794618391|model:229430912329',
  product_id:PRODUCT_ID,variant_id:VARIANT_ID,physical_multiplier:400,
  physical_identity:{active:true,unit:'g',presentation_factors:[400,1000,1]},
});

function runConsultative(raw=snapshot(),mappings=[mapping()],existingExternalOrderIds=new Set()) {
  const normalized=normalizeShopeeOrderRawSnapshot(raw);
  const resolved=buildShopeeMappingPreview(normalized,mappings,{
    channelAccountId:ACCOUNT,marketplaceAccount:'SHOPEE CELIVIO',
    requirePhysicalValidation:true,
  });
  const projection=buildShopeeOrderProjectionPreview(normalized,resolved,{
    marketplaceAccount:'SHOPEE CELIVIO',existingExternalOrderIds,
  });
  return {normalized,resolved,projection};
}

test('C4-D real Raw fixture: normalizer -> exact Item/Model -> 400g projection',()=>{
  const {normalized,resolved,projection}=runConsultative();
  assert.equal(normalized.orderCount,1);
  assert.equal(normalized.orders[0].orderSn,ORDER);
  assert.equal(normalized.orders[0].externalStatus,'PROCESSED');
  assert.equal(normalized.orders[0].items[0].itemId,ITEM_ID);
  assert.equal(normalized.orders[0].items[0].modelId,MODEL_ID);
  assert.equal(normalized.orders[0].items[0].quantity,1);
  assert.equal(resolved.orders[0].items[0].mappingStatus,'recognized');
  assert.equal(resolved.orders[0].items[0].mappingId,mapping().id);
  assert.equal(resolved.orders[0].items[0].components[0].physicalQuantity,400);
  assert.equal(projection.orders[0].projectionStatus,'ready');
  assert.equal(projection.orders[0].candidate.items[0].quantity,400);
  assert.equal(projection.orders[0].candidate.items[0].commercialQuantity,1);
  assert.equal(projection.orders[0].candidate.items[0].physicalMultiplier,400);
  assert.equal(projection.operationalWrites,false);
  assert.equal(projection.writeReady,false);
});

test('C4-D redacted Raw preserves unknown money/shipping as unknown, not invented',()=>{
  const {normalized,projection}=runConsultative();
  const order=normalized.orders[0];
  assert.equal(order.totalAmount,null);
  assert.equal(order.paymentMethod,null);
  assert.equal(order.shippingCarrier,null);
  assert.equal(order.items[0].discountedUnitPrice,null);
  assert.equal(order.items[0].originalUnitPrice,null);
  assert.equal(order.hasRecipientAddress,false);
  assert.equal(order.packageCount,0);
  const safe=buildShopeeOrderSafePreview(normalized);
  assert.equal(safe.orders[0].totalAmount,null);
  assert.equal(projection.orders[0].candidate.totalValue,null);
  assert.equal(projection.orders[0].candidate.paymentMethod,null);
  assert.equal(projection.orders[0].candidate.items[0].unitPrice,null);
});

test('C4-D contract remains inert despite clean mapping, no financial/logistics facts',()=>{
  const {normalized,projection}=runConsultative();
  const order=normalized.orders[0];
  const gate=assessCelivioC4CPreflight({
    channelAccountId:ACCOUNT,shopId:CELIVIO_C4C_SHOP_ID,
    orderSn:order.orderSn,externalStatus:order.externalStatus,
    itemId:order.items[0].itemId,modelId:order.items[0].modelId,
    quantity:order.items[0].quantity,mappingMatches:[mapping()],
    rawOrderDetailPersisted:true,physicalConversionHomologated:true,
    duplicateChecked:true,existingOrder:null,
  });
  assert.equal(gate.candidateForNextGate,true);
  assert.deepEqual(gate.blockers,[]);
  assert.equal(gate.writerAuthorized,false);
  const contract=applyShopeeInternalOrderContract(projection.orders[0],{
    channelAccountId:ACCOUNT,marketplaceAccount:'SHOPEE CELIVIO'
  });
  assert.equal(contract.idempotency.key,`${ACCOUNT}:${ORDER}`);
  assert.equal(contract.order.marketplaceMetadata.externalStatus,'PROCESSED');
  assert.equal(contract.order.totalValue,null);
  assert.equal(contract.order.paymentMethod,null);
  assert.equal(contract.items[0].unitPrice,null);
  assert.equal(contract.items[0].quantity,400);
  assert.equal(contract.items[0].commercialQuantity,1);
  assert.equal(contract.order.customerName,null);
  assert.equal(contract.order.logisticsMode,null);
  assert.equal(contract.effects.stockAction,null);
  assert.equal(contract.effects.financialAction,null);
  assert.equal(contract.effects.crmAction,null);
  assert.equal(contract.operationalWrites,false);
  assert.equal(contract.writerAuthorized,false);
  assert.equal(gate.operationalWrites,false);
  assert.equal(gate.separationAuthorized,false);
  assert.equal(gate.inventoryActionAuthorized,false);
  // Contract's symbolic separationAction is not proof of an executed separation.
  assert.equal(contract.effects.separationAction,'create_todo_record_with_order');
});

test('C4-D blocks wrong Model, wrong gram factor, cross-account, ambiguous mapping and existing order',()=>{
  const wrongModel=runConsultative(snapshot(),[{...mapping(),external_model_id:'239430912885'}]);
  assert.equal(wrongModel.resolved.orders[0].items[0].mappingStatus,'needs_mapping');
  assert.equal(wrongModel.projection.orders[0].projectionStatus,'blocked');
  const badMass=runConsultative(snapshot(),[{...mapping(),physical_multiplier:5000}]);
  assert.equal(badMass.resolved.orders[0].items[0].mappingStatus,'celivio_400g_physical_unverified');
  assert.equal(badMass.projection.orders[0].projectionStatus,'blocked');
  const wrongAccount=runConsultative(snapshot(),[{...mapping(),channel_account_id:'b4027369-5abf-4ac1-ab24-862334fae892'}]);
  assert.equal(wrongAccount.resolved.orders[0].items[0].mappingStatus,'needs_mapping');
  const ambiguous=runConsultative(snapshot(),[mapping(),mapping()]);
  assert.equal(ambiguous.resolved.orders[0].items[0].mappingStatus,'ambiguous');
  const dup=runConsultative(snapshot(),[mapping()],new Set([ORDER]));
  assert.equal(dup.projection.orders[0].projectionStatus,'blocked');
  assert.ok(dup.projection.orders[0].blockers.includes('already_imported'));
});

test('C4-D status regression must be blocked by C4-C even when generic projection is ready',()=>{
  const raw=snapshot();
  raw.payload.response.order_list[0].order_status='UNPAID';
  const {normalized,projection}=runConsultative(raw);
  assert.equal(projection.orders[0].projectionStatus,'ready');
  const order=normalized.orders[0];
  const gate=assessCelivioC4CPreflight({
    channelAccountId:ACCOUNT,shopId:CELIVIO_C4C_SHOP_ID,
    orderSn:order.orderSn,externalStatus:order.externalStatus,
    itemId:ITEM_ID,modelId:MODEL_ID,quantity:1,
    mappingMatches:[mapping()],rawOrderDetailPersisted:true,
    physicalConversionHomologated:true,duplicateChecked:true,existingOrder:null,
  });
  assert.equal(gate.candidateForNextGate,false);
  assert.ok(gate.blockers.includes('external_status_not_intake_eligible'));
  assert.equal(gate.writerAuthorized,false);
});
