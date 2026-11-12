import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdaoF12IsolatedStepExecutor} from '../src/shopee-adao-isolated-step-executor.mjs';
import {createAdaoF12CanonicalSliceWriter} from '../src/shopee-adao-f12-canonical-slice-writer.mjs';
import {F12_3_SCOPE} from '../src/shopee-adao-resumable-discovery.mjs';

// F12.3 offline pilot. A stateful in-memory Core fake exercises the actual
// discovery/staging and canonical-slice writer adapters. ALL ORDER DATA HERE
// IS SYNTHETIC. This is not a live PostgreSQL concurrency test and must never
// be reported as production throughput homologation.
const SN='SYNTHETICF12ADAO11';
const ACCOUNT=F12_3_SCOPE.account;
const leaseId=g=>'11111111-1111-4111-8111-'+String(g).padStart(12,'0');
const start=Date.parse('2026-11-12T18:00:00.000Z');

function fakeCore(){
  const state={phase:'idle',generation:0,lease:null,expires:0,
    pages:null,completed:false,checkpoint:null,orders:new Set()};
  let ms=start;
  const now=()=>ms;
  const advance=n=>{ms+=n;};
  const scope=a=>assert.equal(a,ACCOUNT,'F12 account mismatch');
  async function acquire({channel_account_id}){
    scope(channel_account_id);
    if(state.phase==='staged')return {ok:false,status:409,payload:{status:'staged_requires_ack'}};
    if(state.expires>ms)return {ok:false,status:409,payload:{status:'busy'}};
    state.phase='reading';state.generation++;state.lease=leaseId(state.generation);
    state.expires=ms+180000;
    return {ok:true,payload:{status:'acquired',lease_id:state.lease,
      generation:state.generation,checkpoint:state.checkpoint}};
  }
  async function stage({channel_account_id,lease_id,generation,checkpoint,pages,completed}){
    scope(channel_account_id);
    if(state.phase!=='reading'||lease_id!==state.lease
      ||generation!==state.generation||state.expires<=ms)
      return {ok:false,status:409,payload:{status:'stale_lease'}};
    state.phase='staged';state.pages=structuredClone(pages);
    state.completed=completed;state.checkpoint=checkpoint;
    return {ok:true,payload:{status:'staged'}};
  }
  async function resume({channel_account_id}){
    scope(channel_account_id);
    if(state.phase!=='staged')return {ok:false,status:409,payload:{status:'nothing_staged'}};
    if(state.expires>ms)return {ok:false,status:409,payload:{status:'busy'}};
    state.generation++;state.lease=leaseId(state.generation);
    state.expires=ms+180000;
    return {ok:true,payload:{status:'resumed',lease_id:state.lease,
      generation:state.generation,staged_pages:structuredClone(state.pages),
      checkpoint:state.checkpoint,completed:state.completed}};
  }
  async function acknowledge({channel_account_id,lease_id,generation}){
    scope(channel_account_id);
    if(state.phase!=='staged'||state.expires<=ms||state.lease!==lease_id
      ||state.generation!==generation)
      return {ok:false,status:409,payload:{status:'stale_or_staged_requires_reconciliation'}};
    const ids=state.pages.flat();
    const reconciled=ids.filter(id=>state.orders.has(id)).length;
    if(reconciled!==ids.length)
      return {ok:false,status:409,payload:{status:'reconciliation_required',confirmed:reconciled}};
    state.phase='idle';state.pages=null;state.lease=null;state.expires=0;
    return {ok:true,payload:{status:'acknowledged',reconciled}};
  }
  return {state,now,advance,acquire,stage,resume,acknowledge};
}

function singlePageReader({wrongShop=false}={}){
  return async ({pageSize,timeRangeField,onlyIntakeEligibleOrders})=>{
    assert.equal(pageSize,10);
    assert.equal(timeRangeField,'update_time');
    assert.equal(onlyIntakeEligibleOrders,true);
    return {ok:true,shop_id:wrongShop?531736366:F12_3_SCOPE.shop,
      order_sns:[SN],more:false};
  };
}
function runner(db,reader=singlePageReader()){
  return createAdaoF12IsolatedStepExecutor({
    readOrders:reader,now:db.now,acquire:db.acquire,stage:db.stage,
    resume:db.resume,acknowledge:db.acknowledge});
}
function writer(db,intake){
  return createAdaoF12CanonicalSliceWriter({
    resume:db.resume,acknowledge:db.acknowledge,intake,
    now:db.now,enabled:true});
}

test('F12.3 supervised fixture: discovery stages one synthetic order, then canonical reconciliation ACK',async()=>{
  const db=fakeCore();const step=runner(db);
  const initial=await step('discover_one_slice');
  assert.deepEqual(initial,{ok:true,code:'read_only_pages_staged',pages:1,orders:1,completed:true});
  assert.equal(db.state.phase,'staged');
  assert.equal(db.state.orders.size,0);
  const writes=[];
  const commit=writer(db,async p=>{
    writes.push(p);
    db.state.orders.add(p.expectedOrderSn);
    return {ok:true,selected:1,roundStopped:false,
      results:[{orderSn:p.expectedOrderSn,status:'written'}]};
  });
  // No early recovery before expired staged lease; the Core retains quarantine.
  assert.equal((await commit({commit:true})).code,'f12_staged_busy');
  assert.equal(writes.length,0);
  db.advance(180001);
  const r=await commit({commit:true});
  assert.equal(r.ok,true);assert.equal(r.code,'f12_slice_canonically_reconciled');
  assert.equal(r.processed,1);assert.equal(r.written,1);
  assert.equal(db.state.phase,'idle');
  assert.equal(writes.length,1);
  assert.deepEqual(writes[0],{
    channelAccountId:ACCOUNT,expectedOrderSn:SN,
    limit:1,mode:'commit',verifyExisting:true,
  });
});

test('F12.3 interrupted commit quarantines stage; recovered duplicate is decided only by Core ACK',async()=>{
  const db=fakeCore();await runner(db)('discover_one_slice');
  db.advance(180001);
  let attempts=0;
  const uncertain=writer(db,async p=>{
    attempts++;
    db.state.orders.add(p.expectedOrderSn);
    throw Error('post-write network failure');
  });
  const uncertainResult=await uncertain({commit:true});
  assert.equal(uncertainResult.code,'f12_writer_uncertain');
  assert.equal(db.state.phase,'staged');
  assert.equal(attempts,1);
  assert.equal(db.state.orders.size,1);
  const next=writer(db,async()=>{
    attempts++;
    return {ok:false,code:'expected_order_unavailable'};
  });
  // Last resume held a new lease. No immediate automatic retry.
  assert.equal((await next({commit:true})).code,'f12_staged_busy');
  assert.equal(attempts,1);
  db.advance(180001);
  const r=await next({commit:true});
  assert.equal(r.ok,true);
  assert.equal(r.verified_filtered_by_core,1);
  assert.equal(r.written,0);
  assert.equal(db.state.phase,'idle');
  assert.equal(attempts,2);
});

test('F12.3 Core never ACKs a filtered order without canonical persistence',async()=>{
  const db=fakeCore();await runner(db)('discover_one_slice');
  db.advance(180001);
  const commit=writer(db,async()=>({ok:false,code:'expected_order_unavailable'}));
  const r=await commit({commit:true});
  assert.equal(r.code,'f12_core_reconciliation_blocked');
  assert.equal(db.state.phase,'staged');
  assert.equal(db.state.orders.size,0);
});

test('F12.3 wrong shop and invalid discovery do not stage or write',async()=>{
  const db=fakeCore();
  const step=runner(db,singlePageReader({wrongShop:true}));
  const r=await step('discover_one_slice');
  assert.equal(r.ok,false);
  assert.equal(db.state.phase,'reading'); // acquired but no stage
  assert.equal(db.state.pages,null);
  assert.equal(db.state.orders.size,0);
  // Lease naturally expires; no automatic stage overwrite.
  db.advance(180001);
  assert.equal((await db.resume({channel_account_id:ACCOUNT})).payload.status,'nothing_staged');
});

test('F12.3 pilot readiness cannot activate any of the real execution paths',async()=>{
  const db=fakeCore();
  let calls=0;
  const canWrite=writer(db,async()=>{calls++;throw Error('must stay off');});
  assert.equal((await canWrite()).code,'f12_canonical_writer_disabled');
  assert.equal(calls,0);
  assert.equal(db.state.phase,'idle');
});
