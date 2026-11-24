import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeShopeeOrderRawSnapshot, buildShopeeOrderSafePreview }
  from '../src/shopee-order-normalizer.mjs';
import { buildShopeeMappingPreview } from '../src/shopee-mapping-preview.mjs';
import { buildShopeeOrderProjectionPreview } from '../src/shopee-order-projection-preview.mjs';
import { applyShopeeInternalOrderContract } from '../src/shopee-internal-order-contract.mjs';
import { assessCelivioC4CPreflight, CELIVIO_C4C_ACCOUNT_ID }
  from '../src/shopee-celivio-c4c-preflight.mjs';

// TEST FIXTURE ONLY: these dates, order totals and envelope are synthetic.
// No actual Shopee order-detail Raw for Celivio was persisted in the Core.
// The real C4-B evidence was: UNPAID, 2611245JCGC011, one
// Item 23499115129 / Model 239430912885, quantity 1.
// This simulation must never be interpreted as a live Raw observation.
const ACCOUNT = CELIVIO_C4C_ACCOUNT_ID;
const SHOP = 1357031949;
const ORDER_SN = '2611245JCGC011';
const ITEM_ID = '23499115129';
const MODEL_ID = '239430912885';
const MAPPING_ID = '54c9edd0-82c6-412d-9d7c-1c1cc721193e';
const PRODUCT_ID = 'c70dd4b4-bc59-4d88-81ef-1a8c47315560';
const VARIANT_ID = '1a3d59a6-4712-4afd-811a-5a72aad76fa9';

function syntheticDetailSnapshot(externalStatus = 'UNPAID') {
  return {
    source: 'shopee_open_platform', environment: 'live',
    external_entity_type: 'order',
    endpoint: '/api/v2/order/get_order_detail',
    channel_account_id: ACCOUNT,
    external_entity_id: ORDER_SN,
    observed_at: '2026-11-24T13:47:56.000Z', // SYNTHETIC fixture time
    payload: { response: { order_list: [{
      order_sn: ORDER_SN, order_status: externalStatus,
      create_time: 1795528076, // SYNTHETIC date; not evidenced by C4-B response
      item_list: [{
        item_id: ITEM_ID, model_id: MODEL_ID,
        item_name: 'Chocolate Cobertura Diehl Branco ou Meio Amargo',
        model_name: '5 KG,COBERTURA MEIO AMARGO',
        model_quantity_purchased: 1,
      }],
      recipient_address: { name: 'SYNTHETIC PRIVATE' },
    }] } },
  };
}

function catalogMapping() {
  return {
    id: MAPPING_ID, channel_account_id: ACCOUNT, marketplace: 'shopee',
    marketplace_account: 'SHOPEE CELIVIO',
    external_item_id: ITEM_ID, external_model_id: MODEL_ID,
    external_item_key: 'official:item:23499115129|model:239430912885',
    product_id: PRODUCT_ID, variant_id: VARIANT_ID, physical_multiplier: 5000,
    components: [],
    // Supplied by read-only Core catalog loader; real product + variant unit is 'g'.
    physical_identity: { active: true, unit: 'g', presentation_factors: [400,1000,1] },
  };
}

function consultative(externalStatus) {
  const snapshot = syntheticDetailSnapshot(externalStatus);
  const normalized = normalizeShopeeOrderRawSnapshot(snapshot);
  const mapping = buildShopeeMappingPreview(normalized, [catalogMapping()], {
    channelAccountId: ACCOUNT, marketplaceAccount: 'SHOPEE CELIVIO',
    requirePhysicalValidation: true,
  });
  const projection = buildShopeeOrderProjectionPreview(normalized, mapping, {
    marketplaceAccount: 'SHOPEE CELIVIO',
    existingExternalOrderIds: new Set(),
  });
  return { snapshot, normalized, mapping, projection };
}

test('C4-D synthetic raw-to-normalizer-to-mapping-to-projection preserves the true Item/Model and mass', () => {
  const r=consultative('UNPAID');
  assert.equal(r.normalized.orders.length,1);
  assert.equal(r.normalized.orders[0].externalStatus,'UNPAID');
  assert.deepEqual(
    [r.normalized.orders[0].items[0].itemId,r.normalized.orders[0].items[0].modelId],
    [ITEM_ID,MODEL_ID]
  );
  assert.equal(r.mapping.orders[0].items[0].mappingStatus,'recognized');
  assert.equal(r.mapping.orders[0].items[0].components[0].physicalQuantity,5000);
  assert.equal(r.projection.orders[0].candidate.items[0].physicalMultiplier,5000);
  assert.equal(r.projection.orders[0].candidate.items[0].commercialQuantity,1);
  assert.equal(r.projection.orders[0].candidate.items[0].quantity,5000);
  assert.equal(r.projection.operationalWrites,false);
  assert.equal(r.projection.writeReady,false);
  assert.equal(JSON.stringify(buildShopeeOrderSafePreview(r.normalized)).includes('SYNTHETIC PRIVATE'),false);
});

test('C4-D exposes that generic projection ready is NOT proof of intake eligibility for UNPAID', () => {
  const r=consultative('UNPAID');
  // Generic projection only checks mapping and quantity, NOT order eligibility.
  assert.equal(r.projection.orders[0].projectionStatus,'ready');
  const gate=assessCelivioC4CPreflight({
    channelAccountId:ACCOUNT,shopId:SHOP,orderSn:ORDER_SN,externalStatus:'UNPAID',
    itemId:ITEM_ID,modelId:MODEL_ID,quantity:1,
    mappingMatches:[catalogMapping()],physicalConversionHomologated:true,
    // Synthetic Raw data is NOT a Core-persisted Raw.
    rawOrderDetailPersisted:false,
    duplicateChecked:false,
  });
  assert.equal(gate.candidateForNextGate,false);
  assert.ok(gate.blockers.includes('external_status_not_intake_eligible'));
  assert.ok(gate.blockers.includes('raw_order_detail_not_persisted'));
  assert.ok(gate.blockers.includes('duplicate_check_not_proven'));
  assert.equal(gate.writerAuthorized,false);
  assert.equal(gate.rawWrites,false);
  assert.equal(gate.separationAuthorized,false);
});

test('C4-D synthetic paid-status preview creates only an inert internal contract, not a real order', () => {
  const r=consultative('PROCESSED'); // STATUS SIMULATED, not the real Shopee status!
  assert.equal(r.projection.orders[0].projectionStatus,'ready');
  const contract=applyShopeeInternalOrderContract(r.projection.orders[0], {
    channelAccountId:ACCOUNT,marketplaceAccount:'SHOPEE CELIVIO',
  });
  assert.equal(contract.idempotency.key,`${ACCOUNT}:${ORDER_SN}`);
  assert.equal(contract.order.marketplaceMetadata.externalStatus,'PROCESSED');
  assert.equal(contract.order.paymentStatus,'pendente');
  assert.equal(contract.items[0].quantity,5000);
  assert.equal(contract.items[0].commercialQuantity,1);
  assert.equal(contract.operationalWrites,false);
  assert.equal(contract.writerAuthorized,false);
  assert.equal(contract.effects.stockAction,null);
  assert.equal(contract.effects.financialAction,null);
  assert.equal(contract.effects.crmAction,null);

  // A hypothetical eligible status cannot override absence of real persisted Raw.
  const gate=assessCelivioC4CPreflight({
    channelAccountId:ACCOUNT,shopId:SHOP,orderSn:ORDER_SN,externalStatus:'PROCESSED',
    itemId:ITEM_ID,modelId:MODEL_ID,quantity:1,mappingMatches:[catalogMapping()],
    physicalConversionHomologated:true,rawOrderDetailPersisted:false,
    duplicateChecked:false,
  });
  assert.equal(gate.candidateForNextGate,false);
  assert.ok(gate.blockers.includes('raw_order_detail_not_persisted'));
  assert.ok(gate.blockers.includes('duplicate_check_not_proven'));
});

test('C4-D refuses corrupted physical evidence and duplicate identity before an operational gate', () => {
  const normalized=normalizeShopeeOrderRawSnapshot(syntheticDetailSnapshot('READY_TO_SHIP'));
  const bad={...catalogMapping(),physical_multiplier:4999};
  const mapping=buildShopeeMappingPreview(normalized,[bad],{
    channelAccountId:ACCOUNT,marketplaceAccount:'SHOPEE CELIVIO',requirePhysicalValidation:true,
  });
  assert.equal(mapping.orders[0].items[0].mappingStatus,'physical_multiplier_mismatch');
  const projection=buildShopeeOrderProjectionPreview(normalized,mapping,{
    marketplaceAccount:'SHOPEE CELIVIO',
    existingExternalOrderIds:new Set([ORDER_SN]),
  });
  assert.equal(projection.orders[0].projectionStatus,'blocked');
  assert.ok(projection.orders[0].blockers.includes('already_imported'));
  assert.ok(projection.orders[0].blockers.some(x=>x.includes('physical_multiplier_mismatch')));
  assert.equal(projection.writeReady,false);
});
