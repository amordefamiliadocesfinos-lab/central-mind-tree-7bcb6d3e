-- EXECUCAO 02 — complemento de integridade do Fechamento de Produção
-- Nenhum fechamento pode gerar Financeiro sem fontes canônicas que reconciliem
-- exatamente com os itens agregados e com o total do fechamento.

CREATE OR REPLACE FUNCTION public.validate_production_closing_integrity(p_closing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_closing_total numeric;
  v_source_count integer := 0;
  v_source_total numeric := 0;
  v_item_count integer := 0;
  v_item_total numeric := 0;
  v_mismatch integer := 0;
  v_tolerance constant numeric := 0.000000001;
BEGIN
  SELECT total_value INTO v_closing_total
  FROM public.production_closings
  WHERE id = p_closing_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'closing_not_found');
  END IF;

  SELECT count(*), COALESCE(sum(total_value), 0)
    INTO v_source_count, v_source_total
  FROM public.production_closing_sources
  WHERE closing_id = p_closing_id;

  SELECT count(*), COALESCE(sum(total_value), 0)
    INTO v_item_count, v_item_total
  FROM public.production_closing_items
  WHERE closing_id = p_closing_id;

  IF v_source_count = 0 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'closing_sources_required',
      'source_count', v_source_count,
      'item_count', v_item_count,
      'closing_total', v_closing_total
    );
  END IF;

  IF abs(v_source_total - v_closing_total) > v_tolerance THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'closing_source_total_mismatch',
      'source_count', v_source_count,
      'source_total', v_source_total,
      'closing_total', v_closing_total
    );
  END IF;

  IF abs(v_item_total - v_closing_total) > v_tolerance THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'closing_item_total_mismatch',
      'item_count', v_item_count,
      'item_total', v_item_total,
      'closing_total', v_closing_total
    );
  END IF;

  WITH source_groups AS (
    SELECT
      lower(btrim(employee_name)) AS employee_key,
      COALESCE(process_id::text, '__null__') AS process_key,
      sum(quantity) AS quantity,
      sum(total_value) AS total_value
    FROM public.production_closing_sources
    WHERE closing_id = p_closing_id
    GROUP BY 1, 2
  ), item_groups AS (
    SELECT
      lower(btrim(employee_name)) AS employee_key,
      COALESCE(process_id::text, '__null__') AS process_key,
      sum(total_quantity) AS quantity,
      sum(total_value) AS total_value
    FROM public.production_closing_items
    WHERE closing_id = p_closing_id
    GROUP BY 1, 2
  ), compared AS (
    SELECT
      s.employee_key AS source_employee,
      i.employee_key AS item_employee,
      s.process_key AS source_process,
      i.process_key AS item_process,
      s.quantity AS source_quantity,
      i.quantity AS item_quantity,
      s.total_value AS source_value,
      i.total_value AS item_value
    FROM source_groups s
    FULL JOIN item_groups i USING (employee_key, process_key)
  )
  SELECT count(*) INTO v_mismatch
  FROM compared
  WHERE source_employee IS NULL
     OR item_employee IS NULL
     OR source_process IS NULL
     OR item_process IS NULL
     OR source_quantity IS DISTINCT FROM item_quantity
     OR abs(COALESCE(source_value, 0) - COALESCE(item_value, 0)) > v_tolerance;

  IF v_mismatch <> 0 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'closing_integrity_mismatch',
      'group_mismatch_count', v_mismatch,
      'source_count', v_source_count,
      'item_count', v_item_count,
      'source_total', v_source_total,
      'item_total', v_item_total,
      'closing_total', v_closing_total
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'reason', 'ok',
    'source_count', v_source_count,
    'item_count', v_item_count,
    'source_total', v_source_total,
    'item_total', v_item_total,
    'closing_total', v_closing_total
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.validate_production_closing_integrity(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_production_closing_integrity(uuid) TO service_role;

-- O guard de papel é helper interno das RPCs SECURITY DEFINER.
REVOKE ALL ON FUNCTION public.assert_production_closing_manager() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_production_closing_manager() TO service_role;

CREATE OR REPLACE FUNCTION public.confirm_production_closing(p_closing_id uuid, p_due_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_closing public.production_closings%ROWTYPE;
  v_category_id uuid;
  v_entry_id uuid;
  v_count integer := 0;
  v_total numeric := 0;
  v_integrity jsonb;
  v_integrity_reason text;
  r record;
BEGIN
  PERFORM public.assert_production_closing_manager();

  IF p_due_date IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'due_date_required');
  END IF;

  SELECT * INTO v_closing
  FROM public.production_closings
  WHERE id = p_closing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'closing_not_found');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.production_closing_financial_entries
    WHERE closing_id = p_closing_id
  ) THEN
    PERFORM public.refresh_production_closing_financial_status(p_closing_id);
    SELECT count(*), COALESCE(sum(fe.value), 0)
      INTO v_count, v_total
    FROM public.production_closing_financial_entries l
    JOIN public.financial_entries fe ON fe.id = l.financial_entry_id
    WHERE l.closing_id = p_closing_id;

    RETURN jsonb_build_object(
      'success', true,
      'already_confirmed', true,
      'financial_entries', v_count,
      'total_value', v_total
    );
  END IF;

  IF v_closing.status <> 'aberto' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'closing_not_open');
  END IF;

  v_integrity := public.validate_production_closing_integrity(p_closing_id);
  IF COALESCE((v_integrity->>'valid')::boolean, false) = false THEN
    v_integrity_reason := COALESCE(v_integrity->>'reason', 'closing_integrity_mismatch');
    RETURN jsonb_build_object(
      'success', false,
      'reason', v_integrity_reason,
      'integrity', v_integrity
    );
  END IF;

  SELECT id INTO v_category_id
  FROM public.financial_categories
  WHERE is_active
    AND type = 'pagar'
    AND lower(btrim(name)) = 'salários'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_category_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'salary_category_missing');
  END IF;

  FOR r IN
    SELECT min(employee_name) AS employee_name, sum(total_value) AS total_value
    FROM public.production_closing_items
    WHERE closing_id = p_closing_id
    GROUP BY lower(btrim(employee_name))
    HAVING sum(total_value) > 0
  LOOP
    INSERT INTO public.financial_entries(
      type, description, value, value_paid, due_date, category_id, notes,
      issue_date, competence_date, lifecycle_status
    )
    VALUES (
      'pagar',
      format(
        'Mão de obra Produção — %s — Fechamento %s a %s',
        r.employee_name,
        to_char(v_closing.start_date, 'DD/MM/YYYY'),
        to_char(v_closing.end_date, 'DD/MM/YYYY')
      ),
      r.total_value,
      0,
      p_due_date,
      v_category_id,
      format('Gerado pelo Fechamento de Produção %s. Pagamento deve ser realizado no Financeiro.', p_closing_id),
      (now() AT TIME ZONE 'America/Sao_Paulo')::date,
      v_closing.end_date,
      'active'
    )
    RETURNING id INTO v_entry_id;

    INSERT INTO public.production_closing_financial_entries(
      closing_id, employee_name, financial_entry_id
    ) VALUES (p_closing_id, r.employee_name, v_entry_id);

    v_count := v_count + 1;
    v_total := v_total + r.total_value;
  END LOOP;

  IF v_count = 0 THEN
    UPDATE public.production_closings
    SET status = 'fechado_sem_valor', closed_at = now()
    WHERE id = p_closing_id;

    RETURN jsonb_build_object(
      'success', true,
      'financial_entries', 0,
      'total_value', 0,
      'status', 'fechado_sem_valor'
    );
  END IF;

  PERFORM public.refresh_production_closing_financial_status(p_closing_id);
  RETURN jsonb_build_object(
    'success', true,
    'financial_entries', v_count,
    'total_value', v_total,
    'status', 'a_pagar'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.confirm_production_closing(uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_production_closing(uuid,date) TO authenticated, service_role;

-- Fechamento histórico sem fontes: preserva evidência, mas sai da fila de confirmação.
DO $migration$
DECLARE
  v_id constant uuid := '9e370d6b-b894-4057-a945-803ee301231a';
  v_row public.production_closings%ROWTYPE;
  v_sources integer;
  v_items integer;
  v_financial integer;
BEGIN
  SELECT * INTO v_row
  FROM public.production_closings
  WHERE id = v_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'exec02_legacy_closing_not_found';
  END IF;

  IF v_row.start_date <> DATE '2026-03-11'
     OR v_row.end_date <> DATE '2026-03-18'
     OR abs(v_row.total_value - 360::numeric) > 0.000000001::numeric THEN
    RAISE EXCEPTION 'exec02_legacy_closing_changed';
  END IF;

  SELECT count(*) INTO v_sources
  FROM public.production_closing_sources WHERE closing_id = v_id;
  SELECT count(*) INTO v_items
  FROM public.production_closing_items WHERE closing_id = v_id;
  SELECT count(*) INTO v_financial
  FROM public.production_closing_financial_entries WHERE closing_id = v_id;

  IF v_sources <> 0 OR v_items <> 5 OR v_financial <> 0 THEN
    RAISE EXCEPTION 'exec02_legacy_integrity_state_changed sources=% items=% financial=%',
      v_sources, v_items, v_financial;
  END IF;

  IF v_row.status = 'aberto' THEN
    UPDATE public.production_closings
    SET status = 'revisao_integridade',
        notes = CASE
          WHEN COALESCE(btrim(notes), '') = '' THEN
            '[Integridade] Fechamento legado sem fontes canônicas preservadas. Não financializar sem reconstrução factual comprovada.'
          ELSE
            notes || E'\n[Integridade] Fechamento legado sem fontes canônicas preservadas. Não financializar sem reconstrução factual comprovada.'
        END
    WHERE id = v_id;
  ELSIF v_row.status <> 'revisao_integridade' THEN
    RAISE EXCEPTION 'exec02_legacy_unexpected_status %', v_row.status;
  END IF;
END;
$migration$;
