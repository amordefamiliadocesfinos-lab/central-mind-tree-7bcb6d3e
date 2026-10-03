-- F01 — roteamento canônico Produto -> Processos
-- A tabela product_processes já existe no banco real e é a fonte de verdade.
-- Esta migration apenas a evolui para suportar ordem/estado operacional.

ALTER TABLE public.product_processes
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS product_processes_product_active_order_idx
  ON public.product_processes(product_id, is_active, sort_order);

ALTER TABLE public.product_processes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users read product processes" ON public.product_processes;
CREATE POLICY "Authenticated users read product processes"
ON public.product_processes FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.product_processes TO authenticated;
GRANT ALL ON public.product_processes TO service_role;

-- Completa apenas vínculos comprovados pelas OPs históricas. Os quatro processos
-- de Alfajor já existentes são preservados; produtos ainda sem vínculo recebem
-- somente relações realmente observadas no histórico.
WITH historical AS (
  SELECT DISTINCT poi.product_id, pop.process_id, pr.name AS process_name,
         COALESCE(pr.value_per_unit, 0) AS value_per_unit
  FROM public.production_order_items poi
  JOIN public.production_order_processes pop
    ON pop.production_order_id = poi.production_order_id
  JOIN public.processes pr ON pr.id = pop.process_id
  WHERE pop.is_required = true
), ranked AS (
  SELECT product_id, process_id, value_per_unit,
    row_number() OVER (
      PARTITION BY product_id
      ORDER BY lower(process_name), process_id
    ) - 1 AS sort_order
  FROM historical
)
INSERT INTO public.product_processes(
  product_id, process_id, cost_per_unit, sort_order, is_required, is_active, updated_at
)
SELECT product_id, process_id, value_per_unit, sort_order, true, true, now()
FROM ranked
ON CONFLICT (product_id, process_id)
DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  is_required = true,
  is_active = true,
  updated_at = now();

-- Um fato físico passa a aceitar N processos: uma linha por fato+processo.
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
  v_value_per_unit numeric;
BEGIN
  SELECT * INTO v_fact
  FROM public.production_facts
  WHERE id = p_production_fact_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'production_fact_not_found');
  END IF;

  SELECT pr.*, COALESCE(pp.cost_per_unit, pr.value_per_unit, 0)
  INTO v_process, v_value_per_unit
  FROM public.processes pr
  JOIN public.product_processes pp
    ON pp.process_id = pr.id
   AND pp.product_id = v_fact.product_id
   AND pp.is_active = true
  WHERE pr.id = p_process_id
    AND pr.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'process_not_configured_for_product');
  END IF;

  IF p_operator_user_id IS NOT NULL THEN
    SELECT name INTO v_operator_name
    FROM public.app_users
    WHERE id = p_operator_user_id AND is_active = true;
    IF v_operator_name IS NULL THEN
      RETURN jsonb_build_object('success', false, 'reason', 'invalid_operator');
    END IF;
  ELSE
    v_operator_name := COALESCE(NULLIF(btrim(p_operator_name), ''), NULLIF(btrim(v_fact.operator_name), ''));
  END IF;

  IF v_operator_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'missing_operator');
  END IF;

  INSERT INTO public.production_fact_process_entries(
    production_fact_id, process_id, operator_user_id, operator_name,
    quantity, value_per_unit_snapshot, total_value, occurred_at, updated_at
  ) VALUES (
    v_fact.id, v_process.id, p_operator_user_id, v_operator_name,
    v_fact.quantity, v_value_per_unit,
    v_fact.quantity * v_value_per_unit, v_fact.occurred_at, now()
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

  RETURN jsonb_build_object(
    'success', true,
    'production_fact_id', v_fact.id,
    'process_id', v_process.id,
    'operator_name', v_operator_name,
    'quantity', v_fact.quantity,
    'value_per_unit', v_value_per_unit
  );
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
  v_value numeric;
BEGIN
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
