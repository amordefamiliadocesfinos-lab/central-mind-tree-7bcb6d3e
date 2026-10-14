-- Preserve the deployed billing contract; change only the amount selected for final partial purchases.
DO $patch$
DECLARE v_def text; v_anchor text; v_add text;
BEGIN
  SELECT pg_get_functiondef('public.register_purchase_billing(uuid,jsonb)'::regprocedure) INTO v_def;
  v_anchor := E'  WHERE purchase_order_id = p_purchase_order_id;\n\n  IF v_total <= 0 THEN';
  v_add := E'  WHERE purchase_order_id = p_purchase_order_id;\n\n  IF EXISTS (SELECT 1 FROM public.purchase_final_closures WHERE purchase_order_id=p_purchase_order_id) THEN\n    SELECT effective_amount INTO v_total FROM public.purchase_final_closures WHERE purchase_order_id=p_purchase_order_id;\n  END IF;\n\n  IF v_total <= 0 THEN';
  IF position(v_add IN v_def)>0 THEN RETURN; END IF;
  IF position(v_anchor IN v_def)=0 THEN RAISE EXCEPTION 'billing_contract_changed'; END IF;
  EXECUTE replace(v_def,v_anchor,v_add);
END $patch$;
