-- Preserva a pré-validação completa e a atomicidade da saída física. O DETAIL
-- passa a conter todas as faltas, para que a interface não reduza o erro a um
-- alerta genérico nem obrigue o operador a tentar uma identidade por vez.
CREATE OR REPLACE FUNCTION public.apply_order_stock_event(p_order_id uuid, p_event text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item record; v_inventory record; v_available numeric; v_remaining numeric; v_take numeric;
  v_key text; v_movement_count integer := 0; v_shortages jsonb := '[]'::jsonb;
BEGIN
  IF p_event NOT IN ('confirmed','cancelled','shipped','external_shipped') THEN RAISE EXCEPTION 'Evento de estoque de pedido inválido: %', p_event; END IF;
  PERFORM 1 FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF p_event IN ('confirmed','cancelled') THEN RETURN jsonb_build_object('event',p_event,'applied',false,'already_applied',false,'movement_count',0); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id=p_order_id) THEN RAISE EXCEPTION 'Pedido sem itens não pode ser finalizado fisicamente'; END IF;
  IF EXISTS (SELECT 1 FROM public.inventory_movements WHERE reference_id=p_order_id AND movement_type='out' AND (reference_type='order' OR (reference_type='order_stock_event' AND event_key LIKE 'order:'||p_order_id::text||':physical_out:%'))) THEN RETURN jsonb_build_object('event',p_event,'applied',false,'already_applied',true,'movement_count',0); END IF;
  FOR v_item IN SELECT oi.product_id,oi.variant_id,sum(oi.quantity) required_quantity,p.name product_name,pv.variant_name,COALESCE(pv.unit,p.unit) unit FROM public.order_items oi JOIN public.products p ON p.id=oi.product_id LEFT JOIN public.product_variants pv ON pv.id=oi.variant_id WHERE oi.order_id=p_order_id GROUP BY oi.product_id,oi.variant_id,p.name,pv.variant_name,p.unit,pv.unit LOOP
    v_available:=0;
    FOR v_inventory IN SELECT quantity FROM public.inventory WHERE product_id=v_item.product_id AND variant_id IS NOT DISTINCT FROM v_item.variant_id FOR UPDATE LOOP v_available:=v_available+v_inventory.quantity; END LOOP;
    IF v_available<v_item.required_quantity THEN v_shortages:=v_shortages||jsonb_build_array(jsonb_build_object('product_id',v_item.product_id,'variant_id',v_item.variant_id,'product_name',v_item.product_name,'variant_name',v_item.variant_name,'unit',v_item.unit,'required_quantity',v_item.required_quantity,'available_quantity',v_available,'missing_quantity',v_item.required_quantity-v_available)); END IF;
  END LOOP;
  IF jsonb_array_length(v_shortages)>0 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='Estoque insuficiente para finalizar a separação.',DETAIL=v_shortages::text; END IF;
  FOR v_item IN SELECT product_id,variant_id,sum(quantity) required_quantity FROM public.order_items WHERE order_id=p_order_id GROUP BY product_id,variant_id LOOP
    v_remaining:=v_item.required_quantity;
    FOR v_inventory IN SELECT id,location,quantity FROM public.inventory WHERE product_id=v_item.product_id AND variant_id IS NOT DISTINCT FROM v_item.variant_id AND quantity>0 ORDER BY quantity DESC,id FOR UPDATE LOOP
      EXIT WHEN v_remaining<=0; v_take:=LEAST(v_remaining,v_inventory.quantity); v_key:='order:'||p_order_id::text||':physical_out:'||v_item.product_id::text||':'||COALESCE(v_item.variant_id::text,'simple')||':'||COALESCE(v_inventory.location,'sem-localizacao');
      UPDATE public.inventory SET quantity=quantity-v_take,updated_at=now() WHERE id=v_inventory.id;
      INSERT INTO public.inventory_movements(product_id,variant_id,movement_type,quantity,previous_balance,new_balance,location,reference_type,reference_id,event_key,notes) VALUES(v_item.product_id,v_item.variant_id,'out',v_take,v_inventory.quantity,v_inventory.quantity-v_take,v_inventory.location,'order_stock_event',p_order_id,v_key,'Saída física única por expedição de pedido');
      v_remaining:=v_remaining-v_take; v_movement_count:=v_movement_count+1;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('event',p_event,'applied',true,'already_applied',false,'movement_count',v_movement_count);
END; $$;
