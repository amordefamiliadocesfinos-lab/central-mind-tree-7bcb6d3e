import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdaoF12OneOrderPreviewGate}
  from '../src/shopee-adao-f12-one-order-preview-gate.mjs';
import {F12_3_SCOPE} from '../src/shopee-adao-resumable-discovery.mjs';

const NOW=1794506400000, SN='SYNTHETICF12ADAO1';
const evidence=()=>({
  livePage:{ok:true,shop_id:F12_3_SCOPE.shop,order_sns:[SN],more:false},
  readRequest:{timeRangeField:'update_time',onlyIntakeEligibleOrders:true,
    pageSize:F12_3_SCOPE.pageSize},
  account:F12_3_SCOPE.account,observedAt:NOW,allowPreview:true,
});
const ready=p=>({ok:true,mode:'preview',selected:1,ready:1,
  blocked:0,written:0,results:[{orderSn:p.expectedOrderSn,status:'ready',write:null}]});

test('F12.3 preview is disabled without explicit opt-in, has no Core reads',async()=>{
  let calls=0;
  const gate=createAdaoF12OneOrderPreviewGate({
    previewOrder:async()=>{calls++;throw Error('unexpected');},now:()=>NOW,
  });
  assert.equal((await gate({...evidence(),allowPreview:false})).code,'f12_preview_disabled');
  assert.equal(calls,0);
});

test('F12.3 one live page candidate requires exact canonical preview and still cannot commit',async()=>{
  const calls=[];
  const gate=createAdaoF12OneOrderPreviewGate({
    previewOrder:async p=>{calls.push(p);return ready(p);},now:()=>NOW,
  });
  assert.deepEqual(await gate(evidence()),{
    ok:true,code:'f12_one_live_candidate_previewed',candidates:1,
    productionAuthorized:false,commitAuthorized:false,
  });
  assert.deepEqual(calls,[{
    channelAccountId:F12_3_SCOPE.account,
    expectedOrderSn:SN,limit:1,mode:'preview',verifyExisting:false,
  }]);
});

test('F12.3 refuses unsafe pages and wrong account before reading canonical preview',async()=>{
  let calls=0;
  const gate=createAdaoF12OneOrderPreviewGate({
    previewOrder:async p=>{calls++;return ready(p);},now:()=>NOW,
  });
  for(const patch of [
    {account:'8a8ad166-0317-4597-8be6-e43fb46b4d1b'},
    {livePage:{...evidence().livePage,shop_id:531736366}},
    {livePage:{...evidence().livePage,order_sns:[]}},
    {livePage:{...evidence().livePage,order_sns:[SN,'SYNTHETICF12ADAO2']}},
    {livePage:{...evidence().livePage,order_sns:[SN,SN]}},
    {livePage:{...evidence().livePage,order_sns:[SN],more:true}},
    {livePage:{...evidence().livePage,order_sns:['INVALID!']}},
    {readRequest:{...evidence().readRequest,onlyIntakeEligibleOrders:false}},
    {readRequest:{...evidence().readRequest,timeRangeField:'create_time'}},
    {readRequest:{...evidence().readRequest,pageSize:1}},
    {observedAt:NOW-120001},{observedAt:NOW+1},
  ]){
    const r=await gate({...evidence(),...patch});
    assert.equal(r.ok,false);
    assert.equal(r.commitAuthorized,undefined);
  }
  assert.equal(calls,0);
});

test('F12.3 never certifies preview when canonical pipeline rejects or misidentifies order',async()=>{
  for(const response of [
    {ok:false,code:'expected_order_unavailable'},
    {...ready({expectedOrderSn:SN}),ready:0,blocked:1,
      results:[{orderSn:SN,status:'blocked',write:null}]},
    {...ready({expectedOrderSn:SN}),results:[{orderSn:'OTHER12345',status:'ready',write:null}]},
    {...ready({expectedOrderSn:SN}),written:1},
    {...ready({expectedOrderSn:SN}),mode:'commit'},
    {...ready({expectedOrderSn:SN}),results:[{orderSn:SN,status:'ready',write:{ok:true}}]},
  ]){
    const gate=createAdaoF12OneOrderPreviewGate({
      previewOrder:async()=>response,now:()=>NOW,
    });
    assert.equal((await gate(evidence())).code,'f12_canonical_preview_blocked');
  }
  const error=createAdaoF12OneOrderPreviewGate({
    previewOrder:async()=>{throw Error('disconnect');},now:()=>NOW,
  });
  assert.equal((await error(evidence())).code,'f12_canonical_preview_unavailable');
});
