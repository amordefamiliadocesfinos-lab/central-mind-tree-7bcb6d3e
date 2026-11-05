-- Disposable fixture only: exact unguarded separation function read LIVE 2026-11-05.
-- No production function modified. Includes same transaction ordering.
CREATE OR REPLACE FUNCTION public.finalize_order_separation_unguarded_01b(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_separation public.order_separation;
  v_stock_result jsonb;
  v_operational_status text;
BEGIN
  SELECT operational_status INTO v_operational_status
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF v_operational_status = 'cancelled' THEN
    RAISE EXCEPTION 'Pedido cancelado não pode ser finalizado.';
  END IF;

  INSERT INTO public.order_separation (order_id)
  VALUES (p_order_id)
  ON CONFLICT (order_id) DO NOTHING;

  SELECT * INTO v_separation
  FROM public.order_separation
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF v_separation.separation_status = 'finalized' THEN
    UPDATE public.orders
    SET operational_status = 'finalized', updated_at = now()
    WHERE id = p_order_id;
    RETURN jsonb_build_object('already_finalized', true, 'stock_result', NULL);
  END IF;

  v_stock_result := public.apply_order_stock_event(p_order_id, 'shipped');

  UPDATE public.order_separation
  SET separation_status = 'finalized',
      finalized_at = now(),
      finalized_by = auth.uid(),
      updated_at = now()
  WHERE order_id = p_order_id;

  UPDATE public.orders
  SET operational_status = 'finalized',
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('already_finalized', false, 'stock_result', v_stock_result);
END;
$function$;

BEGIN;
DO $test$
DECLARE
  loc uuid:='b1ef7322-86f9-4cf4-9d52-39ba32911ef6';
  sorbato uuid:='6f43ad65-74d5-4db9-b931-1ecd6d124987';
  generic uuid:='22222222-2222-4222-8222-222222222222';
  oid uuid:=gen_random_uuid();
  replay jsonb;
  initial jsonb;
  stock numeric;
  n integer;
  blocked boolean:=false;
  bad_id uuid:=gen_random_uuid();
BEGIN
  IF to_regclass('public.p2_disposable_test_marker') IS NULL
  THEN RAISE EXCEPTION 'disposable_only';END IF;
  PERFORM public.p2_four_apply_internal('sorbato','receipt',1,loc,
    'p2-finalize-receipt:'||gen_random_uuid()::text,'purchase_receipt',
    gen_random_uuid(),'SYNTHETIC RECEIPT',
    'c9d1d89d-366a-42c0-b691-f56bad36af7f');
  INSERT INTO public.products(id,name,unit,variation_mode)
  VALUES(generic,'SYNTHETIC UNRELATED','g','sem_variacao');
  INSERT INTO public.inventory(product_id,location,location_id,quantity)
  VALUES(generic,'Fábrica',loc,7);
  INSERT INTO public.orders(id,operational_status) VALUES(oid,'todo');
  INSERT INTO public.order_items(
    id,order_id,product_id,variant_id,quantity,commercial_quantity,commercial_presentation_id
  ) VALUES
    (gen_random_uuid(),oid,sorbato,NULL,1000,1,
      '684d4a55-5d3a-4c18-be47-818a1a3bc074'),
    (gen_random_uuid(),oid,generic,NULL,7,NULL,NULL);
  initial:=public.finalize_order_separation_unguarded_01b(oid);
  IF (initial->>'already_finalized')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'p2_finalize_not_applied';END IF;
  SELECT quantity INTO stock FROM public.inventory WHERE product_id=generic;
  IF stock<>0 THEN RAISE EXCEPTION 'p2_finalize_generic_stock_incorrect';END IF;
  SELECT units INTO n FROM public.p2_four_sealed_stock
   WHERE product_id=sorbato AND storage_location_id=loc
     AND physical_state='originalPackages1kg';
  IF n<>0 THEN RAISE EXCEPTION 'p2_finalize_original_still_present';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.order_separation WHERE order_id=oid
    AND separation_status='finalized' AND finalized_at IS NOT NULL)
    OR NOT EXISTS(SELECT 1 FROM public.orders
    WHERE id=oid AND operational_status='finalized') THEN
    RAISE EXCEPTION 'p2_finalize_not_atomic_with_separation';END IF;
  replay:=public.finalize_order_separation_unguarded_01b(oid);
  IF (replay->>'already_finalized')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'p2_finalize_repeat_applied';END IF;
  SELECT count(*) INTO n FROM public.p2_four_sealed_events
   WHERE reference_type='order_stock_event' AND reference_id=oid;
  IF n<>1 THEN RAISE EXCEPTION 'p2_finalize_duplicate_sealed_event';END IF;

  -- Cancelled order must not finalize or consume any stock.
  INSERT INTO public.orders(id,operational_status) VALUES(bad_id,'cancelled');
  BEGIN
    PERFORM public.finalize_order_separation_unguarded_01b(bad_id);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Pedido cancelado não pode ser finalizado%' THEN blocked:=true;
    ELSE RAISE; END IF;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'p2_finalize_cancelled_was_allowed';END IF;
END $test$;
ROLLBACK;
