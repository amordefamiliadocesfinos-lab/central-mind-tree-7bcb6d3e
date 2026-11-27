import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFinancialIntegrity } from './integrityDiagnostics.ts';
const entry = (id: string, value: string, paid: string, order_id: string | null = null, type = 'receber', is_conciliated = false) => ({id,type,description:id,order_id,value,value_paid:paid,lifecycle_status:'active',is_conciliated});
const movement = (id: string, entry_id: string, value: string, account_id = 'a') => ({id,entry_id,value,account_id});
const account = (current_balance: string) => ({id:'a',name:'Caixa',initial_balance:'0',current_balance});
test('preserves decimal traces beyond Number precision and distinguishes residues from cents',()=>{
 const r=analyzeFinancialIntegrity([entry('e','372.000000000000024','372')],[movement('m','e','372')],[account('372')],[]);
 const e=r.entryFindings[0]; assert.equal(e.residual,'0.000000000000024'); assert.equal(e.subcentOpen,true); assert.equal(e.economic,false); assert.equal(e.paidMismatch,false); assert.equal(r.accountFindings[0].hasDifference,false);
});
test('real commercial divergence and conciliated record require individual review',()=>{
 const r=analyzeFinancialIntegrity([entry('e','131','130.999999999999990905','o','receber',true)],[movement('m','e','130.999999999999990905')],[account('131')],[{id:'o',order_number:'PED',total_value:'1.78'}]);
 assert.equal(r.entryFindings[0].economic,true);assert.equal(r.entryFindings[0].requiresReview,true);assert.equal(r.accountFindings[0].monetaryDifference,'0.00');
});
test('signed cash reconstruction and movement mismatch',()=>{
 const r=analyzeFinancialIntegrity([entry('in','20','20'),entry('out','9','9',null,'pagar')],[movement('m','in','20'),movement('n','out','8')],[account('15')],[]);
 assert.equal(r.accountFindings[0].expected,'12'); assert.equal(r.accountFindings[0].difference,'3'); assert.equal(r.entryFindings[0].paidMismatch,true);
});
test('unknown links and malformed numerics do not yield silently trusted totals',()=>{
 const r=analyzeFinancialIntegrity([], [movement('m','unknown','10')],[account('10')],[]);assert.equal(r.unknownMovementLinks,1);
 assert.throws(()=>analyzeFinancialIntegrity([entry('e','NaN','0')],[],[],[]));
});
test('logistics payable does not compare with commercial revenue',()=>{
 const r=analyzeFinancialIntegrity([entry('e','25','0','o','pagar')],[],[],[{id:'o',order_number:'PED',total_value:'325'}]);assert.equal(r.entryFindings.length,0);
});
test('actual overpayment and subcent negative noise remain distinguishable',()=>{
 const r=analyzeFinancialIntegrity([entry('a','320','320.000000000000040'),entry('b','50','51')],[movement('m','a','320.000000000000040'),movement('n','b','51')],[account('371.000000000000040')],[]);
 assert.equal(r.entryFindings.find(e=>e.id==='a')?.economic,false);assert.equal(r.entryFindings.find(e=>e.id==='b')?.economic,true);
});
