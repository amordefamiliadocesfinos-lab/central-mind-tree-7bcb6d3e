import test from 'node:test';
import assert from 'node:assert/strict';
import {createD11RecurringPreflight} from '../src/shopee-d11-recurring-preflight.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',L='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',I='cccccccc-cccc-4ccc-8ccc-cccccccccccc',R='dddddddd-dddd-4ddd-8ddd-dddddddddddd',O='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',S='SYNTHETIC001';
const N=Date.parse('2026-11-27T22:00:00Z'),iso=x=>new Date(x).toISOString();
const scope={accountId:A,leaseId:L,revision:1};
function fixture(intakeCommitEnabled=false){
 const f={calls:[],time:N,enabled:true,scope:{ok:true,...scope,partnerId:2047685,shopId:123,orderSn:S,
  expiresAt:iso(N+60000),workBudgetMs:48000,maxActionsPerCycle:1,pageSize:5},
  observation:{ok:true,code:'observation_recorded',orderSn:S,shopId:123,observationId:I,rawId:R,ordersWritten:0},
  batch:{channel_account_id:A,marketplace_account:'SYNTHETIC',snapshots:[{
   source:'shopee_open_platform',environment:'live',channel_account_id:A,external_entity_type:'order',
   external_entity_id:S,endpoint:'/api/v2/order/get_order_detail',observed_at:iso(N),created_at:iso(N),
   payload:{response:{order_list:[{order_sn:S,order_status:'PROCESSED',create_time:Math.floor(N/1000)-120,total_amount:20.21,
    payment_method:'Pix',item_list:[{item_id:'23298665306',model_id:'0',item_name:'Alfajor 60g | SH-002-015',
     model_name:'',item_sku:'',model_sku:'',model_quantity_purchased:1,model_original_price:20.21,model_discounted_price:20.21}]}]}}
  }],mappings:[{id:I,marketplace:'shopee',marketplace_account:'SYNTHETIC',channel_account_id:A,
   external_item_key:'code:SH-002-015|variation:',product_id:R,variant_id:L,physical_multiplier:3,
   components:[{product_id:R,variant_id:L,physical_multiplier:3,position:0,physical_identity:{active:true,unit:'un',presentation_factors:[3]}},
    {product_id:R,variant_id:O,physical_multiplier:3,position:1,physical_identity:{active:true,unit:'un',presentation_factors:[3]}}]}]},
  proof:{ok:true,status:'verified_existing',channel_account_id:A,order_number:S,order_id:O,observation_id:I,raw_id:R}};
 f.canonicalState='absent';f.commitReply={status:'intake_written',channel_account_id:A,order_number:S,observation_id:I,order_id:O,separation_id:L};
 if(intakeCommitEnabled){f.batch.mappings[0].external_item_id='23298665306';f.batch.mappings[0].external_model_id='0';}
 f.run=createD11RecurringPreflight({enabled:true,intakeCommitEnabled,now:()=>f.time,
  adapters:{readScope:async()=>{f.calls.push('scope');return f.scope},
   readIntake:async p=>{f.calls.push('classify');assert.equal(p.observationId,I);
    return {status:'intake_batch',canonical_state:f.canonicalState,channel_account_id:A,order_sn:S,observation_id:I,raw_id:R,batch:f.batch}},
   commitIntake:async(p,projection)=>{f.calls.push('commit');assert.equal(p.observationId,I);
    assert.equal(projection.channel_account_id,A);assert.equal(projection.order_number,S);
    assert.deepEqual(projection.items.map(i=>i.quantity),[3,3]);if(f.lateCommit)f.time=N+48001;return f.commitReply},
   readReconciliation:async p=>{f.calls.push('batch');assert.equal(p.observationId,I);return {status:'reconciliation_batch',channel_account_id:A,order_sn:S,observation_id:I,raw_id:R,batch:f.batch}},
   verifyReconciliation:async(p,projection)=>{f.calls.push('verify');assert.equal(p.observationId,I);
    assert.equal(projection.channel_account_id,A);assert.equal(projection.order_number,S);
    assert.deepEqual(projection.items.map(i=>i.quantity),[3,3]);return f.proof},
   claimEffect:async()=>assert.fail('preflight cannot claim')},
  observe:async p=>{f.calls.push('observe');assert.equal(p.deadline,N+48000);if(f.expire)f.time=N+48001;return f.observation}});
 return f;
}
test('D11 preflight executes real mapping and projection in reconcile mode, not effects',async()=>{
 const f=fixture(),r=await f.run({...scope,orderSn:'OTHERORDER1'});
 assert.deepEqual(f.calls,['scope','observe','batch','verify']);assert.equal(r.ok,true);
 assert.equal(r.orderId,O);assert.equal(r.observationId,I);assert.equal(r.outcome,'pending');
 assert.equal(r.ordersWritten,0);assert.equal(r.effects,0);assert.equal(r.effectAuthorized,false);
});
test('D11 preflight default-off and legacy refusal precede dependencies',async()=>{
 const disabled=createD11RecurringPreflight({adapters:{readScope:()=>assert.fail('disabled')}});
 assert.equal((await disabled(scope)).code,'d11_preflight_disabled');
 const f=fixture();assert.equal((await f.run({...scope,accountId:'b4027369-5abf-4ac1-ab24-862334fae892'})).ok,false);
 assert.deepEqual(f.calls,[]);
});
test('D11 rejects invalid budget or identity and stops after expired observation',async()=>{
 for(const change of [f=>f.scope.workBudgetMs=48001,f=>f.scope.maxActionsPerCycle=0,f=>f.scope.revision=2]){
  const f=fixture();change(f);assert.equal((await f.run(scope)).ok,false);assert.deepEqual(f.calls,['scope']);
 }
 const f=fixture();f.expire=true;assert.equal((await f.run(scope)).code,'d11_preflight_budget_exhausted');
 assert.deepEqual(f.calls,['scope','observe']);
});
test('D11 refuses observation mismatch or changed reconciliation proof without fallback',async()=>{
 const f=fixture();f.observation.shopId=999;assert.equal((await f.run(scope)).ok,false);assert.deepEqual(f.calls,['scope','observe']);
 for(const change of [f=>f.proof.observation_id=O,f=>f.proof.raw_id=O,f=>f.proof.ok=false]){
  const g=fixture();change(g);assert.equal((await g.run(scope)).ok,false);assert.deepEqual(g.calls,['scope','observe','batch','verify']);
 }
});
test('D11 unmapped candidate is blocked without canonical verify or creation',async()=>{
 const f=fixture();f.batch.mappings=[];
 assert.equal((await f.run(scope)).ok,false);assert.deepEqual(f.calls,['scope','observe','batch']);
});

test('D11 explicit protected intake reuses canonical commercial pipeline and confirms one write only for absent order',async()=>{
 const f=fixture(true),r=await f.run(scope);
 assert.equal(r.ok,true);assert.equal(r.code,'d11_intake_written');assert.equal(r.ordersWritten,1);
 assert.equal(r.separationId,L);assert.equal(r.effectAuthorized,false);assert.equal(r.outcome,'pending');
 assert.deepEqual(f.calls,['scope','observe','classify','commit']);
});
test('D11 existing order uses reconciliation only, even if verification fails',async()=>{
 for(const ok of [true,false]){
 const f=fixture(true);f.canonicalState='existing';f.proof.ok=ok;
 const r=await f.run(scope);assert.equal(r.ok,ok);assert.equal(r.ordersWritten,0);
 assert.deepEqual(f.calls,['scope','observe','classify','verify']);}
});
test('D11 aliases and uncertain canonical identity never authorize a protected write',async()=>{
 const f=fixture(true);delete f.batch.mappings[0].external_item_id;delete f.batch.mappings[0].external_model_id;
 assert.equal((await f.run(scope)).ok,false);assert.deepEqual(f.calls,['scope','observe','classify']);
 const g=fixture(true);g.canonicalState='unknown';
 assert.equal((await g.run(scope)).ok,false);assert.deepEqual(g.calls,['scope','observe','classify']);
});
test('D11 lost ACK is unknown and confirmed late write is preserved without another action',async()=>{
 const f=fixture(true);f.commitReply=null;const a=await f.run(scope);
 assert.equal(a.code,'d11_intake_commit_unconfirmed');assert.equal(a.ordersWritten,null);assert.equal(a.reconciliationRequired,true);
 assert.deepEqual(f.calls,['scope','observe','classify','commit']);
 const g=fixture(true);g.lateCommit=true;const b=await g.run(scope);
 assert.equal(b.code,'d11_intake_written_requires_reconciliation');assert.equal(b.ordersWritten,1);assert.equal(b.reconciliationRequired,true);
 assert.deepEqual(g.calls,['scope','observe','classify','commit']);
});
