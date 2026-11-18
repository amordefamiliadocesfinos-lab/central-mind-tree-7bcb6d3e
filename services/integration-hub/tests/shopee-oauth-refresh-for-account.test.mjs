import assert from 'node:assert/strict';
import test from 'node:test';
import { createShopeeOauthRefreshForAccount } from '../src/shopee-oauth-refresh-for-account.mjs';

const account = 'd26c7a30-aa4a-4441-8012-600d70453689';
const other = 'b4027369-5abf-4ac1-ab24-862334fae892';
const shop = 1357031949;
const clock = Date.parse('2026-11-18T12:00:00.000Z');
function fixture(overrides = {}) {
  const calls = [];
  const ctx = {
    channel_account_id:account, partner_id:2047685, shop_id:shop,
    refresh_token_ciphertext:'encrypted-original',
    refresh_token_expires_at:'2026-12-18T12:00:00.000Z',
  };
  const run = createShopeeOauthRefreshForAccount({
    now: () => clock,
    getEnv: name => name === 'SHOPEE_LIVE_PARTNER_KEY' ? 'synthetic-key' :
      name === 'SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY' ? 'synthetic-crypto-key' : null,
    readContext: async input => { calls.push(['read', input]); return { ok:true,payload:ctx }; },
    persistIfCurrent: async input => { calls.push(['persist',input]);return {ok:true}; },
    decrypt: async () => { calls.push(['decrypt']); return 'plaintext-original'; },
    encrypt: async v => 'cipher:' + v,
    refresh: async input => { calls.push(['refresh',input]);return {
      response: {ok:true},payload: {
        shop_id:shop, access_token:'new-access-token',refresh_token:'new-refresh-token',expire_in:14400,
      },
    }; },
    ...overrides,
  });
  return { run, calls, ctx };
}

test('renews a specifically trusted account and persists by CAS without exposing tokens',async()=>{
  const {run,calls}=fixture();
  const out=await run(account);
  assert.equal(out.ok,true);
  assert.equal(out.code,'oauth_refreshed_for_account');
  const persist=calls.find(([action])=>action==='persist')[1];
  assert.equal(persist.channel_account_id,account);
  assert.equal(persist.partner_id,2047685);
  assert.equal(persist.shop_id,shop);
  assert.equal(persist.expected_refresh_token_ciphertext,'encrypted-original');
  assert.equal(persist.access_token_ciphertext,'cipher:new-access-token');
  assert.equal(persist.refresh_token_ciphertext,'cipher:new-refresh-token');
  assert.equal(out.after.shop_id,shop);
  assert.ok(!JSON.stringify(out).includes('cipher:'));
  assert.ok(!JSON.stringify(out).includes('plaintext-original'));
  assert.equal(calls.filter(([a])=>a==='refresh').length,1);
});

test('does not use public/malformed account identities',async()=>{
  const {run,calls}=fixture();
  for(const candidate of [null,undefined,'celivio',1357031949,'bad',{}]){
    assert.equal((await run(candidate)).code,'invalid_internal_account');
  }
  assert.equal(calls.length,0);
});

test('Core identity cannot be substituted by another account or partner',async()=>{
  for(const delta of [{channel_account_id:other},{partner_id:999},{shop_id:0}]){
    let refreshed=false;
    const {run,ctx}=fixture({refresh:async()=>{refreshed=true;throw Error('should not call')}});
    Object.assign(ctx,delta);
    assert.equal((await run(account)).code,'oauth_refresh_identity_mismatch');
    assert.equal(refreshed,false);
  }
});

test('rejects expired tokens without Shopee calls',async()=>{
  const {run,ctx,calls}=fixture();
  ctx.refresh_token_expires_at='2026-11-17T10:00:00.000Z';
  assert.equal((await run(account)).code,'refresh_token_expired');
  assert.equal(calls.some(([a])=>a==='refresh'),false);
});

test('rejects missing or mismatched shop identity before persist',async()=>{
  for(const payload of [
    {access_token:'a',refresh_token:'b'},
    {shop_id:531736366,access_token:'a',refresh_token:'b'},
    {shop_id_list:[shop,531736366],access_token:'a',refresh_token:'b'},
  ]){
    const {run,calls}=fixture({refresh:async()=>({response:{ok:true},payload})});
    assert.equal((await run(account)).code,'refreshed_shop_mismatch');
    assert.equal(calls.some(([a])=>a==='persist'),false);
  }
});

test('stale CAS rejects without touching another account',async()=>{
  const {run}=fixture({persistIfCurrent:async()=>({ok:false,status:409})});
  assert.equal((await run(account)).code,'oauth_refresh_stale_or_revoked');
});

test('missing canonical context fails before decrypt and refresh',async()=>{
  const {run,calls}=fixture({readContext:async()=>({ok:false,status:409})});
  assert.equal((await run(account)).code,'oauth_refresh_context_unavailable');
  assert.equal(calls.some(([a])=>a==='decrypt'||a==='refresh'),false);
});
