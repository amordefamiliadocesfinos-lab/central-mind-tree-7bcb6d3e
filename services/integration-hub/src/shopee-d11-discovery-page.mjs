// Candidate discovery uses the existing official signed reader and Raw writers.
// No refresh, order writer, claim, label or scheduler.
import {createShopeeLiveOrdersReader} from './shopee-live-orders.mjs';
import {createD11BridgeAdapters} from './shopee-d11-bridge-adapter.mjs';
import {upsertLiveShopeeOrderListSnapshot,upsertLiveShopeeOrderSnapshot,sha256Hex} from './core-bridge.mjs';
const SN=/^[A-Za-z0-9]{8,100}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const legacy=new Set(['8a8ad166-0317-4597-8be6-e43fb46b4d1b','b4027369-5abf-4ac1-ab24-862334fae892']);
const id=v=>typeof v==='string'&&UUID.test(v);
const cap=(v,n)=>Number.isSafeInteger(v)&&v>0&&v<=n;
const fail=code=>({ok:false,code,ordersWritten:0,effects:0});
const requestId=v=>typeof v==='string'&&/^[A-Za-z0-9_.:-]{1,160}$/.test(v);
const scalar=(o,keys)=>Object.fromEntries(keys.filter(k=>['string','number','boolean'].includes(typeof o?.[k])).map(k=>[k,o[k]]));
export function createD11DiscoveryPage({enabled=false,now=Date.now,call,getEnv=k=>process.env[k],
 adapters=createD11BridgeAdapters({enabled,call}),readerFactory=createShopeeLiveOrdersReader,
 persistList=upsertLiveShopeeOrderListSnapshot,persistDetail=upsertLiveShopeeOrderSnapshot,fetchImpl=globalThis.fetch}={}){
 return async function discover({accountId,leaseId,revision,deadline:outerDeadline=Infinity}={}){
  if(enabled!==true)return fail('d11_discovery_disabled');
  if(!id(accountId)||legacy.has(accountId.toLowerCase())||!id(leaseId)||!cap(revision,2147483647))return fail('d11_discovery_scope_refused');
  const scope={accountId,leaseId,revision},started=now();
  try{
   const s=await adapters.readDiscoveryScope(scope);
   const valid=v=>v?.status==='discovery_scope'&&v.channel_account_id===accountId&&v.lease_id===leaseId&&v.revision===revision
    &&v.partner_id===2047685&&cap(v.shop_id,Number.MAX_SAFE_INTEGER)&&cap(v.history_cutoff,Math.floor(now()/1000))
    &&cap(v.page_size,5)&&cap(v.work_budget_ms,48000)&&cap(v.time_from,Math.floor(now()/1000))
    &&cap(v.time_to,Math.floor(now()/1000))&&v.time_to>v.time_from&&v.time_to-v.time_from<=604800
    &&(v.cursor===null||(typeof v.cursor==='string'&&v.cursor.length>0&&v.cursor.length<=2048))
    &&Number.isFinite(Date.parse(v.lease_started_at))&&Date.parse(v.lease_started_at)<=now()&&Date.parse(v.expires_at)>now();
   if(!valid(s))return fail('d11_discovery_scope_refused');
   const deadline=Math.min(outerDeadline,started+s.work_budget_ms,Date.parse(s.expires_at)-1000);
   const within=()=>now()>=started&&now()<deadline;
   const same=async()=>{
    if(!within())return false;
    const v=await adapters.readDiscoveryScope(scope);
    return within()&&valid(v)&&['shop_id','history_cutoff','page_size','work_budget_ms','time_from','time_to','cursor','lease_started_at','expires_at','candidate_order_sn'].every(k=>v[k]===s[k]);
   };
   const timeout=()=>Math.max(1,Math.min(5000,deadline-now()));
   const windowId='update_time:'+s.time_from+'-'+s.time_to+':cursor:'+(s.cursor??'root');
   let listHash=null,listed=null,more=null,next=null;
   const details=Object.create(null);
   const reader=readerFactory({
    allowRefresh:false,expectedShopId:s.shop_id,now,
    getEnv:k=>k==='SHOPEE_LIVE_CHANNEL_ACCOUNT_ID'?accountId:k==='SHOPEE_LIVE_PARTNER_ID'?'2047685':getEnv(k),
    logger:()=>{},
    fetchImpl:async(url,init)=>{
     if(!await same())throw Error('discovery_scope_changed');
     return fetchImpl(url,{...init,redirect:'error',signal:AbortSignal.timeout(timeout())});
    },
    persistOrderListSnapshot:async r=>{
     const b=r?.payload,rows=b?.response?.order_list;
     if(listHash!==null||r?.channel_account_id!==accountId||r?.external_entity_id!==windowId
      ||!requestId(b?.request_id)||!Array.isArray(rows)||rows.length>s.page_size||typeof b.response.more!=='boolean'
      ||rows.some(o=>typeof o?.order_sn!=='string'||!SN.test(o.order_sn))
      ||new Set(rows.map(o=>o.order_sn)).size!==rows.length
      ||(b.response.more&&(typeof b.response.next_cursor!=='string'||!b.response.next_cursor||b.response.next_cursor.length>2048||b.response.next_cursor===s.cursor))
      ||!await same())return {ok:false};
     listed=rows.map(o=>o.order_sn);more=b.response.more;next=more?b.response.next_cursor:null;
     const payload={request_id:b.request_id,response:{order_list:listed.map(order_sn=>({order_sn})),more,next_cursor:next}};
     const hash=sha256Hex(JSON.stringify(payload));
     const result=await persistList({...r,payload,payload_hash:hash},{timeoutMs:timeout()});
     if(result?.ok===true)listHash=hash;
     return result;
    },
    persistOrderSnapshot:async r=>{
     const b=r?.payload,rows=b?.response?.order_list,o=rows?.[0],sn=r?.external_entity_id;
     if(!listHash||r?.channel_account_id!==accountId||!listed.includes(sn)||Object.hasOwn(details,sn)
      ||!requestId(b?.request_id)||!Array.isArray(rows)||rows.length!==1||o?.order_sn!==sn
      ||!cap(o.create_time,Math.floor(now()/1000))||typeof o.order_status!=='string'||!o.order_status||!await same())return {ok:false};
     // Preserve normal business fields, never buyer/address/invoice objects.
     const order=scalar(o,['order_sn','order_status','create_time','update_time','pay_time','ship_by_date','currency','total_amount','payment_method','shipping_carrier','split_up']);
     if(Array.isArray(o.item_list))order.item_list=o.item_list.map(i=>scalar(i,['item_id','model_id','item_sku','model_sku','item_name','model_name','model_quantity_purchased','model_original_price','model_discounted_price','weight']));
     if(Array.isArray(o.package_list))order.package_list=o.package_list.map(p=>scalar(p,['package_number','logistics_status']));
     const payload={request_id:b.request_id,response:{order_list:[order]}};
     const hash=sha256Hex(JSON.stringify(payload));
     const result=await persistDetail({...r,payload,payload_hash:hash},{timeoutMs:timeout()});
     if(result?.ok===true)details[sn]=hash;
     return result;
    }
   });
   if(!await same())return fail('d11_discovery_scope_refused');
   const read=await reader({timeFrom:s.time_from,timeTo:s.time_to,cursor:s.cursor,pageSize:s.page_size,timeRangeField:'update_time',
    responseOptionalFields:['item_list','package_list','split_up','total_amount','pay_time','ship_by_date','payment_method','shipping_carrier']});
   if(!within()||read?.ok!==true||read.shop_id!==s.shop_id||!listHash||!Array.isArray(listed)
     ||read.listed_count!==listed.length||read.detailed_count!==listed.length||read.more!==more
     ||(more&&read.next_cursor!==next)||Object.keys(details).length!==listed.length||!listed.every(sn=>Object.hasOwn(details,sn))
     ||!await same())return fail('d11_discovery_page_unconfirmed');
   // The SQL derives eligibility and cursor from the persisted page, not caller selection.
   try{
    const done=await adapters.finishDiscovery(scope,listHash,details);
    if(done?.status!=='finished'||done.listed!==listed.length||!Number.isSafeInteger(done.eligible)||done.eligible<0||done.eligible>done.listed)
      return {...fail('d11_discovery_checkpoint_unconfirmed'),checkpointAttempted:true};
    return {ok:true,code:'d11_discovery_checkpointed',listed:done.listed,eligible:done.eligible,leaseReleased:true,ordersWritten:0,effects:0};
   }catch{return {...fail('d11_discovery_checkpoint_unconfirmed'),checkpointAttempted:true};}
  }catch{return fail('d11_discovery_unavailable');}
 };
}

// Internal single-page round shares the preflight acquisition. No discovery
// and preflight are run concurrently for the same account. The existing
// durable lease is the exclusion boundary. A lost checkpoint acknowledgement
// is never followed by a second finish or an automatic replay.
export function createD11DiscoveryRound({enabled=false,now=Date.now,call,
 adapters=createD11BridgeAdapters({enabled,call}),
 discover=createD11DiscoveryPage({enabled,now,call,adapters})}={}){
 return async function run({accountId}={}){
  if(enabled!==true)return fail('d11_discovery_disabled');
  if(!id(accountId)||legacy.has(accountId.toLowerCase()))return fail('d11_discovery_scope_refused');
  const started=now();
  let lease;
  try{lease=await adapters.acquirePreflight(accountId)}catch{return fail('d11_discovery_acquire_unconfirmed');}
  if(lease?.status!=='acquired'||lease.channel_account_id!==accountId||!id(lease.lease_id)||!cap(lease.policy_revision,2147483647)
   ||!cap(lease.work_budget_ms,48000)||!Number.isFinite(Date.parse(lease.expires_at))
   ||!(lease.candidate_order_sn===null||(typeof lease.candidate_order_sn==='string'&&SN.test(lease.candidate_order_sn))))
   return fail('d11_discovery_acquire_unconfirmed');
  const scope={accountId,leaseId:lease.lease_id,revision:lease.policy_revision,orderSn:lease.candidate_order_sn};
  const deadline=Math.min(started+lease.work_budget_ms,Date.parse(lease.expires_at)-1000);
  let r;
  try{
   r=now()<deadline?await discover({accountId,leaseId:scope.leaseId,revision:scope.revision,deadline}):fail('d11_discovery_budget_exhausted');
  }catch{
   // Unknown whether the injected worker crossed the checkpoint boundary.
   return fail('d11_discovery_checkpoint_unconfirmed');
  }
  if(r?.ok===true&&r.code==='d11_discovery_checkpointed'&&r.leaseReleased===true&&r.ordersWritten===0&&r.effects===0)return r;
  if(!r||r.checkpointAttempted||r.ok===true)return fail('d11_discovery_checkpoint_unconfirmed');
  try{
   const f=await adapters.finishPreflight(scope,scope.orderSn===null?'d11_preflight_no_candidate':'d11_preflight_unavailable');
   if(f?.status!=='finished')return fail('d11_discovery_release_unconfirmed');
   return {...fail(r.code),leaseReleased:true};
  }catch{return fail('d11_discovery_release_unconfirmed');}
 };
}
