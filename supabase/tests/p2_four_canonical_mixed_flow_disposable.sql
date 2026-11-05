-- ONLY synthetic disposable CI: full candidate canonical receipt/order RPCs.
-- Rollback is unconditional; does not assess LIVE permissions or operational fact.
BEGIN;
DO $test$
DECLARE
 loc uuid:='b1ef7322-86f9-4cf4-9d52-39ba32911ef6';
 italac uuid:='0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b';
 sorbato uuid:='6f43ad65-74d5-4db9-b931-1ecd6d124987';
 generic uuid:='11111111-1111-4111-8111-111111111119';
 po uuid:=gen_random_uuid();receipt uuid:=gen_random_uuid();
 pol1 uuid:=gen_random_uuid();pol2 uuid:=gen_random_uuid();
 order_id uuid:=gen_random_uuid();v_result jsonb;v_count integer;
BEGIN
 IF to_regclass('public.p2_disposable_test_marker') IS NULL
 THEN RAISE EXCEPTION 'p2_canonical_test_requires_disposable_marker';END IF;
 INSERT INTO public.purchase_orders(id,status) VALUES(po,'confirmado');
 INSERT INTO public.purchase_receipts(id,purchase_order_id,status,storage_location_id)
 VALUES(receipt,po,'draft',loc);
 INSERT INTO public.purchase_order_items
 (id,purchase_order_id,product_id,variant_id,purchase_presentation_id,purchase_unit_label)
 VALUES
 (pol1,po,italac,NULL,'1a72b347-97ba-414a-9ef9-783c2d175ea3','caixa'),
 (pol2,po,sorbato,NULL,'c9d1d89d-366a-42c0-b691-f56bad36af7f','pacote');
 INSERT INTO public.purchase_receipt_items
 (id,purchase_receipt_id,purchase_order_item_id,operational_received_qty,received_purchase_qty)
 VALUES
 (gen_random_uuid(),receipt,pol1,10665,1),
 (gen_random_uuid(),receipt,pol2,1000,1);
 v_result:=public.confirm_purchase_receipt_unguarded_01b(receipt);
 IF (v_result->>'movement_count')::integer<>2 THEN
  RAISE EXCEPTION 'p2_canonical_receipt_missing_two_physical_movements';END IF;
 v_result:=public.confirm_purchase_receipt_unguarded_01b(receipt);
 IF (v_result->>'already_confirmed')::boolean IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'p2_canonical_receipt_replay_was_not_idempotent';END IF;
 SELECT count(*) INTO v_count FROM public.p2_four_sealed_events
  WHERE reference_type='purchase_receipt';
 IF v_count<>2 THEN RAISE EXCEPTION 'p2_receipt_expected_two_sealed_events';END IF;
 SELECT count(*) INTO v_count FROM public.inventory
  WHERE product_id IN (italac,sorbato) AND quantity<>0;
 IF v_count<>0 THEN RAISE EXCEPTION 'p2_canonical_receipt_double_credited_grams';END IF;
 -- Add unrelated product to mixed outgoing order. Generic path must remain
 -- operational and decrement ONLY this item, not the P2 originals.
 INSERT INTO public.products(id,name,unit,variation_mode)
 VALUES(generic,'UNRELATED SYNTHETIC','un','sem_variacao');
 INSERT INTO public.inventory(product_id,location,location_id,quantity)
 VALUES(generic,'Fábrica',loc,10);
 INSERT INTO public.orders(id) VALUES(order_id);
 INSERT INTO public.order_items(
 id,order_id,product_id,variant_id,quantity,commercial_quantity,commercial_presentation_id)
 VALUES
 (gen_random_uuid(),order_id,italac,NULL,10665,1,'b1bdfd2f-0278-4273-9e19-2544c8a3d758'),
 (gen_random_uuid(),order_id,sorbato,NULL,1000,1,'684d4a55-5d3a-4c18-be47-818a1a3bc074'),
 (gen_random_uuid(),order_id,generic,NULL,10,NULL,NULL);
 v_result:=public.apply_order_stock_event(order_id,'confirmed');
 IF (v_result->>'applied')::boolean IS DISTINCT FROM false THEN
  RAISE EXCEPTION 'p2_canonical_confirmed_order_debited_stock';END IF;
 -- External shipment has no independently verified P2 physical event path.
 BEGIN
   PERFORM public.apply_order_stock_event(order_id,'external_shipped');
   RAISE EXCEPTION 'p2_external_without_evidence_allowed';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%p2_external_shipped_requires_verified_physical_event%' THEN RAISE; END IF;
 END;
 -- Direct shipped call must fail for P2 even if the order exists.
 BEGIN
   PERFORM public.apply_order_stock_event(order_id,'shipped');
   RAISE EXCEPTION 'p2_direct_shipped_was_allowed';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%p2_shipped_requires_canonical_separation%' THEN RAISE; END IF;
 END;
 v_result:=public.finalize_order_separation_unguarded_01b(order_id);
 v_result:=v_result->'stock_result';
 IF (v_result->>'applied')::boolean IS DISTINCT FROM true
 OR (v_result->>'movement_count')::integer<>3 THEN
  RAISE EXCEPTION 'p2_canonical_mixed_dispatch_count_wrong: %',v_result;END IF;
 SELECT count(*) INTO v_count FROM public.p2_four_sealed_stock WHERE units<>0;
 IF v_count<>0 THEN RAISE EXCEPTION 'p2_canonical_mixed_dispatch_left_originals';END IF;
 SELECT count(*) INTO v_count FROM public.inventory
  WHERE product_id IN (italac,sorbato) AND quantity<>0;
 IF v_count<>0 THEN RAISE EXCEPTION 'p2_canonical_mixed_dispatch_consumed_grams';END IF;
 SELECT quantity INTO v_count FROM public.inventory WHERE product_id=generic;
 IF v_count<>0 THEN RAISE EXCEPTION 'p2_canonical_generic_unrelated_item_not_debited';END IF;
 v_result:=public.finalize_order_separation_unguarded_01b(order_id);
 IF (v_result->>'already_finalized')::boolean IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'p2_canonical_mixed_dispatch_double_applied';END IF;
 -- Unknown P2 presentation must not trigger legacy generic grams fallback.
 UPDATE public.inventory SET quantity=5 WHERE product_id=generic;
 INSERT INTO public.orders(id) VALUES(gen_random_uuid()) RETURNING id INTO order_id;
 INSERT INTO public.order_items(
 id,order_id,product_id,variant_id,quantity,commercial_quantity,commercial_presentation_id)
 VALUES
 (gen_random_uuid(),order_id,
  'ef118d1c-e7c7-45e3-b796-3a9908840f3c',NULL,1000,1,NULL),
 (gen_random_uuid(),order_id,generic,NULL,5,NULL,NULL);
 BEGIN
  v_result:=public.finalize_order_separation_unguarded_01b(order_id);
  RAISE EXCEPTION 'p2_unrecognized_presentation_was_dispatched';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%p2_acido_unknown_presentation%' THEN RAISE;END IF;
 END;
 SELECT quantity INTO v_count FROM public.inventory WHERE product_id=generic;
 IF v_count<>5 THEN RAISE EXCEPTION 'p2_failed_mixed_order_changed_generic_stock';END IF;

 -- P2 shortage on a mixed order must atomically reject the entire shipment,
 -- without consuming the unrelated generic product in the same order.
 INSERT INTO public.orders(id) VALUES(gen_random_uuid()) RETURNING id INTO order_id;
 INSERT INTO public.order_items(
 id,order_id,product_id,variant_id,quantity,commercial_quantity,commercial_presentation_id)
 VALUES
 (gen_random_uuid(),order_id,sorbato,NULL,1000,1,
  '684d4a55-5d3a-4c18-be47-818a1a3bc074'),
 (gen_random_uuid(),order_id,generic,NULL,5,NULL,NULL);
 BEGIN
   PERFORM public.finalize_order_separation_unguarded_01b(order_id);
   RAISE EXCEPTION 'p2_shortage_mixed_order_was_dispatched';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%p2_insufficient_original_packages_for_shipment%'
   THEN RAISE; END IF;
 END;
 SELECT quantity INTO v_count FROM public.inventory WHERE product_id=generic;
 IF v_count<>5 THEN RAISE EXCEPTION 'p2_shortage_debited_generic_inventory';END IF;
 IF EXISTS(SELECT 1 FROM public.inventory_movements
   WHERE reference_id=order_id AND movement_type='out')
 THEN RAISE EXCEPTION 'p2_shortage_left_generic_out_movement';END IF;
 IF EXISTS(SELECT 1 FROM public.p2_four_sealed_events
   WHERE reference_type='order_stock_event' AND reference_id=order_id)
 THEN RAISE EXCEPTION 'p2_shortage_left_sealed_event';END IF;


END $test$;
ROLLBACK;
