import test from 'node:test';
import assert from 'node:assert/strict';
import { canInitiateShopeeOAuth, validRequestedAccount } from './shopee-oauth-authorization.mjs';

const userId = '11111111-1111-4111-8111-111111111111';
const accountId = '22222222-2222-4222-8222-222222222222';
const platformId = '33333333-3333-4333-8333-333333333333';
function allowedFixture() {
  return {
    user: { id: userId },
    appUser: { auth_user_id: userId, is_active: true },
    account: { id: accountId, platform_id: platformId, is_active: true },
    platform: { id: platformId, name: 'Shopee Brasil', group_type: 'marketplace', parent_id: null, is_active: true },
    grant: { auth_user_id: userId, channel_account_id: accountId },
  };
}

test('validates exactly one canonical account UUID and rejects public identity fields', () => {
  assert.equal(validRequestedAccount({ channel_account_id: accountId }), accountId);
  for (const body of [
    null, [], {}, { channel_account_id: 'celivio' }, { channel_account_id: 1357031949 },
    { channel_account_id: accountId, shop_id: 1357031949 },
    { channel_account_id: accountId, user_id: userId },
    { channel_account_id: accountId, partner_id: 2047685 },
  ]) assert.equal(validRequestedAccount(body), null);
});

test('authorized active linked account + explicit per-account grant passes', () => {
  assert.equal(canInitiateShopeeOAuth(allowedFixture()), true);
});

test('no explicit grant always denies even for a linked active user', () => {
  const f = allowedFixture();
  f.grant = null;
  assert.equal(canInitiateShopeeOAuth(f), false);
});

test('user identity mismatches and inactive app user deny', () => {
  for (const variant of [
    { user: null },
    { user: { id: '44444444-4444-4444-8444-444444444444' } },
    { appUser: { auth_user_id: userId, is_active: false } },
    { appUser: { auth_user_id: '44444444-4444-4444-8444-444444444444', is_active: true } },
    { grant: { auth_user_id: '44444444-4444-4444-8444-444444444444', channel_account_id: accountId } },
    { grant: { auth_user_id: userId, channel_account_id: '44444444-4444-4444-8444-444444444444' } },
  ]) assert.equal(canInitiateShopeeOAuth({ ...allowedFixture(), ...variant }), false);
});

test('inactive, non-Shopee, non-canonical, and mismatched platforms deny', () => {
  const fixture = allowedFixture();
  for (const variant of [
    { account: { ...fixture.account, is_active: false } },
    { platform: { ...fixture.platform, is_active: false } },
    { platform: { ...fixture.platform, group_type: 'social' } },
    { platform: { ...fixture.platform, parent_id: platformId } },
    { platform: { ...fixture.platform, name: 'Mercado Livre' } },
    { platform: { ...fixture.platform, id: accountId } },
  ]) assert.equal(canInitiateShopeeOAuth({ ...fixture, ...variant }), false);
});

test('empty or partial data always denies', () => {
  assert.equal(canInitiateShopeeOAuth(), false);
  for (const key of Object.keys(allowedFixture())) {
    const f = allowedFixture();
    f[key] = null;
    assert.equal(canInitiateShopeeOAuth(f), false);
  }
});
