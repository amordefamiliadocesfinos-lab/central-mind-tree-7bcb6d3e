-- Agenda operacional de entrega por fornecedor.
-- Uso real confirmado em 2026-10-07:
-- Ivoti: terça, quinta e sexta.
-- Dinâmica: quinta.
-- Regra: pedido confirmado antes das 17h do dia anterior à rota.
--
-- Esta etapa NÃO integra com MRP. Apenas registra a verdade operacional
-- e permite que Compras informe a próxima entrega elegível/cutoff.

CREATE TABLE IF NOT EXISTS public.supplier_delivery_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  cutoff_days_before smallint NOT NULL DEFAULT 1 CHECK (cutoff_days_before >= 0),
  cutoff_time time NOT NULL DEFAULT '17:00'::time,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  is_active boolean NOT NULL DEFAULT true,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_delivery_schedules_supplier_weekday_key
    UNIQUE (supplier_contact_id, weekday)
);

ALTER TABLE public.supplier_delivery_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supplier_delivery_schedules_read_authenticated
  ON public.supplier_delivery_schedules;

CREATE POLICY supplier_delivery_schedules_read_authenticated
ON public.supplier_delivery_schedules
FOR SELECT
TO authenticated
USING (true);

INSERT INTO public.supplier_delivery_schedules (
  supplier_contact_id, weekday, cutoff_days_before, cutoff_time, timezone, is_active, notes
)
VALUES
  ('75ac9c38-f6d5-4e63-98db-a8e7e3b06bf1'::uuid, 2, 1, '17:00', 'America/Sao_Paulo', true, 'Ivoti — rota de terça. Pedido até 17h do dia anterior.'),
  ('75ac9c38-f6d5-4e63-98db-a8e7e3b06bf1'::uuid, 4, 1, '17:00', 'America/Sao_Paulo', true, 'Ivoti — rota de quinta. Pedido até 17h do dia anterior.'),
  ('75ac9c38-f6d5-4e63-98db-a8e7e3b06bf1'::uuid, 5, 1, '17:00', 'America/Sao_Paulo', true, 'Ivoti — rota de sexta. Pedido até 17h do dia anterior.'),
  ('5870fb3e-197d-4447-ba27-d5967584e097'::uuid, 4, 1, '17:00', 'America/Sao_Paulo', true, 'Dinâmica — rota de quinta. Pedido até 17h do dia anterior.')
ON CONFLICT (supplier_contact_id, weekday)
DO UPDATE SET
  cutoff_days_before = EXCLUDED.cutoff_days_before,
  cutoff_time = EXCLUDED.cutoff_time,
  timezone = EXCLUDED.timezone,
  is_active = EXCLUDED.is_active,
  notes = EXCLUDED.notes,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.get_supplier_delivery_plan(
  p_supplier_contact_id uuid,
  p_reference_time timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_timezone text;
  v_local_now timestamp;
  v_days_label text;
  v_delivery_date date;
  v_deadline_date date;
  v_deadline_time time;
BEGIN
  SELECT s.timezone
    INTO v_timezone
  FROM public.supplier_delivery_schedules s
  WHERE s.supplier_contact_id = p_supplier_contact_id
    AND s.is_active = true
  ORDER BY s.weekday
  LIMIT 1;

  IF v_timezone IS NULL THEN
    RETURN jsonb_build_object(
      'has_schedule', false,
      'supplier_contact_id', p_supplier_contact_id
    );
  END IF;

  v_local_now := p_reference_time AT TIME ZONE v_timezone;

  SELECT string_agg(
           CASE s.weekday
             WHEN 1 THEN 'segunda'
             WHEN 2 THEN 'terça'
             WHEN 3 THEN 'quarta'
             WHEN 4 THEN 'quinta'
             WHEN 5 THEN 'sexta'
             WHEN 6 THEN 'sábado'
             WHEN 7 THEN 'domingo'
           END,
           ', ' ORDER BY s.weekday
         )
    INTO v_days_label
  FROM public.supplier_delivery_schedules s
  WHERE s.supplier_contact_id = p_supplier_contact_id
    AND s.is_active = true;

  SELECT
    d.delivery_date,
    d.delivery_date - s.cutoff_days_before,
    s.cutoff_time
  INTO
    v_delivery_date,
    v_deadline_date,
    v_deadline_time
  FROM (
    SELECT gs::date AS delivery_date
    FROM generate_series(
      v_local_now::date,
      v_local_now::date + 21,
      interval '1 day'
    ) gs
  ) d
  JOIN public.supplier_delivery_schedules s
    ON s.supplier_contact_id = p_supplier_contact_id
   AND s.is_active = true
   AND s.weekday = extract(isodow FROM d.delivery_date)::integer
  WHERE v_local_now < ((d.delivery_date - s.cutoff_days_before) + s.cutoff_time)
  ORDER BY d.delivery_date
  LIMIT 1;

  RETURN jsonb_build_object(
    'has_schedule', true,
    'supplier_contact_id', p_supplier_contact_id,
    'timezone', v_timezone,
    'weekdays_label', v_days_label,
    'next_delivery_date', v_delivery_date,
    'order_deadline_date', v_deadline_date,
    'order_deadline_time', to_char(v_deadline_time, 'HH24:MI')
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_supplier_delivery_plan(uuid,timestamptz)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_supplier_delivery_plan(uuid,timestamptz)
TO authenticated, service_role;

COMMENT ON TABLE public.supplier_delivery_schedules IS
  'Agenda operacional recorrente de entrega do fornecedor. Não representa lead time realizado.';
COMMENT ON FUNCTION public.get_supplier_delivery_plan(uuid,timestamptz) IS
  'Retorna a próxima entrega elegível considerando dias de rota e cutoff; não altera pedido, estoque ou MRP.';
