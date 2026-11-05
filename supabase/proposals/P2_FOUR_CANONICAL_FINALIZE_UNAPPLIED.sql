-- UNAPPLIED: candidate extension of LIVE canonical finalizer.
-- Must be reviewed with real grants and verified physical action before activation.
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

  -- Transaction-scoped signal set only by the existing canonical separation
  -- finalization path. No parallel finalizer or direct stock writer.
  PERFORM set_config('app.p2_four_separation_order_id', p_order_id::text, true);
  v_stock_result := public.apply_order_stock_event(p_order_id, 'shipped');
  PERFORM set_config('app.p2_four_separation_order_id', '', true);

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
$function$

