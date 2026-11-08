-- F11 Health — integrity hardening.

ALTER TABLE public.health_integrated_decision_runs
ADD CONSTRAINT health_integrated_runs_parameter_object_check
  CHECK (pg_catalog.jsonb_typeof(parameter_set)='object'),
ADD CONSTRAINT health_integrated_runs_evidence_object_check
  CHECK (pg_catalog.jsonb_typeof(evidence_snapshot)='object'),
ADD CONSTRAINT health_integrated_runs_fingerprint_md5_check
  CHECK (input_fingerprint ~ '^[0-9a-f]{32}$');

ALTER TABLE public.health_integrated_decisions
ADD CONSTRAINT health_integrated_decisions_source_reasons_object_check
  CHECK (pg_catalog.jsonb_typeof(source_reason_codes)='object'),
ADD CONSTRAINT health_integrated_decisions_evidence_object_check
  CHECK (pg_catalog.jsonb_typeof(evidence_snapshot)='object'),
ADD CONSTRAINT health_integrated_decisions_reason_required_check
  CHECK (pg_catalog.cardinality(reason_codes) > 0),
ADD CONSTRAINT health_integrated_decisions_ready_class_check CHECK (
  (decision_status='ready' AND decision_class IN ('execution','plan_review'))
  OR (decision_status='paused' AND decision_class='data_quality')
),
ADD CONSTRAINT health_integrated_decisions_code_status_check CHECK (
  (decision_code='review_nutrition_execution' AND decision_status='ready' AND decision_scope='nutrition_execution')
  OR (decision_code='review_nutrition_plan_candidate' AND decision_status='ready' AND decision_scope='nutrition_plan_review')
  OR (decision_code IN ('decision_paused','review_data_quality') AND decision_status='paused')
);

-- F11 v1 must never persist an automatic action.
ALTER TABLE public.health_integrated_decisions
ADD CONSTRAINT health_integrated_decisions_no_action_v1_check
  CHECK (action_status='none');
