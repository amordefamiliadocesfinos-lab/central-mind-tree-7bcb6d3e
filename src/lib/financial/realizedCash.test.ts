import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectRealizedCash,type CashMovementRow} from './realizedCash.ts';
const entry={id:'e',type:'receber' as const,description:'Venda',value:1000,value_paid:1000,due_date:'2026-11-20'};
const movement=(id:string,date:string,value:string,account='a',type:'pagar'|'receber'='receber'):CashMovementRow=>({id,entry_id:'e',movement_date:date,value,account_id:account,account:{id:account,name:account},entry:{...entry,type}});
test('partial receipts across months, unrelated to due or final payment date',()=>{
 const rows=[movement('1','2026-10-31','400'),movement('2','2026-11-01','600')];
 assert.equal(projectRealizedCash(rows,'2026-10-01','2026-10-31').incoming,400);
 assert.equal(projectRealizedCash(rows,'2026-11-01','2026-11-30').incoming,600);
});
test('actual movement account and signed net',()=>{
 const r=projectRealizedCash([movement('1','2026-11-01','10','a'),movement('2','2026-11-01','20','b'),movement('3','2026-11-01','5','b','pagar')]);
 assert.equal(r.incoming,30);assert.equal(r.outgoing,5);assert.equal(r.net,25);assert.equal(r.movements[1].account_id,'b');
});
test('historical fractional numeric sums before display',()=>{
 const r=projectRealizedCash([movement('1','2026-11-01','44.99999999999999'),movement('2','2026-11-01','0.00000000000001')]);assert.equal(r.incoming,45);
});
test('reject duplicates, invalid amount and missing obligation',()=>{
 const m=movement('1','2026-11-01','10');
 assert.throws(()=>projectRealizedCash([m,m]));assert.throws(()=>projectRealizedCash([{...m,value:'NaN'}]));assert.throws(()=>projectRealizedCash([{...m,entry:null}]));
});
test('empty successful read and inclusive boundaries',()=>{
 assert.equal(projectRealizedCash([]).net,0);
 assert.equal(projectRealizedCash([movement('1','2026-11-30','1'),movement('2','2026-12-01','2')],'2026-11-01','2026-11-30').incoming,1);
});
