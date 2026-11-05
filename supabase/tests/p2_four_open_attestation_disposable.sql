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

 -- Negative operational acceptance: a missing authenticated identity, inactive
 -- or unknown location, and insufficient opening description fail closed.
 blocked:=false;
 PERFORM set_config('app.p2_test_actor','',true);
 BEGIN
  PERFORM public.p2_four_attest_and_open('sorbato','open_original_package',1,loc,
    open_key,true,'Pacote lacrado efetivamente aberto em teste isolado');
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%p2_physical_open_role_required%' THEN blocked:=true; ELSE RAISE; END IF;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'p2_null_identity_opened'; END IF;
 PERFORM set_config('app.p2_test_actor',actor::text,true);

 blocked:=false;
 BEGIN
  PERFORM public.p2_four_attest_and_open('sorbato','open_original_package',1,gen_random_uuid(),
    open_key,true,'Pacote lacrado fisicamente conferido no teste');
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%p2_invalid_or_inactive_location%' THEN blocked:=true; ELSE RAISE; END IF;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'p2_invalid_location_opened'; END IF;

 blocked:=false;
 BEGIN
  PERFORM public.p2_four_attest_and_open('sorbato','open_original_package',1,loc,
    open_key,true,'curta');
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%p2_open_evidence_detail_required%' THEN blocked:=true; ELSE RAISE; END IF;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'p2_weak_note_opened'; END IF;

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

DO $four_families$
DECLARE
 loc uuid:='b1ef7322-86f9-4cf4-9d52-39ba32911ef6';
 it uuid:='0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b';
 it_buy uuid:='1a72b347-97ba-414a-9ef9-783c2d175ea3';
 bucket uuid:='d913f0f2-4893-4985-9976-fcd9119a57b1';
 acid uuid:='ef118d1c-e7c7-45e3-b796-3a9908840f3c';
 row_before numeric; row_after numeric; n integer;
 v jsonb;
BEGIN
 IF to_regclass('public.p2_disposable_test_marker') IS NULL
 THEN RAISE EXCEPTION 'p2_four_open_extra_disposable_only';END IF;
 PERFORM set_config('app.p2_test_actor','11111111-1111-4111-8111-111111111111',true);
 PERFORM set_config('app.p2_test_role','LIDER PRODUÇÃO',true);
 -- Italac: splitting intact box creates units, NOT generic 10665 grams.
 SELECT quantity INTO row_before FROM public.inventory WHERE product_id=it AND location_id=loc;
 PERFORM public.p2_four_apply_internal('italac','receipt',1,loc,
    'it-open-fixture:'||gen_random_uuid(),'purchase_receipt',gen_random_uuid(),
    'DISPOSABLE ITALAC ORIGINAL BOX',it_buy);
 v:=public.p2_four_attest_and_open('italac','open_original_box',1,loc,
    'it-box:'||gen_random_uuid(),true,'Caixa original Italac fisicamente aberta e conferida');
 SELECT units INTO n FROM public.p2_four_sealed_stock
 WHERE product_id=it AND storage_location_id=loc AND physical_state='intactUnits395';
 IF n<>27 THEN RAISE EXCEPTION 'p2_italac_split_not_27_intact';END IF;
 SELECT quantity INTO row_after FROM public.inventory WHERE product_id=it AND location_id=loc;
 IF row_after IS DISTINCT FROM row_before THEN RAISE EXCEPTION 'p2_italac_box_incorrect_gram_credit';END IF;
 v:=public.p2_four_attest_and_open('italac','open_intact_unit',1,loc,
    'it-unit:'||gen_random_uuid(),true,'Uma unidade intacta Italac de 395g aberta na Fabrica');
 SELECT quantity INTO row_after FROM public.inventory WHERE product_id=it AND location_id=loc;
 IF row_after<>row_before+395 THEN RAISE EXCEPTION 'p2_italac_unit_not_395g';END IF;
 SELECT units INTO n FROM public.p2_four_sealed_stock
 WHERE product_id=it AND storage_location_id=loc AND physical_state='intactUnits395';
 IF n<>26 THEN RAISE EXCEPTION 'p2_italac_26_intact_expected';END IF;

 -- Acid and Ivoti: exact original presentation; no opened grams at receipt.
 FOR v IN SELECT value FROM jsonb_array_elements(
  '[{"family":"acido","product":"ef118d1c-e7c7-45e3-b796-3a9908840f3c",
     "purchase":"1c7268cd-fcd9-4d98-aa14-65f76ef72a0b","action":"open_original_package","grams":1000},
    {"family":"ivoti","product":"d913f0f2-4893-4985-9976-fcd9119a57b1",
     "purchase":"fcd94ec6-1fc6-4bab-bc6f-8436279ca737","action":"open_original_bucket","grams":9800}]'::jsonb
 ) LOOP
  SELECT quantity INTO row_before FROM public.inventory
  WHERE product_id=(v->>'product')::uuid AND location_id=loc;
  PERFORM public.p2_four_apply_internal(v->>'family','receipt',1,loc,
      'open-fixture:'||gen_random_uuid(),'purchase_receipt',gen_random_uuid(),
      'DISPOSABLE ORIGINAL CONTAINER',(v->>'purchase')::uuid);
  SELECT quantity INTO row_after FROM public.inventory
  WHERE product_id=(v->>'product')::uuid AND location_id=loc;
  IF row_after IS DISTINCT FROM row_before
  THEN RAISE EXCEPTION 'p2_open_receipt_double_grams_%',v->>'family';END IF;
  PERFORM public.p2_four_attest_and_open(
      v->>'family',v->>'action',1,loc,'open-other:'||gen_random_uuid(),
      true,'Recipiente original aberto com conferencia fisica do operador');
  SELECT quantity INTO row_after FROM public.inventory
  WHERE product_id=(v->>'product')::uuid AND location_id=loc;
  IF row_after<>row_before+(v->>'grams')::numeric
  THEN RAISE EXCEPTION 'p2_open_wrong_grams_%',v->>'family';END IF;
 END LOOP;
 -- Every added attestation must be traceable to sealed events.
 SELECT count(*) INTO n FROM public.p2_four_open_attestations WHERE
 source_event_key LIKE 'p2:physical_open:%';
 IF n<>5 THEN RAISE EXCEPTION 'p2_expected_five_attestations_actual_%',n;END IF;
END $four_families$;

-- Exercise the actual SQL role boundary (the identity itself is synthetic).
SET LOCAL ROLE authenticated;
DO $auth_access$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.p2_four_attest_and_open(
   'sorbato','open_original_package',1,
   'b1ef7322-86f9-4cf4-9d52-39ba32911ef6',
   'access-test:'||gen_random_uuid()::text,FALSE,
   'Abertura fisica nao confirmada para verificar a entrada');
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%p2_physical_confirmation_required%' THEN denied:=true;
  ELSE RAISE;END IF;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'p2_authenticated_rpc_not_reached';END IF;
END $auth_access$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $anon_access$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.p2_four_attest_and_open(
   'sorbato','open_original_package',1,
   'b1ef7322-86f9-4cf4-9d52-39ba32911ef6',
   'anon-test:'||gen_random_uuid()::text,TRUE,
   'Abertura fisica indevidamente pedida por anonimo');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'p2_anon_routed_to_opening';END IF;
END $anon_access$;
RESET ROLE;
ROLLBACK;
