// Reuse official OAuth refresh executor on the same admitted account lease.
// No token rotation when the access token is still usable; no retry on ambiguity.
import {createShopeeOauthRefreshOnce} from './shopee-oauth-refresh-once.mjs';
import {readLiveShopeeOauthConnection,refreshLiveShopeeOauthConnection} from './core-bridge.mjs';
import {refreshToken} from './connectors/shopee-protocol.mjs';
import {createD11BridgeAdapters} from './shopee-d11-bridge-adapter.mjs';
const fail=code=>({ok:false,code});
export function createD11Refresh({enabled=false,now=Date.now,getEnv=k=>process.env[k],call,
 adapters=createD11BridgeAdapters({enabled,call}),readConnection=readLiveShopeeOauthConnection,
 persistRefresh=refreshLiveShopeeOauthConnection,makeRefresh=createShopeeOauthRefreshOnce,
 refreshAccessToken=refreshToken,fetchImpl=globalThis.fetch,refreshOptions={}}={}){
 return async function refresh({accountId,leaseId,revision,deadline}={}){
  if(enabled!==true)return fail('d11_refresh_not_admitted');
  const scope={accountId,leaseId,revision},within=()=>Number.isFinite(deadline)&&now()<deadline;
  let sent=false,persisted=false;
  try{
   // Discovery scope is valid with or without a queued order.
   if(!within())return fail('d11_refresh_not_admitted');
   const d=await adapters.readDiscoveryScope(scope);
   if(!within()||d?.status!=='discovery_scope'||d.channel_account_id!==accountId||d.lease_id!==leaseId
    ||d.revision!==revision||d.partner_id!==2047685||!Number.isSafeInteger(d.shop_id)||d.shop_id<1)
    return fail('d11_refresh_not_admitted');
   const timeout=()=>Math.max(1,Math.min(5000,deadline-now()));
   const read=async p=>{
    if(p?.channel_account_id!==accountId)return {ok:false};
    const r=await readConnection(p,{timeoutMs:timeout()});
    return r?.ok===true&&Number(r.payload?.shop_id)===d.shop_id&&Number(r.payload?.partner_id)===2047685?r:{ok:false};
   };
   const connection=await read({channel_account_id:accountId});
   if(!within()||connection?.ok!==true)return fail('d11_refresh_not_admitted');
   if(Date.parse(connection.payload?.access_token_expires_at)>now()+60000)return {ok:true,code:'d11_oauth_current'};
   if(getEnv('SHOPEE_D11_REFRESH_ENABLED')!=='true'||!(Date.parse(connection.payload?.refresh_token_expires_at)>now()))return fail('d11_refresh_not_admitted');
   const admitted=async()=>{
    if(!within())return false;
    const s=await adapters.readRefreshScope(scope);
    return within()&&s?.status==='refresh_scope'&&s.accountId===accountId&&s.leaseId===leaseId&&s.revision===revision
     &&s.shopId===d.shop_id&&s.partnerId===2047685&&Date.parse(s.expiresAt)>now()+1000;
   };
   if(!await admitted())return fail('d11_refresh_not_admitted');
   const execute=makeRefresh({...refreshOptions,now,getEnv:k=>k==='SHOPEE_LIVE_CHANNEL_ACCOUNT_ID'?accountId:k==='SHOPEE_LIVE_PARTNER_ID'?'2047685':getEnv(k),
    readConnection:read,
    refreshAccessToken:async p=>{
     if(sent||p.shopId!==d.shop_id||p.partnerId!==2047685||!await admitted())throw Error('d11_refresh_scope_refused');
     return refreshAccessToken({...p,fetchImpl:async(url,opts)=>{
      const u=new URL(url);
      if(sent||!within()||u.origin!=='https://partner.shopeemobile.com'||u.pathname!=='/api/v2/auth/access_token/get')throw Error('d11_refresh_transport_refused');
      sent=true;
      return fetchImpl(url,{...opts,redirect:'error',signal:AbortSignal.timeout(timeout())});
     }});
    },
    persistRefresh:async p=>{
     // If Shopee already rotated the token, preserve it even if the policy
     // was paused during the request. This does not admit any further action.
     if(!sent||persisted||p?.channel_account_id!==accountId)return {ok:false};
     const r=await persistRefresh(p,{timeoutMs:5000});
     persisted=r?.ok===true;return r;
    }});
   const r=await execute();
   if(sent&&persisted&&r?.ok===true&&r.code==='oauth_refreshed'
    &&Number(r.after?.shop_id)===d.shop_id&&Number(r.after?.partner_id)===2047685&&Date.parse(r.after?.access_token_expires_at)>now()+60000)
    return {ok:true,code:'d11_oauth_refreshed'};
   return fail(sent?'cycle_refresh_or_discovery_uncertain':'d11_refresh_not_admitted');
  }catch{return fail(sent?'cycle_refresh_or_discovery_uncertain':'d11_refresh_not_admitted');}
 };
}
