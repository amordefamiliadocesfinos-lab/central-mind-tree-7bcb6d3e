-- M5 maintenance — Food log day lifecycle required by M6 state
-- Completeness is explicit and auditable. Direct lifecycle UPDATE is not exposed.

CREATE TABLE public.health_food_log_day_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  food_log_day_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('completed','reopened')),
  client_event_id uuid NULL,
  payload jsonb NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  UNIQUE (athlete_id, client_event_id),
  CONSTRAINT health_food_log_day_events_day_athlete_fkey
    FOREIGN KEY (food_log_day_id, athlete_id)
    REFERENCES public.health_food_log_days(id, athlete_id)
    ON DELETE RESTRICT
);

CREATE INDEX health_food_log_day_events_day_time_idx
ON public.health_food_log_day_events(food_log_day_id, occurred_at);

ALTER TABLE public.health_food_log_day_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.health_food_log_day_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.health_food_log_day_events TO authenticated;

CREATE POLICY health_food_log_day_events_select
ON public.health_food_log_day_events
FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

-- A new day may only start unknown/partial. Completion is RPC-only and audited.
DROP POLICY IF EXISTS health_food_log_days_insert ON public.health_food_log_days;
CREATE POLICY health_food_log_days_insert
ON public.health_food_log_days
FOR INSERT TO authenticated
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND completeness_status IN ('unknown','partial')
  AND completed_at IS NULL
  AND completion_confirmed_by IS NULL
);

-- Keep ordinary editable metadata available, but lifecycle fields are RPC-only.
REVOKE UPDATE ON public.health_food_log_days FROM authenticated;
GRANT UPDATE (
  registration_level,
  confidence,
  confidence_score,
  confidence_reason_codes,
  notes
) ON public.health_food_log_days TO authenticated;

CREATE OR REPLACE FUNCTION public.health_m5_complete_food_log_day(
  p_day_id uuid,
  p_client_event_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
DECLARE
  v_athlete_id uuid;
  v_status text;
  v_existing_day_id uuid;
BEGIN
  SELECT d.athlete_id,d.completeness_status
  INTO v_athlete_id,v_status
  FROM public.health_food_log_days d
  WHERE d.id=p_day_id
  FOR UPDATE;

  IF v_athlete_id IS NULL THEN
    RAISE EXCEPTION 'food log day not found';
  END IF;

  IF NOT public.health_can_write_athlete(v_athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF p_client_event_id IS NOT NULL THEN
    SELECT e.food_log_day_id
    INTO v_existing_day_id
    FROM public.health_food_log_day_events e
    WHERE e.athlete_id=v_athlete_id
      AND e.client_event_id=p_client_event_id;

    IF v_existing_day_id IS NOT NULL THEN
      IF v_existing_day_id IS DISTINCT FROM p_day_id THEN
        RAISE EXCEPTION 'client_event_id already used for another food log day';
      END IF;
      RETURN p_day_id;
    END IF;
  END IF;

  IF v_status='complete' THEN
    RETURN p_day_id;
  END IF;

  UPDATE public.health_food_log_days
  SET completeness_status='complete',
      completed_at=now(),
      completion_confirmed_by='user'
  WHERE id=p_day_id;

  INSERT INTO public.health_food_log_day_events (
    athlete_id,food_log_day_id,event_type,client_event_id,payload
  ) VALUES (
    v_athlete_id,p_day_id,'completed',p_client_event_id,
    jsonb_build_object('confirmed_by','user')
  );

  RETURN p_day_id;
END;
$;

CREATE OR REPLACE FUNCTION public.health_m5_reopen_food_log_day(
  p_day_id uuid,
  p_client_event_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
DECLARE
  v_athlete_id uuid;
  v_status text;
  v_existing_day_id uuid;
BEGIN
  SELECT d.athlete_id,d.completeness_status
  INTO v_athlete_id,v_status
  FROM public.health_food_log_days d
  WHERE d.id=p_day_id
  FOR UPDATE;

  IF v_athlete_id IS NULL THEN
    RAISE EXCEPTION 'food log day not found';
  END IF;

  IF NOT public.health_can_write_athlete(v_athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF p_client_event_id IS NOT NULL THEN
    SELECT e.food_log_day_id
    INTO v_existing_day_id
    FROM public.health_food_log_day_events e
    WHERE e.athlete_id=v_athlete_id
      AND e.client_event_id=p_client_event_id;

    IF v_existing_day_id IS NOT NULL THEN
      IF v_existing_day_id IS DISTINCT FROM p_day_id THEN
        RAISE EXCEPTION 'client_event_id already used for another food log day';
      END IF;
      RETURN p_day_id;
    END IF;
  END IF;

  IF v_status<>'complete' THEN
    RETURN p_day_id;
  END IF;

  UPDATE public.health_food_log_days
  SET completeness_status='partial',
      completed_at=NULL,
      completion_confirmed_by=NULL
  WHERE id=p_day_id;

  INSERT INTO public.health_food_log_day_events (
    athlete_id,food_log_day_id,event_type,client_event_id,payload
  ) VALUES (
    v_athlete_id,p_day_id,'reopened',p_client_event_id,
    jsonb_build_object('previous_status','complete')
  );

  RETURN p_day_id;
END;
$;

REVOKE ALL ON FUNCTION public.health_m5_complete_food_log_day(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.health_m5_reopen_food_log_day(uuid,uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.health_m5_complete_food_log_day(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.health_m5_reopen_food_log_day(uuid,uuid) TO authenticated;
