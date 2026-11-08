-- F13 Health — longitudinal review foundation.
-- Stores deterministic period comparisons and explicit human review outcomes.
-- F13 v1 never mutates specialist plans, goals, training, nutrition, body, recovery, or clinical data.

CREATE TABLE public.health_longitudinal_review_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  as_of_date date NOT NULL,
  window_days integer NOT NULL DEFAULT 28 CHECK (window_days=28),

  current_start_date date NOT NULL,
  current_end_date date NOT NULL,
  prior_start_date date NOT NULL,
  prior_end_date date NOT NULL,

  run_status text NOT NULL CHECK (run_status IN ('available','paused')),
  available_domains text[] NOT NULL DEFAULT '{}'::text[],
  unavailable_domains text[] NOT NULL DEFAULT '{}'::text[],
  reason_codes text[] NOT NULL DEFAULT '{}'::text[],

  algorithm_version text NOT NULL DEFAULT 'F13_LONGITUDINAL_REVIEW_V1'
    CHECK (btrim(algorithm_version) <> ''),
  parameter_set jsonb NOT NULL,
  evidence_snapshot jsonb NOT NULL,
  input_fingerprint text NOT NULL CHECK (btrim(input_fingerprint) <> ''),

  record_status text NOT NULL DEFAULT 'current'
    CHECK (record_status IN ('current','superseded')),
  supersedes_run_id uuid NULL,

  created_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (id, athlete_id),
  CHECK (supersedes_run_id IS NULL OR supersedes_run_id <> id),
  CONSTRAINT health_longitudinal_runs_supersedes_athlete_fkey
    FOREIGN KEY (supersedes_run_id, athlete_id)
    REFERENCES public.health_longitudinal_review_runs(id, athlete_id)
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX health_longitudinal_runs_one_current_idx
ON public.health_longitudinal_review_runs(
  athlete_id, as_of_date, window_days, algorithm_version
)
WHERE record_status='current';

CREATE INDEX health_longitudinal_runs_athlete_date_idx
ON public.health_longitudinal_review_runs(athlete_id, as_of_date DESC, created_at DESC);

CREATE INDEX health_longitudinal_runs_fingerprint_idx
ON public.health_longitudinal_review_runs(
  athlete_id, as_of_date, window_days, algorithm_version, input_fingerprint
);

CREATE INDEX health_longitudinal_runs_supersedes_idx
ON public.health_longitudinal_review_runs(supersedes_run_id, athlete_id)
WHERE supersedes_run_id IS NOT NULL;

CREATE INDEX health_longitudinal_runs_created_by_idx
ON public.health_longitudinal_review_runs(created_by_auth_user_id)
WHERE created_by_auth_user_id IS NOT NULL;

CREATE TABLE public.health_longitudinal_review_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  review_run_id uuid NOT NULL,

  outcome_code text NOT NULL CHECK (
    outcome_code IN (
      'continue_observation',
      'review_goal',
      'review_training',
      'review_nutrition',
      'review_recovery',
      'review_multiple',
      'insufficient_data'
    )
  ),
  target_domains text[] NOT NULL DEFAULT '{}'::text[],
  notes text NULL,

  record_status text NOT NULL DEFAULT 'current'
    CHECK (record_status IN ('current','superseded')),
  supersedes_outcome_id uuid NULL,

  reviewed_by_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (id, athlete_id),
  CHECK (supersedes_outcome_id IS NULL OR supersedes_outcome_id <> id),

  CONSTRAINT health_longitudinal_outcomes_run_athlete_fkey
    FOREIGN KEY (review_run_id, athlete_id)
    REFERENCES public.health_longitudinal_review_runs(id, athlete_id)
    ON DELETE RESTRICT,

  CONSTRAINT health_longitudinal_outcomes_supersedes_athlete_fkey
    FOREIGN KEY (supersedes_outcome_id, athlete_id)
    REFERENCES public.health_longitudinal_review_outcomes(id, athlete_id)
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX health_longitudinal_outcomes_one_current_idx
ON public.health_longitudinal_review_outcomes(review_run_id)
WHERE record_status='current';

CREATE INDEX health_longitudinal_outcomes_run_idx
ON public.health_longitudinal_review_outcomes(review_run_id, athlete_id);

CREATE INDEX health_longitudinal_outcomes_athlete_date_idx
ON public.health_longitudinal_review_outcomes(athlete_id, reviewed_at DESC);

CREATE INDEX health_longitudinal_outcomes_supersedes_idx
ON public.health_longitudinal_review_outcomes(supersedes_outcome_id, athlete_id)
WHERE supersedes_outcome_id IS NOT NULL;

CREATE INDEX health_longitudinal_outcomes_reviewer_idx
ON public.health_longitudinal_review_outcomes(reviewed_by_auth_user_id);
