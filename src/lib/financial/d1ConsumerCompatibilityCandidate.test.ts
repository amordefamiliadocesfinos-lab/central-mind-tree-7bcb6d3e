import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareObligation,type ObligationComparison} from './d1ConsumerCompatibilityCandidate.ts';
const base:ObligationComparison={entry_id:'fixture',original_value:'100.00',legacy_paid:'90.00',explicit_principal:'100.00',unmapped_movements:'0',explicit_remaining_principal:'0.00',effective_cash:'95.00'};
const read=(overrides:Partial<ObligationComparison>={})=>compareObligation({...base,...overrides},'2026-11-20','2026-11-27');
test('discount and fee do not leave principal outstanding; correction changes cash only',()=>{
 const r=read();assert.equal(r.legacyStatus,'parcial');assert.equal(r.structuredStatus,'pago');assert.equal(r.principalRemaining,0n);assert.equal(r.effectiveCash,9500n);assert.equal(r.wouldBeFullySettled,true);
});
test('interest can make legacy cash look fully paid before principal is settled',()=>{
 const r=read({legacy_paid:'105',explicit_principal:'90',explicit_remaining_principal:'10',effective_cash:'105'});assert.equal(r.legacyStatus,'pago');assert.equal(r.structuredStatus,'parcial');assert.equal(r.principalRemaining,1000n);assert.equal(r.wouldBeFullySettled,false);
});
test('mixed history never infers unknown principal from cash',()=>{
 const r=read({unmapped_movements:'2',explicit_principal:'40',explicit_remaining_principal:null});assert.equal(r.basis,'unmapped');assert.equal(r.knownPrincipal,4000n);assert.equal(r.principalPaid,null);assert.equal(r.principalRemaining,null);assert.equal(r.structuredStatus,null);assert.equal(r.wouldBeFullySettled,null);
});
test('unmapped paid history is not automatically certified',()=>{const r=read({legacy_paid:'100',explicit_principal:'0',unmapped_movements:'1',explicit_remaining_principal:null,effective_cash:'100'});assert.equal(r.legacyStatus,'pago');assert.equal(r.structuredStatus,null);});
test('open obligation has known zero principal and date-based status',()=>{
 const row={...base,legacy_paid:'0',explicit_principal:'0',explicit_remaining_principal:'100',effective_cash:'0'};assert.equal(read(row).structuredStatus,'atrasada');assert.equal(compareObligation(row,'2026-11-27','2026-11-27').structuredStatus,'em_aberto');
});
test('inconsistent projection fails closed for status and principal',()=>{
 for(const x of [{explicit_remaining_principal:'1'},{explicit_principal:'101',explicit_remaining_principal:'0'},{unmapped_movements:'1'},{legacy_paid:'0',explicit_principal:'0',explicit_remaining_principal:'100',effective_cash:'1'}]) {const r=read(x);assert.equal(r.basis,'inconsistent');assert.equal(r.wouldBeFullySettled,null);}
});
test('rejects fractional legacy, malformed counts and impossible date without rounding',()=>{
 assert.throws(()=>read({legacy_paid:'90.001'}));assert.throws(()=>read({unmapped_movements:'-1'}));assert.throws(()=>compareObligation(base,'2026-02-30','2026-11-27'));
});
test('exact arithmetic above JS safe integer',()=>{
 const r=read({original_value:'900719925474099.99',explicit_principal:'900719925474099.98',explicit_remaining_principal:'0.01',legacy_paid:'900719925474099.98',effective_cash:'900719925474099.98'});assert.equal(r.principalRemaining,1n);assert.equal(r.structuredStatus,'parcial');
});
