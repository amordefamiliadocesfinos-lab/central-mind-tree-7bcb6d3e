import test from 'node:test';
import assert from 'node:assert/strict';
import { shopeeBatchLimit, selectShopeeBatchCandidates, selectShopeePendingShipments,
  selectShopeeLabelCandidate } from '../src/shopee-cycle-selection.mjs';
import { adaoBatchLimit, selectAdaoBatchCandidates, selectAdaoPendingShipments,
  selectAdaoLabelCandidate } from '../src/shopee-adao-automatic-intake.mjs';

const now = 1795809600000;
const sample = [
  {order_sn:'TESTORDER001',create_time:1795800000,ship_by_date:1795900000},
  {order_sn:'TESTORDER002',create_time:1795800100,ship_by_date:1795890000},
  {order_sn:'TESTORDER003',create_time:1795790000},
];
test('D11 shared selection retains the exact Adão exports',()=>{
  assert.equal(adaoBatchLimit,shopeeBatchLimit);
  assert.equal(selectAdaoBatchCandidates,selectShopeeBatchCandidates);
  assert.equal(selectAdaoPendingShipments,selectShopeePendingShipments);
  assert.equal(selectAdaoLabelCandidate,selectShopeeLabelCandidate);
});
test('D11 official deadline outranks age and absent deadlines remain fallback',()=>{
  assert.deepEqual(selectShopeePendingShipments(sample,now,3),
    ['TESTORDER002','TESTORDER001','TESTORDER003']);
  assert.deepEqual(selectShopeePendingShipments(sample,now,1),['TESTORDER002']);
});
test('D11 equal priority rotates, bounded cap and malformed input fail safely',()=>{
  const tie=sample.slice(0,2).map(x=>({...x,create_time:1795800000,ship_by_date:1795900000}));
  const a=selectShopeePendingShipments(tie,now,1);
  const b=selectShopeePendingShipments(tie,now+300000,1);
  assert.notDeepEqual(a,b);
  assert.equal(shopeeBatchLimit(9),1);
  assert.equal(shopeeBatchLimit(3),3);
  assert.deepEqual(selectShopeePendingShipments([{order_sn:'bad!'}],now,3),[]);
  assert.deepEqual(selectShopeeBatchCandidates(null,now),[]);
});
test('D11 queue selection uses only the already scoped input; no cross-account global pool',()=>{
  const a=sample.slice(0,1);
  const b=sample.slice(1);
  assert.deepEqual(selectShopeePendingShipments(a,now,3),['TESTORDER001']);
  assert.deepEqual(selectShopeePendingShipments(b,now,3),['TESTORDER002','TESTORDER003']);
  assert.equal(selectShopeeLabelCandidate(['TESTORDER001'],now),'TESTORDER001');
  assert.equal(selectShopeeLabelCandidate([],now),null);
});
