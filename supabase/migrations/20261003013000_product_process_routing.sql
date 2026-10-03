-- F01 — roteamento canônico Produto/Variante -> Processos

CREATE TABLE IF NOT EXISTS public.product_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  process_id uuid NOT NULL REFERENCES public.processes(id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_processes_identity_uidx
  ON public.product_processes(product_id, variant_id, process_id) NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS product_processes_product_idx
  ON public.product_processes(product_id, variant_id, is_active, sort_order);

ALTER TABLE public.product_processes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read product processes" ON public.product_processes;
CREATE POLICY "Authenticated users read product processes"
ON public.product_processes FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.product_processes TO authenticated;
GRANT ALL ON public.product_processes TO service_role;

-- Semeia somente relações comprovadas pelas OPs históricas: processo requerido da OP
-- ligado ao produto presente naquela mesma OP. A configuração nasce no nível do
-- produto, portanto vale para suas variantes salvo override futuro por variante.
INSERT INTO public.product_processes(product_id, variant_id, process_id, sort_order, is_required, is_active)
SELECT DISTINCT
  poi.product_id,
  NULL::uuid,
  pop.process_id,
  row_number() OVER (
    PARTITION BY poi.product_id
    ORDER BY lower(pr.name), pop.process_id
  ) - 1,
  true,
  true
FROM public.production_order_items poi
JOIN public.production_order_processes pop
  ON pop.production_order_id = poi.production_order_id
JOIN public.processes pr ON pr.id = pop.process_id
WHERE pop.is_required = true
ON CONFLICT (product_id, variant_id, process_id) DO NOTHING;

-- Um fato físico agora aceita vários processos, um apontamento por processo.
ALTER TABLE public.production_fact_process_entries
  DROP CONSTRAINT IF EXISTS production_fact_process_entries_production_fact_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS production_fact_process_entries_fact_process_uidx
  ON public.production_fact_process_entries(production_fact_id, process_id);

CREATE OR REPLACE FUNCTION public.attach_production_fact_process(
  p_production_fact_id uuid,
  p_process_id uuid,
  p_operator_user_id uuid DEFAULT NULL,
  p_operator_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fact public.production_facts;
  v_process public.processes;
  v_operator_name text;
BEGIN
  SELECT * INTO v_fact FROM public.production_facts WHERE id = p_production_fact_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'reason', 'production_fact_not_found'); END IF;

  SELECT * INTO v_process FROM public.processes WHERE id = p_process_id AND is_active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'reason', 'invalid_process'); END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.product_processes pp
    WHERE pp.product_id = v_fact.product_id
      AND pp.is_active = true
      AND pp.process_id = p_process_id
      AND (
        pp.variant_id IS NOT DISTINCT FROM v_fact.variant_id
        OR (
          pp.variant_id IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.product_processes px
            WHERE px.product_id = v_fact.product_id
              AND px.variant_id IS NOT DISTINCT FROM v_fact.variant_id
              AND px.is_active = true
          )
        )
      )
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'process_not_configured_for_product');
  END IF;

  IF p_operator_user_id IS NOT NULL THEN
    SELECT name INTO v_operator_name
    FROM public.app_users
    WHERE id = p_operator_user_id AND is_active = true;
    IF v_operator_name IS NULL THEN RETURN jsonb_build_object('success', false, 'reason', 'invalid_operator'); END IF;
  ELSE
    v_operator_name := COALESCE(NULLIF(btrim(p_operator_name), ''), NULLIF(btrim(v_fact.operator_name), ''));
  END IF;

  IF v_operator_name IS NULL THEN RETURN jsonb_build_object('success', false, 'reason', 'missing_operator'); END IF;

  INSERT INTO public.production_fact_process_entries(
    production_fact_id, process_id, operator_user_id, operator_name,
    quantity, value_per_unit_snapshot, total_value, occurred_at, updated_at
  ) VALUES (
    v_fact.id, v_process.id, p_operator_user_id, v_operator_name,
    v_fact.quantity, COALESCE(v_process.value_per_unit,0),
    v_fact.quantity * COALESCE(v_process.value_per_unit,0), v_fact.occurred_at, now()
  )
  ON CONFLICT (production_fact_id, process_id)
  DO UPDATE SET
    operator_user_id = EXCLUDED.operator_user_id,
    operator_name = EXCLUDED.operator_name,
    quantity = EXCLUDED.quantity,
    value_per_unit_snapshot = EXCLUDED.value_per_unit_snapshot,
    total_value = EXCLUDED.total_value,
    occurred_at = EXCLUDED.occurred_at,
    updated_at = now();

  RETURN jsonb_build_object('success', true, 'production_fact_id', v_fact.id,
    'process_id', v_process.id, 'operator_name', v_operator_name,
    'quantity', v_fact.quantity, 'value_per_unit', COALESCE(v_process.value_per_unit,0));
END;
$function$;

REVOKE ALL ON FUNCTION public.attach_production_fact_process(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.attach_production_fact_process(uuid, uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.attach_production_fact_process(uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attach_production_fact_process(uuid, uuid, uuid, text) TO service_role;

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
