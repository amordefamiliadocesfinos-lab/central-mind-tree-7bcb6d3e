-- Corrige a assinatura pública da RPC de recebimento de compras.
-- O cliente chama confirm_purchase_receipt com p_receipt_id.
-- Uma migration de integridade recriou o wrapper com o nome de argumento
-- p_purchase_order_id, quebrando a resolução nomeada do PostgREST.
-- A função interna continua recebendo o UUID do receipt e não é alterada.

DROP FUNCTION IF EXISTS public.confirm_purchase_receipt(uuid);

CREATE FUNCTION public.confirm_purchase_receipt(
  p_receipt_id uuid
)
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

  RETURN public.confirm_purchase_receipt_unguarded_01b(p_receipt_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.confirm_purchase_receipt(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_purchase_receipt(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.confirm_purchase_receipt(uuid) IS
  'Confirma um recebimento físico de compra pelo receipt_id; wrapper operacional com gate de papel.';
