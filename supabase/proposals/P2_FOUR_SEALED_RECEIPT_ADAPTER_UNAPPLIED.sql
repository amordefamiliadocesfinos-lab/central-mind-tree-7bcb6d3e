-- REVIEW ONLY — not wired to confirm_purchase_receipt_unguarded_01b.
-- Requires the existing canonical receipt wrapper to validate actor/role,
-- receipt status, purchase order, physical confirmation, and active location.
-- No production function is modified here.
CREATE OR REPLACE FUNCTION public.p2_four_receipt_adapter_candidate(
 p_product_id uuid,p_variant_id uuid,p_presentation_id uuid,
 p_purchase_count numeric,p_operational_grams numeric,p_location_id uuid,
 p_receipt_id uuid,p_receipt_item_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
DECLARE v_family text;v_factor integer;
BEGIN
 IF p_variant_id IS NOT NULL OR p_purchase_count IS NULL
 OR p_purchase_count<1 OR p_purchase_count>10000
 OR p_purchase_count<>trunc(p_purchase_count)
 THEN RAISE EXCEPTION 'p2_receipt_whole_packages_required';END IF;
 CASE p_product_id
 WHEN '0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b'::uuid THEN
  v_family:='italac';v_factor:=10665;
  IF p_presentation_id IS DISTINCT FROM '1a72b347-97ba-414a-9ef9-783c2d175ea3'::uuid THEN
   RAISE EXCEPTION 'p2_italac_receipt_requires_original_box';END IF;
 WHEN '6f43ad65-74d5-4db9-b931-1ecd6d124987'::uuid THEN
  v_family:='sorbato';v_factor:=1000;
  IF p_presentation_id IS DISTINCT FROM 'c9d1d89d-366a-42c0-b691-f56bad36af7f'::uuid THEN
   RAISE EXCEPTION 'p2_sorbato_receipt_requires_original_package';END IF;
 WHEN 'ef118d1c-e7c7-45e3-b796-3a9908840f3c'::uuid THEN
  v_family:='acido';v_factor:=1000;
  IF p_presentation_id IS DISTINCT FROM '1c7268cd-fcd9-4d98-aa14-65f76ef72a0b'::uuid THEN
   RAISE EXCEPTION 'p2_acido_receipt_requires_original_package';END IF;
 WHEN 'd913f0f2-4893-4985-9976-fcd9119a57b1'::uuid THEN
  v_family:='ivoti';v_factor:=9800;
  IF p_presentation_id IS DISTINCT FROM 'fcd94ec6-1fc6-4bab-bc6f-8436279ca737'::uuid THEN
   RAISE EXCEPTION 'p2_ivoti_receipt_requires_original_bucket';END IF;
 ELSE RAISE EXCEPTION 'p2_receipt_product_not_supported';
 END CASE;
 IF p_operational_grams IS DISTINCT FROM p_purchase_count*v_factor
 THEN RAISE EXCEPTION 'p2_receipt_mass_mismatch';END IF;
 IF p_receipt_id IS NULL OR p_receipt_item_id IS NULL OR p_location_id IS NULL
 THEN RAISE EXCEPTION 'p2_receipt_reference_missing';END IF;
 RETURN public.p2_four_apply_internal(
  v_family,'receipt',p_purchase_count::integer,p_location_id,
  'purchase_receipt:'||p_receipt_id::text||':'||p_receipt_item_id::text||':'||p_location_id::text,
  'purchase_receipt',p_receipt_id,
  'purchase_receipt_confirmed:'||p_receipt_id::text,p_presentation_id
 );
END;$body$;
REVOKE ALL ON FUNCTION public.p2_four_receipt_adapter_candidate(
 uuid,uuid,uuid,numeric,numeric,uuid,uuid,uuid
) FROM PUBLIC,anon,authenticated,service_role;
