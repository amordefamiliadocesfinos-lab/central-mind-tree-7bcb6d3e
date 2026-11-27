// Independent sessions in dedicated disposable CI database only.
import assert from 'node:assert/strict';
import {execFile,execFileSync} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
assert.equal(process.env.PGDATABASE,'d11_policy_test');
const flags=['-X','-q','-v','ON_ERROR_STOP=1','-A','-t'];
const query=sql=>execFileSync('psql',[...flags,'-c',sql],{encoding:'utf8'}).trim();
const actor='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const lease=a=>query(`SELECT lease_id FROM public.shopee_cycle_state WHERE channel_account_id='${a}'`);
const pause=(a,q)=>`SELECT public.append_shopee_cycle_policy_revision('${a}',1,'${q}','pause',null,'fixture/pause')`;
const claim=(a,l,shop)=>`SELECT public.claim_shopee_cycle_effect('${a}','${l}',1,'ship',${shop},'D11SYNTHETIC1','PKG1',repeat('a',64),(SELECT id FROM public.shopee_cycle_observations WHERE channel_account_id='${a}' AND lease_id='${l}'))`;
const auth=`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${actor}',false)`;
const service='SET ROLE service_role';
const parse=s=>JSON.parse(s.split('\n').map(x=>x.trim()).find(x=>x.startsWith('{')));
async function run(name,role,sql,hold=false){
 const args=[...flags,'-c',role,'-c','BEGIN','-c',sql];
 if(hold)args.push('-c','SELECT pg_sleep(2)');
 args.push('-c','COMMIT');
 return parse((await exec('psql',args,{env:{...process.env,PGAPPNAME:name}})).stdout);
}
async function waitHolding(name){
 for(let i=0;i<60;i++){
   if(query(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${name}' AND wait_event='PgSleep'`)==='1')return;
   await new Promise(r=>setTimeout(r,50));
 }
 throw Error('first transaction did not reach lock-holding sleep');
}
// Pause commits before the claim can acquire the same state row lock.
const la=lease(A),lb=lease(B);
const first=run('d11_pause_first',auth,pause(A,'22222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),true);
await waitHolding('d11_pause_first');
const second=run('d11_claim_second',service,claim(A,la,123));
const [p,c]=await Promise.all([first,second]);
assert.equal(p.status,'recorded');assert.equal(c.status,'policy_admission_refused');
assert.equal(query(`SELECT count(*) FROM public.shopee_shipping_arrangement_attempts WHERE channel_account_id='${A}'`),'0');
// Claim commits first: one already-admitted attempt survives pause for reconciliation.
const third=run('d11_claim_first',service,claim(B,lb,456),true);
await waitHolding('d11_claim_first');
const fourth=run('d11_pause_second',auth,pause(B,'22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb'));
const [c2,p2]=await Promise.all([third,fourth]);
assert.equal(c2.status,'claimed');assert.equal(c2.fresh,true);assert.equal(p2.status,'recorded');
assert.equal((await run('d11_after_pause',service,claim(B,lb,456))).status,'policy_admission_refused');
assert.equal(query(`SELECT count(*) FROM public.shopee_shipping_arrangement_attempts WHERE channel_account_id='${B}'`),'1');
assert.equal(JSON.parse(query(`SELECT public.resolve_shopee_shipping_arrangement('${c2.attempt_id}',repeat('a',64),'uncertain')`)).state,'uncertain');
assert.equal(JSON.parse(query(`SELECT public.finish_shopee_cycle('${B}','${lb}',null,'D11SYNTHETIC1','blocked','policy_paused')`)).status,'finished');
console.log('PASS D11 independent sessions: pause-first denies claim; claim-first survives for reconciliation; no retry');
