import test from 'node:test';
import assert from 'node:assert/strict';
import { shopeePortoGelLegacyBlocker as blocker } from '../src/shopee-porto-gel-legacy-guard.mjs';

const account = 'b4027369-5abf-4ac1-ab24-862334fae892';
const normalized = (a,item,model) => ({
  channelAccountId:a,
  orders:[{items:[{itemId:item,modelId:model}]}],
});

test('legacy 5kg must be quarantined', () => {
  assert.equal(blocker(normalized(account,'58211561353','199622481703')),
    'porto_gel_historical_5kg_identity_unverified');
});
test('current 1/2/3/4kg remain unaffected', () => {
  for (const model of ['199622481699','199622481700','199622481701','199622481702'])
    assert.equal(blocker(normalized(account,'58211561353',model)),null);
});
test('current 10kg unaffected', () =>
  assert.equal(blocker(normalized(account,'58211569433','199190017655')),null));
test('other accounts unaffected', () =>
  assert.equal(blocker(normalized('different','58211561353','199622481703')),null));
test('invalid multi-order payload does not assert history', () =>
  assert.equal(blocker({channelAccountId:account,orders:[]}),null));
