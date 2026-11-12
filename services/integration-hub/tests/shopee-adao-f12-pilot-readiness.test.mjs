import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {assessAdaoF12PilotReadiness,ADAO_F12_PILOT_PREPARATION}
  from '../src/shopee-adao-f12-pilot-readiness.mjs';
import {F12_3_SCOPE} from '../src/shopee-adao-resumable-discovery.mjs';

const current=1794517200000;
const evidence=()=>({
  account:F12_3_SCOPE.account,shop:F12_3_SCOPE.shop,observedAt:current,
  pilotWorkers:1,pilotOrders:1,pilotPages:1,checkpointRows:0,
  hmac_live_verified:true,core_rpc_rollback_verified:true,
  canonical_pipeline_offline_verified:true,core_ack_gate_verified:true,
});
const verify = e => assessAdaoF12PilotReadiness(e,{now:()=>current});

test('F12.3 pilot is offline-only despite complete evidence',()=>{
  const r=verify(evidence());
  assert.deepEqual(r,{
    ok:true,code:'pilot_offline_readiness_only',account:'adao',
    pilotWorkers:1,pilotOrders:1,pilotPages:1,
    productionAuthorized:false,concurrencyVerified:false,
    throughput100Verified:false,
  });
  assert.equal(ADAO_F12_PILOT_PREPARATION.productionActivation,false);
  assert.equal(ADAO_F12_PILOT_PREPARATION.permittedCoreWrites,0);
  assert.equal(ADAO_F12_PILOT_PREPARATION.permittedOrdersWrites,0);
  assert.equal(ADAO_F12_PILOT_PREPARATION.permittedLogisticsWrites,0);
});

test('F12.3 pilot denies foreign account, larger batch and active checkpoint',()=>{
  for(const patch of [
    {account:'8a8ad166-0317-4597-8be6-e43fb46b4d1b'},
    {shop:531736366},{pilotWorkers:2},{pilotOrders:2},{pilotPages:2},
    {checkpointRows:1},{checkpointRows:undefined},
  ]){
    const r=verify({...evidence(),...patch});
    assert.equal(r.ok,false);
    assert.equal(r.productionAuthorized,undefined);
  }
});

test('F12.3 refuses stale, future, unknown and unproved evidence',()=>{
  for(const patch of [
    {observedAt:current-300_001},{observedAt:current+1},
    {observedAt:null},{hmac_live_verified:false},
    {core_rpc_rollback_verified:false},{canonical_pipeline_offline_verified:false},
    {core_ack_gate_verified:false},
  ]){
    assert.equal(verify({...evidence(),...patch}).ok,false);
  }
  assert.equal(verify(null).code,'pilot_evidence_missing');
});

test('F12.3 pilot source contains no operational code imports or writer invocation',()=>{
  const src=readFileSync(new URL('../src/shopee-adao-f12-pilot-readiness.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(src,/^import .*?(core-bridge|automatic-intake|canonical-slice-writer|shopee-live-orders|server\.mjs)/m);
  assert.doesNotMatch(src,/\b(await|fetch\(|persistShopeeOrderContract\(|acknowledgeAdaoF12Discovery\()/);
  assert.equal(typeof assessAdaoF12PilotReadiness,'function');
});
