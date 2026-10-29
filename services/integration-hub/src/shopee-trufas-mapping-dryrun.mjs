// Offline planning only. Never execute this output without a separate approved operation.
// Default transaction ends in ROLLBACK; caller cannot select COMMIT here.
import { prepareAdãoTrufasMappingPlan } from './shopee-trufas-adao-mapping-plan.mjs';
const quote=v=>"'"+String(v).replaceAll("'","''")+"'";
export function buildTrufasMappingDryRun(existingMappings=[]) {
 const report=prepareAdãoTrufasMappingPlan(existingMappings);
 if(report.selected!==60 || report.missing!==60 || report.duplicates!==0) {
  throw new Error('Expected exactly 60 absent official identities; re-audit required');
 }
 const values=report.plan.map(p=>{
  if(p.action!=='candidate_insert'||p.components.length===0) throw new Error('unsafe mapping row');
  const key='item:'+p.item_id+'|model:'+p.model_id;
  const data=JSON.stringify(p.components);
  return '('+[quote(p.account_id),quote(p.item_id),quote(p.model_id),quote(key),quote(p.family+' '+p.kind+' '+p.commercial_quantity_per_unit+' '+p.flavor),quote(data)].join(',')+')';
 });
 // Deliberate standalone diagnostic: no insert/update/delete anywhere.
 const sql=`BEGIN READ ONLY;
WITH source(account_id,item_id,model_id,external_item_key,description,components_json) AS (
 VALUES
 ${values.join(',\n ')}
), audit AS (
 SELECT s.*, m.id mapping_id,
  (SELECT COUNT(*) FROM marketplace_product_mappings x
   WHERE x.marketplace='shopee' AND x.channel_account_id=s.account_id::uuid
    AND x.external_item_key=s.external_item_key) key_collision
 FROM source s LEFT JOIN marketplace_product_mappings m
   ON m.marketplace='shopee' AND m.channel_account_id=s.account_id::uuid
   AND m.external_item_id=s.item_id AND m.external_model_id=s.model_id
)
SELECT COUNT(*) total, COUNT(DISTINCT account_id||'|'||item_id||'|'||model_id) unique_identities,
 COUNT(*) FILTER (WHERE mapping_id IS NOT NULL) existing,
 COUNT(*) FILTER (WHERE key_collision>0) key_conflicts
FROM audit;
ROLLBACK;`;
 return {writes:false,sql,selected:60,componentRows:report.plan.reduce((n,p)=>n+p.components.length,0)};
}
