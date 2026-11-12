import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdaoF12StageReconciler } from '../src/shopee-adao-stage-reconcile.mjs';
import { F12_3_SCOPE } from '../src/shopee-adao-resumable-discovery.mjs';

const one={ok:true,payload:{status:'resumed',lease_id:'99999999-9999-4999-8999-999999999999',
  generation:3,staged_pages:[['26111200000001']],completed:false}};

test('F12.3: resumed stage passes exact fenced token to Core ACK only',async()=>{
  let count=0;
  const fn=createAdaoF12StageReconciler({
    resume:async args=>{assert.equal(args.channel_account_id,F12_3_SCOPE.account);return one;},
    acknowledge:async args=>{
      count++;
      assert.deepEqual(args,{channel_account_id:F12_3_SCOPE.account,
        lease_id:one.payload.lease_id,generation:3});
      return {ok:true,payload:{status:'acknowledged',reconciled:1}};
    },
  });
  const r=await fn();
  assert.deepEqual(r,{ok:true,code:'stage_reconciled',completed:false,pages:1,orders:1});
  assert.equal(count,1);
});

test('F12.3: absent, busy or malformed stage never ACKs',async()=>{
  let called=0;
  for(const response of [
    {ok:false,status:409,payload:{status:'blocked',code:'busy'}},
    {ok:false,status:503},
    {ok:true,payload:{status:'resumed',lease_id:'secret',generation:4,staged_pages:[]}},
    {ok:true,payload:{status:'resumed',lease_id:'secret',generation:4,
      staged_pages:[['INVALID#ID']],completed:false}},
  ]){
    const fn=createAdaoF12StageReconciler({
      resume:async()=>response,acknowledge:async()=>{called++;throw Error('must not be called');},
    });
    assert.equal((await fn()).ok,false);
  }
  assert.equal(called,0);
});

test('F12.3: SQL reconciliation 409 retains stage, no client-side retry',async()=>{
  let calls=0;
  const fn=createAdaoF12StageReconciler({
    resume:async()=>one,
    acknowledge:async()=>{
      calls++;
      return {ok:false,status:409,payload:{status:'blocked',code:'reconciliation_required'}};
    },
  });
  assert.deepEqual(await fn(),{ok:false,code:'reconciliation_blocked'});
  assert.equal(calls,1);
});

test('F12.3: lost ACK response is uncertain, never automatically retried',async()=>{
  let calls=0;
  const fn=createAdaoF12StageReconciler({
    resume:async()=>one,
    acknowledge:async()=>{calls++;throw new Error('network failed after commit');},
  });
  assert.deepEqual(await fn(),{ok:false,code:'ack_uncertain'});
  assert.equal(calls,1);
});

test('F12.3: returned metrics never leak staged IDs, leases or checkpoint',async()=>{
  const fn=createAdaoF12StageReconciler({
    resume:async()=>one,
    acknowledge:async()=>({ok:true,payload:{status:'acknowledged'}}),
  });
  const report=JSON.stringify(await fn());
  assert.ok(!report.includes(one.payload.lease_id));
  assert.ok(!report.includes('26111200000001'));
});

test('F12.3: two independent reconcilers compete for one staged lease; only one ACKs',async()=>{
  let leaseOutstanding=false,acquisitions=0,acks=0;
  const resume=async()=>{
    if(leaseOutstanding) return {ok:false,status:409,payload:{status:'blocked',code:'busy'}};
    leaseOutstanding=true;acquisitions++;
    return one;
  };
  const acknowledge=async()=>{
    acks++;
    return {ok:true,payload:{status:'acknowledged'}};
  };
  const first=createAdaoF12StageReconciler({resume,acknowledge});
  const second=createAdaoF12StageReconciler({resume,acknowledge});
  const results=await Promise.all([first(),second()]);
  assert.equal(results.filter(x=>x.ok).length,1);
  assert.equal(results.filter(x=>!x.ok&&x.code==='stage_blocked').length,1);
  assert.equal(acquisitions,1);
  assert.equal(acks,1);
});
