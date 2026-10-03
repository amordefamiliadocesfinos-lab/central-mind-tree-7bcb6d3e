-- EXECUCAO 01-B — complemento de integridade para usuarios autenticados.
-- O perfil PRODUCAO nao deve conseguir contornar o shell exclusivo chamando RPCs administrativas diretamente.

-- Helper fisico cru: somente funcoes SECURITY DEFINER internas / service role.
REVOKE ALL ON FUNCTION public.apply_order_stock_event(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_order_stock_event(uuid,text) TO service_role;

-- Preserva implementacoes atuais e recoloca contratos publicos com gate de papel.
ALTER FUNCTION public.create_unified_sale(jsonb,jsonb)
  RENAME TO create_unified_sale_unguarded_01b;
ALTER FUNCTION public.finalize_order_separation(uuid)
  RENAME TO finalize_order_separation_unguarded_01b;
ALTER FUNCTION public.confirm_purchase_receipt(uuid)
  RENAME TO confirm_purchase_receipt_unguarded_01b;
ALTER FUNCTION public.link_order_to_existing_financial_entry(uuid,uuid,numeric,text,text)
  RENAME TO link_order_to_existing_financial_entry_unguarded_01b;

REVOKE ALL ON FUNCTION public.create_unified_sale_unguarded_01b(jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_order_separation_unguarded_01b(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_purchase_receipt_unguarded_01b(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_order_to_existing_financial_entry_unguarded_01b(uuid,uuid,numeric,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_unified_sale_unguarded_01b(jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_order_separation_unguarded_01b(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_purchase_receipt_unguarded_01b(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.link_order_to_existing_financial_entry_unguarded_01b(uuid,uuid,numeric,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.create_unified_sale(p_order jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role'
     AND COALESCE(public.current_app_user_role(), '') NOT IN ('Administrador', 'VENDA', 'LIDER PRODUÇÃO') THEN
    RAISE EXCEPTION 'operations_order_write_required';
  END IF;
  RETURN public.create_unified_sale_unguarded_01b(p_order, p_items);
END;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_order_separation(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role'
     AND COALESCE(public.current_app_user_role(), '') NOT IN ('Administrador', 'VENDA', 'LIDER PRODUÇÃO') THEN
    RAISE EXCEPTION 'operations_order_write_required';
  END IF;
  RETURN public.finalize_order_separation_unguarded_01b(p_order_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_purchase_receipt(p_purchase_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role'
     AND COALESCE(public.current_app_user_role(), '') NOT IN ('Administrador', 'VENDA', 'LIDER PRODUÇÃO') THEN
    RAISE EXCEPTION 'operations_order_write_required';
  END IF;
  RETURN public.confirm_purchase_receipt_unguarded_01b(p_purchase_order_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.link_order_to_existing_financial_entry(
  p_order_id uuid,
  p_financial_entry_id uuid,
  p_value numeric,
  p_description text,
  p_notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role'
     AND COALESCE(public.current_app_user_role(), '') NOT IN ('Administrador', 'VENDA', 'LIDER PRODUÇÃO') THEN
    RAISE EXCEPTION 'operations_order_write_required';
  END IF;
  RETURN public.link_order_to_existing_financial_entry_unguarded_01b(
    p_order_id, p_financial_entry_id, p_value, p_description, p_notes
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_unified_sale(jsonb,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finalize_order_separation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_purchase_receipt(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.link_order_to_existing_financial_entry(uuid,uuid,numeric,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_unified_sale(jsonb,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_order_separation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_purchase_receipt(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.link_order_to_existing_financial_entry(uuid,uuid,numeric,text,text) TO authenticated, service_role;
