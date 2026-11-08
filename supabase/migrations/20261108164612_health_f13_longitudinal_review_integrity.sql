-- F13 Health — integrity hardening.

ALTER TABLE public.health_longitudinal_review_runs
ADD CONSTRAINT health_longitudinal_runs_dates_check CHECK (
  current_end_date=as_of_date
  AND current_start_date=current_end_date-27
  AND prior_end_date=current_end_date-28
  AND prior_start_date=current_end_date-55
),
ADD CONSTRAINT health_longitudinal_runs_parameter_object_check
  CHECK (pg_catalog.jsonb_typeof(parameter_set)='object'),
ADD CONSTRAINT health_longitudinal_runs_evidence_object_check
  CHECK (pg_catalog.jsonb_typeof(evidence_snapshot)='object'),
ADD CONSTRAINT health_longitudinal_runs_fingerprint_md5_check
  CHECK (input_fingerprint ~ '^[0-9a-f]{32}$'),
ADD CONSTRAINT health_longitudinal_runs_domains_check CHECK (
  available_domains <@ ARRAY['training','nutrition','body','recovery']::text[]
  AND unavailable_domains <@ ARRAY['training','nutrition','body','recovery']::text[]
  AND NOT (available_domains && unavailable_domains)
),
ADD CONSTRAINT health_longitudinal_runs_status_domains_check CHECK (
  (run_status='available' AND pg_catalog.cardinality(available_domains)>0)
  OR (run_status='paused' AND pg_catalog.cardinality(available_domains)=0)
),
ADD CONSTRAINT health_longitudinal_runs_reason_required_check
  CHECK (pg_catalog.cardinality(reason_codes)>0);

ALTER TABLE public.health_longitudinal_review_outcomes
ADD CONSTRAINT health_longitudinal_outcomes_targets_check CHECK (
  target_domains <@ ARRAY['goal','training','nutrition','body','recovery']::text[]
),
ADD CONSTRAINT health_longitudinal_outcomes_notes_length_check
  CHECK (notes IS NULL OR char_length(notes)<=4000),
ADD CONSTRAINT health_longitudinal_outcomes_code_targets_check CHECK (
  (outcome_code='continue_observation' AND pg_catalog.cardinality(target_domains)=0)
  OR (outcome_code='review_goal' AND 'goal'=ANY(target_domains))
  OR (outcome_code='review_training' AND 'training'=ANY(target_domains))
  OR (outcome_code='review_nutrition' AND 'nutrition'=ANY(target_domains))
  OR (outcome_code='review_recovery' AND 'recovery'=ANY(target_domains))
  OR (outcome_code='review_multiple' AND pg_catalog.cardinality(target_domains)>=2)
  OR (outcome_code='insufficient_data')
);
