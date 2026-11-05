-- P2 physical opening: disposable PostgreSQL only, unconditional rollback.
BEGIN;
DO $test$
DECLARE
 loc uuid:='b1ef7322-86f9-4cf4-9d52-39ba32911ef6';
 product uuid:='6f43ad65-74d5-4db9-b931-1ecd6d124987';
 buyer uuid:='c9d1d89d-366a-42c0-b691-f56bad36af7f';
 actor uuid:='11111111-1111-4111-8111-111111111111';
 initial numeric;
 after_open numeric;
 att_count integer;
 evt_count integer;
 blocked boolean;
 open_key text:='open-test:'||gen_random_uuid()::text;
 response jsonb;
BEGIN
 IF to_regclass('public.p2_disposable_test_marker') IS NULL
 THEN RAISE EXCEPTION 'p2_open_test_disposable_only'; END IF;
 PERFORM set_config('app.p2_test_actor',actor::text,true);
 PERFORM set_config('app.p2_test_role','Administrador',true);
 IF has_function_privilege('anon','public.p2_four_attest_and_open(text,text,integer,uuid,text,boolean,text)','EXECUTE')
 OR has_function_privilege('service_role','public.p2_four_attest_and_open(text,text,integer,uuid,text,boolean,text)','EXECUTE')
 THEN RAISE EXCEPTION 'p2_open_exposed_to_wrong_role';END IF;
 IF NOT has_function_privilege('authenticated','public.p2_four_attest_and_open(text,text,integer,uuid,text,boolean,text)','EXECUTE')
 THEN RAISE EXCEPTION 'p2_open_not_exposed_to_authenticated';END IF;
 IF has_table_privilege('authenticated','public.p2_four_open_attestations','INSERT')
 OR has_table_privilege('authenticated','public.p2_four_open_attestations','UPDATE')
 THEN RAISE EXCEPTION 'p2_attestation_table_mutable';END IF;

 SELECT quantity INTO initial FROM public.inventory WHERE product_id=product AND location_id=loc;
 PERFORM public.p2_four_apply_internal('sorbato','receipt',1,loc,
 'open-fixture:'||gen_random_uuid(),'purchase_receipt',gen_random_uuid(),
 'DISPOSABLE ORIGINAL PACKAGE',buyer);

 blocked:=false;
 BEGIN
  PERFORM set_config('app.p2_test_role','VENDA',true);
  PERFORM public.p2_four_attest_and_open('sorbato','open_original_package',1,loc,
    open_key,true,'Abertura fisica confirmada por operador');
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%p2_physical_open_role_required%' THEN blocked:=true;ELSE RAISE;END IF;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'p2_wrong_role_opened';END IF;
 PERFORM set_config('app.p2_test_role','Administrador',true);

 blocked:=false;
 BEGIN
  PERFORM public.p2_four_attest_and_open('sorbato','open_original_package',1,loc,
    open_key,false,'Abertura fisica confirmada por operador');
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%p2_physical_confirmation_required%' THEN blocked:=true;ELSE RAISE;END IF;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'p2_unconfirmed_opened';END IF;

 blocked:=false;
 BEGIN
  PERFORM public.p2_four_attest_and_open('sorbato','open_original_bucket',1,loc,
    open_key,true,'Abertura fisica confirmada por operador');
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%p2_open_family_action_mismatch%' THEN blocked:=true;ELSE RAISE;END IF;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'p2_mismatched_container_opened';END IF;

 response:=public.p2_four_attest_and_open('sorbato','open_original_package',1,loc,
    open_key,true,'Pacote original lacrado conferido e aberto na Fabrica');
 IF response->>'attestationId' IS NULL THEN RAISE EXCEPTION 'p2_attestation_id_missing';END IF;
 SELECT quantity INTO after_open FROM public.inventory WHERE product_id=product AND location_id=loc;
 IF after_open<>initial+1000 THEN RAISE EXCEPTION 'p2_open_grams_not_atomic';END IF;
 SELECT count(*) INTO att_count FROM public.p2_four_open_attestations
 WHERE event_key=open_key AND attested_by=actor AND physical_confirmation AND
       storage_location_id=loc AND container_count=1;
 IF att_count<>1 THEN RAISE EXCEPTION 'p2_attestation_not_linked_to_actor';END IF;
 SELECT count(*) INTO evt_count FROM public.p2_four_sealed_events
 WHERE reference_type='p2_open_attestation'
   AND reference_id=(response->>'attestationId')::uuid;
 IF evt_count<>1 THEN RAISE EXCEPTION 'p2_sealed_open_not_linked_to_attestation';END IF;
 SELECT count(*) INTO evt_count FROM public.inventory_movements
 WHERE reference_type='p2_four_physical_open'
   AND reference_id=(response->>'attestationId')::uuid;
 IF evt_count<>1 THEN RAISE EXCEPTION 'p2_open_gram_movement_not_linked';END IF;

 blocked:=false;
 BEGIN
  PERFORM public.p2_four_attest_and_open('sorbato','open_original_package',1,loc,
    open_key,true,'Tentativa de repetir a abertura previamente registrada');
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%p2_open_event_already_attested%' THEN blocked:=true;ELSE RAISE;END IF;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'p2_open_replayed';END IF;

 blocked:=false;
 BEGIN
  PERFORM public.p2_four_attest_and_open('sorbato','open_original_package',1,loc,
    'open-shortage:'||gen_random_uuid(),true,
    'Tentativa de abrir outro pacote sem saldo fisico');
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%p2_insufficient_original_state%' THEN blocked:=true;ELSE RAISE;END IF;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'p2_shortage_open_allowed';END IF;
 SELECT count(*) INTO att_count FROM public.p2_four_open_attestations;
 IF att_count<>1 THEN RAISE EXCEPTION 'p2_failed_open_left_attestation';END IF;
 SELECT quantity INTO after_open FROM public.inventory WHERE product_id=product AND location_id=loc;
 IF after_open<>initial+1000 THEN RAISE EXCEPTION 'p2_failed_open_modified_grams';END IF;
END $test$;
ROLLBACK;
