-- Disposable PostgreSQL only: prove original opening obeys LIVE physical
-- identity triggers and exact NULLS NOT DISTINCT inventory uniqueness.
BEGIN;
DO $test$
DECLARE
 loc uuid:='b1ef7322-86f9-4cf4-9d52-39ba32911ef6';
 acid uuid:='ef118d1c-e7c7-45e3-b796-3a9908840f3c';
 stock_before numeric;
 stock_after numeric;
 rejected boolean:=false;
BEGIN
 IF to_regclass('public.p2_disposable_test_marker') IS NULL
 THEN RAISE EXCEPTION 'p2_disposable_marker_required';END IF;
 SELECT quantity INTO STRICT stock_before FROM public.inventory
 WHERE product_id=acid AND location='Fábrica' AND variant_id IS NULL;
 PERFORM public.p2_four_apply_internal(
 'acido','receipt',1,loc,'p2-trigger-test-receipt:'||gen_random_uuid()::text,
 'purchase_receipt',gen_random_uuid(),'DISPOSABLE SYNTHETIC RECEIPT',
 '1c7268cd-fcd9-4d98-aa14-65f76ef72a0b');
 PERFORM public.p2_four_apply_internal(
 'acido','open_original_package',1,loc,
 'p2-trigger-test-open:'||gen_random_uuid()::text,'p2_physical_test',
 gen_random_uuid(),'DISPOSABLE SYNTHETIC OPEN',NULL);
 SELECT quantity INTO STRICT stock_after FROM public.inventory
 WHERE product_id=acid AND location='Fábrica' AND variant_id IS NULL;
 IF stock_after-stock_before<>1000 THEN
  RAISE EXCEPTION 'p2_trigger_open_mass_incorrect';END IF;
 IF NOT EXISTS(
 SELECT 1 FROM public.inventory_movements
 WHERE product_id=acid AND reference_type='p2_four_physical_open'
   AND quantity=1000
 ) THEN RAISE EXCEPTION 'p2_trigger_open_audit_missing';END IF;
 -- Identity guard must reject phantom physical variants in movements.
 BEGIN
  INSERT INTO public.inventory_movements(
   product_id,variant_id,movement_type,quantity,previous_balance,new_balance,
   location,reference_type,reference_id,event_key
  ) VALUES(acid,gen_random_uuid(),'in',1,0,1,
   'Fábrica','p2_invalid_variant_test',gen_random_uuid(),
   'p2-invalid:'||gen_random_uuid()::text);
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%não aceita variante%' OR
     SQLERRM LIKE '%não pertence ao produto%'
  THEN rejected:=true; ELSE RAISE;END IF;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'p2_live_identity_trigger_not_enforced';END IF;
END $test$;
ROLLBACK;
