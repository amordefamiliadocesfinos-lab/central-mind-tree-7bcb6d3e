-- DISPOSABLE PostgreSQL fixture ONLY. Tests proposed receipt/dispatch line adapters.
-- Executes candidate functions with synthetic IDs, no production calls, ROLLBACK.
BEGIN;
DO $test$
DECLARE
 loc uuid:='b1ef7322-86f9-4cf4-9d52-39ba32911ef6';
 order_id uuid:=gen_random_uuid();
 r1 jsonb;r2 jsonb;v_failed boolean;v_balance numeric;
BEGIN
 IF to_regclass('public.p2_disposable_test_marker') IS NULL
 THEN RAISE EXCEPTION 'P2_DISPOSABLE_MARKER_REQUIRED';END IF;
 IF has_function_privilege('authenticated',
   'public.p2_four_receipt_adapter_candidate(uuid,uuid,uuid,numeric,numeric,uuid,uuid,uuid)','EXECUTE')
 OR has_function_privilege('service_role',
   'public.p2_four_dispatch_adapter_candidate(uuid,uuid,uuid,numeric,numeric,uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'p2_candidate_adapter_publicly_exposed';END IF;
 -- Mixed receipt, two independent original container families.
 r1:=public.p2_four_receipt_adapter_candidate(
  '0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b',NULL,
  '1a72b347-97ba-414a-9ef9-783c2d175ea3',1,10665,
  loc,gen_random_uuid(),gen_random_uuid());
 r2:=public.p2_four_receipt_adapter_candidate(
  '6f43ad65-74d5-4db9-b931-1ecd6d124987',NULL,
  'c9d1d89d-366a-42c0-b691-f56bad36af7f',1,1000,
  loc,gen_random_uuid(),gen_random_uuid());
 IF (r1->>'allowed')::boolean IS DISTINCT FROM true OR
    (r2->>'allowed')::boolean IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'p2_mixed_receipt_rejected';END IF;
 SELECT quantity INTO v_balance FROM public.inventory
  WHERE product_id='0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b';
 IF v_balance<>0 THEN RAISE EXCEPTION 'p2_receipt_credited_legacy_grams';END IF;
 -- Wrong purchase presentation must be rejected, never fallback to grams.
 v_failed:=false;
 BEGIN
  PERFORM public.p2_four_receipt_adapter_candidate(
   'ef118d1c-e7c7-45e3-b796-3a9908840f3c',NULL,
   'f093c456-f757-4efe-b575-8177b8b1d607',1,1000,
   loc,gen_random_uuid(),gen_random_uuid());
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%p2_acido_receipt_requires_original_package%'
  THEN v_failed:=true;ELSE RAISE;END IF;
 END;
 IF NOT v_failed THEN RAISE EXCEPTION 'p2_acido_bad_purchase_was_accepted';END IF;
 -- Mixed dispatch must consume two distinct physical states.
 r1:=public.p2_four_dispatch_adapter_candidate(
  '0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b',NULL,
  'b1bdfd2f-0278-4273-9e19-2544c8a3d758',1,10665,
  order_id,gen_random_uuid());
 r2:=public.p2_four_dispatch_adapter_candidate(
  '6f43ad65-74d5-4db9-b931-1ecd6d124987',NULL,
  '684d4a55-5d3a-4c18-be47-818a1a3bc074',1,1000,
  order_id,gen_random_uuid());
 IF (r1->>'success')::boolean IS DISTINCT FROM true OR
    (r2->>'success')::boolean IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'p2_mixed_dispatch_rejected';END IF;
 SELECT count(*) INTO v_balance FROM public.p2_four_sealed_stock WHERE units<>0;
 IF v_balance<>0 THEN RAISE EXCEPTION 'p2_original_remained_after_dispatch';END IF;
 -- Re-dispatch of exhausted physical original must fail closed.
 v_failed:=false;
 BEGIN
  PERFORM public.p2_four_dispatch_adapter_candidate(
   '0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b',NULL,
   'b1bdfd2f-0278-4273-9e19-2544c8a3d758',1,10665,
   order_id,gen_random_uuid());
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%p2_insufficient_original_packages_for_shipment%'
  THEN v_failed:=true;ELSE RAISE;END IF;
 END;
 IF NOT v_failed THEN RAISE EXCEPTION 'p2_dispatch_reused_empty_original';END IF;
END $test$;
ROLLBACK;
