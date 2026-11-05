-- REVIEW ONLY. Does not change public.apply_order_stock_event.
-- Called only after authenticated canonical order lifecycle validates shipped
-- or external_shipped, p_order_id, current actor, and physical separation.
-- No public/service-role EXECUTE. Requires schema and primitive P2 candidate.
CREATE OR REPLACE FUNCTION public.p2_four_dispatch_adapter_candidate(
 p_product_id uuid,p_variant_id uuid,p_presentation_id uuid,
 p_commercial_count numeric,p_operational_grams numeric,
 p_order_id uuid,p_order_item_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
DECLARE
 v_family text;v_action text;v_state text;v_factor integer;
 v_remaining integer;v_take integer;v_row record;v_movements integer:=0;
BEGIN
 IF p_order_id IS NULL OR p_order_item_id IS NULL OR p_variant_id IS NOT NULL
  OR p_commercial_count IS NULL OR p_commercial_count<1
  OR p_commercial_count>10000 OR p_commercial_count<>trunc(p_commercial_count)
 THEN RAISE EXCEPTION 'p2_dispatch_invalid_order_or_count';END IF;
 CASE p_product_id
 WHEN '0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b'::uuid THEN
  v_family:='italac';
  IF p_presentation_id='b1bdfd2f-0278-4273-9e19-2544c8a3d758'::uuid THEN
   v_action:='dispatch_original_box';v_state:='originalBoxes27';v_factor:=10665;
  ELSIF p_presentation_id='008d57c4-63b6-4c30-80fd-161ca368fd66'::uuid THEN
   v_action:='dispatch_intact_units';v_state:='intactUnits395';v_factor:=395;
  ELSE RAISE EXCEPTION 'p2_italac_unknown_presentation';END IF;
 WHEN '6f43ad65-74d5-4db9-b931-1ecd6d124987'::uuid THEN
  v_family:='sorbato';v_action:='dispatch_original_package';
  v_state:='originalPackages1kg';v_factor:=1000;
  IF p_presentation_id IS DISTINCT FROM '684d4a55-5d3a-4c18-be47-818a1a3bc074'::uuid
  THEN RAISE EXCEPTION 'p2_sorbato_unknown_presentation';END IF;
 WHEN 'ef118d1c-e7c7-45e3-b796-3a9908840f3c'::uuid THEN
  v_family:='acido';v_action:='dispatch_original_package';
  v_state:='originalPackages1kg';v_factor:=1000;
  IF p_presentation_id IS DISTINCT FROM 'f093c456-f757-4efe-b575-8177b8b1d607'::uuid
  THEN RAISE EXCEPTION 'p2_acido_unknown_presentation';END IF;
 WHEN 'd913f0f2-4893-4985-9976-fcd9119a57b1'::uuid THEN
  v_family:='ivoti';v_action:='dispatch_original_bucket';
  v_state:='originalBuckets98';v_factor:=9800;
  IF p_presentation_id IS DISTINCT FROM '40809f6d-687c-493b-ac4d-67a602cceba0'::uuid
  THEN RAISE EXCEPTION 'p2_ivoti_unknown_presentation';END IF;
 ELSE RAISE EXCEPTION 'p2_dispatch_product_not_supported';
 END CASE;
 IF p_operational_grams IS DISTINCT FROM p_commercial_count*v_factor
 THEN RAISE EXCEPTION 'p2_dispatch_mass_mismatch';END IF;
 -- Lock orders of existing containers stable by location.
 -- Atomic SQL invocation rolls back all debits on a shortage.
 v_remaining:=p_commercial_count::integer;
 FOR v_row IN SELECT storage_location_id,units
   FROM public.p2_four_sealed_stock
   WHERE product_id=p_product_id AND physical_state=v_state AND units>0
   ORDER BY storage_location_id FOR UPDATE
 LOOP
  EXIT WHEN v_remaining<=0;
  v_take:=LEAST(v_remaining,v_row.units);
  PERFORM public.p2_four_apply_internal(
   v_family,v_action,v_take,v_row.storage_location_id,
   'order:'||p_order_id::text||':p2:'||p_order_item_id::text||':'||v_row.storage_location_id::text,
   'order_stock_event',p_order_id,'physical_shipment:'||p_order_id::text,
   p_presentation_id
  );
  v_remaining:=v_remaining-v_take;
  v_movements:=v_movements+1;
 END LOOP;
 IF v_remaining>0 THEN RAISE EXCEPTION 'p2_insufficient_original_packages_for_shipment';END IF;
 RETURN jsonb_build_object('success',true,'family',v_family,
  'physical_state',v_state,'requested',p_commercial_count,
  'movement_count',v_movements,'operationalWrites',true);
END;$body$;
REVOKE ALL ON FUNCTION public.p2_four_dispatch_adapter_candidate(
 uuid,uuid,uuid,numeric,numeric,uuid,uuid
) FROM PUBLIC,anon,authenticated,service_role;
