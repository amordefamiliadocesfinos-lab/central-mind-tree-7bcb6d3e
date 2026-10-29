import test from 'node:test';
import assert from 'node:assert/strict';
import { shopeeTrufa30TemporalBlocker } from '../src/shopee-trufa30-temporal-guard.mjs';

const account = 'b4027369-5abf-4ac1-ab24-862334fae892';
const reused = ['229425631222','229425631223','229425631224','229425631225','229425631226'];
const payload = (channelAccountId,itemId,modelId) => ({
  channelAccountId, orders: [{ createdAt: '2026-10-29T00:00:00.000Z',
    items: [{itemId,modelId,modelName:'old or new',modelSku:null}] }],
});

test('all five reused T30-3 IDs are quarantined even with a new title or date', () => {
  for (const modelId of reused) {
    assert.equal(shopeeTrufa30TemporalBlocker(payload(account,'22898142109',modelId)),
      'trufa30_reused_model_temporal_identity_unverified');
  }
});
test('other account, item and new models are not quarantined', () => {
  assert.equal(shopeeTrufa30TemporalBlocker(payload('other','22898142109',reused[0])),null);
  assert.equal(shopeeTrufa30TemporalBlocker(payload(account,'23093522370',reused[0])),null);
  assert.equal(shopeeTrufa30TemporalBlocker(payload(account,'22898142109','129659799016')),null);
  assert.equal(shopeeTrufa30TemporalBlocker(payload(account,'22898142109','129659799017')),null);
});
