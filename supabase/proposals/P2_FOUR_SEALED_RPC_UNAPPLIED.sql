-- P2 DESIGN ONLY — UNAPPLIED, NOT AN ACTIVE MIGRATION OR LIVE RPC.
-- Depends on P2_FOUR_SEALED_FOUNDATION_UNAPPLIED.sql, which is ALSO unapplied.
-- SECURITY: this helper has NO EXECUTE for anon/authenticated/service_role.
-- It is a proposed internal primitive; only a separately reviewed canonical
-- receipt/dispatch wrapper may call it. Never publish it as a user-facing RPC.
-- It assumes the caller already validated the immutable physical evidence and
-- the real receipt/order lifecycle. Do not approve any grant/call until proven.
-- This SQL has not passed PostgreSQL execution/concurrency tests.
CREATE OR REPLACE FUNCTION public.p2_four_apply_internal(
 p_family text, p_action text, p_count integer, p_location_id uuid,
 p_event_key text, p_reference_type text, p_reference_id uuid,
 p_evidence_reference text, p_presentation_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $p2$
DECLARE
 v_product uuid;
 v_purchase uuid;
 v_sale uuid;
 v_src text;
 v_dst text;
 v_factor integer;
 v_dst_units integer;
 v_source_balance integer;
 v_target_balance integer;
 v_grams numeric;
 v_loc text;
 v_inventory record;
 v_after numeric;
 v_operation text;
BEGIN
 IF p_family NOT IN ('italac','sorbato','acido','ivoti') OR p_family IS NULL
   THEN RAISE EXCEPTION 'p2_unknown_family'; END IF;
 IF p_count IS NULL OR p_count<1 OR p_count>10000
   THEN RAISE EXCEPTION 'p2_invalid_count'; END IF;
 IF p_reference_id IS NULL OR p_location_id IS NULL
   OR nullif(btrim(p_reference_type),'') IS NULL
   OR nullif(btrim(p_evidence_reference),'') IS NULL
   OR nullif(btrim(p_event_key),'') IS NULL
   OR length(p_event_key)>220 THEN
   RAISE EXCEPTION 'p2_missing_verified_reference_or_location';
 END IF;
 -- No inference from inventory.quantity: only manually authorized ledger
 -- entries can be consumed. Original container identity is not recomposable.
 CASE p_family
  WHEN 'italac' THEN
   v_product:='0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b'::uuid;
   CASE p_action
    WHEN 'receipt' THEN v_dst:='originalBoxes27';v_dst_units:=p_count;
      v_factor:=10665;v_purchase:='1a72b347-97ba-414a-9ef9-783c2d175ea3'::uuid;
    WHEN 'dispatch_original_box' THEN v_src:='originalBoxes27';v_factor:=10665;
      v_sale:='b1bdfd2f-0278-4273-9e19-2544c8a3d758'::uuid;
    WHEN 'dispatch_intact_units' THEN v_src:='intactUnits395';v_factor:=395;
      v_sale:='008d57c4-63b6-4c30-80fd-161ca368fd66'::uuid;
    WHEN 'open_original_box' THEN v_src:='originalBoxes27';
      v_dst:='intactUnits395';v_dst_units:=p_count*27;
    WHEN 'open_intact_unit' THEN v_src:='intactUnits395';v_factor:=395;
    ELSE RAISE EXCEPTION 'p2_forbidden_action';
   END CASE;
  WHEN 'sorbato' THEN
   v_product:='6f43ad65-74d5-4db9-b931-1ecd6d124987'::uuid;
   v_src:='originalPackages1kg';v_factor:=1000;
   v_purchase:='c9d1d89d-366a-42c0-b691-f56bad36af7f'::uuid;
   v_sale:='684d4a55-5d3a-4c18-be47-818a1a3bc074'::uuid;
  WHEN 'acido' THEN
   v_product:='ef118d1c-e7c7-45e3-b796-3a9908840f3c'::uuid;
   v_src:='originalPackages1kg';v_factor:=1000;
   v_purchase:='1c7268cd-fcd9-4d98-aa14-65f76ef72a0b'::uuid;
   v_sale:='f093c456-f757-4efe-b575-8177b8b1d607'::uuid;
  WHEN 'ivoti' THEN
   v_product:='d913f0f2-4893-4985-9976-fcd9119a57b1'::uuid;
   v_src:='originalBuckets98';v_factor:=9800;
   v_purchase:='fcd94ec6-1fc6-4bab-bc6f-8436279ca737'::uuid;
   v_sale:='40809f6d-687c-493b-ac4d-67a602cceba0'::uuid;
 END CASE;
 IF p_family<>'italac' THEN
   CASE p_action
    WHEN 'receipt' THEN v_dst:=v_src;v_src:=NULL;v_dst_units:=p_count;
    WHEN 'open_original_package' THEN
      IF p_family='ivoti' THEN RAISE EXCEPTION 'p2_forbidden_action'; END IF;
    WHEN 'open_original_bucket' THEN
      IF p_family<>'ivoti' THEN RAISE EXCEPTION 'p2_forbidden_action'; END IF;
    WHEN 'dispatch_original_package' THEN
      IF p_family='ivoti' THEN RAISE EXCEPTION 'p2_forbidden_action'; END IF;
    WHEN 'dispatch_original_bucket' THEN
      IF p_family<>'ivoti' THEN RAISE EXCEPTION 'p2_forbidden_action'; END IF;
    ELSE RAISE EXCEPTION 'p2_forbidden_action';
   END CASE;
 END IF;
 -- Every external receipt/dispatch MUST bind product and exact canonical
 -- presentation. Acid sale label 'kg' is still an ORIGINAL 1kg container.
 IF p_action='receipt' THEN
   IF p_presentation_id IS DISTINCT FROM v_purchase
      THEN RAISE EXCEPTION 'p2_purchase_presentation_mismatch'; END IF;
 ELSIF p_action LIKE 'dispatch_%' THEN
   IF p_presentation_id IS DISTINCT FROM v_sale
      THEN RAISE EXCEPTION 'p2_sale_presentation_mismatch'; END IF;
 ELSIF p_action LIKE 'open_%' THEN
   IF p_presentation_id IS NOT NULL
      THEN RAISE EXCEPTION 'p2_open_must_be_physical_event'; END IF;
 ELSE RAISE EXCEPTION 'p2_forbidden_action';
 END IF;
 SELECT name INTO v_loc FROM public.storage_locations
 WHERE id=p_location_id AND is_active;
 IF v_loc IS NULL THEN RAISE EXCEPTION 'p2_invalid_or_inactive_location'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(
   'p2:four:'||v_product::text||':'||p_location_id::text,0));
 IF EXISTS(SELECT 1 FROM public.p2_four_sealed_events
   WHERE event_key IN (p_event_key||':source',p_event_key||':target'))
  OR EXISTS(SELECT 1 FROM public.inventory_movements
   WHERE event_key=p_event_key||':grams') THEN
   RAISE EXCEPTION 'p2_duplicate_or_conflicting_event';
 END IF;
 IF v_src IS NOT NULL THEN
   INSERT INTO public.p2_four_sealed_stock(product_id,storage_location_id,physical_state,units)
   VALUES(v_product,p_location_id,v_src,0) ON CONFLICT DO NOTHING;
   SELECT units INTO v_source_balance FROM public.p2_four_sealed_stock
   WHERE product_id=v_product AND storage_location_id=p_location_id
     AND physical_state=v_src FOR UPDATE;
   IF v_source_balance<p_count THEN
     RAISE EXCEPTION 'p2_insufficient_original_state';
   END IF;
   UPDATE public.p2_four_sealed_stock SET units=v_source_balance-p_count,updated_at=now()
   WHERE product_id=v_product AND storage_location_id=p_location_id AND physical_state=v_src;
   v_operation:=CASE WHEN p_action LIKE 'open_%' THEN 'open' ELSE 'dispatch' END;
   INSERT INTO public.p2_four_sealed_events(
     event_key,product_id,storage_location_id,physical_state,operation,
     units,previous_balance,new_balance,reference_type,reference_id,
     physical_evidence_reference,created_by)
   VALUES(p_event_key||':source',v_product,p_location_id,v_src,v_operation,
     p_count,v_source_balance,v_source_balance-p_count,p_reference_type,p_reference_id,
     p_evidence_reference,auth.uid());
 END IF;
 IF v_dst IS NOT NULL THEN
   INSERT INTO public.p2_four_sealed_stock(product_id,storage_location_id,physical_state,units)
   VALUES(v_product,p_location_id,v_dst,0) ON CONFLICT DO NOTHING;
   SELECT units INTO v_target_balance FROM public.p2_four_sealed_stock
   WHERE product_id=v_product AND storage_location_id=p_location_id
     AND physical_state=v_dst FOR UPDATE;
   IF (v_target_balance::bigint+v_dst_units::bigint)>2147483647 THEN
     RAISE EXCEPTION 'p2_container_balance_overflow'; END IF;
   UPDATE public.p2_four_sealed_stock SET units=v_target_balance+v_dst_units,updated_at=now()
   WHERE product_id=v_product AND storage_location_id=p_location_id AND physical_state=v_dst;
   INSERT INTO public.p2_four_sealed_events(
     event_key,product_id,storage_location_id,physical_state,operation,
     units,previous_balance,new_balance,reference_type,reference_id,
     physical_evidence_reference,created_by)
   VALUES(p_event_key||':target',v_product,p_location_id,v_dst,
     CASE WHEN p_action='receipt' THEN 'receipt' ELSE 'transfer_in' END,
     v_dst_units,v_target_balance,v_target_balance+v_dst_units,
     p_reference_type,p_reference_id,p_evidence_reference,auth.uid());
 END IF;
 -- Only physically opened units/packages are converted into grams.
 -- These are NEW gram credits from checked original stock, not retroactive
 -- conversion of historical inventory.quantity.
 IF p_action LIKE 'open_%' AND v_dst IS NULL THEN
   v_grams:=v_factor::numeric*p_count::numeric;
   -- Do NOT create a null-variant inventory row implicitly: preexisting legacy
   -- uniqueness semantics are not yet proven safe for this path.
   SELECT id,quantity INTO STRICT v_inventory FROM public.inventory
    WHERE product_id=v_product AND variant_id IS NULL
      AND location=v_loc AND location_id=p_location_id FOR UPDATE;
   v_after:=v_inventory.quantity+v_grams;
   UPDATE public.inventory SET quantity=v_after,updated_at=now() WHERE id=v_inventory.id;
   INSERT INTO public.inventory_movements(
     product_id,variant_id,movement_type,quantity,previous_balance,new_balance,
     location,reference_type,reference_id,event_key,notes,created_by)
   VALUES(v_product,NULL,'in',v_grams,v_inventory.quantity,v_after,v_loc,
     'p2_four_physical_open',p_reference_id,p_event_key||':grams',
     'Abertura física original P2, evidência '||p_evidence_reference,auth.uid()::text);
 END IF;
 RETURN jsonb_build_object('allowed',true,'operationalWrites',true,
   'family',p_family,'action',p_action,'count',p_count,
   'productId',v_product,'locationId',p_location_id,'eventKey',p_event_key,
   'sourceState',v_src,'targetState',v_dst,'gramsCredited',COALESCE(v_grams,0));
END;
$p2$;

-- Strictly internal, not directly executable by the browser OR service role.
-- Canonical receipt/order wrappers must be reviewed and extended separately.
REVOKE ALL ON FUNCTION public.p2_four_apply_internal(
 text,text,integer,uuid,text,text,uuid,text,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
