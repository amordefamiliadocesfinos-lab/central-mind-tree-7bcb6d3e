-- M6 Health — Nutrition State
-- Derived state only. M5 remains the factual source of truth.

CREATE TABLE public.health_nutrition_daily_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  state_date date NOT NULL,
  food_log_day_id uuid NULL,
  plan_version_id uuid NULL,
  target_id uuid NULL,

  observed_meal_count integer NOT NULL DEFAULT 0 CHECK (observed_meal_count >= 0),
  observed_item_count integer NOT NULL DEFAULT 0 CHECK (observed_item_count >= 0),

  energy_kcal_consumed numeric(14,3) NULL CHECK (energy_kcal_consumed IS NULL OR energy_kcal_consumed >= 0),
  protein_g_consumed numeric(14,3) NULL CHECK (protein_g_consumed IS NULL OR protein_g_consumed >= 0),
  carbohydrate_g_consumed numeric(14,3) NULL CHECK (carbohydrate_g_consumed IS NULL OR carbohydrate_g_consumed >= 0),
  fat_g_consumed numeric(14,3) NULL CHECK (fat_g_consumed IS NULL OR fat_g_consumed >= 0),
  fiber_g_consumed numeric(14,3) NULL CHECK (fiber_g_consumed IS NULL OR fiber_g_consumed >= 0),
  sodium_mg_consumed numeric(16,3) NULL CHECK (sodium_mg_consumed IS NULL OR sodium_mg_consumed >= 0),

  energy_unknown_item_count integer NOT NULL DEFAULT 0 CHECK (energy_unknown_item_count >= 0),
  protein_unknown_item_count integer NOT NULL DEFAULT 0 CHECK (protein_unknown_item_count >= 0),
  carbohydrate_unknown_item_count integer NOT NULL DEFAULT 0 CHECK (carbohydrate_unknown_item_count >= 0),
  fat_unknown_item_count integer NOT NULL DEFAULT 0 CHECK (fat_unknown_item_count >= 0),
  fiber_unknown_item_count integer NOT NULL DEFAULT 0 CHECK (fiber_unknown_item_count >= 0),
  sodium_unknown_item_count integer NOT NULL DEFAULT 0 CHECK (sodium_unknown_item_count >= 0),

  energy_kcal_min_target numeric(14,3) NULL,
  energy_kcal_max_target numeric(14,3) NULL,
  protein_g_min_target numeric(14,3) NULL,
  protein_g_max_target numeric(14,3) NULL,
  carbohydrate_g_min_target numeric(14,3) NULL,
  carbohydrate_g_max_target numeric(14,3) NULL,
  fat_g_min_target numeric(14,3) NULL,
  fat_g_max_target numeric(14,3) NULL,
  fiber_g_min_target numeric(14,3) NULL,
  fiber_g_max_target numeric(14,3) NULL,

  energy_target_status text NOT NULL DEFAULT 'unknown'
    CHECK (energy_target_status IN ('unknown','not_targeted','below','in_range','above')),
  protein_target_status text NOT NULL DEFAULT 'unknown'
    CHECK (protein_target_status IN ('unknown','not_targeted','below','in_range','above')),
  carbohydrate_target_status text NOT NULL DEFAULT 'unknown'
    CHECK (carbohydrate_target_status IN ('unknown','not_targeted','below','in_range','above')),
  fat_target_status text NOT NULL DEFAULT 'unknown'
    CHECK (fat_target_status IN ('unknown','not_targeted','below','in_range','above')),
  fiber_target_status text NOT NULL DEFAULT 'unknown'
    CHECK (fiber_target_status IN ('unknown','not_targeted','below','in_range','above')),

  completeness_status text NOT NULL DEFAULT 'unknown'
    CHECK (completeness_status IN ('unknown','partial','complete')),
  registration_level text NULL
    CHECK (registration_level IS NULL OR registration_level IN ('minimal','intermediate','complete')),

  state_status text NOT NULL DEFAULT 'unobserved'
    CHECK (state_status IN ('unobserved','partial','sufficient')),
  confidence text NOT NULL DEFAULT 'low'
    CHECK (confidence IN ('low','moderate','high')),
  confidence_score numeric(5,4) NULL
    CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  reason_codes text[] NOT NULL DEFAULT '{}'::text[],

  algorithm_version text NOT NULL DEFAULT 'M6_DAILY_STATE_V1',
  parameter_set jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (athlete_id, state_date),
  UNIQUE (id, athlete_id),

  CONSTRAINT health_nutrition_daily_states_day_athlete_fkey
    FOREIGN KEY (food_log_day_id, athlete_id)
    REFERENCES public.health_food_log_days(id, athlete_id)
    ON DELETE SET NULL,

  CONSTRAINT health_nutrition_daily_states_plan_version_athlete_fkey
    FOREIGN KEY (plan_version_id, athlete_id)
    REFERENCES public.health_nutrition_plan_versions(id, athlete_id)
    ON DELETE SET NULL,

  CONSTRAINT health_nutrition_daily_states_target_fkey
    FOREIGN KEY (target_id)
    REFERENCES public.health_nutrition_targets(id)
    ON DELETE SET NULL
);

CREATE TABLE public.health_nutrition_rolling_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  window_end_date date NOT NULL,
  window_days integer NOT NULL CHECK (window_days IN (7,14,28)),
  window_start_date date NOT NULL,

  calendar_day_count integer NOT NULL CHECK (calendar_day_count >= 1),
  observed_day_count integer NOT NULL DEFAULT 0 CHECK (observed_day_count >= 0),
  sufficient_day_count integer NOT NULL DEFAULT 0 CHECK (sufficient_day_count >= 0),
  partial_day_count integer NOT NULL DEFAULT 0 CHECK (partial_day_count >= 0),
  unobserved_day_count integer NOT NULL DEFAULT 0 CHECK (unobserved_day_count >= 0),

  observation_coverage_ratio numeric(6,5) NOT NULL DEFAULT 0
    CHECK (observation_coverage_ratio >= 0 AND observation_coverage_ratio <= 1),
  sufficient_coverage_ratio numeric(6,5) NOT NULL DEFAULT 0
    CHECK (sufficient_coverage_ratio >= 0 AND sufficient_coverage_ratio <= 1),

  avg_energy_kcal numeric(14,3) NULL,
  avg_protein_g numeric(14,3) NULL,
  avg_carbohydrate_g numeric(14,3) NULL,
  avg_fat_g numeric(14,3) NULL,
  avg_fiber_g numeric(14,3) NULL,

  energy_comparable_day_count integer NOT NULL DEFAULT 0 CHECK (energy_comparable_day_count >= 0),
  energy_in_target_day_count integer NOT NULL DEFAULT 0 CHECK (energy_in_target_day_count >= 0),
  energy_target_adherence_ratio numeric(6,5) NULL
    CHECK (energy_target_adherence_ratio IS NULL OR (energy_target_adherence_ratio >= 0 AND energy_target_adherence_ratio <= 1)),

  protein_comparable_day_count integer NOT NULL DEFAULT 0 CHECK (protein_comparable_day_count >= 0),
  protein_in_target_day_count integer NOT NULL DEFAULT 0 CHECK (protein_in_target_day_count >= 0),
  protein_target_adherence_ratio numeric(6,5) NULL
    CHECK (protein_target_adherence_ratio IS NULL OR (protein_target_adherence_ratio >= 0 AND protein_target_adherence_ratio <= 1)),

  coverage_status text NOT NULL DEFAULT 'unobserved'
    CHECK (coverage_status IN ('unobserved','sparse','partial','complete')),
  confidence text NOT NULL DEFAULT 'low'
    CHECK (confidence IN ('low','moderate','high')),
  reason_codes text[] NOT NULL DEFAULT '{}'::text[],

  algorithm_version text NOT NULL DEFAULT 'M6_ROLLING_STATE_V1',
  parameter_set jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (athlete_id, window_end_date, window_days),
  CHECK (window_start_date = window_end_date - (window_days - 1))
);

CREATE INDEX health_nutrition_daily_states_athlete_date_idx
ON public.health_nutrition_daily_states(athlete_id, state_date DESC);

CREATE INDEX health_nutrition_daily_states_plan_version_idx
ON public.health_nutrition_daily_states(plan_version_id)
WHERE plan_version_id IS NOT NULL;

CREATE INDEX health_nutrition_rolling_states_athlete_window_idx
ON public.health_nutrition_rolling_states(athlete_id, window_days, window_end_date DESC);

CREATE TRIGGER health_nutrition_daily_states_updated_at
BEFORE UPDATE ON public.health_nutrition_daily_states
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_nutrition_rolling_states_updated_at
BEFORE UPDATE ON public.health_nutrition_rolling_states
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
