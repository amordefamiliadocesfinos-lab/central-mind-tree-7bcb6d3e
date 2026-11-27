import test from 'node:test';
import assert from 'node:assert/strict';
import {createProtectedReconciliationReader} from '../../../supabase/functions/integration-core-bridge/cycle-reconciliation-reader.mjs';
import {sanitizeIntakeSnapshot} from '../../../supabase/functions/integration-core-bridge/shopee-intake-read-shared.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',L='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',I='cccccccc-cccc-4ccc-8ccc-cccccccccccc',S='SYNTHETIC001';
const NOW=Date.parse('2026-11-27T22:00:00Z'), iso=t=>new Date(t).toISOString();
function fixture(){
 const f={calls:[],valid:true,revision:1,policy:true,
  state:{channel_account_id:A,lease_id:L,lease_policy_revision:1,lease_expires_at:iso(NOW+60000),candidate_order_sn:S,updated_at:iso(NOW-10000),halted_code:null},
  queue:{channel_account_id:A,order_sn:S,state:'pending'},
  rows:[{channel_account_id:A,external_entity_id:S,observed_at:iso(NOW-1000),created_at:iso(NOW-1000),payload_hash:'a'.repeat(64),
   payload:{response:{order_list:[{order_sn:S,create_time:NOW/1000-120,order_status:'READY_TO_SHIP',split_up:false,
   recipient_address:{name:'private fixture'},item_list:[{item_id:123,model_id:456,buyer_private:'redact'}],
   package_list:[{package_number:'PKG1',logistics_status:'LOGISTICS_READY'}]}]}}}]};
 const core={from(table){
  f.calls.push(table);
  const q={select(){return q},eq(){return q},order(){return q},limit(n){assert.equal(n,2);return Promise.resolve({data:f.rows})},
   maybeSingle(){return Promise.resolve({data:table==='shopee_cycle_state'?f.state:f.queue})}};
  return q;
 }};
 f.run=createProtectedReconciliationReader(core,{
   now:()=>NOW,readPolicy:async()=>({ok:f.policy,profile:{account:A,revision:f.revision,partner:2047685,shop:123,
    action:'intake',history_cutoff:NOW/1000-3600,expires_at:iso(NOW+60000)}}),
   checkLease:async()=>({ok:f.valid}),
   readAccount:async()=>({account:{id:A,name:'SYNTHETIC'}}),
   readMappings:async()=>({mappings:[{id:'m1'}]}),attachPhysical:async(_core,mappings)=>({mappings}),
   verifyOrder:async(_core,payload)=>{f.calls.push('verify');return {ok:true,status:'verified_existing',channel_account_id:A,order_number:payload.order_number,order_id:I};}
 });
 return f;
}
const scope={accountId:A,leaseId:L,revision:1};
const batch={channel_account_id:A,order_sn:S,limit:1};
const projection={channel_account_id:A,order_number:S,items:[]};
test('D11 protected reader uses exact Core candidate, redacts snapshot and verifies only once',async()=>{
 const f=fixture(),r=await f.run({...scope,orderSn:'OTHERORDER1'});
 assert.equal(r.ok,true);assert.equal(r.orderSn,S);
 assert.equal((await r.readExistingBatch({...batch,order_sn:'OTHERORDER1'})).ok,false);
 assert.equal((await r.verifyCanonicalOrder(projection)).ok,false);
 const b=await r.readExistingBatch(batch);
 assert.equal(b.ok,true);assert.equal(b.payload.channel_account_id,A);
 const o=b.payload.snapshots[0].payload.response.order_list[0];
 assert.equal(o.order_sn,S);assert.equal(o.recipient_address,undefined);assert.equal(o.item_list[0].buyer_private,undefined);
 assert.equal((await r.readExistingBatch(batch)).ok,false);
 assert.equal((await r.verifyCanonicalOrder({...projection,order_number:'OTHERORDER1'})).ok,false);
 assert.equal((await r.verifyCanonicalOrder(projection)).order_id,I);
 assert.equal((await r.verifyCanonicalOrder(projection)).ok,false);
 assert.equal(f.calls.filter(x=>x==='verify').length,1);
});
test('D11 rejects stale/ambiguous Raw, wrong candidate, cutoff and uncertain package',async()=>{
 for(const alter of [
 f=>f.rows[0].observed_at=iso(NOW-20000),f=>f.rows.push(structuredClone(f.rows[0])),
 f=>f.rows[0].channel_account_id=I,f=>f.queue.state='blocked',f=>f.state.candidate_order_sn='OTHERORDER1',
 f=>f.rows[0].payload.response.order_list[0].create_time=NOW/1000-4000,
 f=>delete f.rows[0].payload.response.order_list[0].split_up,
 f=>f.rows[0].payload.response.order_list[0].package_list.push({package_number:'PKG2'}),
 f=>f.rows[0].payload.response.order_list[0].order_status='SHIPPED'
 ]){const f=fixture();alter(f);assert.equal((await f.run(scope)).ok,false);assert.equal(f.calls.includes('verify'),false);}
});
test('D11 denies missing policy, lease, different revision and legacy scope',async()=>{
 for(const alter of [f=>f.policy=false,f=>f.valid=false,f=>f.revision=2,f=>f.state.lease_policy_revision=2]){
 const f=fixture();alter(f);assert.equal((await f.run(scope)).ok,false);}
 assert.equal((await fixture().run({...scope,accountId:'b4027369-5abf-4ac1-ab24-862334fae892'})).ok,false);
});
test('D11 policy pause and Raw drift after batch invalidate reconciliation',async()=>{
 for(const alter of [f=>f.valid=false,f=>f.rows[0].payload_hash='b'.repeat(64),f=>f.state.lease_id=I]){
 const f=fixture(),r=await f.run(scope);assert.equal((await r.readExistingBatch(batch)).ok,true);
 alter(f);assert.equal((await r.verifyCanonicalOrder(projection)).ok,false);assert.equal(f.calls.includes('verify'),false);}
});
test('shared sanitizer preserves original mapping fields while removing raw private fields',()=>{
 const f=fixture(),s=sanitizeIntakeSnapshot(f.rows[0]),o=s.payload.response.order_list[0];
 assert.equal(o.item_list[0].item_id,123);assert.equal(o.item_list[0].model_id,456);
 assert.equal(o.recipient_address,undefined);assert.equal(o.package_list,undefined);
 assert.equal(s.external_entity_id,S);
});
