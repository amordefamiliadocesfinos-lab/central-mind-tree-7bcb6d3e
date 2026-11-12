import test from 'node:test';
import assert from 'node:assert/strict';
import { createBridgeHandler } from '../../../supabase/functions/integration-core-bridge/handler.mjs';
import { CORE_BRIDGE_URL } from '../src/core-bridge.mjs';
import { runF12SafeBridgeProbe } from '../scripts/f12-3-core-bridge-safe-smoke.mjs';

const secret='synthetic-private-hmac-secret-test-only';

test('F12.3 live-safe probe rejects unsigned and passes only signed read-only health',async()=>{
  const actions=[];
  const handler=createBridgeHandler({
    getSecret:()=>secret,
    checkCore:async()=>true,
    executeAction:async body=>{actions.push(body.action);return {status:503,body:{error:'must_not_execute'}};},
  });
  let calls=0;
  const fetchImpl=(url,init)=>{
    calls++;
    assert.equal(url,CORE_BRIDGE_URL);
    assert.equal(JSON.parse(init.body).action,'health');
    return handler(new Request(url,init));
  };
  const r=await runF12SafeBridgeProbe({secret,fetchImpl});
  assert.deepEqual(r,{ok:true,code:'bridge_hmac_health_ok',unsigned_status:401,signed_status:200});
  assert.equal(calls,2);
  assert.deepEqual(actions,[]);
});

test('F12.3 live-safe probe refuses to proceed when unsigned health is not 401',async()=>{
  let calls=0;
  const result=await runF12SafeBridgeProbe({
    secret,fetchImpl:async()=>{calls++;return new Response('{}',{status:200});},
  });
  assert.equal(result.ok,false);
  assert.equal(result.code,'unsigned_probe_not_rejected');
  assert.equal(calls,1);
});

test('F12.3 live-safe probe requires explicit injected HMAC secret',async()=>{
  let called=0;
  const r=await runF12SafeBridgeProbe({secret:'',fetchImpl:async()=>{called++;}});
  assert.equal(r.code,'hmac_secret_unavailable');
  assert.equal(called,0);
});

test('F12.3 live-safe probe does not log, return or expose HMAC secret',async()=>{
  const logs=[];
  const handler=createBridgeHandler({getSecret:()=>secret,checkCore:async()=>true});
  const result=await runF12SafeBridgeProbe({
    secret,fetchImpl:(url,init)=>handler(new Request(url,init)),
    logger:msg=>logs.push(msg),
  });
  assert.equal(result.ok,true);
  assert.equal(JSON.stringify([result,logs]).includes(secret),false);
});
