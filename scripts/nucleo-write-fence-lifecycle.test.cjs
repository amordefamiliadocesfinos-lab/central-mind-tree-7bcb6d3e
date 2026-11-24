const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(path,mocks){const m={exports:{}};new Function('module','exports','require',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(m,m.exports,n=>mocks[n]);return m.exports;}
const witness=load('src/lib/nucleo/writeRecoveryWitnessV1.ts',{});
let slots=[],index=0,effects=[],listener,uid='actor-a';
const storage=new Map();
global.window={localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},addEventListener(){},removeEventListener(){}};
const react={
 useRef(value){const i=index++;return slots[i]??(slots[i]={current:value});},
 useState(value){const i=index++;if(!(i in slots))slots[i]=value;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},
 useCallback(fn){index++;return fn;},
 useEffect(fn,deps){const i=index++,previous=slots[i];if(!previous||deps.some((d,n)=>d!==previous.deps[n])){previous?.cleanup?.();slots[i]={deps};effects.push(()=>{slots[i].cleanup=fn();});}}
};
const supabase={auth:{getUser:async()=>({data:{user:{id:uid}},error:null}),onAuthStateChange:fn=>{listener=fn;return {data:{subscription:{unsubscribe(){}}}};}}};
const hook=load('src/lib/nucleo/pendingWriteFenceV1.ts',{'react':react,'@/integrations/supabase/client':{supabase},'@/lib/nucleo/writeRecoveryWitnessV1':witness}).usePendingWriteFence;
function render(){index=0;const value=hook('ac01','module-a');const pending=effects;effects=[];pending.forEach(fn=>fn());return value;}
async function settle(){await Promise.resolve();await Promise.resolve();return render();}
(async()=>{
 render();let fence=await settle();assert(fence.ready&&!fence.blocked);
 const first=await witness.makeWitness('ac01','module-a',['synthetic','actor-a'],{requestId:'request-a',authUid:'actor-a'});
 // Same callback retained across awaits: React has not refreshed its state.
 assert(fence.markStarted(first));assert(fence.clearConfirmed(first));assert.equal(storage.size,0);
 fence=render();assert(fence.markStarted(first));fence=render();
 const second={...first,requestId:'request-b'};
 assert.equal(fence.clearConfirmed(second),false);assert.equal(storage.size,1);
 assert.equal(await fence.verifyAndClear(['changed','actor-a'],{requestId:'request-a'}),false);
 assert(await fence.verifyAndClear(['synthetic','actor-a'],{requestId:'request-a'}));
 fence=render();assert(fence.markStarted(first));fence=render();
 // A session switch during digest calculation must preserve the old marker.
 const inflight=fence.verifyAndClear(['synthetic','actor-a'],{requestId:'request-a'});
 uid='actor-b';listener('SIGNED_IN');render();await settle();
 assert.equal(await inflight,false);assert.equal(storage.size,1);
 fence=render();assert.equal(fence.markStarted(first),false,'old actor cannot start under new account');
 const a=witness.witnessFieldsAc01({recorded_by_auth_uid:'actor-a'}),b=witness.witnessFieldsAc01({recorded_by_auth_uid:'actor-b'});
 assert.notEqual(await witness.fingerprint(a,first.salt),await witness.fingerprint(b,first.salt));
 console.log('PASS write fence lifecycle: immediate readback, wrong attempt, mismatched content, actor change during reconciliation, authored witness.');
})().catch(e=>{console.error(e);process.exitCode=1;});
