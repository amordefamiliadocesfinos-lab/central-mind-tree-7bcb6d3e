import test from 'node:test';
import assert from 'node:assert/strict';
import {createD11Refresh} from '../src/shopee-d11-refresh.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',L='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',N=Date.parse('2026-11-28T12:00:00Z'),iso=n=>new Date(n).toISOString(),scope={accountId:A,leaseId:L,revision:1,deadline:N+48000};
function fixture(){
 const f={calls:[],allowed:true,flag:'true',expires:iso(N-1000)};
 const run=createD11Refresh({enabled:true,now:()=>N,getEnv:k=>({SHOPEE_D11_REFRESH_ENABLED:f.flag,SHOPEE_LIVE_PARTNER_KEY:'fixture',SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY:'fixture'})[k],
  adapters:{readDiscoveryScope:async()=>({status:'discovery_scope',channel_account_id:A,lease_id:L,revision:1,partner_id:2047685,shop_id:123}),
   readRefreshScope:async()=>f.allowed?{status:'refresh_scope',accountId:A,leaseId:L,revision:1,shopId:123,partnerId:2047685,expiresAt:iso(N+120000)}:null},
  readConnection:async()=>({ok:true,payload:{channel_account_id:A,partner_id:2047685,shop_id:123,access_token_expires_at:f.expires,refresh_token_expires_at:iso(N+120000),refresh_token_ciphertext:'fixture'}}),
  refreshOptions:{decryptToken:async()=> 'fixture',encryptToken:async()=> 'fixture'},
  refreshAccessToken:async p=>{const r=await p.fetchImpl('https://partner.shopeemobile.com/api/v2/auth/access_token/get',{method:'POST'});return {response:r,payload:await r.json()};},
  fetchImpl:async()=>{f.calls.push('rotate');if(f.ambiguous)throw Error('fixture');if(f.pause)f.allowed=false;
   return new Response(JSON.stringify({error:'',access_token:'fixture',refresh_token:'fixture',expire_in:14400}),{status:200});},
  persistRefresh:async p=>{f.calls.push('persist');assert.equal(p.channel_account_id,A);if(f.losePersist)return {ok:false};f.expires=p.access_token_expires_at;return {ok:true};}
 });
 return {...f,run,f};
}
test('D11 current access token never rotates; expired token requires approved refresh capability',async()=>{
 const {run,f}=fixture();f.expires=iso(N+120000);assert.equal((await run(scope)).code,'d11_oauth_current');assert.deepEqual(f.calls,[]);
 f.expires=iso(N-1000);f.allowed=false;assert.equal((await run(scope)).code,'d11_refresh_not_admitted');assert.deepEqual(f.calls,[]);
});
test('D11 refresh reuses existing OAuth executor and preserves rotated token after pause',async()=>{
 const {run,f}=fixture();f.pause=true;assert.equal((await run(scope)).code,'d11_oauth_refreshed');assert.deepEqual(f.calls,['rotate','persist']);
});
test('D11 refresh ambiguity halts without retry',async()=>{
 const a=fixture();a.f.ambiguous=true;assert.equal((await a.run(scope)).code,'cycle_refresh_or_discovery_uncertain');assert.deepEqual(a.f.calls,['rotate']);
 const b=fixture();b.f.losePersist=true;assert.equal((await b.run(scope)).code,'cycle_refresh_or_discovery_uncertain');assert.deepEqual(b.f.calls,['rotate','persist']);
});
