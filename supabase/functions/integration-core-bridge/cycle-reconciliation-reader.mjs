// D11 internal read-only adapter, not exposed by any bridge route.
import {readCyclePolicy,checkCyclePolicyLease} from './cycle-policy-reader.mjs';
import {verifyCycleExistingOrder} from './cycle.mjs';
import {sanitizeIntakeSnapshot,canonicalShopeeChannelAccount} from './shopee-intake-read-shared.mjs';
import {readShopeeScopedMappingCatalog} from './shopee-intake-mapping-catalog.mjs';
import {attachMappingPhysicalCatalog} from './mapping-physical-catalog.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SN=/^[A-Za-z0-9]{8,100}$/;
const PACKAGE=/^[A-Za-z0-9_-]{1,100}$/;
const denied=code=>({ok:false,code});
const legacy=new Set(['8a8ad166-0317-4597-8be6-e43fb46b4d1b','b4027369-5abf-4ac1-ab24-862334fae892']);
export function createProtectedReconciliationReader(core,{
 now=Date.now,readPolicy=readCyclePolicy,checkLease=checkCyclePolicyLease,
 readAccount=canonicalShopeeChannelAccount,readMappings=readShopeeScopedMappingCatalog,
 attachPhysical=attachMappingPhysicalCatalog,verifyOrder=verifyCycleExistingOrder
}={}){
 return async function prepare({accountId,leaseId,revision}={}){
  if(!UUID.test(accountId??'')||!UUID.test(leaseId??'')||!Number.isSafeInteger(revision)||revision<1||legacy.has(accountId))
    return denied('reconcile_scope_invalid');
  const scope={accountId,leaseId,revision,action:'intake'};
  let initial=null, attempted=false, served=false, consumed=false;
  async function inspect(){
   const time=now();
   const admitted=await readPolicy(core,{accountId,action:'intake',now:time});
   const p=admitted?.profile;
   if(!admitted?.ok||p?.account!==accountId||p.revision!==revision||p.partner!==2047685
     ||!Number.isSafeInteger(p.shop)||p.shop<=0||p.action!=='intake'
     ||!Number.isSafeInteger(p.history_cutoff)||!(Date.parse(p.expires_at)>time))
     return denied('reconcile_policy_refused');
   if(!(await checkLease(core,scope))?.ok)return denied('reconcile_lease_refused');
   const state=await core.from('shopee_cycle_state')
    .select('channel_account_id,lease_id,lease_policy_revision,lease_expires_at,candidate_order_sn,updated_at,halted_code')
    .eq('channel_account_id',accountId).maybeSingle();
   const v=state.data;
   if(state.error||!v||v.channel_account_id!==accountId||v.lease_id!==leaseId||v.lease_policy_revision!==revision
     ||v.halted_code!==null||!SN.test(v.candidate_order_sn??'')||!(Date.parse(v.lease_expires_at)>now())
     ||!Number.isFinite(Date.parse(v.updated_at))||Date.parse(v.updated_at)>now())
     return denied('reconcile_candidate_refused');
   const orderSn=v.candidate_order_sn;
   const queue=await core.from('shopee_cycle_orders').select('channel_account_id,order_sn,state')
    .eq('channel_account_id',accountId).eq('order_sn',orderSn).maybeSingle();
   if(queue.error||queue.data?.state!=='pending'||queue.data.channel_account_id!==accountId||queue.data.order_sn!==orderSn)
     return denied('reconcile_candidate_refused');
   const raw=await core.from('marketplace_raw_snapshots')
    .select('channel_account_id,external_entity_id,observed_at,created_at,payload,payload_hash')
    .eq('channel_account_id',accountId).eq('source','shopee_open_platform').eq('environment','live')
    .eq('external_entity_type','order').eq('endpoint','/api/v2/order/get_order_detail')
    .eq('external_entity_id',orderSn).order('observed_at',{ascending:false}).limit(2);
   if(raw.error||!Array.isArray(raw.data)||!raw.data.length)return denied('reconcile_raw_unavailable');
   const row=raw.data[0], t=Date.parse(row?.observed_at);
   if(!Number.isFinite(t)||t<Date.parse(v.updated_at)||t>now())return denied('reconcile_raw_not_fresh');
   if(raw.data.length>1&&Date.parse(raw.data[1]?.observed_at)===t)return denied('reconcile_raw_ambiguous');
   const list=row.payload?.response?.order_list, o=list?.[0], pkg=o?.package_list?.[0];
   if(row.channel_account_id!==accountId||row.external_entity_id!==orderSn||!Array.isArray(list)||list.length!==1
     ||o?.order_sn!==orderSn||!Number.isSafeInteger(o.create_time)||o.create_time<=p.history_cutoff
     ||o.create_time>Math.floor(now()/1000)||!Array.isArray(o.package_list)||o.package_list.length!==1
     ||!PACKAGE.test(pkg?.package_number??'')||typeof o.split_up!=='boolean'
     ||!((o.order_status==='READY_TO_SHIP'&&pkg.logistics_status==='LOGISTICS_READY')
        ||(o.order_status==='PROCESSED'&&pkg.logistics_status==='LOGISTICS_REQUEST_CREATED'))
     ||typeof row.payload_hash!=='string'||!/^[0-9a-f]{64}$/.test(row.payload_hash))
      return denied('reconcile_raw_identity_refused');
   if(!(await checkLease(core,scope))?.ok)return denied('reconcile_lease_refused');
   return {ok:true,row,orderSn,shop:p.shop,packageNumber:pkg.package_number,observedAt:row.observed_at,hash:row.payload_hash};
  }
  const unchanged=x=>x?.ok===true&&x.orderSn===initial.orderSn&&x.shop===initial.shop
   &&x.packageNumber===initial.packageNumber&&x.hash===initial.hash&&x.observedAt===initial.observedAt;
  try{
   initial=await inspect();
   if(!initial.ok)return initial;
   const account=await readAccount(core,accountId);
   if(account?.unavailable||account?.account?.id!==accountId||!account.account.name)
    return denied('reconcile_account_unavailable');
   const catalog=await readMappings(core,accountId,account.account.name);
   if(catalog?.error||!Array.isArray(catalog?.mappings))return denied('reconcile_mapping_unavailable');
   const physical=await attachPhysical(core,catalog.mappings);
   if(physical?.error||!Array.isArray(physical?.mappings))return denied('reconcile_mapping_unavailable');
   if(!unchanged(await inspect()))return denied('reconcile_scope_changed');
   const snapshot=sanitizeIntakeSnapshot(initial.row);
   return {ok:true,code:'reconcile_reader_prepared',orderSn:initial.orderSn,
    readExistingBatch:async request=>{
     if(attempted||request?.channel_account_id!==accountId||request?.order_sn!==initial.orderSn||request?.limit!==1)
      return denied('reconcile_scope_invalid');
     attempted=true;
     try{
      if(!unchanged(await inspect()))return denied('reconcile_scope_changed');
      served=true;
      return {ok:true,payload:{channel_account_id:accountId,marketplace_account:account.account.name,
       snapshots:[snapshot],mappings:physical.mappings}};
     }catch{return denied('reconcile_read_unavailable');}
    },
    verifyCanonicalOrder:async request=>{
     if(!served||consumed||request?.channel_account_id!==accountId||request?.order_number!==initial.orderSn)
      return denied('reconcile_scope_invalid');
     consumed=true;
     try{
      if(!unchanged(await inspect()))return denied('reconcile_scope_changed');
      const proof=await verifyOrder(core,request);
      if(proof?.ok!==true||proof.status!=='verified_existing'||proof.channel_account_id!==accountId
        ||proof.order_number!==initial.orderSn||!UUID.test(proof.order_id??''))
        return denied('canonical_order_unverified');
      if(!unchanged(await inspect()))return denied('reconcile_scope_changed');
      return proof;
     }catch{return denied('reconcile_read_unavailable');}
    }};
  }catch{return denied('reconcile_read_unavailable');}
 };
}
