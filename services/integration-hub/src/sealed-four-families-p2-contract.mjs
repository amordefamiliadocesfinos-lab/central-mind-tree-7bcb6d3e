// P2 design contract (read-only planner) for four physically sealed families.
// Does not read/write a database and must not be wired to live entrypoints.
// Migration, authenticated ledger and order/receipt integration require separate approval.
const product=(productId,states,gramsPerUnit)=>Object.freeze({productId,states:Object.freeze(states),gramsPerUnit});
export const SEALED_FAMILY_CONTRACTS=Object.freeze({
 italac:product('0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b',['originalBoxes27','intactUnits395','openGrams'],395),
 sorbato:product('6f43ad65-74d5-4db9-b931-1ecd6d124987',['originalPackages1kg','openGrams'],1000),
 acido:product('ef118d1c-e7c7-45e3-b796-3a9908840f3c',['originalPackages1kg','openGrams'],1000),
 ivoti:product('d913f0f2-4893-4985-9976-fcd9119a57b1',['originalBuckets98','openGrams'],9800),
});
const TRANSITIONS=Object.freeze({
 italac:Object.freeze({
  open_original_box:Object.freeze({from:'originalBoxes27',debit:1,to:'intactUnits395',credit:27}),
  open_intact_unit:Object.freeze({from:'intactUnits395',debit:1,to:'openGrams',credit:395}),
  dispatch_original_box:Object.freeze({from:'originalBoxes27',debit:1}),
  dispatch_intact_units:Object.freeze({from:'intactUnits395',debit:1}),
 }),
 sorbato:Object.freeze({
  open_original_package:Object.freeze({from:'originalPackages1kg',debit:1,to:'openGrams',credit:1000}),
  dispatch_original_package:Object.freeze({from:'originalPackages1kg',debit:1}),
 }),
 acido:Object.freeze({
  open_original_package:Object.freeze({from:'originalPackages1kg',debit:1,to:'openGrams',credit:1000}),
  dispatch_original_package:Object.freeze({from:'originalPackages1kg',debit:1}),
 }),
 ivoti:Object.freeze({
  open_original_bucket:Object.freeze({from:'originalBuckets98',debit:1,to:'openGrams',credit:9800}),
  dispatch_original_bucket:Object.freeze({from:'originalBuckets98',debit:1}),
 }),
});
const fail=(reason)=>Object.freeze({allowed:false,reason,operationalWrites:false});
const integer=(value)=>Number.isSafeInteger(value)&&value>=0;
const nonempty=(value)=>typeof value==='string'&&value.trim().length>0;

// Simulation only. Even a successful preview is NOT permission for a database mutation.
// Do not infer an intact package from a gram-based inventory balance or channel quantity.
export function planSealedPhysicalTransition({
 family,operation,count,verifiedSnapshot,physicalEvidence,eventKey,locationId
}={}){
 const contract=SEALED_FAMILY_CONTRACTS[family];
 if(!contract)return fail('sealed_family_unknown');
 const transition=TRANSITIONS[family]?.[operation];
 if(!transition)return fail('sealed_transition_not_permitted');
 if(!integer(count)||count===0||count>10000)return fail('sealed_count_invalid');
 if(!nonempty(eventKey)||!nonempty(locationId))return fail('sealed_event_identity_missing');
 if(physicalEvidence?.confirmed!==true || !nonempty(physicalEvidence?.reference))
  return fail('sealed_physical_evidence_required');
 if(verifiedSnapshot?.source!=='verified_sealed_ledger'
    || verifiedSnapshot?.productId!==contract.productId
    || verifiedSnapshot?.locationId!==locationId
    || verifiedSnapshot?.hasOpenPhysicalInventoryReconciled!==true)
  return fail('sealed_verified_snapshot_required');
 const balances=verifiedSnapshot.balances;
 if(!balances||typeof balances!=='object'||Array.isArray(balances)
    ||contract.states.some(s=>!integer(balances[s])))
  return fail('sealed_balance_invalid');
 if(balances[transition.from]<transition.debit*count)
  return fail('sealed_insufficient_original_packages');
 const proposed=Object.fromEntries(contract.states.map(s=>[s,balances[s]]));
 proposed[transition.from]-=transition.debit*count;
 if(transition.to) {
  const added=transition.credit*count;
  if(!Number.isSafeInteger(added)||!Number.isSafeInteger(proposed[transition.to]+added))
   return fail('sealed_quantity_overflow');
  proposed[transition.to]+=added;
 }
 return Object.freeze({
  allowed:true,operationalWrites:false,family,operation,count,
  productId:contract.productId,locationId,eventKey,
  physicalEvidenceReference:physicalEvidence.reference,
  before:Object.freeze(Object.fromEntries(contract.states.map(s=>[s,balances[s]]))),
  after:Object.freeze(proposed),
  requiresSeparateAuthorizedTransactionalEntrypoint:true,
 });
}
export function getSealedFamilyOperations(family) {
 return Object.freeze(Object.keys(TRANSITIONS[family]??{}));
}
