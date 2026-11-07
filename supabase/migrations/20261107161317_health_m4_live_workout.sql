-- M4 Health: live workout execution facts.
-- M3 remains sovereign for planned program data; M4 records what actually happened.

ALTER TABLE public.health_cch_queue_entries
DROP CONSTRAINT health_cch_queue_entries_state_check;

ALTER TABLE public.health_cch_queue_entries
ADD CONSTRAINT health_cch_queue_entries_state_check
CHECK (
  state IN (
    'queued','eligible','prioritized','in_progress',
    'blocked','completed','skipped','superseded'
  )
);

CREATE TABLE public.health_workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  queue_entry_id uuid NULL REFERENCES public.health_cch_queue_entries(id) ON DELETE RESTRICT,
  program_version_id uuid NULL,
  session_template_id uuid NULL,
  source text NOT NULL DEFAULT 'queue' CHECK (
    source IN ('queue','manual','reentry')
  ),
  status text NOT NULL DEFAULT 'active' CHECK (
    status IN ('active','paused','completed','aborted')
  ),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz NULL,
  start_client_event_id uuid NOT NULL,
  notes text NULL,
  created_by_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, athlete_id),
  UNIQUE (athlete_id, start_client_event_id),
  CONSTRAINT health_workout_sessions_version_athlete_fkey
    FOREIGN KEY (program_version_id, athlete_id)
    REFERENCES public.health_program_versions(id, athlete_id)
    ON DELETE RESTRICT,
  CONSTRAINT health_workout_sessions_template_athlete_fkey
    FOREIGN KEY (session_template_id, athlete_id)
    REFERENCES public.health_session_templates(id, athlete_id)
    ON DELETE RESTRICT,
  CHECK (
    (status IN ('completed','aborted') AND ended_at IS NOT NULL)
    OR (status IN ('active','paused') AND ended_at IS NULL)
  )
);

CREATE UNIQUE INDEX health_workout_sessions_one_open_per_athlete
ON public.health_workout_sessions(athlete_id)
WHERE status IN ('active','paused');

CREATE UNIQUE INDEX health_workout_sessions_one_open_per_queue
ON public.health_workout_sessions(queue_entry_id)
WHERE queue_entry_id IS NOT NULL AND status IN ('active','paused');

CREATE TABLE public.health_workout_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.health_exercises(id) ON DELETE RESTRICT,
  template_exercise_id uuid NULL REFERENCES public.health_session_template_exercises(id) ON DELETE SET NULL,
  sequence_order integer NOT NULL CHECK (sequence_order >= 1),
  origin text NOT NULL DEFAULT 'template' CHECK (
    origin IN ('template','manual','substitution')
  ),
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending','active','completed','skipped','replaced')
  ),
  replaced_from_exercise_id uuid NULL REFERENCES public.health_workout_exercises(id) ON DELETE SET NULL,
  planned_sets_min smallint NULL CHECK (planned_sets_min IS NULL OR planned_sets_min BETWEEN 1 AND 20),
  planned_sets_max smallint NULL CHECK (planned_sets_max IS NULL OR planned_sets_max BETWEEN 1 AND 20),
  planned_reps_min smallint NULL CHECK (planned_reps_min IS NULL OR planned_reps_min BETWEEN 1 AND 100),
  planned_reps_max smallint NULL CHECK (planned_reps_max IS NULL OR planned_reps_max BETWEEN 1 AND 100),
  planned_rir_target numeric(3,1) NULL CHECK (
    planned_rir_target IS NULL OR (planned_rir_target >= 0 AND planned_rir_target <= 10)
  ),
  planned_rest_seconds integer NULL CHECK (
    planned_rest_seconds IS NULL OR planned_rest_seconds BETWEEN 0 AND 1800
  ),
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, session_id, athlete_id),
  UNIQUE (session_id, sequence_order),
  CONSTRAINT health_workout_exercises_session_athlete_fkey
    FOREIGN KEY (session_id, athlete_id)
    REFERENCES public.health_workout_sessions(id, athlete_id)
    ON DELETE CASCADE,
  CHECK (
    planned_sets_min IS NULL OR planned_sets_max IS NULL OR planned_sets_max >= planned_sets_min
  ),
  CHECK (
    planned_reps_min IS NULL OR planned_reps_max IS NULL OR planned_reps_max >= planned_reps_min
  )
);

CREATE TABLE public.health_workout_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_exercise_id uuid NOT NULL,
  session_id uuid NOT NULL,
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  set_number integer NOT NULL CHECK (set_number >= 1 AND set_number <= 100),
  set_type text NOT NULL DEFAULT 'working' CHECK (
    set_type IN ('warmup','working','backoff','drop','other')
  ),
  status text NOT NULL DEFAULT 'completed' CHECK (
    status IN ('completed','skipped')
  ),
  load_value numeric(10,3) NULL CHECK (load_value IS NULL OR load_value >= 0),
  load_unit text NOT NULL DEFAULT 'kg' CHECK (
    load_unit IN ('kg','lb','bodyweight')
  ),
  reps integer NULL CHECK (reps IS NULL OR (reps >= 0 AND reps <= 1000)),
  rir numeric(3,1) NULL CHECK (rir IS NULL OR (rir >= 0 AND rir <= 10)),
  rest_seconds integer NULL CHECK (
    rest_seconds IS NULL OR (rest_seconds >= 0 AND rest_seconds <= 3600)
  ),
  client_event_id uuid NOT NULL,
  completed_at timestamptz NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, client_event_id),
  UNIQUE (workout_exercise_id, set_number),
  CONSTRAINT health_workout_sets_exercise_session_athlete_fkey
    FOREIGN KEY (workout_exercise_id, session_id, athlete_id)
    REFERENCES public.health_workout_exercises(id, session_id, athlete_id)
    ON DELETE CASCADE,
  CHECK (
    (status='completed' AND completed_at IS NOT NULL)
    OR (status='skipped')
  )
);

CREATE TABLE public.health_workout_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  workout_exercise_id uuid NULL REFERENCES public.health_workout_exercises(id) ON DELETE SET NULL,
  workout_set_id uuid NULL REFERENCES public.health_workout_sets(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (
    event_type IN (
      'session_started','session_paused','session_resumed',
      'exercise_added','exercise_skipped','exercise_replaced',
      'set_logged','set_updated','rest_recorded',
      'session_completed','session_aborted','note'
    )
  ),
  source text NOT NULL DEFAULT 'user' CHECK (
    source IN ('user','system','sync')
  ),
  client_event_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NULL,
  created_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  UNIQUE (athlete_id, client_event_id),
  CONSTRAINT health_workout_events_session_athlete_fkey
    FOREIGN KEY (session_id, athlete_id)
    REFERENCES public.health_workout_sessions(id, athlete_id)
    ON DELETE CASCADE
);

CREATE INDEX health_workout_sessions_athlete_time_idx
ON public.health_workout_sessions(athlete_id, started_at DESC);

CREATE INDEX health_workout_exercises_session_idx
ON public.health_workout_exercises(session_id, sequence_order);

CREATE INDEX health_workout_sets_exercise_idx
ON public.health_workout_sets(workout_exercise_id, set_number);

CREATE INDEX health_workout_events_session_idx
ON public.health_workout_events(session_id, occurred_at, recorded_at);

ALTER TABLE public.health_workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_workout_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_workout_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
  public.health_workout_sessions,
  public.health_workout_exercises,
  public.health_workout_sets,
  public.health_workout_events
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.health_workout_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.health_workout_exercises TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.health_workout_sets TO authenticated;
GRANT SELECT, INSERT ON public.health_workout_events TO authenticated;

CREATE POLICY health_workout_sessions_select
ON public.health_workout_sessions FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_workout_sessions_insert
ON public.health_workout_sessions FOR INSERT TO authenticated
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND created_by_auth_user_id = auth.uid()
);

CREATE POLICY health_workout_sessions_update
ON public.health_workout_sessions FOR UPDATE TO authenticated
USING (public.health_can_write_athlete(athlete_id))
WITH CHECK (public.health_can_write_athlete(athlete_id));

CREATE POLICY health_workout_exercises_select
ON public.health_workout_exercises FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_workout_exercises_insert
ON public.health_workout_exercises FOR INSERT TO authenticated
WITH CHECK (public.health_can_write_athlete(athlete_id));

CREATE POLICY health_workout_exercises_update
ON public.health_workout_exercises FOR UPDATE TO authenticated
USING (public.health_can_write_athlete(athlete_id))
WITH CHECK (public.health_can_write_athlete(athlete_id));

CREATE POLICY health_workout_sets_select
ON public.health_workout_sets FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_workout_sets_insert
ON public.health_workout_sets FOR INSERT TO authenticated
WITH CHECK (public.health_can_write_athlete(athlete_id));

CREATE POLICY health_workout_sets_update
ON public.health_workout_sets FOR UPDATE TO authenticated
USING (public.health_can_write_athlete(athlete_id))
WITH CHECK (public.health_can_write_athlete(athlete_id));

CREATE POLICY health_workout_events_select
ON public.health_workout_events FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_workout_events_insert
ON public.health_workout_events FOR INSERT TO authenticated
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND (created_by_auth_user_id IS NULL OR created_by_auth_user_id = auth.uid())
);

CREATE TRIGGER health_workout_sessions_updated_at
BEFORE UPDATE ON public.health_workout_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_workout_exercises_updated_at
BEFORE UPDATE ON public.health_workout_exercises
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_workout_sets_updated_at
BEFORE UPDATE ON public.health_workout_sets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.health_m4_start_workout(
  p_queue_entry_id uuid,
  p_client_event_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_queue public.health_cch_queue_entries%ROWTYPE;
  v_session_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT *
  INTO v_queue
  FROM public.health_cch_queue_entries
  WHERE id=p_queue_entry_id
    AND state IN ('queued','eligible','prioritized','in_progress');

  IF v_queue.id IS NULL THEN
    RAISE EXCEPTION 'queue entry not found or unavailable';
  END IF;

  IF NOT public.health_can_write_athlete(v_queue.athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  SELECT s.id
  INTO v_session_id
  FROM public.health_workout_sessions s
  WHERE s.athlete_id=v_queue.athlete_id
    AND s.start_client_event_id=p_client_event_id
  LIMIT 1;

  IF v_session_id IS NOT NULL THEN
    RETURN v_session_id;
  END IF;

  INSERT INTO public.health_workout_sessions (
    athlete_id,
    queue_entry_id,
    program_version_id,
    session_template_id,
    source,
    status,
    start_client_event_id,
    created_by_auth_user_id
  )
  VALUES (
    v_queue.athlete_id,
    v_queue.id,
    v_queue.program_version_id,
    v_queue.session_template_id,
    'queue',
    'active',
    p_client_event_id,
    auth.uid()
  )
  RETURNING id INTO v_session_id;

  INSERT INTO public.health_workout_exercises (
    session_id,
    athlete_id,
    exercise_id,
    template_exercise_id,
    sequence_order,
    origin,
    status,
    planned_sets_min,
    planned_sets_max,
    planned_reps_min,
    planned_reps_max,
    planned_rir_target,
    planned_rest_seconds
  )
  SELECT
    v_session_id,
    v_queue.athlete_id,
    e.exercise_id,
    e.id,
    e.sequence_order,
    'template',
    'pending',
    e.planned_sets_min,
    e.planned_sets_max,
    e.reps_min,
    e.reps_max,
    e.rir_target,
    e.rest_seconds
  FROM public.health_session_template_exercises e
  WHERE e.session_template_id=v_queue.session_template_id
    AND e.athlete_id=v_queue.athlete_id
  ORDER BY e.sequence_order;

  INSERT INTO public.health_workout_events (
    athlete_id,
    session_id,
    event_type,
    source,
    client_event_id,
    payload,
    created_by_auth_user_id
  )
  VALUES (
    v_queue.athlete_id,
    v_session_id,
    'session_started',
    'user',
    p_client_event_id,
    jsonb_build_object(
      'queue_entry_id',v_queue.id,
      'program_version_id',v_queue.program_version_id,
      'session_template_id',v_queue.session_template_id
    ),
    auth.uid()
  );

  UPDATE public.health_cch_queue_entries
  SET
    state='in_progress',
    reason_codes=CASE
      WHEN 'WORKOUT_STARTED'=ANY(reason_codes) THEN reason_codes
      ELSE array_append(reason_codes,'WORKOUT_STARTED')
    END
  WHERE id=v_queue.id
    AND athlete_id=v_queue.athlete_id;

  RETURN v_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m4_log_set(
  p_session_id uuid,
  p_workout_exercise_id uuid,
  p_client_event_id uuid,
  p_set_number integer,
  p_set_type text,
  p_load_value numeric,
  p_load_unit text,
  p_reps integer,
  p_rir numeric,
  p_rest_seconds integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_athlete_id uuid;
  v_set_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT s.athlete_id
  INTO v_athlete_id
  FROM public.health_workout_sessions s
  JOIN public.health_workout_exercises e
    ON e.session_id=s.id
   AND e.athlete_id=s.athlete_id
  WHERE s.id=p_session_id
    AND e.id=p_workout_exercise_id
    AND s.status IN ('active','paused');

  IF v_athlete_id IS NULL THEN
    RAISE EXCEPTION 'open workout/exercise not found';
  END IF;

  IF NOT public.health_can_write_athlete(v_athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  SELECT ws.id
  INTO v_set_id
  FROM public.health_workout_sets ws
  WHERE ws.athlete_id=v_athlete_id
    AND ws.client_event_id=p_client_event_id
  LIMIT 1;

  IF v_set_id IS NOT NULL THEN
    RETURN v_set_id;
  END IF;

  INSERT INTO public.health_workout_sets (
    workout_exercise_id,
    session_id,
    athlete_id,
    set_number,
    set_type,
    status,
    load_value,
    load_unit,
    reps,
    rir,
    rest_seconds,
    client_event_id,
    completed_at
  )
  VALUES (
    p_workout_exercise_id,
    p_session_id,
    v_athlete_id,
    p_set_number,
    p_set_type,
    'completed',
    p_load_value,
    p_load_unit,
    p_reps,
    p_rir,
    p_rest_seconds,
    p_client_event_id,
    now()
  )
  RETURNING id INTO v_set_id;

  UPDATE public.health_workout_exercises
  SET status='active'
  WHERE id=p_workout_exercise_id
    AND athlete_id=v_athlete_id
    AND status='pending';

  INSERT INTO public.health_workout_events (
    athlete_id,
    session_id,
    workout_exercise_id,
    workout_set_id,
    event_type,
    source,
    client_event_id,
    payload,
    created_by_auth_user_id
  )
  VALUES (
    v_athlete_id,
    p_session_id,
    p_workout_exercise_id,
    v_set_id,
    'set_logged',
    'user',
    p_client_event_id,
    jsonb_build_object(
      'set_number',p_set_number,
      'set_type',p_set_type,
      'load_value',p_load_value,
      'load_unit',p_load_unit,
      'reps',p_reps,
      'rir',p_rir,
      'rest_seconds',p_rest_seconds
    ),
    auth.uid()
  );

  RETURN v_set_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m4_update_set(
  p_set_id uuid,
  p_client_event_id uuid,
  p_load_value numeric,
  p_load_unit text,
  p_reps integer,
  p_rir numeric,
  p_rest_seconds integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_set public.health_workout_sets%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT *
  INTO v_set
  FROM public.health_workout_sets
  WHERE id=p_set_id;

  IF v_set.id IS NULL THEN
    RAISE EXCEPTION 'set not found';
  END IF;

  IF NOT public.health_can_write_athlete(v_set.athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.health_workout_events ev
    WHERE ev.athlete_id=v_set.athlete_id
      AND ev.client_event_id=p_client_event_id
  ) THEN
    RETURN p_set_id;
  END IF;

  UPDATE public.health_workout_sets
  SET
    load_value=p_load_value,
    load_unit=p_load_unit,
    reps=p_reps,
    rir=p_rir,
    rest_seconds=p_rest_seconds
  WHERE id=p_set_id
    AND athlete_id=v_set.athlete_id;

  INSERT INTO public.health_workout_events (
    athlete_id,
    session_id,
    workout_exercise_id,
    workout_set_id,
    event_type,
    source,
    client_event_id,
    payload,
    created_by_auth_user_id
  )
  VALUES (
    v_set.athlete_id,
    v_set.session_id,
    v_set.workout_exercise_id,
    v_set.id,
    'set_updated',
    'user',
    p_client_event_id,
    jsonb_build_object(
      'load_value',p_load_value,
      'load_unit',p_load_unit,
      'reps',p_reps,
      'rir',p_rir,
      'rest_seconds',p_rest_seconds
    ),
    auth.uid()
  );

  RETURN p_set_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m4_add_exercise(
  p_session_id uuid,
  p_exercise_id uuid,
  p_client_event_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_athlete_id uuid;
  v_exercise_id uuid;
  v_next_order integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT athlete_id
  INTO v_athlete_id
  FROM public.health_workout_sessions
  WHERE id=p_session_id
    AND status IN ('active','paused');

  IF v_athlete_id IS NULL THEN
    RAISE EXCEPTION 'open workout not found';
  END IF;

  IF NOT public.health_can_write_athlete(v_athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.health_workout_events ev
    WHERE ev.athlete_id=v_athlete_id
      AND ev.client_event_id=p_client_event_id
  ) THEN
    SELECT (ev.payload->>'workout_exercise_id')::uuid
    INTO v_exercise_id
    FROM public.health_workout_events ev
    WHERE ev.athlete_id=v_athlete_id
      AND ev.client_event_id=p_client_event_id;
    RETURN v_exercise_id;
  END IF;

  SELECT coalesce(max(sequence_order),0)+1
  INTO v_next_order
  FROM public.health_workout_exercises
  WHERE session_id=p_session_id
    AND athlete_id=v_athlete_id;

  INSERT INTO public.health_workout_exercises (
    session_id,
    athlete_id,
    exercise_id,
    sequence_order,
    origin,
    status
  )
  VALUES (
    p_session_id,
    v_athlete_id,
    p_exercise_id,
    v_next_order,
    'manual',
    'pending'
  )
  RETURNING id INTO v_exercise_id;

  INSERT INTO public.health_workout_events (
    athlete_id,
    session_id,
    workout_exercise_id,
    event_type,
    source,
    client_event_id,
    payload,
    created_by_auth_user_id
  )
  VALUES (
    v_athlete_id,
    p_session_id,
    v_exercise_id,
    'exercise_added',
    'user',
    p_client_event_id,
    jsonb_build_object(
      'workout_exercise_id',v_exercise_id,
      'exercise_id',p_exercise_id
    ),
    auth.uid()
  );

  RETURN v_exercise_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m4_skip_exercise(
  p_workout_exercise_id uuid,
  p_client_event_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.health_workout_exercises%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT *
  INTO v_row
  FROM public.health_workout_exercises
  WHERE id=p_workout_exercise_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'workout exercise not found';
  END IF;

  IF NOT public.health_can_write_athlete(v_row.athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.health_workout_events ev
    WHERE ev.athlete_id=v_row.athlete_id
      AND ev.client_event_id=p_client_event_id
  ) THEN
    RETURN p_workout_exercise_id;
  END IF;

  UPDATE public.health_workout_exercises
  SET status='skipped'
  WHERE id=p_workout_exercise_id
    AND athlete_id=v_row.athlete_id;

  INSERT INTO public.health_workout_events (
    athlete_id,
    session_id,
    workout_exercise_id,
    event_type,
    source,
    client_event_id,
    payload,
    created_by_auth_user_id
  )
  VALUES (
    v_row.athlete_id,
    v_row.session_id,
    v_row.id,
    'exercise_skipped',
    'user',
    p_client_event_id,
    jsonb_build_object('exercise_id',v_row.exercise_id),
    auth.uid()
  );

  RETURN p_workout_exercise_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m4_replace_exercise(
  p_workout_exercise_id uuid,
  p_replacement_exercise_id uuid,
  p_client_event_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_original public.health_workout_exercises%ROWTYPE;
  v_new_id uuid;
  v_next_order integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT *
  INTO v_original
  FROM public.health_workout_exercises
  WHERE id=p_workout_exercise_id;

  IF v_original.id IS NULL THEN
    RAISE EXCEPTION 'workout exercise not found';
  END IF;

  IF NOT public.health_can_write_athlete(v_original.athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.health_workout_events ev
    WHERE ev.athlete_id=v_original.athlete_id
      AND ev.client_event_id=p_client_event_id
  ) THEN
    SELECT (ev.payload->>'replacement_workout_exercise_id')::uuid
    INTO v_new_id
    FROM public.health_workout_events ev
    WHERE ev.athlete_id=v_original.athlete_id
      AND ev.client_event_id=p_client_event_id;
    RETURN v_new_id;
  END IF;

  SELECT coalesce(max(sequence_order),0)+1
  INTO v_next_order
  FROM public.health_workout_exercises
  WHERE session_id=v_original.session_id
    AND athlete_id=v_original.athlete_id;

  UPDATE public.health_workout_exercises
  SET status='replaced'
  WHERE id=v_original.id
    AND athlete_id=v_original.athlete_id;

  INSERT INTO public.health_workout_exercises (
    session_id,
    athlete_id,
    exercise_id,
    sequence_order,
    origin,
    status,
    replaced_from_exercise_id,
    planned_sets_min,
    planned_sets_max,
    planned_reps_min,
    planned_reps_max,
    planned_rir_target,
    planned_rest_seconds
  )
  VALUES (
    v_original.session_id,
    v_original.athlete_id,
    p_replacement_exercise_id,
    v_next_order,
    'substitution',
    'pending',
    v_original.id,
    v_original.planned_sets_min,
    v_original.planned_sets_max,
    v_original.planned_reps_min,
    v_original.planned_reps_max,
    v_original.planned_rir_target,
    v_original.planned_rest_seconds
  )
  RETURNING id INTO v_new_id;

  INSERT INTO public.health_workout_events (
    athlete_id,
    session_id,
    workout_exercise_id,
    event_type,
    source,
    client_event_id,
    payload,
    created_by_auth_user_id
  )
  VALUES (
    v_original.athlete_id,
    v_original.session_id,
    v_original.id,
    'exercise_replaced',
    'user',
    p_client_event_id,
    jsonb_build_object(
      'original_workout_exercise_id',v_original.id,
      'original_exercise_id',v_original.exercise_id,
      'replacement_workout_exercise_id',v_new_id,
      'replacement_exercise_id',p_replacement_exercise_id
    ),
    auth.uid()
  );

  RETURN v_new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m4_complete_workout(
  p_session_id uuid,
  p_client_event_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session public.health_workout_sessions%ROWTYPE;
  v_completed_sets integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT *
  INTO v_session
  FROM public.health_workout_sessions
  WHERE id=p_session_id;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'workout session not found';
  END IF;

  IF NOT public.health_can_write_athlete(v_session.athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.health_workout_events ev
    WHERE ev.athlete_id=v_session.athlete_id
      AND ev.client_event_id=p_client_event_id
      AND ev.event_type='session_completed'
  ) THEN
    RETURN p_session_id;
  END IF;

  IF v_session.status='completed' THEN
    RETURN p_session_id;
  END IF;

  IF v_session.status NOT IN ('active','paused') THEN
    RAISE EXCEPTION 'workout is not open';
  END IF;

  SELECT count(*)
  INTO v_completed_sets
  FROM public.health_workout_sets ws
  WHERE ws.session_id=p_session_id
    AND ws.athlete_id=v_session.athlete_id
    AND ws.status='completed';

  IF v_completed_sets < 1 THEN
    RAISE EXCEPTION 'at least one completed set is required';
  END IF;

  UPDATE public.health_workout_exercises e
  SET status=CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.health_workout_sets ws
      WHERE ws.workout_exercise_id=e.id
        AND ws.athlete_id=e.athlete_id
        AND ws.status='completed'
    ) THEN 'completed'
    WHEN e.status IN ('skipped','replaced') THEN e.status
    ELSE 'skipped'
  END
  WHERE e.session_id=p_session_id
    AND e.athlete_id=v_session.athlete_id;

  UPDATE public.health_workout_sessions
  SET
    status='completed',
    ended_at=now()
  WHERE id=p_session_id
    AND athlete_id=v_session.athlete_id;

  IF v_session.queue_entry_id IS NOT NULL THEN
    UPDATE public.health_cch_queue_entries
    SET
      state='completed',
      reason_codes=CASE
        WHEN 'WORKOUT_COMPLETED'=ANY(reason_codes) THEN reason_codes
        ELSE array_append(reason_codes,'WORKOUT_COMPLETED')
      END
    WHERE id=v_session.queue_entry_id
      AND athlete_id=v_session.athlete_id;
  END IF;

  INSERT INTO public.health_workout_events (
    athlete_id,
    session_id,
    event_type,
    source,
    client_event_id,
    payload,
    created_by_auth_user_id
  )
  VALUES (
    v_session.athlete_id,
    p_session_id,
    'session_completed',
    'user',
    p_client_event_id,
    jsonb_build_object(
      'completed_sets',v_completed_sets,
      'queue_entry_id',v_session.queue_entry_id
    ),
    auth.uid()
  );

  RETURN p_session_id;
END;
$$;

REVOKE ALL ON FUNCTION public.health_m4_start_workout(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.health_m4_log_set(uuid, uuid, uuid, integer, text, numeric, text, integer, numeric, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.health_m4_update_set(uuid, uuid, numeric, text, integer, numeric, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.health_m4_add_exercise(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.health_m4_skip_exercise(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.health_m4_replace_exercise(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.health_m4_complete_workout(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.health_m4_start_workout(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.health_m4_log_set(uuid, uuid, uuid, integer, text, numeric, text, integer, numeric, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.health_m4_update_set(uuid, uuid, numeric, text, integer, numeric, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.health_m4_add_exercise(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.health_m4_skip_exercise(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.health_m4_replace_exercise(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.health_m4_complete_workout(uuid, uuid) TO authenticated;
