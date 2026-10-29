import test from 'node:test';
import assert from 'node:assert/strict';
import { previewTrufasMappings } from '../src/shopee-trufas-reconciliation-preview.mjs';
const A = 'b4027369-5abf-4ac1-ab24-862334fae892';
const ref = [{item_id:'19799761406',model_id:'219175660379'},
  {item_id:'20999760944',model_id:'238786420976',seller_sku_observed:null}];
test('missing mappings and SKU-less box are safe', () => {
  const out=previewTrufasMappings(ref,[],A);
  assert.equal(out.selected,2);assert.equal(out.missing,2);assert.equal(out.writes,false);
});
test('exact account and model identity, duplicates exposed', () => {
  const m={marketplace:'shopee',channel_account_id:A,external_item_id:'19799761406',external_model_id:'219175660379'};
  const wrong={...m,channel_account_id:'other'};
  assert.equal(previewTrufasMappings(ref,[wrong],A).missing,2);
  assert.equal(previewTrufasMappings(ref,[m],A).missing,1);
  assert.equal(previewTrufasMappings(ref,[m,m],A).duplicate,1);
});
test('reject duplicate official reference IDs', () => {
  assert.throws(()=>previewTrufasMappings([ref[0],ref[0]],[],A),/duplicate/);
});
