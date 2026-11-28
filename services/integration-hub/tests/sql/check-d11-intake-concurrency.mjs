// Independent PostgreSQL sessions, isolated P4 fixture database ONLY.
import assert from 'node:assert/strict';
import {execFile,execFileSync} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
assert.equal(process.env.PGDATABASE,'p4_shopee_writer_disposable');
const flags=['-X','-q','-v','ON_ERROR_STOP=1','-A','-t'];
const query=sql=>execFileSync('psql',[...flags,'-c',sql],{encoding:'utf8'}).trim();
const A='cccccccc-cccc-4ccc-8ccc-cccccccccccc',M='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const setup=JSON.parse(query("SELECT public.acquire_shopee_cycle('"+A+"')"));
assert.equal(setup.status,'acquired');
const L=setup.lease_id;
const receipt=n=>query("SELECT public.d11_fixture_observe('"+A+"','fixture_race_"+n+"')");
const call=o=>`SELECT public.commit_shopee_d11_intake('${A}','${L}',1,'${o}',public.d11_fixture_projection())`;
const update=n=>`UPDATE public.marketplace_product_mapping_items SET physical_multiplier=${n} WHERE mapping_id='${M}' AND position=1`;
const insert=`INSERT INTO public.marketplace_product_mapping_items(mapping_id,product_id,variant_id,physical_multiplier,position) VALUES ('${M}','92088a70-8cc0-40ef-a39d-564603df6866',NULL,1,2)`;
const count=()=>query(`SELECT count(*) FROM public.orders WHERE channel_account_id='${A}'`);
const parse=s=>JSON.parse(s.split('\n').find(x=>x.trim().startsWith('{')));
async function session(name,sql,{service=false,hold=false}={}){
 const args=[...flags,'-c',"SET lock_timeout='12s'; SET statement_timeout='15s'"];
 if(service)args.push('-c','SET ROLE service_role');
 args.push('-c','BEGIN','-c',sql);
 if(hold)args.push('-c','SELECT pg_sleep(4)');
 args.push('-c','COMMIT');
 return (await exec('psql',args,{env:{...process.env,PGAPPNAME:name}})).stdout;
}
async function waitEvent(name,field,value){
 for(let i=0;i<100;i++){
  if(query(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${name}' AND ${field}='${value}'`)==='1')return;
  await new Promise(r=>setTimeout(r,25));
 }
 throw Error('expected independent-session wait not observed: '+name+' '+value);
}
// Editor commits first: the worker must see changed components, not accept
// the projection it read before the editor obtained the row lock.
const o1=receipt(1);
const editor=session('d11_mapping_editor_first',update(4),{hold:true});
await waitEvent('d11_mapping_editor_first','wait_event','PgSleep');
const worker=session('d11_intake_second',call(o1),{service:true});
await waitEvent('d11_intake_second','wait_event_type','Lock');
const [,blocked]=await Promise.all([editor,worker]);
assert.equal(parse(blocked).status,'intake_composition_refused');assert.equal(count(),'0');
query(update(2));
// Import commits first: an update of an existing component AND a new FK
// component cannot alter the validated composition until the commit ends.
const o2=receipt(2);
const first=session('d11_intake_first',call(o2),{service:true,hold:true});
await waitEvent('d11_intake_first','wait_event','PgSleep');
const second=session('d11_component_update_second',update(4));
const third=session('d11_component_insert_second',insert);
await Promise.all([waitEvent('d11_component_update_second','wait_event_type','Lock'),waitEvent('d11_component_insert_second','wait_event_type','Lock')]);
const [written]=await Promise.all([first,second,third]);
const result=parse(written);assert.equal(result.status,'intake_written');assert.equal(count(),'1');
assert.equal(query(`SELECT count(*)||':'||sum(quantity)||':'||round(sum(quantity*unit_price),2) FROM public.order_items WHERE order_id='${result.order_id}'`),'2:10:20.00');
assert.equal(query(`SELECT marketplace_metadata->>'buyer_message' FROM public.orders WHERE id='${result.order_id}'`),'fixture packing note');
assert.equal(query(`SELECT count(*) FROM public.order_separation WHERE order_id='${result.order_id}' AND separation_status='todo'`),'1');
assert.equal(query(`SELECT count(*) FROM public.marketplace_product_mapping_items WHERE mapping_id='${M}'`),'3');
assert.equal(parse(await session('d11_intake_replay',call(o2),{service:true})).status,'intake_existing_requires_reconciliation');
assert.equal(count(),'1');
console.log('PASS D11 independent sessions: editor-first rejects stale projection; intake-first holds update and FK insert until commit; no duplicate order');
