-- Integra os lançamentos de processo do Fato Real ao fechamento por período.

ALTER TABLE public.production_fact_process_entries
  ADD COLUMN IF NOT EXISTS occurred_at timestamptz NOT NULL DEFAULT now();

UPDATE public.production_fact_process_entries fppe
SET occurred_at = pf.occurred_at
FROM public.production_facts pf
WHERE pf.id = fppe.production_fact_id;

CREATE INDEX IF NOT EXISTS production_fact_process_entries_occurred_at_idx
  ON public.production_fact_process_entries(occurred_at);

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
  SELECT * INTO v_fact
  FROM public.production_facts
  WHERE id = p_production_fact_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'production_fact_not_found');
  END IF;

  SELECT * INTO v_process
  FROM public.processes
  WHERE id = p_process_id
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_process');
  END IF;

  IF p_operator_user_id IS NOT NULL THEN
    SELECT name INTO v_operator_name
    FROM public.app_users
    WHERE id = p_operator_user_id
      AND is_active = true;

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
    production_fact_id,
    process_id,
    operator_user_id,
    operator_name,
    quantity,
    value_per_unit_snapshot,
    total_value,
    occurred_at,
    updated_at
  ) VALUES (
    v_fact.id,
    v_process.id,
    p_operator_user_id,
    v_operator_name,
    v_fact.quantity,
    COALESCE(v_process.value_per_unit, 0),
    v_fact.quantity * COALESCE(v_process.value_per_unit, 0),
    v_fact.occurred_at,
    now()
  )
  ON CONFLICT (production_fact_id)
  DO UPDATE SET
    process_id = EXCLUDED.process_id,
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
    'value_per_unit', COALESCE(v_process.value_per_unit, 0)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.attach_production_fact_process(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.attach_production_fact_process(uuid, uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.attach_production_fact_process(uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attach_production_fact_process(uuid, uuid, uuid, text) TO service_role;
