-- G5-F local ONLY. Minimal M4 fixture to run UNMODIFIED original F19 RPC bodies.
-- Run exclusively inside a brand-new Supabase temp workdir, never the official configuration.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE public.health_g5f_access (
 auth_user_id uuid NOT NULL, athlete_id uuid NOT NULL, PRIMARY KEY(auth_user_id, athlete_id)
);
REVOKE ALL ON public.health_g5f_access FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.health_can_read_athlete(p_athlete_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
 AS $$ SELECT auth.uid() IS NOT NULL AND EXISTS
 (SELECT 1 FROM public.health_g5f_access a WHERE a.auth_user_id=auth.uid() AND a.athlete_id=p_athlete_id) $$;
CREATE OR REPLACE FUNCTION public.health_can_write_athlete(p_athlete_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
 AS $$ SELECT public.health_can_read_athlete(p_athlete_id) $$;
REVOKE ALL ON FUNCTION public.health_can_read_athlete(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.health_can_write_athlete(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.health_can_read_athlete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.health_can_write_athlete(uuid) TO authenticated;

CREATE TABLE public.health_workout_sessions (
 id uuid PRIMARY KEY, athlete_id uuid NOT NULL,
 status text NOT NULL CHECK(status IN ('active','paused','completed','aborted')),
 timer_paused_at timestamptz, pause_accumulated_seconds integer NOT NULL DEFAULT 0,
 started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz,
 UNIQUE(id,athlete_id)
);
CREATE TABLE public.health_workout_exercises (
 id uuid PRIMARY KEY, athlete_id uuid NOT NULL,
 session_id uuid NOT NULL, status text NOT NULL,
 planned_sets_min int,planned_sets_max int,planned_rest_seconds integer DEFAULT 90,
 planned_reps_min int,planned_reps_max int,planned_rir_target numeric,
 started_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,session_id,athlete_id)
);
CREATE TABLE public.health_workout_sets(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), athlete_id uuid NOT NULL,
 session_id uuid NOT NULL, workout_exercise_id uuid NOT NULL,
 set_number int NOT NULL, set_type text DEFAULT 'working',status text NOT NULL,
 load_value numeric,load_unit text,reps integer,rir numeric,
 work_seconds integer,rest_seconds integer,client_event_id uuid,
 completed_at timestamptz,notes text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.health_workout_timer_intervals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), athlete_id uuid NOT NULL,
 session_id uuid NOT NULL,workout_exercise_id uuid NOT NULL,workout_set_id uuid,
 interval_type text NOT NULL CHECK(interval_type IN('work','rest')),
 set_number int,status text NOT NULL CHECK(status IN('running','paused','completed','cancelled')),
 client_event_id uuid NOT NULL,created_by_auth_user_id uuid,
 started_at timestamptz NOT NULL DEFAULT clock_timestamp(),target_seconds int,
 pause_accumulated_seconds integer NOT NULL DEFAULT 0,paused_at timestamptz,
 ended_at timestamptz,actual_seconds integer, UNIQUE(athlete_id,client_event_id)
);
CREATE UNIQUE INDEX health_g5f_one_open_interval ON public.health_workout_timer_intervals(session_id)
 WHERE status IN ('running','paused');
CREATE TABLE public.health_workout_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),athlete_id uuid NOT NULL,
 session_id uuid,workout_exercise_id uuid,workout_set_id uuid,
 event_type text NOT NULL, source text,client_event_id uuid NOT NULL,
 occurred_at timestamptz,payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_by_auth_user_id uuid,UNIQUE(athlete_id,client_event_id)
);
DO $$
DECLARE tab text;
BEGIN
 FOREACH tab IN ARRAY ARRAY['health_workout_sessions','health_workout_exercises',
  'health_workout_sets','health_workout_timer_intervals','health_workout_events']
 LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated',tab);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',tab);
  EXECUTE format('CREATE POLICY g5f_owner_select ON public.%I FOR SELECT TO authenticated USING (public.health_can_read_athlete(athlete_id))',tab);
 END LOOP;
END $$;
-- No direct client INSERT/UPDATE/DELETE; F19 definer RPCs own state.
-- G5F uses original RPCs extracted from the existing migration, not copied SQL rewrites.

-- M4 allows editing factual set execution for the owner; timer mutations remain RPC only.
GRANT UPDATE (load_value,load_unit,reps,rir) ON public.health_workout_sets TO authenticated;
CREATE POLICY g5f_owner_update_sets ON public.health_workout_sets
 FOR UPDATE TO authenticated
 USING (public.health_can_write_athlete(athlete_id))
 WITH CHECK (public.health_can_write_athlete(athlete_id));
