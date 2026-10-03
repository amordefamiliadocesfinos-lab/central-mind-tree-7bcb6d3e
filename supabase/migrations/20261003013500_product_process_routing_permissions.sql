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

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'product_not_found');
  END IF;

  IF p_variant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.product_variants WHERE id=p_variant_id AND product_id=p_product_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_variant');
  END IF;

  DELETE FROM public.product_processes
  WHERE product_id=p_product_id AND variant_id IS NOT DISTINCT FROM p_variant_id;

  FOREACH v_process_id IN ARRAY COALESCE(p_process_ids, ARRAY[]::uuid[])
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.processes WHERE id=v_process_id AND is_active=true) THEN
      RAISE EXCEPTION 'Invalid or inactive process %', v_process_id;
    END IF;
    INSERT INTO public.product_processes(product_id,variant_id,process_id,sort_order,is_required,is_active)
    VALUES (p_product_id,p_variant_id,v_process_id,v_order,true,true);
    v_order := v_order + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'count', v_order);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_product_processes(uuid, uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_product_processes(uuid, uuid, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_product_processes(uuid, uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_product_processes(uuid, uuid, uuid[]) TO service_role;
