-- Restringe alteração estrutural Produto -> Processos a gestão da produção.
CREATE OR REPLACE FUNCTION public.set_product_processes(
  p_product_id uuid,
  p_variant_id uuid,
  p_process_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_process_id uuid;
  v_order integer := 0;
  v_value numeric;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.app_users au
    WHERE au.auth_user_id = auth.uid()
      AND au.is_active = true
      AND upper(COALESCE(au.role, '')) IN ('ADMINISTRADOR', 'LIDER PRODUÇÃO')
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'forbidden');
  END IF;

  IF p_variant_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'variant_override_not_supported');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'product_not_found');
  END IF;

  DELETE FROM public.product_processes WHERE product_id = p_product_id;

  FOREACH v_process_id IN ARRAY COALESCE(p_process_ids, ARRAY[]::uuid[])
  LOOP
    SELECT COALESCE(value_per_unit, 0) INTO v_value
    FROM public.processes
    WHERE id = v_process_id AND is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid or inactive process %', v_process_id;
    END IF;

    INSERT INTO public.product_processes(
      product_id, process_id, cost_per_unit, sort_order, is_required, is_active, updated_at
    ) VALUES (
      p_product_id, v_process_id, v_value, v_order, true, true, now()
    );
    v_order := v_order + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'count', v_order);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_product_processes(uuid, uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_product_processes(uuid, uuid, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_product_processes(uuid, uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_product_processes(uuid, uuid, uuid[]) TO service_role;
