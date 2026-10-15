-- Status cancelado em Pedidos deve usar cancelamento operacional canônico.
-- Não toca no estoque: somente pedidos não finalizados podem ser cancelados.
CREATE OR REPLACE FUNCTION public.transition_order_status_with_stock(
 p_order_id uuid, p_status text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_operational text;
BEGIN
 IF auth.role()<>'service_role' AND COALESCE(public.current_app_user_role(),'') NOT IN ('Administrador','VENDA','LIDER PRODUÇÃO') THEN
  RAISE EXCEPTION 'operations_order_write_required';
 END IF;
 SELECT operational_status INTO v_operational FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pedido nao encontrado.'; END IF;
 IF p_status='cancelado' THEN
  PERFORM public.set_order_operational_status_unguarded_01b(p_order_id,'cancelled');
  RETURN jsonb_build_object('stock_event',NULL,'movement_count',0,'operational_status','cancelled');
 END IF;
 IF v_operational='cancelled' THEN
  RAISE EXCEPTION 'Pedido cancelado nao pode ser reativado alterando o status comercial.';
 END IF;
 RETURN public.transition_order_status_with_stock_unguarded_01b(p_order_id,p_status);
END $$;
REVOKE ALL ON FUNCTION public.transition_order_status_with_stock(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transition_order_status_with_stock(uuid,text) TO authenticated,service_role;
