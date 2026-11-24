import test from 'node:test';
import assert from 'node:assert/strict';
import { assessCelivioC4CPreflight, CELIVIO_C4C_ACCOUNT_ID } from '../src/shopee-celivio-c4c-preflight.mjs';

const match = {
  channel_account_id: CELIVIO_C4C_ACCOUNT_ID,
  external_item_id: '23499115129',
  external_model_id: '239430912885',
  product_id: 'c70dd4b4-bc59-4d88-81ef-1a8c47315560',
  physical_multiplier: 5000,
};
const input = {
  channelAccountId: CELIVIO_C4C_ACCOUNT_ID,
  shopId: 1357031949,
  orderSn: '2611245JCGC011',
  externalStatus: 'UNPAID',
  itemId: '23499115129',
  modelId: '239430912885',
  quantity: 1,
  mappingMatches: [match],
};

test('real Celivio UNPAID evidence blocks import even with exact official mapping', () => {
  const r = assessCelivioC4CPreflight(input);
  assert.equal(r.candidateForNextGate, false);
  assert.ok(r.blockers.includes('external_status_not_intake_eligible'));
  assert.ok(r.blockers.includes('raw_order_detail_not_persisted'));
  assert.ok(r.blockers.includes('physical_conversion_not_homologated'));
  assert.equal(r.writerAuthorized, false);
  assert.equal(r.operationalWrites, false);
  assert.equal(r.separationAuthorized, false);
});

test('cross-account identity and approximate mapping cannot pass', () => {
  const r = assessCelivioC4CPreflight({
    ...input, channelAccountId: 'b4027369-5abf-4ac1-ab24-862334fae892',
    externalStatus: 'READY_TO_SHIP', rawOrderDetailPersisted: true,
    physicalConversionHomologated: true,
  });
  assert.ok(r.blockers.includes('celivio_identity_mismatch'));
});

test('wrong Item/Model and duplicated mappings block the next evidence gate', () => {
  const bad = assessCelivioC4CPreflight({...input, modelId:'0'});
  assert.ok(bad.blockers.includes('official_mapping_not_resolved'));
  const dup = assessCelivioC4CPreflight({...input, mappingMatches:[match,match]});
  assert.ok(dup.blockers.includes('ambiguous_official_mapping'));
});

test('unverified duplicate blocks; even all green remains non-writing', () => {
  const base = {...input, externalStatus:'PROCESSED', rawOrderDetailPersisted:true,
    physicalConversionHomologated:true, duplicateChecked:true};
  const duplicate = assessCelivioC4CPreflight({...base, existingOrder:{id:'existing'}});
  assert.ok(duplicate.blockers.includes('already_imported'));
  const unverified = assessCelivioC4CPreflight({...base, duplicateChecked:false});
  assert.ok(unverified.blockers.includes('duplicate_check_not_proven'));
  const clean = assessCelivioC4CPreflight(base);
  assert.equal(clean.candidateForNextGate,true);
  assert.deepEqual(clean.blockers,[]);
  assert.equal(clean.writerAuthorized,false);
  assert.equal(clean.operationalWrites,false);
  assert.equal(clean.rawWrites,false);
  assert.equal(clean.inventoryActionAuthorized,false);
});

test('PII and token values are never returned', () => {
  const r = assessCelivioC4CPreflight({...input,buyerName:'PRIVATE',accessToken:'SECRET'});
  const serialized=JSON.stringify(r);
  assert.equal(serialized.includes('PRIVATE'),false);
  assert.equal(serialized.includes('SECRET'),false);
});
