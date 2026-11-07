-- Manual rollback for Health M4 Live Workout.
-- Use only after confirming no downstream recovery/analytics data depends on these facts.

DROP FUNCTION IF EXISTS public.health_m4_complete_workout(uuid, uuid);
DROP FUNCTION IF EXISTS public.health_m4_replace_exercise(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.health_m4_skip_exercise(uuid, uuid);
DROP FUNCTION IF EXISTS public.health_m4_add_exercise(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.health_m4_update_set(uuid, uuid, numeric, text, integer, numeric, integer);
DROP FUNCTION IF EXISTS public.health_m4_log_set(uuid, uuid, uuid, integer, text, numeric, text, integer, numeric, integer);
DROP FUNCTION IF EXISTS public.health_m4_start_workout(uuid, uuid);

DROP TABLE IF EXISTS public.health_workout_events;
DROP TABLE IF EXISTS public.health_workout_sets;
DROP TABLE IF EXISTS public.health_workout_exercises;
DROP TABLE IF EXISTS public.health_workout_sessions;

ALTER TABLE public.health_cch_queue_entries
DROP CONSTRAINT IF EXISTS health_cch_queue_entries_state_check;

ALTER TABLE public.health_cch_queue_entries
ADD CONSTRAINT health_cch_queue_entries_state_check
CHECK (
  state IN (
    'queued','eligible','prioritized','blocked',
    'completed','skipped','superseded'
  )
);
