import test from 'node:test';
import assert from 'node:assert/strict';
import { shopeeTrufa40HistoricalBlocker } from '../src/shopee-trufa40-historical-guard.mjs';
const ACCOUNT='b4027369-5abf-4ac1-ab24-862334fae892';
const historic={
  '19598189256':['159546591760'],
  '21999552311':['238789009560','238789009561','238789009562'],
  '22193668881':['238778628464'],
  '22393654582':['109869648890','109869648891'],
};
function payload(account,itemId,modelId) {
  return { channelAccountId:account, orders:[{createdAt:'2026-10-01T00:00:00Z',
    items:[{itemId,modelId,modelName:'changed title',modelSku:'changed-sku'}]}]};
}
test('blocks seven sensitive T40 historical models before mapping regardless of title and date',()=>{
  let count=0;
  for(const [itemId,models] of Object.entries(historic)) for(const modelId of models){
    count++;
    assert.equal(shopeeTrufa40HistoricalBlocker(payload(ACCOUNT,itemId,modelId)),
      'trufa40_historical_model_identity_unverified');
  }
  assert.equal(count,7);
});
test('does not block new T40 models, other accounts or unrelated item IDs',()=>{
  assert.equal(shopeeTrufa40HistoricalBlocker(payload('other','19598189256','159546591760')),null);
  assert.equal(shopeeTrufa40HistoricalBlocker(payload(ACCOUNT,'21999552311','238816651454')),null);
  assert.equal(shopeeTrufa40HistoricalBlocker(payload(ACCOUNT,'22193668881','179732818913')),null);
  assert.equal(shopeeTrufa40HistoricalBlocker(payload(ACCOUNT,'22393654582','149796249929')),null);
  assert.equal(shopeeTrufa40HistoricalBlocker(payload(ACCOUNT,'random','109869648890')),null);
});
