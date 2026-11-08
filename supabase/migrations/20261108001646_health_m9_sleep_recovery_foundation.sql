-- M9A Health — Sleep & Recovery foundation.
-- Facts are append-only; corrections use supersession or voiding.

CREATE TABLE public.health_sleep_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  sleep_date date NOT NULL,
  period_type text NOT NULL DEFAULT 'nocturnal' CHECK (period_type IN ('nocturnal','nap','other')),
  bed_at timestamptz NULL,
  sleep_start_at timestamptz NULL,
  final_wake_at timestamptz NULL,
  out_of_bed_at timestamptz NULL,
  declared_sleep_minutes integer NULL,
  calculated_time_in_bed_minutes integer NULL,
  calculated_sleep_minutes integer NULL,
  awakenings_count integer NULL,
  awake_during_period_minutes integer NULL,
  timezone text NULL,
  data_source text NOT NULL DEFAULT 'USER_REPORTED' CHECK (
    data_source IN ('USER_REPORTED','MEASURED','IMPORTED','DEVICE_ESTIMATED','SYSTEM_DERIVED','PROFESSIONAL_RECORDED')
  ),
  confidence text NOT NULL DEFAULT 'moderate' CHECK (confidence IN ('low','moderate','high')),
  notes text NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','superseded','voided')),
  supersedes_sleep_period_id uuid NULL REFERENCES public.health_sleep_periods(id) ON DELETE RESTRICT,
  void_reason text NULL,
  status_changed_at timestamptz NULL,
  client_event_id uuid NULL,
  created_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, athlete_id),
  UNIQUE (athlete_id, client_event_id),
  CHECK (supersedes_sleep_period_id IS NULL OR supersedes_sleep_period_id <> id),
  CHECK (declared_sleep_minutes IS NULL OR declared_sleep_minutes >= 0),
  CHECK (calculated_time_in_bed_minutes IS NULL OR calculated_time_in_bed_minutes >= 0),
  CHECK (calculated_sleep_minutes IS NULL OR calculated_sleep_minutes >= 0),
  CHECK (awakenings_count IS NULL OR awakenings_count >= 0),
  CHECK (awake_during_period_minutes IS NULL OR awake_during_period_minutes >= 0),
  CHECK ((status='voided' AND NULLIF(btrim(void_reason),'') IS NOT NULL) OR status <> 'voided')
);

CREATE INDEX health_sleep_periods_athlete_date_idx
ON public.health_sleep_periods(athlete_id, sleep_date DESC, created_at DESC);

CREATE INDEX health_sleep_periods_status_idx
ON public.health_sleep_periods(athlete_id, status, sleep_date DESC);

CREATE INDEX health_sleep_periods_supersedes_idx
ON public.health_sleep_periods(supersedes_sleep_period_id)
WHERE supersedes_sleep_period_id IS NOT NULL;

CREATE INDEX health_sleep_periods_created_by_idx
ON public.health_sleep_periods(created_by_auth_user_id)
WHERE created_by_auth_user_id IS NOT NULL;

CREATE TABLE public.health_recovery_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  checkin_event_id uuid NOT NULL,
  observed_at timestamptz NOT NULL,
  observed_on date NOT NULL,
  metric_code text NOT NULL CHECK (
    metric_code IN (
      'sleep_quality','sleepiness','general_fatigue','muscular_fatigue','mental_fatigue',
      'physical_recovery','training_readiness','muscle_soreness','disposition'
    )
  ),
  value_ordinal smallint NULL CHECK (value_ordinal BETWEEN 1 AND 5),
  raw_text text NULL,
  scale_version text NOT NULL DEFAULT 'M9_RECOVERY_ORDINAL_V1' CHECK (btrim(scale_version) <> ''),
  data_source text NOT NULL DEFAULT 'USER_REPORTED' CHECK (
    data_source IN ('USER_REPORTED','MEASURED','IMPORTED','SYSTEM_DERIVED','PROFESSIONAL_RECORDED')
  ),
  confidence text NOT NULL DEFAULT 'moderate' CHECK (confidence IN ('low','moderate','high')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','superseded','voided')),
  supersedes_checkin_id uuid NULL REFERENCES public.health_recovery_checkins(id) ON DELETE RESTRICT,
  void_reason text NULL,
  status_changed_at timestamptz NULL,
  client_event_id uuid NULL,
  created_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, athlete_id),
  UNIQUE (athlete_id, checkin_event_id, metric_code),
  CHECK (value_ordinal IS NOT NULL OR NULLIF(btrim(raw_text),'') IS NOT NULL),
  CHECK (supersedes_checkin_id IS NULL OR supersedes_checkin_id <> id),
  CHECK ((status='voided' AND NULLIF(btrim(void_reason),'') IS NOT NULL) OR status <> 'voided')
);

CREATE UNIQUE INDEX health_recovery_checkins_client_event_idx
ON public.health_recovery_checkins(athlete_id, client_event_id)
WHERE client_event_id IS NOT NULL;

CREATE INDEX health_recovery_checkins_metric_idx
ON public.health_recovery_checkins(athlete_id, metric_code, observed_on DESC, observed_at DESC);

CREATE INDEX health_recovery_checkins_status_idx
ON public.health_recovery_checkins(athlete_id, status, observed_on DESC);

CREATE INDEX health_recovery_checkins_supersedes_idx
ON public.health_recovery_checkins(supersedes_checkin_id)
WHERE supersedes_checkin_id IS NOT NULL;

CREATE TABLE public.health_sleep_device_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  observed_at timestamptz NOT NULL,
  observed_on date NOT NULL,
  window_start_at timestamptz NULL,
  window_end_at timestamptz NULL,
  metric_code text NOT NULL CHECK (
    metric_code IN (
      'sleep_duration_minutes_estimated','time_in_bed_minutes','sleep_latency_minutes_estimated',
      'wake_after_sleep_onset_minutes_estimated','awakenings_count_estimated','awake_minutes_estimated',
      'sleep_stage_light_minutes_estimated','sleep_stage_deep_minutes_estimated','sleep_stage_rem_minutes_estimated',
      'resting_heart_rate_bpm','hrv_rmssd_ms','respiratory_rate_breaths_per_min'
    )
  ),
  numeric_value numeric(14,4) NOT NULL,
  unit_code text NOT NULL CHECK (btrim(unit_code) <> ''),
  provider text NOT NULL CHECK (btrim(provider) <> ''),
  device_model text NULL,
  external_id text NULL,
  provider_algorithm_version text NULL,
  confidence text NOT NULL DEFAULT 'moderate' CHECK (confidence IN ('low','moderate','high')),
  raw_metadata jsonb NULL,
  client_event_id uuid NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','voided')),
  void_reason text NULL,
  status_changed_at timestamptz NULL,
  created_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, athlete_id),
  CHECK (window_end_at IS NULL OR window_start_at IS NULL OR window_end_at >= window_start_at),
  CHECK ((status='voided' AND NULLIF(btrim(void_reason),'') IS NOT NULL) OR status <> 'voided')
);

CREATE UNIQUE INDEX health_sleep_device_external_unique_idx
ON public.health_sleep_device_observations(athlete_id, provider, external_id, metric_code)
WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX health_sleep_device_client_event_idx
ON public.health_sleep_device_observations(athlete_id, client_event_id)
WHERE client_event_id IS NOT NULL;

CREATE INDEX health_sleep_device_metric_idx
ON public.health_sleep_device_observations(athlete_id, metric_code, observed_on DESC, observed_at DESC);

CREATE TABLE public.health_sleep_recovery_rolling_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  as_of_date date NOT NULL,
  window_days integer NOT NULL CHECK (window_days IN (7,14,28)),
  window_start_date date NOT NULL,

  sleep_duration_observed_days integer NOT NULL DEFAULT 0 CHECK (sleep_duration_observed_days >= 0),
  sleep_timing_observed_days integer NOT NULL DEFAULT 0 CHECK (sleep_timing_observed_days >= 0),
  sleep_quality_observed_days integer NOT NULL DEFAULT 0 CHECK (sleep_quality_observed_days >= 0),
  recovery_observed_days integer NOT NULL DEFAULT 0 CHECK (recovery_observed_days >= 0),
  fatigue_observed_days integer NOT NULL DEFAULT 0 CHECK (fatigue_observed_days >= 0),
  readiness_observed_days integer NOT NULL DEFAULT 0 CHECK (readiness_observed_days >= 0),

  sleep_duration_coverage text NOT NULL CHECK (sleep_duration_coverage IN ('unobserved','sparse','partial','complete')),
  sleep_timing_coverage text NOT NULL CHECK (sleep_timing_coverage IN ('unobserved','sparse','partial','complete')),
  sleep_quality_coverage text NOT NULL CHECK (sleep_quality_coverage IN ('unobserved','sparse','partial','complete')),
  recovery_coverage text NOT NULL CHECK (recovery_coverage IN ('unobserved','sparse','partial','complete')),
  fatigue_coverage text NOT NULL CHECK (fatigue_coverage IN ('unobserved','sparse','partial','complete')),
  readiness_coverage text NOT NULL CHECK (readiness_coverage IN ('unobserved','sparse','partial','complete')),

  average_sleep_minutes numeric(10,2) NULL,
  sleep_duration_variability_minutes numeric(10,2) NULL,
  average_sleep_quality numeric(6,3) NULL,
  average_recovery numeric(6,3) NULL,
  average_fatigue numeric(6,3) NULL,
  average_readiness numeric(6,3) NULL,

  confidence text NOT NULL CHECK (confidence IN ('low','moderate','high')),
  reason_codes text[] NOT NULL DEFAULT '{}'::text[],
  algorithm_version text NOT NULL DEFAULT 'M9_SLEEP_RECOVERY_STATE_V1',
  computed_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (athlete_id, as_of_date, window_days)
);

CREATE INDEX health_sleep_recovery_states_athlete_date_idx
ON public.health_sleep_recovery_rolling_states(athlete_id, as_of_date DESC, window_days);
