-- Disposable PostgreSQL fixture for F13. Never run in hosted Supabase.

CREATE SCHEMA IF NOT EXISTS auth;

DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true),'')::uuid
$$;

CREATE TABLE public.health_athletes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NULL REFERENCES auth.users(id),
  owner_auth_user_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'active'
);

CREATE TABLE public.health_athlete_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  principal_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_read boolean NOT NULL DEFAULT true,
  can_write boolean NOT NULL DEFAULT false,
  revoked_at timestamptz NULL
);

CREATE OR REPLACE FUNCTION public.health_can_read_athlete(p_athlete_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.health_athletes a
      WHERE a.id=p_athlete_id AND a.status <> 'archived'
        AND (a.auth_user_id=auth.uid() OR a.owner_auth_user_id=auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.health_athlete_access x
      WHERE x.athlete_id=p_athlete_id
        AND x.principal_auth_user_id=auth.uid()
        AND x.revoked_at IS NULL
        AND x.can_read=true
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.health_can_write_athlete(p_athlete_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.health_athletes a
      WHERE a.id=p_athlete_id AND a.status <> 'archived'
        AND (a.auth_user_id=auth.uid() OR a.owner_auth_user_id=auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.health_athlete_access x
      WHERE x.athlete_id=p_athlete_id
        AND x.principal_auth_user_id=auth.uid()
        AND x.revoked_at IS NULL
        AND x.can_write=true
    )
  )
$$;

REVOKE ALL ON FUNCTION public.health_can_read_athlete(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.health_can_write_athlete(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.health_can_read_athlete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.health_can_write_athlete(uuid) TO authenticated;

CREATE TABLE public.health_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  goal_type text NOT NULL,
  title text NOT NULL,
  status text NOT NULL,
  priority smallint NOT NULL DEFAULT 3,
  is_primary boolean NOT NULL DEFAULT false,
  started_on date NULL,
  target_date date NULL
);

CREATE TABLE public.health_goal_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL,
  phase_type text NOT NULL,
  title text NOT NULL,
  status text NOT NULL,
  starts_on date NULL,
  ends_on date NULL
);

CREATE TABLE public.health_workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  status text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NULL
);

CREATE TABLE public.health_workout_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.health_workout_sessions(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL
);

CREATE TABLE public.health_workout_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_exercise_id uuid NOT NULL REFERENCES public.health_workout_exercises(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.health_workout_sessions(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  status text NOT NULL
);

CREATE TABLE public.health_nutrition_rolling_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  window_end_date date NOT NULL,
  window_days integer NOT NULL,
  window_start_date date NOT NULL,
  observed_day_count integer NOT NULL DEFAULT 0,
  sufficient_day_count integer NOT NULL DEFAULT 0,
  observation_coverage_ratio numeric(6,5) NOT NULL DEFAULT 0,
  sufficient_coverage_ratio numeric(6,5) NOT NULL DEFAULT 0,
  avg_energy_kcal numeric(14,3) NULL,
  avg_protein_g numeric(14,3) NULL,
  avg_carbohydrate_g numeric(14,3) NULL,
  avg_fat_g numeric(14,3) NULL,
  avg_fiber_g numeric(14,3) NULL,
  energy_target_adherence_ratio numeric(6,5) NULL,
  protein_target_adherence_ratio numeric(6,5) NULL,
  coverage_status text NOT NULL,
  confidence text NOT NULL,
  reason_codes text[] NOT NULL DEFAULT '{}'::text[],
  algorithm_version text NOT NULL DEFAULT 'M6_ROLLING_STATE_V1',
  UNIQUE(athlete_id,window_end_date,window_days)
);

CREATE TABLE public.health_body_rolling_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  as_of_date date NOT NULL,
  window_days integer NOT NULL,
  weight_observation_count integer NOT NULL DEFAULT 0,
  weight_latest_kg numeric(10,3) NULL,
  weight_change_kg numeric(10,3) NULL,
  weight_trend_kg_per_week numeric(10,4) NULL,
  waist_observation_count integer NOT NULL DEFAULT 0,
  waist_latest_cm numeric(10,3) NULL,
  waist_change_cm numeric(10,3) NULL,
  body_fat_observation_count integer NOT NULL DEFAULT 0,
  body_fat_latest_pct numeric(10,3) NULL,
  body_fat_change_pct numeric(10,3) NULL,
  coverage_status text NOT NULL,
  confidence text NOT NULL,
  reason_codes text[] NOT NULL DEFAULT '{}'::text[],
  algorithm_version text NOT NULL DEFAULT 'M8_BODY_STATE_V1',
  UNIQUE(athlete_id,as_of_date,window_days)
);

CREATE TABLE public.health_sleep_recovery_rolling_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  as_of_date date NOT NULL,
  window_days integer NOT NULL,
  recovery_coverage text NOT NULL,
  fatigue_coverage text NOT NULL,
  readiness_coverage text NOT NULL,
  average_sleep_minutes numeric(10,2) NULL,
  sleep_duration_variability_minutes numeric(10,2) NULL,
  average_sleep_quality numeric(6,3) NULL,
  average_recovery numeric(6,3) NULL,
  average_fatigue numeric(6,3) NULL,
  average_readiness numeric(6,3) NULL,
  confidence text NOT NULL,
  reason_codes text[] NOT NULL DEFAULT '{}'::text[],
  algorithm_version text NOT NULL DEFAULT 'M9_SLEEP_RECOVERY_STATE_V1',
  UNIQUE(athlete_id,as_of_date,window_days)
);

CREATE TABLE public.health_integrated_decision_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  as_of_date date NOT NULL,
  window_days integer NOT NULL,
  run_status text NOT NULL,
  algorithm_version text NOT NULL,
  record_status text NOT NULL DEFAULT 'current',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.health_integrated_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.health_integrated_decision_runs(id) ON DELETE CASCADE,
  decision_scope text NOT NULL,
  decision_status text NOT NULL,
  decision_code text NOT NULL,
  target_domain text NOT NULL,
  confidence text NOT NULL,
  reason_codes text[] NOT NULL DEFAULT '{}'::text[]
);
