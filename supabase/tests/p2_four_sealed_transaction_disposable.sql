-- DISPOSABLE DATABASE ONLY. DO NOT RUN IN LOVABLE CLOUD / PRODUCTION.
-- Prerequisites: a disposable clone with real product/presentation IDs from
-- PAINEL CENTRAL, both P2 SQL proposals applied, and a manually created
-- public.p2_disposable_test_marker table. No automatic migration or seed.
-- Tests are rolled back at end. No test is claimed as EXECUTED by this file.
BEGIN;
DO $test$
DECLARE
 v_loc uuid;
 v_loc_name text;
 v_it uuid:='0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b';
 v_it_buy uuid:='1a72b347-97ba-414a-9ef9-783c2d175ea3';
 v_it_ml1 uuid:='008d57c4-63b6-4c30-80fd-161ca368fd66';
 v_it_ml2 uuid:='b1bdfd2f-0278-4273-9e19-2544c8a3d758';
 v_case jsonb;
 v_product uuid;
 v_family text;
 v_buy uuid;
 v_sale uuid;
 v_factor integer;
 v_open text;
 v_dispatch text;
 v_event text;
 v_before numeric;
 v_after numeric;
 v_stock integer;
 v_blocked boolean;
BEGIN
 IF to_regclass('public.p2_disposable_test_marker') IS NULL THEN
  RAISE EXCEPTION 'P2 TEST MUST NOT RUN WITHOUT DISPOSABLE DATABASE MARKER';
 END IF;
 SELECT id,name INTO v_loc,v_loc_name FROM public.storage_locations
  WHERE is_active AND name='Fábrica';
 IF v_loc IS NULL THEN RAISE EXCEPTION 'disposable_fixture_location_missing'; END IF;
 IF NOT has_function_privilege('postgres',
  'public.p2_four_apply_internal(text,text,integer,uuid,text,text,uuid,text,uuid)',
  'EXECUTE') THEN RAISE EXCEPTION 'p2_owner_cannot_invoke_candidate';END IF;
 -- The generic legacy stock path must reject any of the four families
 -- even when the presentation ID is absent or mislabeled.
 FOR v_case IN SELECT value FROM jsonb_array_elements(
   '["0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b",
     "6f43ad65-74d5-4db9-b931-1ecd6d124987",
     "ef118d1c-e7c7-45e3-b796-3a9908840f3c",
     "d913f0f2-4893-4985-9976-fcd9119a57b1"]'::jsonb
 ) LOOP
  v_blocked:=false;
  BEGIN
   PERFORM public.p2_four_assert_generic_inventory_safe((v_case#>>'{}')::uuid,NULL);
  EXCEPTION WHEN OTHERS THEN
   IF SQLERRM LIKE '%p2_four_original_or_ambiguous_inventory_requires_sealed_routing%'
     THEN v_blocked:=true;
   ELSE RAISE; END IF;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'generic_fallback_allowed_%',v_case;END IF;
 END LOOP;
 IF has_function_privilege('authenticated',
  'public.p2_four_apply_internal(text,text,integer,uuid,text,text,uuid,text,uuid)',
  'EXECUTE') OR has_function_privilege('service_role',
  'public.p2_four_apply_internal(text,text,integer,uuid,text,text,uuid,text,uuid)',
  'EXECUTE') THEN RAISE EXCEPTION 'p2_internal_rpc_publicly_exposed';END IF;

 -- Italac: 1 original factory box can become 27 intact 395g units, never
 -- an original box again; ML1 dispatch must consume intact units only.
 v_event:='p2-test:'||gen_random_uuid()::text;
 PERFORM public.p2_four_apply_internal('italac','receipt',1,v_loc,
   v_event,'purchase_receipt',gen_random_uuid(),'DISPOSABLE SYNTHETIC BOX',v_it_buy);
 v_event:='p2-test:'||gen_random_uuid()::text;
 PERFORM public.p2_four_apply_internal('italac','open_original_box',1,v_loc,
   v_event,'p2_physical_test',gen_random_uuid(),'DISPOSABLE SYNTHETIC OPEN',NULL);
 SELECT units INTO v_stock FROM public.p2_four_sealed_stock
  WHERE product_id=v_it AND storage_location_id=v_loc AND physical_state='intactUnits395';
 IF v_stock<>27 THEN RAISE EXCEPTION 'italac_box_did_not_produce_27_units';END IF;
 v_blocked:=false;
 BEGIN
  PERFORM public.p2_four_apply_internal('italac','dispatch_original_box',1,v_loc,
   'p2-test:'||gen_random_uuid()::text,'order_stock_event',gen_random_uuid(),
   'DISPOSABLE SYNTHETIC DISPATCH',v_it_ml2);
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%p2_insufficient_original_state%' THEN v_blocked:=true;
  ELSE RAISE; END IF;
 END;
 IF NOT v_blocked THEN RAISE EXCEPTION 'ML2_RECOMPOSED_FROM_27_UNITS';END IF;
 PERFORM public.p2_four_apply_internal('italac','dispatch_intact_units',2,v_loc,
  'p2-test:'||gen_random_uuid()::text,'order_stock_event',gen_random_uuid(),
  'DISPOSABLE SYNTHETIC ML1 DISPATCH',v_it_ml1);
 SELECT units INTO v_stock FROM public.p2_four_sealed_stock
  WHERE product_id=v_it AND storage_location_id=v_loc AND physical_state='intactUnits395';
 IF v_stock<>25 THEN RAISE EXCEPTION 'ML1_UNITS_NOT_DEBITED';END IF;
 SELECT quantity INTO STRICT v_before FROM public.inventory
  WHERE product_id=v_it AND location=v_loc_name AND location_id=v_loc AND variant_id IS NULL;
 PERFORM public.p2_four_apply_internal('italac','open_intact_unit',1,v_loc,
  'p2-test:'||gen_random_uuid()::text,'p2_physical_test',gen_random_uuid(),
  'DISPOSABLE SYNTHETIC UNIT OPEN',NULL);
 SELECT quantity INTO STRICT v_after FROM public.inventory
  WHERE product_id=v_it AND location=v_loc_name AND location_id=v_loc AND variant_id IS NULL;
 IF v_after<>v_before+395 THEN RAISE EXCEPTION 'italac_unit_open_grams_not_atomic';END IF;

 -- Sorbato, Acid commercial 'kg', Ivoti. Each original receipt increments
 -- sealed stock only; open moves 1 physical original to grams; dispatch
 -- consumes remaining original with no fallback to opened grams.
 FOR v_case IN SELECT value FROM jsonb_array_elements(
  '[{"family":"sorbato","product":"6f43ad65-74d5-4db9-b931-1ecd6d124987","buy":"c9d1d89d-366a-42c0-b691-f56bad36af7f","sale":"684d4a55-5d3a-4c18-be47-818a1a3bc074","factor":1000,"open":"open_original_package","dispatch":"dispatch_original_package"},
    {"family":"acido","product":"ef118d1c-e7c7-45e3-b796-3a9908840f3c","buy":"1c7268cd-fcd9-4d98-aa14-65f76ef72a0b","sale":"f093c456-f757-4efe-b575-8177b8b1d607","factor":1000,"open":"open_original_package","dispatch":"dispatch_original_package"},
    {"family":"ivoti","product":"d913f0f2-4893-4985-9976-fcd9119a57b1","buy":"fcd94ec6-1fc6-4bab-bc6f-8436279ca737","sale":"40809f6d-687c-493b-ac4d-67a602cceba0","factor":9800,"open":"open_original_bucket","dispatch":"dispatch_original_bucket"}]'::jsonb
 ) LOOP
  v_family:=v_case->>'family';
  v_product:=(v_case->>'product')::uuid;
  v_buy:=(v_case->>'buy')::uuid;
  v_sale:=(v_case->>'sale')::uuid;
  v_factor:=(v_case->>'factor')::integer;
  v_open:=v_case->>'open';
  v_dispatch:=v_case->>'dispatch';
  SELECT quantity INTO STRICT v_before FROM public.inventory WHERE product_id=v_product
    AND variant_id IS NULL AND location=v_loc_name AND location_id=v_loc;
  -- Exact presentation identity is mandatory even if the unit conversion matches.
  v_blocked:=false;
  BEGIN
   PERFORM public.p2_four_apply_internal(v_family,'receipt',1,v_loc,
    'p2-test:'||gen_random_uuid()::text,'purchase_receipt',gen_random_uuid(),
    'DISPOSABLE WRONG PRESENTATION',v_sale);
  EXCEPTION WHEN OTHERS THEN
   IF SQLERRM LIKE '%p2_purchase_presentation_mismatch%' THEN v_blocked:=true;
   ELSE RAISE;END IF;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'wrong_purchase_presentation_%',v_family;END IF;
  v_event:='p2-test:'||gen_random_uuid()::text;
  PERFORM public.p2_four_apply_internal(v_family,'receipt',2,v_loc,v_event,
    'purchase_receipt',gen_random_uuid(),'DISPOSABLE SYNTHETIC RECEIPT',v_buy);
  SELECT quantity INTO STRICT v_after FROM public.inventory WHERE product_id=v_product
    AND variant_id IS NULL AND location=v_loc_name AND location_id=v_loc;
  IF v_after<>v_before THEN RAISE EXCEPTION 'receipt_duplicated_grams_%',v_family;END IF;
  v_blocked:=false;
  BEGIN
   PERFORM public.p2_four_apply_internal(v_family,'receipt',2,v_loc,v_event,
     'purchase_receipt',gen_random_uuid(),'DISPOSABLE REPLAY',v_buy);
  EXCEPTION WHEN OTHERS THEN
   IF SQLERRM LIKE '%p2_duplicate_or_conflicting_event%' THEN v_blocked:=true;
   ELSE RAISE; END IF;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'duplicate_event_accepted_%',v_family;END IF;
  PERFORM public.p2_four_apply_internal(v_family,v_open,1,v_loc,
    'p2-test:'||gen_random_uuid()::text,'p2_physical_test',gen_random_uuid(),
    'DISPOSABLE SYNTHETIC OPEN',NULL);
  SELECT quantity INTO STRICT v_after FROM public.inventory WHERE product_id=v_product
    AND variant_id IS NULL AND location=v_loc_name AND location_id=v_loc;
  IF v_after<>v_before+v_factor THEN
    RAISE EXCEPTION 'open_grams_not_conserved_%',v_family;END IF;
  PERFORM public.p2_four_apply_internal(v_family,v_dispatch,1,v_loc,
    'p2-test:'||gen_random_uuid()::text,'order_stock_event',gen_random_uuid(),
    'DISPOSABLE SYNTHETIC DISPATCH',v_sale);
  SELECT sum(units)::integer INTO v_stock FROM public.p2_four_sealed_stock
   WHERE product_id=v_product AND storage_location_id=v_loc;
  IF v_stock<>0 THEN RAISE EXCEPTION 'sealed_original_left_after_open_dispatch_%',v_family;END IF;
 END LOOP;
END $test$;
ROLLBACK;
