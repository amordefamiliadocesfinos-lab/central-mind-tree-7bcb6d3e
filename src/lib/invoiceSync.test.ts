import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
// Execute the actual source with only its Supabase dependency replaced by a recording double.
const source=readFileSync(new URL('./invoiceSync.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function fixture(failTable?:string){
 const calls:{table:string;op:string;payload?:any}[]=[];
 const supabase={from(table:string){
  calls.push({table,op:'from'});
  const q:any={update(payload:any){calls.push({table,op:'update',payload});return q;},insert(payload:any){calls.push({table,op:'insert',payload});return q;},select(){return q;},eq(){return q;},maybeSingle(){return Promise.resolve({data:{funnel_status:'lead'},error:null});},then(resolve:any){return Promise.resolve({error:table===failTable?{message:'fixture error'}:null}).then(resolve);}};
  return q;
 }};
 const exports:any={};
 new Function('require','exports',compiled)((id:string)=>{assert.equal(id,'@/integrations/supabase/client');return {supabase};},exports);
 return {calls,api:exports};
}
const input={invoiceId:'fixture',invoiceNumber:'123',invoiceType:'NF-e',accessKey:null,issueDate:'2026-11-27',value:100,orderId:'order',contactId:'contact'};
test('fiscal issuance never accesses financial entries or movements; preserves other effects',async()=>{
 const {calls,api}=fixture();const r=await api.syncInvoiceIssued(input);
 assert.equal(r.financialConfirmed,0);assert.equal(r.orderUpdated,true);assert.equal(r.contactUpdated,true);assert.equal(r.timelineLogged,true);
 assert.deepEqual(r.errors,[]);assert.deepEqual(calls.filter(c=>c.op==='from').map(c=>c.table),['orders','contacts','contacts','contact_history']);
 assert.equal(calls.find(c=>c.table==='orders'&&c.op==='update')?.payload.status,'faturado');
 assert.equal(calls.find(c=>c.table==='contact_history'&&c.op==='insert')?.payload.event_type,'nota_fiscal');
 assert.doesNotMatch(api.buildSyncSummary(r),/Receita confirmada/);
});
test('order error is preserved without financial mutation',async()=>{
 const {calls,api}=fixture('orders');const r=await api.syncInvoiceIssued(input);
 assert.equal(r.orderUpdated,false);assert.equal(r.financialConfirmed,0);assert.match(r.errors[0],/Pedido: fixture error/);assert.equal(r.timelineLogged,true);
 assert.ok(calls.every(c=>!c.table.startsWith('financial_')));
});
test('no linked order or contact results in no database actions',async()=>{
 const {calls,api}=fixture();const r=await api.syncInvoiceIssued({...input,orderId:null,contactId:null});
 assert.deepEqual(calls,[]);assert.equal(r.financialConfirmed,0);
});
