// D1 shadow consumer contract. No production import, API or writer.
export type ObligationComparison = {
 entry_id:string; original_value:string; legacy_paid:string; explicit_principal:string;
 unmapped_movements:string; explicit_remaining_principal:string|null; effective_cash:string;
};
type Status='pago'|'parcial'|'atrasada'|'em_aberto';
type Basis='structured'|'unmapped'|'inconsistent';
function parse(value:string):bigint {
 if(typeof value!=='string'||!/^[0-9]+(?:\.[0-9]{1,2})?$/.test(value)) throw new Error('Invalid cent amount');
 const [w,f='']=value.split('.');return BigInt(w)*100n+BigInt(f.padEnd(2,'0'));
}
function date(value:string) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value) throw new Error('Invalid date');
 return value;
}
function status(original:bigint,paid:bigint,due:string,today:string):Status {
 return paid>=original?'pago':paid>0n?'parcial':due<today?'atrasada':'em_aberto';
}
export function compareObligation(row:ObligationComparison,dueDate:string,todayDate:string) {
 const due=date(dueDate),today=date(todayDate);
 // Fractional legacy amounts must be diagnosed, not silently rounded.
 const original=parse(row.original_value),legacy=parse(row.legacy_paid),principal=parse(row.explicit_principal),cash=parse(row.effective_cash);
 if(!/^\d+$/.test(row.unmapped_movements)) throw new Error('Invalid unmapped count');
 const unmapped=BigInt(row.unmapped_movements);
 const remaining=row.explicit_remaining_principal===null?null:parse(row.explicit_remaining_principal);
 let basis:Basis='structured';
 if(principal>original || (unmapped>0n && remaining!==null) || (unmapped===0n && (remaining===null || remaining!==original-principal)) || (unmapped===0n && principal===0n && (legacy!==0n||cash!==0n)) || (unmapped===0n && principal>0n && (legacy===0n||cash===0n))) basis='inconsistent';
 else if(unmapped>0n) basis='unmapped';
 const known=basis==='structured';
 return {entryId:row.entry_id,basis,original,legacyPaid:legacy,legacyStatus:status(original,legacy,due,today),
  legacyRemaining:original>legacy?original-legacy:0n,knownPrincipal:principal,
  principalPaid:known?principal:null,principalRemaining:known?remaining:null,
  effectiveCash:cash,structuredStatus:known?status(original,principal,due,today):null,
  // A read-side candidate cannot authorize CRM events or mutation.
  wouldBeFullySettled:known?remaining===0n:null};
}
