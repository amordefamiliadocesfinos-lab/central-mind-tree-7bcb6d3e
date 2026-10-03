-- F06 — Fechamento da Produção -> Financeiro
-- Fonte da verdade: apontamentos individuais -> fechamento -> financial_entries.

ALTER TABLE public.production_closing_items
  ALTER COLUMN total_quantity TYPE numeric USING total_quantity::numeric,
  ADD COLUMN IF NOT EXISTS employee_user_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS process_name_snapshot text;

CREATE TABLE IF NOT EXISTS public.production_closing_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id uuid NOT NULL REFERENCES public.production_closings(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('production_entry','production_fact_process_entry','production_log')),
  source_id uuid NOT NULL,
  source_date date NOT NULL,
  employee_name text NOT NULL,
  employee_user_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  process_id uuid REFERENCES public.processes(id) ON DELETE SET NULL,
  process_name_snapshot text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  total_value numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_production_closing_sources_closing
  ON public.production_closing_sources(closing_id);
CREATE INDEX IF NOT EXISTS idx_production_closing_sources_date
  ON public.production_closing_sources(source_date);

CREATE TABLE IF NOT EXISTS public.production_closing_financial_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id uuid NOT NULL REFERENCES public.production_closings(id) ON DELETE RESTRICT,
  employee_name text NOT NULL,
  financial_entry_id uuid NOT NULL REFERENCES public.financial_entries(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (financial_entry_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_production_closing_financial_employee
  ON public.production_closing_financial_entries(closing_id, lower(btrim(employee_name)));
CREATE INDEX IF NOT EXISTS idx_production_closing_financial_closing
  ON public.production_closing_financial_entries(closing_id);

ALTER TABLE public.production_closing_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_closing_financial_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read production closing sources" ON public.production_closing_sources;
CREATE POLICY "Authenticated read production closing sources"
  ON public.production_closing_sources FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Service role manage production closing sources" ON public.production_closing_sources;
CREATE POLICY "Service role manage production closing sources"
  ON public.production_closing_sources FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated read production closing financial entries" ON public.production_closing_financial_entries;
CREATE POLICY "Authenticated read production closing financial entries"
  ON public.production_closing_financial_entries FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Service role manage production closing financial entries" ON public.production_closing_financial_entries;
CREATE POLICY "Service role manage production closing financial entries"
  ON public.production_closing_financial_entries FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Preserva os fechamentos históricos: os apontamentos que estavam dentro de seus períodos
-- são marcados como já utilizados para não reaparecerem em um novo fechamento.
INSERT INTO public.production_closing_sources (
  closing_id, source_type, source_id, source_date, employee_name,
  employee_user_id, process_id, process_name_snapshot, quantity, total_value
)
SELECT c.id, 'production_entry', pe.id, pe.date, pe.employee_name,
       au.id, pe.process_id, COALESCE(pr.name,'Processo'), pe.quantity, COALESCE(pe.total_value,0)
FROM public.production_entries pe
JOIN LATERAL (
  SELECT pc.id FROM public.production_closings pc
  WHERE pe.date BETWEEN pc.start_date AND pc.end_date
  ORDER BY pc.created_at ASC LIMIT 1
) c ON true
LEFT JOIN public.processes pr ON pr.id = pe.process_id
LEFT JOIN LATERAL (
  SELECT u.id FROM public.app_users u
  WHERE u.is_active AND lower(btrim(u.name)) = lower(btrim(pe.employee_name))
  ORDER BY u.created_at ASC LIMIT 1
) au ON true
ON CONFLICT (source_type, source_id) DO NOTHING;

INSERT INTO public.production_closing_sources (
  closing_id, source_type, source_id, source_date, employee_name,
  employee_user_id, process_id, process_name_snapshot, quantity, total_value
)
SELECT c.id, 'production_fact_process_entry', fpe.id,
       (fpe.occurred_at AT TIME ZONE 'America/Sao_Paulo')::date,
       fpe.operator_name, fpe.operator_user_id, fpe.process_id,
       COALESCE(pr.name,'Processo'), fpe.quantity, COALESCE(fpe.total_value,0)
FROM public.production_fact_process_entries fpe
JOIN public.production_facts pf ON pf.id = fpe.production_fact_id AND pf.status = 'confirmed'
JOIN LATERAL (
  SELECT pc.id FROM public.production_closings pc
  WHERE (fpe.occurred_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN pc.start_date AND pc.end_date
  ORDER BY pc.created_at ASC LIMIT 1
) c ON true
LEFT JOIN public.processes pr ON pr.id = fpe.process_id
ON CONFLICT (source_type, source_id) DO NOTHING;

INSERT INTO public.production_closing_sources (
  closing_id, source_type, source_id, source_date, employee_name,
  employee_user_id, process_id, process_name_snapshot, quantity, total_value
)
SELECT c.id, 'production_log', pl.id, pl.date, pl.employee_name,
       au.id, NULL, COALESCE(pl.process,'Processo'), pl.quantity, 0
FROM public.production_logs pl
JOIN LATERAL (
  SELECT pc.id FROM public.production_closings pc
  WHERE pl.date BETWEEN pc.start_date AND pc.end_date
  ORDER BY pc.created_at ASC LIMIT 1
) c ON true
LEFT JOIN LATERAL (
  SELECT u.id FROM public.app_users u
  WHERE u.is_active AND lower(btrim(u.name)) = lower(btrim(pl.employee_name))
  ORDER BY u.created_at ASC LIMIT 1
) au ON true
ON CONFLICT (source_type, source_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.assert_production_closing_manager()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_jwt_role text := current_setting('request.jwt.claim.role', true);
BEGIN
  IF v_jwt_role = 'service_role' THEN RETURN; END IF;
  SELECT role INTO v_role FROM public.app_users
  WHERE auth_user_id = auth.uid() AND is_active
  ORDER BY created_at ASC LIMIT 1;
  IF COALESCE(v_role,'') NOT IN ('Administrador','LIDER PRODUÇÃO') THEN
    RAISE EXCEPTION 'production_closing_manager_required';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_production_closing(
  p_start_date date,
  p_end_date date,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_closing_id uuid;
  v_source_count integer := 0;
  v_total numeric := 0;
BEGIN
  PERFORM public.assert_production_closing_manager();
  IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date THEN
    RETURN jsonb_build_object('success',false,'reason','invalid_period');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('production-closing-create',0));

  INSERT INTO public.production_closings(start_date,end_date,status,total_value,notes)
  VALUES (p_start_date,p_end_date,'aberto',0,NULLIF(btrim(COALESCE(p_notes,'')),''))
  RETURNING id INTO v_closing_id;

  INSERT INTO public.production_closing_sources (
    closing_id,source_type,source_id,source_date,employee_name,employee_user_id,
    process_id,process_name_snapshot,quantity,total_value
  )
  SELECT v_closing_id,'production_entry',pe.id,pe.date,pe.employee_name,au.id,
         pe.process_id,COALESCE(pr.name,'Processo'),pe.quantity,COALESCE(pe.total_value,0)
  FROM public.production_entries pe
  LEFT JOIN public.processes pr ON pr.id=pe.process_id
  LEFT JOIN LATERAL (
    SELECT u.id FROM public.app_users u
    WHERE u.is_active AND lower(btrim(u.name))=lower(btrim(pe.employee_name))
    ORDER BY u.created_at ASC LIMIT 1
  ) au ON true
  WHERE pe.date BETWEEN p_start_date AND p_end_date
    AND NOT EXISTS (
      SELECT 1 FROM public.production_closing_sources s
      WHERE s.source_type='production_entry' AND s.source_id=pe.id
    )
  ON CONFLICT (source_type,source_id) DO NOTHING;

  INSERT INTO public.production_closing_sources (
    closing_id,source_type,source_id,source_date,employee_name,employee_user_id,
    process_id,process_name_snapshot,quantity,total_value
  )
  SELECT v_closing_id,'production_fact_process_entry',fpe.id,
         (fpe.occurred_at AT TIME ZONE 'America/Sao_Paulo')::date,
         fpe.operator_name,fpe.operator_user_id,fpe.process_id,COALESCE(pr.name,'Processo'),
         fpe.quantity,COALESCE(fpe.total_value,0)
  FROM public.production_fact_process_entries fpe
  JOIN public.production_facts pf ON pf.id=fpe.production_fact_id AND pf.status='confirmed'
  LEFT JOIN public.processes pr ON pr.id=fpe.process_id
  WHERE (fpe.occurred_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start_date AND p_end_date
    AND NOT EXISTS (
      SELECT 1 FROM public.production_closing_sources s
      WHERE s.source_type='production_fact_process_entry' AND s.source_id=fpe.id
    )
  ON CONFLICT (source_type,source_id) DO NOTHING;

  INSERT INTO public.production_closing_sources (
    closing_id,source_type,source_id,source_date,employee_name,employee_user_id,
    process_id,process_name_snapshot,quantity,total_value
  )
  SELECT v_closing_id,'production_log',pl.id,pl.date,pl.employee_name,au.id,
         NULL,COALESCE(pl.process,'Processo'),pl.quantity,0
  FROM public.production_logs pl
  LEFT JOIN LATERAL (
    SELECT u.id FROM public.app_users u
    WHERE u.is_active AND lower(btrim(u.name))=lower(btrim(pl.employee_name))
    ORDER BY u.created_at ASC LIMIT 1
  ) au ON true
  WHERE pl.date BETWEEN p_start_date AND p_end_date
    AND NOT EXISTS (
      SELECT 1 FROM public.production_closing_sources s
      WHERE s.source_type='production_log' AND s.source_id=pl.id
    )
  ON CONFLICT (source_type,source_id) DO NOTHING;

  SELECT count(*),COALESCE(sum(total_value),0)
    INTO v_source_count,v_total
  FROM public.production_closing_sources WHERE closing_id=v_closing_id;

  IF v_source_count=0 THEN
    DELETE FROM public.production_closings WHERE id=v_closing_id;
    RETURN jsonb_build_object('success',false,'reason','no_unclosed_entries');
  END IF;

  INSERT INTO public.production_closing_items(
    closing_id,employee_name,employee_user_id,process_id,process_name_snapshot,total_quantity,total_value
  )
  SELECT v_closing_id,
         min(employee_name),
         min(employee_user_id::text)::uuid,
         process_id,
         min(process_name_snapshot),
         sum(quantity),sum(total_value)
  FROM public.production_closing_sources
  WHERE closing_id=v_closing_id
  GROUP BY lower(btrim(employee_name)),process_id,lower(btrim(process_name_snapshot));

  UPDATE public.production_closings SET total_value=v_total WHERE id=v_closing_id;
  RETURN jsonb_build_object('success',true,'closing_id',v_closing_id,'source_count',v_source_count,'total_value',v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_production_closing_financial_status(p_closing_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_link_count integer;
  v_active_count integer;
  v_cancelled_count integer;
  v_total numeric;
  v_paid numeric;
  v_status text;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE fe.lifecycle_status='active'),
         count(*) FILTER (WHERE fe.lifecycle_status='cancelled'),
         COALESCE(sum(fe.value) FILTER (WHERE fe.lifecycle_status='active'),0),
         COALESCE(sum(fe.value_paid) FILTER (WHERE fe.lifecycle_status='active'),0)
    INTO v_link_count,v_active_count,v_cancelled_count,v_total,v_paid
  FROM public.production_closing_financial_entries l
  JOIN public.financial_entries fe ON fe.id=l.financial_entry_id
  WHERE l.closing_id=p_closing_id;

  IF v_link_count=0 THEN RETURN NULL; END IF;
  IF v_active_count=0 AND v_cancelled_count>0 THEN v_status:='revisao_financeira';
  ELSIF v_paid<=0 THEN v_status:='a_pagar';
  ELSIF v_paid<v_total THEN v_status:='parcialmente_pago';
  ELSE v_status:='pago'; END IF;

  UPDATE public.production_closings
  SET status=v_status,
      closed_at=CASE WHEN v_status='pago' THEN COALESCE(closed_at,now()) ELSE NULL END
  WHERE id=p_closing_id;
  RETURN v_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_production_closing(
  p_closing_id uuid,
  p_due_date date
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_closing public.production_closings%ROWTYPE;
  v_category_id uuid;
  v_entry_id uuid;
  v_count integer := 0;
  v_total numeric := 0;
  r record;
BEGIN
  PERFORM public.assert_production_closing_manager();
  IF p_due_date IS NULL THEN RETURN jsonb_build_object('success',false,'reason','due_date_required'); END IF;

  SELECT * INTO v_closing FROM public.production_closings WHERE id=p_closing_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'reason','closing_not_found'); END IF;

  IF EXISTS (SELECT 1 FROM public.production_closing_financial_entries WHERE closing_id=p_closing_id) THEN
    PERFORM public.refresh_production_closing_financial_status(p_closing_id);
    SELECT count(*),COALESCE(sum(fe.value),0) INTO v_count,v_total
    FROM public.production_closing_financial_entries l JOIN public.financial_entries fe ON fe.id=l.financial_entry_id
    WHERE l.closing_id=p_closing_id;
    RETURN jsonb_build_object('success',true,'already_confirmed',true,'financial_entries',v_count,'total_value',v_total);
  END IF;

  IF v_closing.status<>'aberto' THEN RETURN jsonb_build_object('success',false,'reason','closing_not_open'); END IF;

  SELECT id INTO v_category_id FROM public.financial_categories
  WHERE is_active AND type='pagar' AND lower(btrim(name))='salários'
  ORDER BY created_at ASC LIMIT 1;
  IF v_category_id IS NULL THEN RETURN jsonb_build_object('success',false,'reason','salary_category_missing'); END IF;

  FOR r IN
    SELECT min(employee_name) employee_name, sum(total_value) total_value
    FROM public.production_closing_items
    WHERE closing_id=p_closing_id
    GROUP BY lower(btrim(employee_name))
    HAVING sum(total_value)>0
  LOOP
    INSERT INTO public.financial_entries(
      type,description,value,value_paid,due_date,category_id,notes,
      issue_date,competence_date,lifecycle_status
    ) VALUES (
      'pagar',
      format('Mão de obra Produção — %s — Fechamento %s a %s',r.employee_name,
             to_char(v_closing.start_date,'DD/MM/YYYY'),to_char(v_closing.end_date,'DD/MM/YYYY')),
      r.total_value,0,p_due_date,v_category_id,
      format('Gerado pelo Fechamento de Produção %s. Pagamento deve ser realizado no Financeiro.',p_closing_id),
      (now() AT TIME ZONE 'America/Sao_Paulo')::date,v_closing.end_date,'active'
    ) RETURNING id INTO v_entry_id;

    INSERT INTO public.production_closing_financial_entries(closing_id,employee_name,financial_entry_id)
    VALUES (p_closing_id,r.employee_name,v_entry_id);
    v_count:=v_count+1;
    v_total:=v_total+r.total_value;
  END LOOP;

  IF v_count=0 THEN
    UPDATE public.production_closings SET status='fechado_sem_valor',closed_at=now() WHERE id=p_closing_id;
    RETURN jsonb_build_object('success',true,'financial_entries',0,'total_value',0,'status','fechado_sem_valor');
  END IF;

  PERFORM public.refresh_production_closing_financial_status(p_closing_id);
  RETURN jsonb_build_object('success',true,'financial_entries',v_count,'total_value',v_total,'status','a_pagar');
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_refresh_production_closing_from_financial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT closing_id FROM public.production_closing_financial_entries
           WHERE financial_entry_id=COALESCE(NEW.id,OLD.id)
  LOOP
    PERFORM public.refresh_production_closing_financial_status(r.closing_id);
  END LOOP;
  RETURN COALESCE(NEW,OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_production_closing_from_financial ON public.financial_entries;
CREATE TRIGGER trg_refresh_production_closing_from_financial
AFTER UPDATE OF value,value_paid,payment_date,lifecycle_status ON public.financial_entries
FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_production_closing_from_financial();

CREATE OR REPLACE FUNCTION public.prevent_financialized_production_closing_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.production_closing_financial_entries WHERE closing_id=OLD.id) THEN
    RAISE EXCEPTION 'financialized_production_closing_cannot_be_deleted';
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_prevent_financialized_production_closing_delete ON public.production_closings;
CREATE TRIGGER trg_prevent_financialized_production_closing_delete
BEFORE DELETE ON public.production_closings
FOR EACH ROW EXECUTE FUNCTION public.prevent_financialized_production_closing_delete();

REVOKE ALL ON FUNCTION public.create_production_closing(date,date,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_production_closing(uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_production_closing(date,date,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_production_closing(uuid,date) TO authenticated, service_role;
