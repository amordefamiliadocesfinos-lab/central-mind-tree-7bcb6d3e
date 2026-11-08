-- F16 Health — in-app reminders and routine.
-- Persists user-controlled reminder rules and append-only daily interaction events.
-- V1 does not send push/email/SMS and does not mutate specialist plans or clinical data.

CREATE TABLE public.health_reminder_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,

  reminder_type text NOT NULL CHECK (
    reminder_type IN (
      'training',
      'nutrition_log',
      'body_assessment',
      'recovery_checkin',
      'longitudinal_review'
    )
  ),
  label text NULL,
  enabled boolean NOT NULL DEFAULT true,

  schedule_kind text NOT NULL CHECK (
    schedule_kind IN ('daily','weekly','interval')
  ),
  days_of_week smallint[] NOT NULL DEFAULT '{}'::smallint[],
  local_time time without time zone NOT NULL,
  interval_days integer NULL,
  start_on date NOT NULL,
  timezone text NOT NULL,

  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','archived')),
  archived_at timestamptz NULL,

  created_by_auth_user_id uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE RESTRICT
    DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (id, athlete_id),

  CHECK (label IS NULL OR char_length(label)<=160),
  CHECK (btrim(timezone)<>'' AND char_length(timezone)<=100),
  CHECK (
    days_of_week <@ ARRAY[0,1,2,3,4,5,6]::smallint[]
  ),
  CHECK (
    (schedule_kind='daily'
      AND pg_catalog.cardinality(days_of_week)=0
      AND interval_days IS NULL)
    OR
    (schedule_kind='weekly'
      AND pg_catalog.cardinality(days_of_week)>0
      AND interval_days IS NULL)
    OR
    (schedule_kind='interval'
      AND pg_catalog.cardinality(days_of_week)=0
      AND interval_days BETWEEN 1 AND 365)
  ),
  CHECK (
    (status='active' AND archived_at IS NULL)
    OR (status='archived' AND archived_at IS NOT NULL)
  )
);

CREATE INDEX health_reminder_rules_athlete_status_idx
ON public.health_reminder_rules(athlete_id, status, enabled, local_time);

CREATE INDEX health_reminder_rules_created_by_idx
ON public.health_reminder_rules(created_by_auth_user_id);

CREATE TABLE public.health_reminder_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  reminder_rule_id uuid NOT NULL,

  event_type text NOT NULL CHECK (
    event_type IN ('completed','dismissed')
  ),
  event_date date NOT NULL,
  notes text NULL,

  recorded_by_auth_user_id uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE RESTRICT
    DEFAULT auth.uid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT health_reminder_events_rule_athlete_fkey
    FOREIGN KEY (reminder_rule_id, athlete_id)
    REFERENCES public.health_reminder_rules(id, athlete_id)
    ON DELETE RESTRICT,

  CHECK (notes IS NULL OR char_length(notes)<=1000)
);

CREATE INDEX health_reminder_events_rule_date_idx
ON public.health_reminder_events(
  reminder_rule_id,
  event_date DESC,
  occurred_at DESC
);

CREATE INDEX health_reminder_events_athlete_date_idx
ON public.health_reminder_events(
  athlete_id,
  event_date DESC,
  occurred_at DESC
);

CREATE INDEX health_reminder_events_recorded_by_idx
ON public.health_reminder_events(recorded_by_auth_user_id);

ALTER TABLE public.health_reminder_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_reminder_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
  public.health_reminder_rules,
  public.health_reminder_events
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON
  public.health_reminder_rules,
  public.health_reminder_events
TO authenticated;

CREATE POLICY health_reminder_rules_select
ON public.health_reminder_rules
FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_reminder_events_select
ON public.health_reminder_events
FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE OR REPLACE FUNCTION public.health_f16_save_reminder_rule(
  p_athlete_id uuid,
  p_reminder_type text,
  p_label text,
  p_enabled boolean,
  p_schedule_kind text,
  p_days_of_week smallint[],
  p_local_time time without time zone,
  p_interval_days integer,
  p_start_on date,
  p_timezone text,
  p_rule_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rule public.health_reminder_rules%ROWTYPE;
  v_days smallint[];
  v_label text;
  v_timezone text;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NOT public.health_can_write_athlete(p_athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF p_reminder_type NOT IN (
    'training',
    'nutrition_log',
    'body_assessment',
    'recovery_checkin',
    'longitudinal_review'
  ) THEN
    RAISE EXCEPTION 'invalid reminder type';
  END IF;

  IF p_schedule_kind NOT IN ('daily','weekly','interval') THEN
    RAISE EXCEPTION 'invalid schedule kind';
  END IF;

  IF p_local_time IS NULL THEN
    RAISE EXCEPTION 'local time is required';
  END IF;

  IF p_start_on IS NULL THEN
    RAISE EXCEPTION 'start date is required';
  END IF;

  v_timezone := NULLIF(pg_catalog.btrim(COALESCE(p_timezone,'')),'');
  IF v_timezone IS NULL OR char_length(v_timezone)>100 THEN
    RAISE EXCEPTION 'valid timezone is required';
  END IF;

  v_label := NULLIF(pg_catalog.btrim(COALESCE(p_label,'')),'');
  IF v_label IS NOT NULL AND char_length(v_label)>160 THEN
    RAISE EXCEPTION 'reminder label is too long';
  END IF;

  SELECT COALESCE(
    pg_catalog.array_agg(DISTINCT d ORDER BY d),
    '{}'::smallint[]
  )
  INTO v_days
  FROM pg_catalog.unnest(COALESCE(p_days_of_week,'{}'::smallint[])) AS d;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(v_days) AS d
    WHERE d<0 OR d>6
  ) THEN
    RAISE EXCEPTION 'invalid day of week';
  END IF;

  IF p_schedule_kind='daily' THEN
    v_days := '{}'::smallint[];
    p_interval_days := NULL;
  ELSIF p_schedule_kind='weekly' THEN
    IF pg_catalog.cardinality(v_days)=0 THEN
      RAISE EXCEPTION 'weekly reminder requires at least one day';
    END IF;
    p_interval_days := NULL;
  ELSE
    v_days := '{}'::smallint[];
    IF p_interval_days IS NULL OR p_interval_days<1 OR p_interval_days>365 THEN
      RAISE EXCEPTION 'interval reminder requires interval_days between 1 and 365';
    END IF;
  END IF;

  IF p_rule_id IS NULL THEN
    INSERT INTO public.health_reminder_rules (
      athlete_id,
      reminder_type,
      label,
      enabled,
      schedule_kind,
      days_of_week,
      local_time,
      interval_days,
      start_on,
      timezone
    ) VALUES (
      p_athlete_id,
      p_reminder_type,
      v_label,
      COALESCE(p_enabled,true),
      p_schedule_kind,
      v_days,
      p_local_time,
      p_interval_days,
      p_start_on,
      v_timezone
    )
    RETURNING id INTO v_id;

    RETURN v_id;
  END IF;

  SELECT r.*
  INTO v_rule
  FROM public.health_reminder_rules r
  WHERE r.id=p_rule_id
    AND r.athlete_id=p_athlete_id
  FOR UPDATE;

  IF v_rule.id IS NULL THEN
    RAISE EXCEPTION 'reminder rule not found';
  END IF;

  IF v_rule.status='archived' THEN
    RAISE EXCEPTION 'archived reminder rule cannot be edited';
  END IF;

  UPDATE public.health_reminder_rules
  SET reminder_type=p_reminder_type,
      label=v_label,
      enabled=COALESCE(p_enabled,true),
      schedule_kind=p_schedule_kind,
      days_of_week=v_days,
      local_time=p_local_time,
      interval_days=p_interval_days,
      start_on=p_start_on,
      timezone=v_timezone,
      updated_at=now()
  WHERE id=v_rule.id
    AND athlete_id=v_rule.athlete_id;

  RETURN v_rule.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_f16_archive_reminder_rule(
  p_rule_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rule public.health_reminder_rules%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT r.*
  INTO v_rule
  FROM public.health_reminder_rules r
  WHERE r.id=p_rule_id
  FOR UPDATE;

  IF v_rule.id IS NULL THEN
    RAISE EXCEPTION 'reminder rule not found';
  END IF;

  IF NOT public.health_can_write_athlete(v_rule.athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF v_rule.status='archived' THEN
    RETURN v_rule.id;
  END IF;

  UPDATE public.health_reminder_rules
  SET status='archived',
      enabled=false,
      archived_at=now(),
      updated_at=now()
  WHERE id=v_rule.id
    AND athlete_id=v_rule.athlete_id;

  RETURN v_rule.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_f16_record_reminder_event(
  p_rule_id uuid,
  p_event_type text,
  p_event_date date,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rule public.health_reminder_rules%ROWTYPE;
  v_notes text;
  v_existing public.health_reminder_events%ROWTYPE;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF p_event_type NOT IN ('completed','dismissed') THEN
    RAISE EXCEPTION 'invalid reminder event type';
  END IF;

  IF p_event_date IS NULL THEN
    RAISE EXCEPTION 'event date is required';
  END IF;

  SELECT r.*
  INTO v_rule
  FROM public.health_reminder_rules r
  WHERE r.id=p_rule_id;

  IF v_rule.id IS NULL THEN
    RAISE EXCEPTION 'reminder rule not found';
  END IF;

  IF NOT public.health_can_write_athlete(v_rule.athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF v_rule.status='archived' THEN
    RAISE EXCEPTION 'archived reminder rule cannot receive events';
  END IF;

  v_notes := NULLIF(pg_catalog.btrim(COALESCE(p_notes,'')),'');
  IF v_notes IS NOT NULL AND char_length(v_notes)>1000 THEN
    RAISE EXCEPTION 'event notes are too long';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_rule.id::text || '|' || p_event_date::text || '|F16_EVENT',
      0
    )
  );

  SELECT e.*
  INTO v_existing
  FROM public.health_reminder_events e
  WHERE e.reminder_rule_id=v_rule.id
    AND e.athlete_id=v_rule.athlete_id
    AND e.event_date=p_event_date
  ORDER BY e.occurred_at DESC,e.id DESC
  LIMIT 1;

  IF v_existing.id IS NOT NULL
    AND v_existing.event_type=p_event_type
    AND COALESCE(v_existing.notes,'')=COALESCE(v_notes,'')
  THEN
    RETURN v_existing.id;
  END IF;

  INSERT INTO public.health_reminder_events (
    athlete_id,
    reminder_rule_id,
    event_type,
    event_date,
    notes
  ) VALUES (
    v_rule.athlete_id,
    v_rule.id,
    p_event_type,
    p_event_date,
    v_notes
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.health_f16_save_reminder_rule(
  uuid,text,text,boolean,text,smallint[],time without time zone,integer,date,text,uuid
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.health_f16_archive_reminder_rule(uuid)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.health_f16_record_reminder_event(
  uuid,text,date,text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.health_f16_save_reminder_rule(
  uuid,text,text,boolean,text,smallint[],time without time zone,integer,date,text,uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.health_f16_archive_reminder_rule(uuid)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.health_f16_record_reminder_event(
  uuid,text,date,text
) TO authenticated;
