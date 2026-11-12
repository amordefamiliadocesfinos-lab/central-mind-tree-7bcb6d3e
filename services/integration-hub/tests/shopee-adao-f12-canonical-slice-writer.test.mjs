import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdaoF12CanonicalSliceWriter} from '../src/shopee-adao-f12-canonical-slice-writer.mjs';
import {F12_3_SCOPE} from '../src/shopee-adao-resumable-discovery.mjs';

const lease='99999999-9999-4999-8999-999999999999';
const stage={
  status:'resumed',lease_id:lease,generation:3,
  staged_pages:[['26111200000001','26111200000002']],completed:false,
};
const resumed=()=>({ok:true,payload:stage});
function intakeResponse(id,status='written'){
  return {ok:true,selected:1,roundStopped:false,
    results:[{orderSn:id,status}]};
}

test('F12.3 writer is disabled twice and never invokes Core or canonical intake',async()=>{
  let calls=0;
  const deps={
    resume:async()=>{calls++;return resumed();},
    acknowledge:async()=>{calls++;throw Error('not expected');},
    intake:async()=>{calls++;throw Error('not expected');},
  };
  const disabled=createAdaoF12CanonicalSliceWriter(deps);
  assert.equal((await disabled({commit:true})).code,'f12_canonical_writer_disabled');
  const manual=createAdaoF12CanonicalSliceWriter({...deps,enabled:true});
  assert.equal((await manual()).code,'f12_canonical_writer_disabled');
  assert.equal(calls,0);
});

test('F12.3 uses existing canonical intake in strict one-order commit mode, then SQL ACK',async()=>{
  const events=[];
  const writer=createAdaoF12CanonicalSliceWriter({
    enabled:true,now:()=>1000,
    resume:async p=>{events.push('resume');assert.deepEqual(p,{channel_account_id:F12_3_SCOPE.account});return resumed();},
    intake:async p=>{
      events.push('intake');
      assert.deepEqual(p,{
        channelAccountId:F12_3_SCOPE.account,
        expectedOrderSn:stage.staged_pages[0][events.filter(e=>e==='intake').length-1],
        limit:1,mode:'commit',verifyExisting:true,
      });
      return intakeResponse(p.expectedOrderSn,
        p.expectedOrderSn.endsWith('01')?'written':'already_registered');
    },
    acknowledge:async p=>{
      events.push('ack');
      assert.deepEqual(p,{channel_account_id:F12_3_SCOPE.account,lease_id:lease,generation:3});
      return {ok:true,payload:{status:'acknowledged',reconciled:2}};
    },
  });
  assert.deepEqual(await writer({commit:true}),{
    ok:true,code:'f12_slice_canonically_reconciled',
    processed:2,written:1,already_registered:1,verified_filtered_by_core:0,completed:false,
  });
  assert.deepEqual(events,['resume','intake','intake','ack']);
});

test('F12.3 missing canonical identity or blocked mapping prevents ACK',async()=>{
  for(const response of [
    {ok:true,selected:1,results:[{orderSn:'26111200000001',status:'blocked'}]},
    {ok:true,selected:1,results:[{orderSn:'OTHER12345',status:'written'}]},
    {ok:true,selected:0,results:[]},
  ]){
    let acks=0, writes=0;
    const run=createAdaoF12CanonicalSliceWriter({
      enabled:true,now:()=>1000,resume:async()=>resumed(),
      intake:async()=>{writes++;return response;},
      acknowledge:async()=>{acks++;throw Error('must not ack');},
    });
    assert.equal((await run({commit:true})).code,'f12_writer_requires_review');
    assert.equal(acks,0);assert.equal(writes,1);
  }
});

test('F12.3 ambiguous writer failure is never retried or ACKed',async()=>{
  let writes=0,acks=0;
  const run=createAdaoF12CanonicalSliceWriter({
    enabled:true,now:()=>1000,resume:async()=>resumed(),
    intake:async()=>{writes++;throw Error('lost after commit');},
    acknowledge:async()=>{acks++;throw Error('must not ack');},
  });
  assert.equal((await run({commit:true})).code,'f12_writer_uncertain');
  assert.equal(writes,1);assert.equal(acks,0);
});

test('F12.3 stale Core ACK or missing canonical count stays blocked',async()=>{
  for (const response of [
    {ok:false,status:409,payload:{status:'blocked',code:'reconciliation_required'}},
    {ok:true,payload:{status:'acknowledged',reconciled:1}},
  ]){
    const run=createAdaoF12CanonicalSliceWriter({
      enabled:true,now:()=>1000,resume:async()=>resumed(),
      intake:async p=>intakeResponse(p.expectedOrderSn),
      acknowledge:async()=>response,
    });
    assert.equal((await run({commit:true})).code,'f12_core_reconciliation_blocked');
  }
});

test('F12.3 stage validation refuses duplicate/foreign evidence without writer calls',async()=>{
  let called=0;
  for(const bad of [
    {...stage,staged_pages:[['26111200000001','26111200000001']]},
    {...stage,staged_pages:[['BAD#ID']]},
    {...stage,generation:0},
    {...stage,lease_id:'invalid'},
    {...stage,staged_pages:Array.from({length:3},()=>[])},
    {...stage,completed:'true'},
  ]){
    const run=createAdaoF12CanonicalSliceWriter({
      enabled:true,now:()=>1000,
      resume:async()=>({ok:true,payload:bad}),
      intake:async()=>{called++;throw Error('must not write');},
      acknowledge:async()=>{called++;throw Error('must not ack');},
    });
    assert.equal((await run({commit:true})).code,'f12_invalid_staged_lease');
  }
  assert.equal(called,0);
});

test('F12.3 bounded time and no identifier leaks in report',async()=>{
  let time=0, writes=0,acks=0;
  const run=createAdaoF12CanonicalSliceWriter({
    enabled:true,now:()=>{time+=61_000;return time;},
    resume:async()=>resumed(),
    intake:async p=>{writes++;return intakeResponse(p.expectedOrderSn);},
    acknowledge:async()=>{acks++;throw Error('must not ack');},
  });
  const report=await run({commit:true});
  assert.equal(report.code,'f12_writer_budget_exhausted');
  assert.equal(writes,1);assert.equal(acks,0);
  assert.equal(JSON.stringify(report).includes(lease),false);
  assert.equal(JSON.stringify(report).includes('26111200000001'),false);
});

test('F12.3 filtered-existing result is not trusted; requires independent Core ACK',async()=>{
  let acks=0;
  const run=createAdaoF12CanonicalSliceWriter({
    enabled:true,now:()=>1000,resume:async()=>resumed(),
    intake:async p=>p.expectedOrderSn.endsWith('01')
      ? {ok:false,code:'expected_order_unavailable'}
      : intakeResponse(p.expectedOrderSn,'written'),
    acknowledge:async()=>{
      acks++;
      return {ok:true,payload:{status:'acknowledged',reconciled:2}};
    },
  });
  assert.deepEqual(await run({commit:true}),{
    ok:true,code:'f12_slice_canonically_reconciled',processed:2,
    written:1,already_registered:0,verified_filtered_by_core:1,completed:false,
  });
  assert.equal(acks,1);
});

test('F12.3 filtered-but-missing order cannot be confirmed by fabricated writer status',async()=>{
  let acks=0;
  const run=createAdaoF12CanonicalSliceWriter({
    enabled:true,now:()=>1000,resume:async()=>resumed(),
    intake:async p=>p.expectedOrderSn.endsWith('01')
      ? {ok:false,code:'expected_order_unavailable'}
      : intakeResponse(p.expectedOrderSn,'written'),
    acknowledge:async()=>{
      acks++;
      return {ok:false,status:409,payload:{status:'blocked',code:'reconciliation_required'}};
    },
  });
  assert.deepEqual(await run({commit:true}),{
    ok:false,code:'f12_core_reconciliation_blocked',processed:2,
  });
  assert.equal(acks,1);
});
