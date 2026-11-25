-- Celivio C7 exact-package exception to the existing durable one-recovery claim.
-- No approval is created here. This migration does NOT trigger ship_order.
-- Preserves Adão recovery, original attempt, unique index and claim fencing.
DO $migration$
DECLARE
  v_definition text;
  v_old text := $old$AND p_channel_account_id='b4027369-5abf-4ac1-ab24-862334fae892'::uuid
     AND v_existing.request_hash <> p_request_hash THEN$old$;
  v_new text := $new$AND (
       p_channel_account_id='b4027369-5abf-4ac1-ab24-862334fae892'::uuid
       OR (
         p_channel_account_id='d26c7a30-aa4a-4441-8012-600d70453689'::uuid
         AND p_order_sn='2611258Y00VM5U'
         AND p_package_number='OFG249308165846906'
         AND v_existing.id='1e1d90ad-2457-479a-a7ac-9bb4baa626b3'::uuid
         AND v_existing.shop_id=1357031949
         AND v_existing.order_id='cf4946c8-51de-4191-9f36-445206e483e7'::uuid
       )
     )
     AND v_existing.request_hash <> p_request_hash THEN$new$;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_definition
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.proname='claim_shopee_shipping_arrangement'
    AND p.pronargs=5;
  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'missing_shopee_shipping_claim_function';
  END IF;
  IF strpos(v_definition,v_new)>0 THEN
    RAISE NOTICE 'celivio_c7_exact_recovery_already_present';
    RETURN;
  END IF;
  IF strpos(v_definition,v_old)=0 THEN
    RAISE EXCEPTION 'shipping_claim_contract_drift_refuse_patch';
  END IF;
  v_definition:=replace(v_definition,v_old,v_new);
  EXECUTE v_definition;
END
$migration$;
