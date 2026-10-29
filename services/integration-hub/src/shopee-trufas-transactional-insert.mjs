// Produces a reviewed SQL transaction; it NEVER executes SQL.
// Run only with an explicit post-deploy approval and an authenticated transactional DB client.
import {prepareAdãoTrufasMappingPlan} from './shopee-trufas-adao-mapping-plan.mjs';
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
export function buildTrufasTransactionalInsertScript(existingMappings, {
  historicalProtectionDeployed=false, approved=false
}={}) {
 const plan=prepareAdãoTrufasMappingPlan(existingMappings,{historicalProtectionDeployed});
 if(!historicalProtectionDeployed || !approved) throw new Error('runtime attestation and explicit approval required');
 if(plan.missing!==60||plan.duplicates!==0||plan.plan.some(x=>x.action!=='candidate_insert'))throw new Error('reconciliation changed: no writes');
 const data=plan.plan.map(p=>{
  const payload=JSON.stringify(p.components);
  return '('+[q(p.account_id),q(p.item_id),q(p.model_id),
   q('official:item:'+p.item_id+'|model:'+p.model_id),q('T'+p.family.slice(1)+' '+p.kind+' '+p.commercial_quantity_per_unit+' '+p.flavor),
   q(p.components[0].product_id),q(p.components[0].variant_id),String(p.components[0].physical_multiplier),q(payload)].join(',')+')';
 }).join(',\n');
 return `BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $validation$
DECLARE n integer; invalid integer;
BEGIN
  SELECT count(*) INTO n FROM marketplace_product_mappings
   WHERE marketplace='shopee' AND channel_account_id='b4027369-5abf-4ac1-ab24-862334fae892'::uuid
     AND external_item_id IN ('19799761406','23093522370','22898142109','20999760944','19598189256','21999552311','22193668881','22393654582');
  IF n<>0 THEN RAISE EXCEPTION 'Existing official mappings: %',n; END IF;
END $validation$;
CREATE TEMP TABLE trufas_stage(account_id uuid,item_id text,model_id text,external_item_key text,description text,parent_product uuid,parent_variant uuid,parent_multiplier numeric,components jsonb) ON COMMIT DROP;
INSERT INTO trufas_stage VALUES
${data};
DO $validate_stage$
DECLARE n integer; invalid integer;
BEGIN
 SELECT count(*) INTO n FROM trufas_stage;
 IF n<>60 THEN RAISE EXCEPTION 'Expected 60 rows, got %',n; END IF;
 SELECT count(*) INTO invalid FROM (
  SELECT account_id,item_id,model_id FROM trufas_stage GROUP BY 1,2,3 HAVING count(*)>1
 ) dup;
 IF invalid>0 THEN RAISE EXCEPTION 'Duplicate Item/Model'; END IF;
 SELECT count(*) INTO invalid FROM trufas_stage s WHERE
 (SELECT count(*) FROM jsonb_array_elements(s.components)) NOT IN (1,6)
 OR (SELECT sum((c->>'physical_multiplier')::numeric)
     FROM jsonb_array_elements(s.components) c) <= 0
 OR EXISTS (SELECT 1 FROM jsonb_array_elements(s.components) c
  GROUP BY c->>'position' HAVING count(*)>1);
 IF invalid>0 THEN RAISE EXCEPTION 'Invalid component cardinality or position'; END IF;
 SELECT count(*) INTO invalid FROM trufas_stage s
 WHERE (SELECT sum((c->>'physical_multiplier')::numeric)
 FROM jsonb_array_elements(s.components) c) <>
 (regexp_match(s.description,' ([0-9]+) '))[1]::numeric;
 IF invalid>0 THEN RAISE EXCEPTION 'Component sum does not match commercial quantity'; END IF;
 SELECT count(*) INTO invalid FROM trufas_stage s
 CROSS JOIN LATERAL jsonb_array_elements(s.components) c
 LEFT JOIN product_variants v ON v.id=(c->>'variant_id')::uuid
 LEFT JOIN products p ON p.id=(c->>'product_id')::uuid
 WHERE v.id IS NULL OR p.id IS NULL OR v.product_id<>p.id OR v.is_active IS DISTINCT FROM TRUE
 OR (c->>'physical_multiplier')::numeric<=0;
 IF invalid>0 THEN RAISE EXCEPTION 'Invalid physical components %',invalid; END IF;
 SELECT count(*) INTO invalid FROM trufas_stage s LEFT JOIN product_variants v ON v.id=s.parent_variant WHERE v.id IS NULL OR v.product_id<>s.parent_product OR v.is_active IS DISTINCT FROM TRUE OR s.parent_multiplier<=0; IF invalid>0 THEN RAISE EXCEPTION 'Invalid parent physical identities'; END IF;
 SELECT count(*) INTO invalid FROM trufas_stage s
 JOIN marketplace_product_mappings m ON m.marketplace='shopee'
 AND m.channel_account_id=s.account_id AND m.external_item_key=s.external_item_key;
 IF invalid>0 THEN RAISE EXCEPTION 'External key collision %',invalid; END IF;
END $validate_stage$;
CREATE TEMP TABLE trufas_inserted (id uuid, item_id text, model_id text) ON COMMIT DROP;
WITH inserted AS (
 INSERT INTO marketplace_product_mappings
  (marketplace,marketplace_account,channel_account_id,external_item_id,external_model_id,
   external_item_key,external_product_title,physical_multiplier,product_id,variant_id)
 SELECT 'shopee','SHOPEE ADÃO',account_id,item_id,model_id,external_item_key,description,parent_multiplier,parent_product,parent_variant
 FROM trufas_stage
 RETURNING id,external_item_id,external_model_id
)
INSERT INTO trufas_inserted SELECT * FROM inserted;
INSERT INTO marketplace_product_mapping_items
 (mapping_id,product_id,variant_id,physical_multiplier,position)
SELECT i.id,(c->>'product_id')::uuid,(c->>'variant_id')::uuid,
 (c->>'physical_multiplier')::numeric,(c->>'position')::int
FROM trufas_stage s
JOIN trufas_inserted i ON i.item_id=s.item_id AND i.model_id=s.model_id
CROSS JOIN LATERAL jsonb_array_elements(s.components) c;
DO $assert$
DECLARE m integer; parts integer;
BEGIN
 SELECT count(*) INTO m FROM trufas_inserted;
 SELECT count(*) INTO parts FROM marketplace_product_mapping_items
 WHERE mapping_id IN (SELECT id FROM trufas_inserted);
 IF m<>60 OR parts<>120 THEN
 RAISE EXCEPTION 'Post-insert mismatch: mappings %, components %',m,parts;
 END IF;
END $assert$;
-- Execute COMMIT only after reviewing evidence, exact revision and authorization.
-- For any exception PostgreSQL aborts the whole transaction.
COMMIT;`;
}
