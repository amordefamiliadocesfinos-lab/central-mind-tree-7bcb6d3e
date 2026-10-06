-- Correção de regressão de uso real na Central de Separação.
-- A camada de role gate criada em 20261003224500 declarou retorno jsonb,
-- mas devolvia diretamente o composite order_separation da função interna.
-- Preserva o gate atual e normaliza o retorno para JSONB.

CREATE OR REPLACE FUNCTION public.mark_order_separation_printed(p_order_id uuid)
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

  RETURN to_jsonb(public.mark_order_separation_printed_unguarded_01b(p_order_id));
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_order_separation_printed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_order_separation_printed(uuid) TO authenticated, service_role;
