-- Disposable PostgreSQL fixture for F11. Never run in hosted Supabase.

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

-- Minimal upstream M7 contract.
CREATE TABLE public.health_nutrition_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  as_of_date date NOT NULL,
  window_days integer NOT NULL CHECK (window_days IN (7,14,28)),
  plan_version_id uuid NULL,
  strategy_type text NULL,
  decision_status text NOT NULL CHECK (decision_status IN ('paused','ready')),
  decision_class text NOT NULL CHECK (decision_class IN ('data_quality','execution','maintenance','plan_adjustment')),
  decision_code text NOT NULL,
  target_domain text NOT NULL,
  confidence text NOT NULL CHECK (confidence IN ('low','moderate','high')),
  reason_codes text[] NOT NULL DEFAULT '{}'::text[],
  plan_adjustment_status text NOT NULL DEFAULT 'paused',
  plan_adjustment_reason_codes text[] NOT NULL DEFAULT '{}'::text[],
  observed_day_count integer NOT NULL DEFAULT 0,
  sufficient_day_count integer NOT NULL DEFAULT 0,
  rolling_coverage_status text NOT NULL DEFAULT 'complete',
  rolling_confidence text NOT NULL DEFAULT 'moderate',
  evidence_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  algorithm_version text NOT NULL DEFAULT 'M7_NUTRITION_DECISION_V1',
  parameter_set jsonb NOT NULL DEFAULT '{}'::jsonb,
  record_status text NOT NULL DEFAULT 'current' CHECK (record_status IN ('current','superseded')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Minimal upstream M8 contract.
CREATE TABLE public.health_body_rolling_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  as_of_date date NOT NULL,
  window_days integer NOT NULL CHECK (window_days IN (7,14,28)),
  window_start_date date NOT NULL,
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
  coverage_status text NOT NULL CHECK (coverage_status IN ('unobserved','sparse','partial','complete')),
  confidence text NOT NULL CHECK (confidence IN ('low','moderate','high')),
  reason_codes text[] NOT NULL DEFAULT '{}'::text[],
  algorithm_version text NOT NULL DEFAULT 'M8_BODY_STATE_V1',
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id,as_of_date,window_days)
);

-- Minimal upstream M9A contract.
CREATE TABLE public.health_sleep_recovery_rolling_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  as_of_date date NOT NULL,
  window_days integer NOT NULL CHECK (window_days IN (7,14,28)),
  window_start_date date NOT NULL,
  recovery_observed_days integer NOT NULL DEFAULT 0,
  fatigue_observed_days integer NOT NULL DEFAULT 0,
  readiness_observed_days integer NOT NULL DEFAULT 0,
  recovery_coverage text NOT NULL CHECK (recovery_coverage IN ('unobserved','sparse','partial','complete')),
  fatigue_coverage text NOT NULL CHECK (fatigue_coverage IN ('unobserved','sparse','partial','complete')),
  readiness_coverage text NOT NULL CHECK (readiness_coverage IN ('unobserved','sparse','partial','complete')),
  average_recovery numeric(6,3) NULL,
  average_fatigue numeric(6,3) NULL,
  average_readiness numeric(6,3) NULL,
  confidence text NOT NULL CHECK (confidence IN ('low','moderate','high')),
  reason_codes text[] NOT NULL DEFAULT '{}'::text[],
  algorithm_version text NOT NULL DEFAULT 'M9_SLEEP_RECOVERY_STATE_V1',
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id,as_of_date,window_days)
);
