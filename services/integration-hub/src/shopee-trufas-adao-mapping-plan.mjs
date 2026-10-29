// Explicitly read-only preparation. No database statements or automatic mappings.
import { SHOPEE_TRUFAS_ADAO_ACCOUNT_ID as ACCOUNT, SHOPEE_TRUFAS_ADAO_REFERENCE_20261029 as REF } from './shopee-trufas-adao-reference-20261029.mjs';
import { expectedTrufasComponents } from './shopee-trufas-physical-reconciliation.mjs';
import { previewTrufasMappings } from './shopee-trufas-reconciliation-preview.mjs';

const HISTORICAL_UNRESOLVED = new Set([
  '22898142109|229425631222','22898142109|229425631223',
  '22898142109|229425631224','22898142109|229425631225',
  '22898142109|229425631226','19598189256|159546591760',
]);
export function prepareAdãoTrufasMappingPlan(existingMappings, {historicalProtectionDeployed=false}={}) {
  const check=previewTrufasMappings(REF,existingMappings,ACCOUNT);
  const expected=expectedTrufasComponents();
  const plan=expected.map((row,i)=>{
    const ref=REF[i];
    if(ref.item_id!==row.item_id||ref.model_id!==row.model_id) throw new Error('reference alignment mismatch');
    const identity=check.rows[i];
    const components=row.components.map(({product_id,variant_id,physical_multiplier},position)=>
      ({product_id,variant_id,physical_multiplier,position}));
    return {
      family:ref.family,item_id:ref.item_id,model_id:ref.model_id,
      seller_sku_observed:ref.seller_sku_observed,
      account_id:ACCOUNT,kind:ref.kind,commercial_quantity_per_unit:ref.qty,
      components,existing_status:identity.status,
      historical_quarantine_required:HISTORICAL_UNRESOLVED.has(ref.item_id+'|'+ref.model_id),
      action:identity.status==='missing'?'candidate_insert':'manual_review'
    };
  });
  const blockers=[];
  if(!historicalProtectionDeployed) blockers.push('temporal_guard_runtime_not_verified');
  if(check.duplicate>0) blockers.push('duplicate_mapping_identity');
  if(check.rows.some(r=>r.status==='present_unverified')) blockers.push('existing_mapping_physics_not_verified');
  // This plan deliberately does NOT authorize inserts even when blockers become empty.
  blockers.push('explicit_mapping_write_approval_and_transactional_rollback_required');
  return {writes:false,authorizedForWrite:false,account_id:ACCOUNT,
    selected:plan.length,missing:check.missing,duplicates:check.duplicate,
    blockers,plan};
}
