import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdaoDurableDiscoveryStage, makeAdaoReadOnlyStager } from '../src/shopee-adao-durable-stage.mjs';
import { F12_3_SCOPE } from '../src/shopee-adao-resumable-discovery.mjs';

const now=()=>Date.parse('2026-11-12T18:00:00Z');
const ids=Array.from({length:100},(_,i)=>'261112'+String(i).padStart(8,'0'));

function fakeCore() {
  let checkpoint=null,phase='idle',lease=0,generation=0,staged=null;
  const acquire=async ({channel_account_id})=>{
    assert.equal(channel_account_id,F12_3_SCOPE.account);
    if(phase!=='idle')return {ok:false,payload:{status:'busy'}};
    phase='reading'; generation++;lease++;
    return {ok:true,payload:{status:'acquired',lease_id:'lease-'+lease,generation,checkpoint}};
  };
  const stage=async ({channel_account_id,lease_id,generation:gen,checkpoint:next,pages,completed})=>{
    assert.equal(channel_account_id,F12_3_SCOPE.account);
    if(phase!=='reading'||lease_id!=='lease-'+lease||gen!==generation)
      return {ok:false,payload:{status:'stale_lease'}};
    phase='staged';staged={next,pages,completed};
    return {ok:true,payload:{status:'staged',generation}};
  };
  const ackAfterSyntheticReconciliation=()=>{
    assert.equal(phase,'staged');
    checkpoint=staged.next;phase='idle';staged=null;
  };
  return {acquire,stage,ackAfterSyntheticReconciliation,getPhase:()=>phase};
}

test('F12.3: ten pages / 100 synthetic orders staged and acknowledged across five leases',async()=>{
  const core=fakeCore();const readCalls=[];
  const reader=async ({cursor,timeFrom,timeTo,pageSize})=>{
    readCalls.push({cursor,timeFrom,timeTo,pageSize});
    const i=cursor===null?0:Number(cursor.slice(1));
    return {ok:true,shop_id:F12_3_SCOPE.shop,order_sns:ids.slice(i*10,i*10+10),
      more:i<9,next_cursor:i<9?'p'+(i+1):null};
  };
  const stager=makeAdaoReadOnlyStager({readOrders:reader,now,...core});
  for(let i=0;i<5;i++){
    const result=await stager();
    assert.equal(result.ok,true);
    assert.equal(result.pages,2);
    assert.equal(result.orders,20);
    assert.equal(result.completed,i===4);
    assert.equal(core.getPhase(),'staged');
    const blocked=await stager();
    assert.equal(blocked.ok,false);
    assert.equal(blocked.code,'checkpoint_busy_or_unavailable');
    // This ACK simulates external verification that every staged page has
    // been safely reconciled. The runner itself NEVER acknowledges.
    core.ackAfterSyntheticReconciliation();
  }
  assert.equal(readCalls.length,10);
  assert.ok(readCalls.every(c=>c.timeFrom===readCalls[0].timeFrom
    && c.timeTo===readCalls[0].timeTo));
});

test('F12.3: uncertain persistence never acknowledges or retries staged data',async()=>{
  let calls=0;
  const runner=createAdaoDurableDiscoveryStage({
    acquire:async()=>({ok:true,payload:{status:'acquired',lease_id:'lease',generation:1,checkpoint:null}}),
    readSlice:async()=>({ok:true,page_orders:[['26111200000001']],checkpoint:null,
      pages_in_slice:1,completed:true}),
    stage:async()=>{calls++;throw new Error('network uncertain');},
  });
  assert.equal((await runner()).code,'checkpoint_stage_uncertain');
  assert.equal(calls,1);
});

test('F12.3: busy lease and discovery exception never stage data',async()=>{
  let writes=0;
  const stage=async()=>{writes++;return {ok:true,payload:{status:'staged'}};};
  const runner=createAdaoDurableDiscoveryStage({
    acquire:async()=>({ok:false,payload:{status:'busy'}}),
    readSlice:async()=>{throw Error('must not read');},stage,
  });
  assert.equal((await runner()).code,'checkpoint_busy_or_unavailable');
  assert.equal(writes,0);
  const broken=createAdaoDurableDiscoveryStage({
    acquire:async()=>({ok:true,payload:{status:'acquired',lease_id:'a',generation:1,checkpoint:null}}),
    readSlice:async()=>{throw Error('API failed');},stage,
  });
  assert.equal((await broken()).code,'discovery_exception');
  assert.equal(writes,0);
});

test('F12.3: successful staged report never exposes cursor, order IDs or lease',async()=>{
  const text='SENSITIVE_CURSOR';
  const runner=createAdaoDurableDiscoveryStage({
    acquire:async()=>({ok:true,payload:{status:'acquired',lease_id:'secretlease',generation:1,
      checkpoint:null}}),
    readSlice:async()=>({ok:true,page_orders:[['26111200000001']],pages_in_slice:1,
      checkpoint:{cursor:text},completed:false}),
    stage:async data=>{
      assert.equal(data.checkpoint.cursor,text);
      return {ok:true,payload:{status:'staged'}};
    },
  });
  const output=JSON.stringify(await runner());
  assert.ok(!output.includes(text));
  assert.ok(!output.includes('secretlease'));
  assert.ok(!output.includes('26111200000001'));
});
