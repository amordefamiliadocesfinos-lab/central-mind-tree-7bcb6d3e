-- Health M4/F19 — allow ending a workout at any time.
-- Preserves completed facts, skips untouched exercises, and marks the queue complete
-- without fabricating missing sets.

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
  v_total_actionable_exercises integer;
  v_exercises_with_sets integer;
  v_partial boolean;
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

  SELECT count(*)
  INTO v_total_actionable_exercises
  FROM public.health_workout_exercises e
  WHERE e.session_id=p_session_id
    AND e.athlete_id=v_session.athlete_id
    AND e.status <> 'replaced';

  SELECT count(*)
  INTO v_exercises_with_sets
  FROM public.health_workout_exercises e
  WHERE e.session_id=p_session_id
    AND e.athlete_id=v_session.athlete_id
    AND e.status <> 'replaced'
    AND EXISTS (
      SELECT 1
      FROM public.health_workout_sets ws
      WHERE ws.workout_exercise_id=e.id
        AND ws.athlete_id=e.athlete_id
        AND ws.status='completed'
    );

  v_partial :=
    v_completed_sets = 0
    OR v_exercises_with_sets < v_total_actionable_exercises;

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
    ended_at=now(),
    timer_paused_at=NULL
  WHERE id=p_session_id
    AND athlete_id=v_session.athlete_id;

  IF v_session.queue_entry_id IS NOT NULL THEN
    UPDATE public.health_cch_queue_entries
    SET
      state='completed',
      reason_codes=CASE
        WHEN v_partial THEN
          CASE
            WHEN 'WORKOUT_COMPLETED_PARTIAL'=ANY(reason_codes)
              THEN reason_codes
            ELSE array_append(reason_codes,'WORKOUT_COMPLETED_PARTIAL')
          END
        ELSE
          CASE
            WHEN 'WORKOUT_COMPLETED'=ANY(reason_codes)
              THEN reason_codes
            ELSE array_append(reason_codes,'WORKOUT_COMPLETED')
          END
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
      'exercises_with_completed_sets',v_exercises_with_sets,
      'total_actionable_exercises',v_total_actionable_exercises,
      'partial',v_partial,
      'ended_anytime',true,
      'queue_entry_id',v_session.queue_entry_id
    ),
    auth.uid()
  );

  RETURN p_session_id;
END;
$$;

REVOKE ALL ON FUNCTION public.health_m4_complete_workout(uuid, uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.health_m4_complete_workout(uuid, uuid)
TO authenticated;
