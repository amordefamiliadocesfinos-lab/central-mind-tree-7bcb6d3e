import test from 'node:test';
import assert from 'node:assert/strict';
import { shopeeAdaoEasterCommitBlocker, ADAO_CHANNEL_ACCOUNT_ID } from '../src/shopee-adao-easter-commit-guard.mjs';

const order = (items) => ({ channelAccountId: ADAO_CHANNEL_ACCOUNT_ID, orders: [{ items }] });

test('Adão requires explicit exact non-Easter identity proof for any commit', () => {
  assert.equal(shopeeAdaoEasterCommitBlocker(order([{itemId:'1',modelId:'2'}]), {approvedPairs:''}), 'adao_pascoa_exclusion_not_proven');
  assert.equal(shopeeAdaoEasterCommitBlocker(order([{itemId:'1',modelId:'2'}]), {approvedPairs:'1:2,'}), 'adao_pascoa_exclusion_not_proven');
  assert.equal(shopeeAdaoEasterCommitBlocker(order([{itemId:'1',modelId:'3'}]), {approvedPairs:'1:2'}), 'adao_pascoa_offer_not_approved_for_intake');
  assert.equal(shopeeAdaoEasterCommitBlocker(order([{itemId:'1',modelId:'2'},{itemId:'3',modelId:'4'}]), {approvedPairs:'1:2'}), 'adao_pascoa_offer_not_approved_for_intake');
  assert.equal(shopeeAdaoEasterCommitBlocker(order([{itemId:'1',modelId:'2'}]), {approvedPairs:'1:2'}), null);
  assert.equal(shopeeAdaoEasterCommitBlocker(order([]), {approvedPairs:'1:2'}), 'adao_pascoa_order_identity_unverified');
});
