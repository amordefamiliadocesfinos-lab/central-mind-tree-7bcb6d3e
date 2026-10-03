-- EXECUCAO 02 — Fechamento canônico de Produção
-- 1) saneia o fechamento real R$ 28,50 somente quando a origem for exatamente comprovada;
-- 2) fecha writers diretos nas tabelas de fechamento;
-- 3) preserva criação/confirmacao pelas RPCs canônicas e cria exclusão controlada.

DO $migration$
DECLARE
  v_closing_id constant uuid := 'be526774-442c-4478-88c4-2947896de807';
  v_start date;
  v_end date;
  v_total numeric;
  v_created_at timestamptz;
  v_existing_sources integer;
  v_candidate_count integer;
  v_candidate_total numeric;
  v_conflicted_sources integer;
  v_mismatch integer;
BEGIN
  SELECT start_date, end_date, total_value, created_at
    INTO v_start, v_end, v_total, v_created_at
  FROM public.production_closings
  WHERE id = v_closing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'exec02_target_closing_not_found';
  END IF;

  IF v_start <> DATE '2026-09-26'
     OR v_end <> DATE '2026-10-03'
     OR v_total <> 28.5::numeric
     OR v_created_at <> TIMESTAMPTZ '2026-10-03 19:40:56.758194+00' THEN
    RAISE EXCEPTION 'exec02_target_closing_changed';
  END IF;

  WITH candidates AS (
    SELECT fpe.id, fpe.operator_name, fpe.process_id, fpe.quantity, COALESCE(fpe.total_value,0) total_value
    FROM public.production_fact_process_entries fpe
    JOIN public.production_facts pf ON pf.id=fpe.production_fact_id AND pf.status='confirmed'
    WHERE (fpe.occurred_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_start AND v_end
      AND fpe.created_at <= v_created_at
  )
  SELECT count(*), COALESCE(sum(total_value),0)
    INTO v_candidate_count, v_candidate_total
  FROM candidates;

  IF v_candidate_count <> 25 OR v_candidate_total <> 28.5::numeric THEN
    RAISE EXCEPTION 'exec02_candidate_set_changed rows=% total=%', v_candidate_count, v_candidate_total;
  END IF;

  -- A composição resumida existente deve coincidir exatamente com as fontes candidatas.
  WITH expected AS (
    SELECT lower(btrim(employee_name)) employee_key,
           COALESCE(process_id::text,'__null__') process_key,
           sum(total_quantity) qty,
           sum(total_value) value
    FROM public.production_closing_items
    WHERE closing_id=v_closing_id
    GROUP BY 1,2
  ), candidates AS (
    SELECT lower(btrim(fpe.operator_name)) employee_key,
           COALESCE(fpe.process_id::text,'__null__') process_key,
           sum(fpe.quantity) qty,
           sum(COALESCE(fpe.total_value,0)) value
    FROM public.production_fact_process_entries fpe
    JOIN public.production_facts pf ON pf.id=fpe.production_fact_id AND pf.status='confirmed'
    WHERE (fpe.occurred_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_start AND v_end
      AND fpe.created_at <= v_created_at
    GROUP BY 1,2
  ), compared AS (
    SELECT e.employee_key e_employee, c.employee_key c_employee,
           e.process_key e_process, c.process_key c_process,
           e.qty e_qty, c.qty c_qty, e.value e_value, c.value c_value
    FROM expected e
    FULL JOIN candidates c USING (employee_key,process_key)
  )
  SELECT count(*) INTO v_mismatch
  FROM compared
  WHERE e_employee IS NULL OR c_employee IS NULL
     OR e_process IS NULL OR c_process IS NULL
     OR e_qty IS DISTINCT FROM c_qty
     OR e_value IS DISTINCT FROM c_value;

  IF v_mismatch <> 0 THEN
    RAISE EXCEPTION 'exec02_grouped_source_mismatch count=%', v_mismatch;
  END IF;

  SELECT count(*) INTO v_existing_sources
  FROM public.production_closing_sources
  WHERE closing_id=v_closing_id;

  IF v_existing_sources = 0 THEN
    -- Nenhuma dessas fontes pode pertencer a outro fechamento.
    SELECT count(*) INTO v_conflicted_sources
    FROM public.production_fact_process_entries fpe
    JOIN public.production_facts pf ON pf.id=fpe.production_fact_id AND pf.status='confirmed'
    JOIN public.production_closing_sources pcs
      ON pcs.source_type='production_fact_process_entry' AND pcs.source_id=fpe.id
    WHERE (fpe.occurred_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_start AND v_end
      AND fpe.created_at <= v_created_at;

    IF v_conflicted_sources <> 0 THEN
      RAISE EXCEPTION 'exec02_candidate_source_already_closed count=%', v_conflicted_sources;
    END IF;

    INSERT INTO public.production_closing_sources(
      closing_id, source_type, source_id, source_date,
      employee_name, employee_user_id, process_id, process_name_snapshot,
      quantity, total_value
    )
    SELECT
      v_closing_id,
      'production_fact_process_entry',
      fpe.id,
      (fpe.occurred_at AT TIME ZONE 'America/Sao_Paulo')::date,
      fpe.operator_name,
      fpe.operator_user_id,
      fpe.process_id,
      COALESCE(
        (SELECT min(i.process_name_snapshot)
         FROM public.production_closing_items i
         WHERE i.closing_id=v_closing_id
           AND lower(btrim(i.employee_name))=lower(btrim(fpe.operator_name))
           AND i.process_id IS NOT DISTINCT FROM fpe.process_id),
        pr.name,
        'Processo'
      ),
      fpe.quantity,
      COALESCE(fpe.total_value,0)
    FROM public.production_fact_process_entries fpe
    JOIN public.production_facts pf ON pf.id=fpe.production_fact_id AND pf.status='confirmed'
    LEFT JOIN public.processes pr ON pr.id=fpe.process_id
    WHERE (fpe.occurred_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_start AND v_end
      AND fpe.created_at <= v_created_at;
  ELSE
    -- Idempotência: se já saneado, o conjunto de source_ids deve ser exatamente o mesmo.
    WITH candidates AS (
      SELECT fpe.id
      FROM public.production_fact_process_entries fpe
      JOIN public.production_facts pf ON pf.id=fpe.production_fact_id AND pf.status='confirmed'
      WHERE (fpe.occurred_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_start AND v_end
        AND fpe.created_at <= v_created_at
    ), differences AS (
      (SELECT id FROM candidates
       EXCEPT
       SELECT source_id FROM public.production_closing_sources
       WHERE closing_id=v_closing_id AND source_type='production_fact_process_entry')
      UNION ALL
      (SELECT source_id FROM public.production_closing_sources
       WHERE closing_id=v_closing_id AND source_type='production_fact_process_entry'
       EXCEPT
       SELECT id FROM candidates)
    )
    SELECT count(*) INTO v_mismatch FROM differences;

    IF v_existing_sources <> 25 OR v_mismatch <> 0 THEN
      RAISE EXCEPTION 'exec02_existing_backfill_mismatch sources=% diff=%', v_existing_sources, v_mismatch;
    END IF;
  END IF;

  SELECT count(*), COALESCE(sum(total_value),0)
    INTO v_existing_sources, v_candidate_total
  FROM public.production_closing_sources
  WHERE closing_id=v_closing_id;

  IF v_existing_sources <> 25 OR v_candidate_total <> 28.5::numeric THEN
    RAISE EXCEPTION 'exec02_backfill_postcondition_failed sources=% total=%', v_existing_sources, v_candidate_total;
  END IF;
END;
$migration$;

-- Exclusão legítima passa a ter um único contrato, sem DELETE direto pelo navegador.
CREATE OR REPLACE FUNCTION public.delete_production_closing(p_closing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
BEGIN
  PERFORM public.assert_production_closing_manager();

  SELECT status INTO v_status
  FROM public.production_closings
  WHERE id=p_closing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',false,'reason','closing_not_found');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.production_closing_financial_entries
    WHERE closing_id=p_closing_id
  ) THEN
    RETURN jsonb_build_object('success',false,'reason','financialized_production_closing');
  END IF;

  IF v_status <> 'aberto' THEN
    RETURN jsonb_build_object('success',false,'reason','closing_not_open');
  END IF;

  DELETE FROM public.production_closings WHERE id=p_closing_id;
  RETURN jsonb_build_object('success',true);
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_production_closing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_production_closing(uuid) TO authenticated, service_role;

-- O refresh é consequência interna de Financeiro/confirmacao; não é uma ação pública.
REVOKE ALL ON FUNCTION public.refresh_production_closing_financial_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_production_closing_financial_status(uuid) TO service_role;

-- Fechamentos: app autenticado lê; mutações ocorrem somente nas RPCs SECURITY DEFINER.
ALTER TABLE public.production_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_closing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_closing_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_closing_financial_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on production_closings" ON public.production_closings;
DROP POLICY IF EXISTS "Authenticated read production closings" ON public.production_closings;
DROP POLICY IF EXISTS "Service role manage production closings" ON public.production_closings;
CREATE POLICY "Authenticated read production closings"
  ON public.production_closings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role manage production closings"
  ON public.production_closings FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on production_closing_items" ON public.production_closing_items;
DROP POLICY IF EXISTS "Authenticated read production closing items" ON public.production_closing_items;
DROP POLICY IF EXISTS "Service role manage production closing items" ON public.production_closing_items;
CREATE POLICY "Authenticated read production closing items"
  ON public.production_closing_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role manage production closing items"
  ON public.production_closing_items FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated read production closing sources" ON public.production_closing_sources;
DROP POLICY IF EXISTS "Service role manage production closing sources" ON public.production_closing_sources;
CREATE POLICY "Authenticated read production closing sources"
  ON public.production_closing_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role manage production closing sources"
  ON public.production_closing_sources FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated read production closing financial entries" ON public.production_closing_financial_entries;
DROP POLICY IF EXISTS "Service role manage production closing financial entries" ON public.production_closing_financial_entries;
CREATE POLICY "Authenticated read production closing financial entries"
  ON public.production_closing_financial_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role manage production closing financial entries"
  ON public.production_closing_financial_entries FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL PRIVILEGES ON TABLE public.production_closings FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.production_closing_items FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.production_closing_sources FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.production_closing_financial_entries FROM anon, authenticated;

GRANT SELECT ON TABLE public.production_closings TO authenticated;
GRANT SELECT ON TABLE public.production_closing_items TO authenticated;
GRANT SELECT ON TABLE public.production_closing_sources TO authenticated;
GRANT SELECT ON TABLE public.production_closing_financial_entries TO authenticated;
