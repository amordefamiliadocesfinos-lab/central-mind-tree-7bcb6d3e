import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compareObligation,type ObligationComparison} from './d1ConsumerCompatibilityCandidate.ts';
// This executable consumes real PostgreSQL output from the existing disposable CI.
// No synthetic JSON substitutes for the SQL projection.
const file=process.env.FIN_D1_EXPORT_FILE;
assert.ok(file,'SQL export path required');
const rows:ObligationComparison[]=JSON.parse(readFileSync(file,'utf8'));
assert.equal(rows.length,3);
assert.equal(new Set(rows.map(r=>r.entry_id)).size,3);
for(const row of rows) {
 for(const key of ['original_value','legacy_paid','explicit_principal','unmapped_movements','effective_cash'] as const) assert.equal(typeof row[key],'string',key);
 assert.ok(row.explicit_remaining_principal===null||typeof row.explicit_remaining_principal==='string');
}
const read=(suffix:string)=>{
 const row=rows.find(r=>r.entry_id==='00000000-0000-0000-0000-00000000000'+suffix);
 assert.ok(row,'fixture row '+suffix);
 return compareObligation(row,'2026-11-20','2026-11-27');
};
const legacy=read('1');
assert.equal(legacy.basis,'unmapped');
assert.equal(legacy.legacyStatus,'pago');
assert.equal(legacy.principalPaid,null);
assert.equal(legacy.wouldBeFullySettled,null);
const partial=read('2');
assert.equal(partial.basis,'structured');
assert.equal(partial.principalPaid,15000n);
assert.equal(partial.principalRemaining,5000n);
assert.equal(partial.legacyPaid,14000n);
assert.equal(partial.effectiveCash,14600n);
assert.equal(partial.structuredStatus,'parcial');
assert.equal(partial.wouldBeFullySettled,false);
const full=read('3');
assert.equal(full.basis,'structured');
assert.equal(full.principalRemaining,0n);
assert.equal(full.legacyStatus,'parcial');
assert.equal(full.structuredStatus,'pago');
assert.equal(full.effectiveCash,9500n);
assert.equal(full.wouldBeFullySettled,true);
console.log('PASS SQL -> TypeScript: exact amounts, null unknown principal, partial, full, rectifications');
