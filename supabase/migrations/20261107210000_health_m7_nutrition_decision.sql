-- M7 Health — Nutrition Decision Ledger
-- M7 consumes M6 state and records deterministic, explainable decisions.
-- It does not mutate nutrition plans.

CREATE TABLE public.health_nutrition_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  as_of_date date NOT NULL,
  window_days integer NOT NULL CHECK (window_days IN (7,14,28)),
  rolling_state_id uuid NOT NULL REFERENCES public.health_nutrition_rolling_states(id) ON DELETE RESTRICT,
  plan_version_id uuid NULL REFERENCES public.health_nutrition_plan_versions(id) ON DELETE RESTRICT,
  strategy_type text NULL CHECK (
    strategy_type IS NULL OR strategy_type IN (
      'maintenance','energy_deficit','energy_surplus',
      'recomposition_support','performance_support','custom'
    )
  ),

  decision_status text NOT NULL CHECK (decision_status IN ('paused','ready')),
  decision_class text NOT NULL CHECK (
    decision_class IN ('data_quality','execution','maintenance','plan_adjustment')
  ),
  decision_code text NOT NULL CHECK (
    decision_code IN (
      'decision_paused',
      'review_data_quality',
      'review_energy_execution',
      'review_protein_execution',
      'review_energy_and_protein_execution',
      'maintain_plan'
    )
  ),
  target_domain text NOT NULL CHECK (
    target_domain IN ('overall','energy','protein','energy_and_protein')
  ),

  confidence text NOT NULL CHECK (confidence IN ('low','moderate','high')),
  reason_codes text[] NOT NULL DEFAULT '{}'::text[],

  plan_adjustment_status text NOT NULL DEFAULT 'paused'
    CHECK (plan_adjustment_status IN ('paused','eligible')),
  plan_adjustment_reason_codes text[] NOT NULL DEFAULT '{}'::text[],

  observed_day_count integer NOT NULL DEFAULT 0 CHECK (observed_day_count >= 0),
  sufficient_day_count integer NOT NULL DEFAULT 0 CHECK (sufficient_day_count >= 0),
  energy_comparable_day_count integer NOT NULL DEFAULT 0 CHECK (energy_comparable_day_count >= 0),
  protein_comparable_day_count integer NOT NULL DEFAULT 0 CHECK (protein_comparable_day_count >= 0),
  energy_target_adherence_ratio numeric(6,5) NULL
    CHECK (energy_target_adherence_ratio IS NULL OR (energy_target_adherence_ratio >= 0 AND energy_target_adherence_ratio <= 1)),
  protein_target_adherence_ratio numeric(6,5) NULL
    CHECK (protein_target_adherence_ratio IS NULL OR (protein_target_adherence_ratio >= 0 AND protein_target_adherence_ratio <= 1)),
  rolling_coverage_status text NOT NULL
    CHECK (rolling_coverage_status IN ('unobserved','sparse','partial','complete')),
  rolling_confidence text NOT NULL
    CHECK (rolling_confidence IN ('low','moderate','high')),

  evidence_snapshot jsonb NOT NULL,
  algorithm_version text NOT NULL DEFAULT 'M7_NUTRITION_DECISION_V1',
  parameter_set jsonb NOT NULL,

  record_status text NOT NULL DEFAULT 'current'
    CHECK (record_status IN ('current','superseded')),
  supersedes_decision_id uuid NULL REFERENCES public.health_nutrition_decisions(id) ON DELETE RESTRICT,

  created_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (id, athlete_id),
  CHECK (supersedes_decision_id IS NULL OR supersedes_decision_id <> id)
);

CREATE UNIQUE INDEX health_nutrition_decisions_one_current_idx
ON public.health_nutrition_decisions(athlete_id, as_of_date, window_days)
WHERE record_status='current';

CREATE INDEX health_nutrition_decisions_athlete_date_idx
ON public.health_nutrition_decisions(athlete_id, as_of_date DESC, created_at DESC);

CREATE INDEX health_nutrition_decisions_rolling_state_idx
ON public.health_nutrition_decisions(rolling_state_id);

CREATE INDEX health_nutrition_decisions_plan_version_idx
ON public.health_nutrition_decisions(plan_version_id)
WHERE plan_version_id IS NOT NULL;

CREATE INDEX health_nutrition_decisions_supersedes_idx
ON public.health_nutrition_decisions(supersedes_decision_id)
WHERE supersedes_decision_id IS NOT NULL;

CREATE INDEX health_nutrition_decisions_created_by_idx
ON public.health_nutrition_decisions(created_by_auth_user_id)
WHERE created_by_auth_user_id IS NOT NULL;
