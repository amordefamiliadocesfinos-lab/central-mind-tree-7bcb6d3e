-- F11 Health — Integrated Decision Engine foundation.
-- Deterministic coordination ledger. No automatic action is executed by F11 v1.

CREATE TABLE public.health_integrated_decision_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  as_of_date date NOT NULL,
  window_days integer NOT NULL CHECK (window_days IN (7,14,28)),

  run_status text NOT NULL CHECK (run_status IN ('complete','partial','paused','failed')),
  algorithm_version text NOT NULL DEFAULT 'F11_INTEGRATED_DECISION_V1'
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
  CONSTRAINT health_integrated_runs_supersedes_athlete_fkey
    FOREIGN KEY (supersedes_run_id, athlete_id)
    REFERENCES public.health_integrated_decision_runs(id, athlete_id)
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX health_integrated_runs_one_current_idx
ON public.health_integrated_decision_runs(
  athlete_id, as_of_date, window_days, algorithm_version
)
WHERE record_status='current';

CREATE INDEX health_integrated_runs_athlete_date_idx
ON public.health_integrated_decision_runs(athlete_id, as_of_date DESC, created_at DESC);

CREATE INDEX health_integrated_runs_fingerprint_idx
ON public.health_integrated_decision_runs(
  athlete_id, as_of_date, window_days, algorithm_version, input_fingerprint
);

CREATE INDEX health_integrated_runs_supersedes_idx
ON public.health_integrated_decision_runs(supersedes_run_id, athlete_id)
WHERE supersedes_run_id IS NOT NULL;

CREATE INDEX health_integrated_runs_created_by_idx
ON public.health_integrated_decision_runs(created_by_auth_user_id)
WHERE created_by_auth_user_id IS NOT NULL;

CREATE TABLE public.health_integrated_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  run_id uuid NOT NULL,

  decision_scope text NOT NULL CHECK (
    decision_scope IN ('nutrition_execution','nutrition_plan_review')
  ),
  decision_status text NOT NULL CHECK (decision_status IN ('ready','paused')),
  decision_class text NOT NULL CHECK (
    decision_class IN ('data_quality','execution','plan_review')
  ),
  decision_code text NOT NULL CHECK (
    decision_code IN (
      'decision_paused',
      'review_data_quality',
      'review_nutrition_execution',
      'review_nutrition_plan_candidate'
    )
  ),
  target_domain text NOT NULL DEFAULT 'nutrition'
    CHECK (target_domain='nutrition'),
  confidence text NOT NULL CHECK (confidence IN ('low','moderate','high')),
  reason_codes text[] NOT NULL DEFAULT '{}'::text[],
  source_reason_codes jsonb NOT NULL DEFAULT '{}'::jsonb,

  action_status text NOT NULL DEFAULT 'none' CHECK (action_status='none'),
  evidence_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (id, athlete_id),
  UNIQUE (run_id, decision_scope),
  CONSTRAINT health_integrated_decisions_run_athlete_fkey
    FOREIGN KEY (run_id, athlete_id)
    REFERENCES public.health_integrated_decision_runs(id, athlete_id)
    ON DELETE RESTRICT
);

CREATE INDEX health_integrated_decisions_run_idx
ON public.health_integrated_decisions(run_id, athlete_id);

CREATE INDEX health_integrated_decisions_athlete_idx
ON public.health_integrated_decisions(athlete_id, created_at DESC);

CREATE INDEX health_integrated_decisions_scope_idx
ON public.health_integrated_decisions(athlete_id, decision_scope, created_at DESC);
