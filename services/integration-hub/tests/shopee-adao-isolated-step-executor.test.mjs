import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdaoF12IsolatedStepExecutor } from '../src/shopee-adao-isolated-step-executor.mjs';
import { F12_3_SCOPE } from '../src/shopee-adao-resumable-discovery.mjs';

const NOW=Date.parse('2026-11-12T18:00:00Z');
const IDS=Array.from({length:100},(_,i)=>'261112'+String(i).padStart(8,'0'));
function createFakeCore({canonical=true}={}) {
  let phase='idle', checkpoint=null, staged=null, generation=0, resumeCalls=0, ackCalls=0;
  let leaseId=null, leaseExpired=false, committedPages=0, canon=new Set();
  return {
    acquire:async({channel_account_id})=>{
      assert.equal(channel_account_id,F12_3_SCOPE.account);
      if(phase!=='idle')return {ok:false,status:409,payload:{status:'blocked',code:'busy'}};
      phase='reading';generation++;leaseId='lease-'+generation;leaseExpired=false;
      return {ok:true,payload:{status:'acquired',checkpoint,lease_id:leaseId,generation}};
    },
    stage:async({channel_account_id,lease_id,generation:g,checkpoint:next,pages,completed})=>{
      assert.equal(channel_account_id,F12_3_SCOPE.account);
      if(phase!=='reading'||g!==generation||lease_id!==leaseId) throw Error('stale');
      staged={pages,next,completed};phase='staged';committedPages+=pages.length;
      // Simulated existing order import is independent of this step executor:
      if(canonical)for(const id of pages.flat())canon.add(id);
      return {ok:true,payload:{status:'staged',generation}};
    },
    resume:async({channel_account_id})=>{
      assert.equal(channel_account_id,F12_3_SCOPE.account);
      resumeCalls++;
      if(phase!=='staged'||!leaseExpired)return {ok:false,status:409,payload:{status:'blocked',code:'busy'}};
      generation++;leaseId='lease-'+generation;leaseExpired=false;
      return {ok:true,payload:{status:'resumed',lease_id:leaseId,generation,
        staged_pages:staged.pages,completed:staged.completed}};
    },
    acknowledge:async({channel_account_id,lease_id,generation:g})=>{
      ackCalls++;
      assert.equal(channel_account_id,F12_3_SCOPE.account);
      if(phase!=='staged'||lease_id!==leaseId||g!==generation)
        return {ok:false,status:409,payload:{status:'blocked',code:'stale_lease'}};
      if(staged.pages.flat().some(id=>!canon.has(id)))
        return {ok:false,status:409,payload:{status:'blocked',code:'reconciliation_required'}};
      checkpoint=staged.next;phase='idle';staged=null;
      return {ok:true,payload:{status:'acknowledged'}};
    },
    expire:()=>{leaseExpired=true;},
    get:()=>({phase,checkpoint,committedPages,resumeCalls,ackCalls}),
    reconcileOrder:id=>canon.add(id),
  };
}
const reader=async({cursor})=>{
  const i=cursor==null?0:Number(cursor.slice(1));
  return {ok:true,shop_id:F12_3_SCOPE.shop,
    order_sns:IDS.slice(i*10,i*10+10),more:i<9,
    next_cursor:i<9?'p'+(i+1):null};
};

test('F12.3 100 synthetic orders through one-step executor, five durable slices',async()=>{
  const core=createFakeCore();
  const step=createAdaoF12IsolatedStepExecutor({
    readOrders:reader,now:()=>NOW,...core,
  });
  const exposed=[];
  for(let i=0;i<5;i++){
    const s=await step('discover_one_slice');
    assert.deepEqual(s,{ok:true,code:'read_only_pages_staged',
      pages:2,orders:20,completed:i===4});
    exposed.push(s);
    assert.equal(core.get().phase,'staged');
    assert.equal((await step('discover_one_slice')).ok,false);
    assert.equal((await step('reconcile_staged')).ok,false); // unexpired lease
    core.expire();
    const ack=await step('reconcile_staged');
    assert.deepEqual(ack,{ok:true,code:'stage_reconciled',
      pages:2,orders:20,completed:i===4});
  }
  assert.equal(core.get().committedPages,10);
  assert.equal(core.get().phase,'idle');
  assert.ok(!JSON.stringify(exposed).includes(IDS[0]));
});

test('F12.3 missing canonical order cannot advance cursor or start next slice',async()=>{
  const core=createFakeCore({canonical:false});
  const step=createAdaoF12IsolatedStepExecutor({
    readOrders:reader,now:()=>NOW,...core,
  });
  const s=await step('discover_one_slice');
  assert.equal(s.ok,true);
  core.expire();
  assert.deepEqual(await step('reconcile_staged'),{
    ok:false,code:'reconciliation_blocked',
  });
  assert.equal(core.get().phase,'staged');
  assert.equal(core.get().checkpoint,null);
  assert.equal((await step('discover_one_slice')).ok,false);
});

test('F12.3 rejects unknown operations before Core or Shopee calls',async()=>{
  let calls=0;
  const step=createAdaoF12IsolatedStepExecutor({
    readOrders:async()=>{calls++;throw Error('should not read');},
    acquire:async()=>{calls++;throw Error('should not acquire');},
    stage:async()=>{calls++;throw Error('should not stage');},
    resume:async()=>{calls++;throw Error('should not resume');},
    acknowledge:async()=>{calls++;throw Error('should not ack');},
  });
  assert.deepEqual(await step('auto_loop'),{ok:false,code:'invalid_operation'});
  assert.equal(calls,0);
});
