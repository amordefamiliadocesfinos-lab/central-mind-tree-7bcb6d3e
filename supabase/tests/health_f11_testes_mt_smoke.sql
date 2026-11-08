-- F11 TESTES MT functional smoke.
-- All synthetic facts and integrated decisions are rolled back.
BEGIN;

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.health_athletes
  WHERE status='active' AND owner_auth_user_id IS NOT NULL;
  IF v_count < 2 THEN
    RAISE EXCEPTION 'F11 TESTES MT requires at least two active athlete profiles for non-vacuous cross-athlete tests';
  END IF;
END $$;

SELECT set_config(
  'test.a_id',
  (
    SELECT id::text
    FROM public.health_athletes
    WHERE status='active' AND owner_auth_user_id IS NOT NULL
    ORDER BY id
    LIMIT 1
  ),
  true
);

SELECT set_config(
  'test.a_owner',
  (
    SELECT owner_auth_user_id::text
    FROM public.health_athletes
    WHERE id=current_setting('test.a_id')::uuid
  ),
  true
);

SELECT set_config(
  'test.b_id',
  (
    SELECT id::text
    FROM public.health_athletes
    WHERE status='active'
      AND owner_auth_user_id IS NOT NULL
      AND id<>current_setting('test.a_id')::uuid
    ORDER BY id
    LIMIT 1
  ),
  true
);

SELECT set_config(
  'test.b_owner',
  (
    SELECT owner_auth_user_id::text
    FROM public.health_athletes
    WHERE id=current_setting('test.b_id')::uuid
  ),
  true
);

-- Athlete A: sufficient M6/M7 + M8 + M9A -> plan review candidate.
WITH ins AS (
  INSERT INTO public.health_nutrition_rolling_states (
    athlete_id,window_end_date,window_days,window_start_date,calendar_day_count,
    observed_day_count,sufficient_day_count,partial_day_count,unobserved_day_count,
    observation_coverage_ratio,sufficient_coverage_ratio,
    energy_comparable_day_count,energy_in_target_day_count,energy_target_adherence_ratio,
    protein_comparable_day_count,protein_in_target_day_count,protein_target_adherence_ratio,
    coverage_status,confidence,reason_codes,parameter_set
  ) VALUES (
    current_setting('test.a_id')::uuid,DATE '2099-01-07',7,DATE '2099-01-01',7,
    7,7,0,0,1,1,7,7,1,7,7,1,'complete','high','{}'::text[],'{}'::jsonb
  )
  RETURNING id
)
SELECT set_config('test.a_rolling_id',(SELECT id::text FROM ins),true);

INSERT INTO public.health_nutrition_decisions (
  athlete_id,as_of_date,window_days,rolling_state_id,plan_version_id,strategy_type,
  decision_status,decision_class,decision_code,target_domain,confidence,reason_codes,
  plan_adjustment_status,plan_adjustment_reason_codes,observed_day_count,sufficient_day_count,
  energy_comparable_day_count,protein_comparable_day_count,energy_target_adherence_ratio,
  protein_target_adherence_ratio,rolling_coverage_status,rolling_confidence,
  evidence_snapshot,algorithm_version,parameter_set,record_status
) VALUES (
  current_setting('test.a_id')::uuid,DATE '2099-01-07',7,
  current_setting('test.a_rolling_id')::uuid,NULL,'maintenance',
  'ready','maintenance','maintain_plan','overall','high',
  ARRAY['ENERGY_AND_PROTEIN_ADHERENCE_ACCEPTABLE'],'paused','{}'::text[],
  7,7,7,7,1,1,'complete','high','{}'::jsonb,
  'M7_NUTRITION_DECISION_V1','{}'::jsonb,'current'
);

INSERT INTO public.health_body_rolling_states (
  athlete_id,as_of_date,window_days,window_start_date,
  weight_observation_count,weight_method_count,weight_first_kg,weight_latest_kg,
  weight_change_kg,weight_trend_kg_per_week,
  waist_observation_count,waist_first_cm,waist_latest_cm,waist_change_cm,
  body_fat_observation_count,photo_set_count,
  coverage_status,confidence,reason_codes
) VALUES (
  current_setting('test.a_id')::uuid,DATE '2099-01-07',7,DATE '2099-01-01',
  6,1,94.0,93.0,-1.0,-0.8,
  2,100.0,99.0,-1.0,
  0,0,'complete','moderate','{}'::text[]
);

INSERT INTO public.health_sleep_recovery_rolling_states (
  athlete_id,as_of_date,window_days,window_start_date,
  sleep_duration_observed_days,sleep_timing_observed_days,sleep_quality_observed_days,
  recovery_observed_days,fatigue_observed_days,readiness_observed_days,
  sleep_duration_coverage,sleep_timing_coverage,sleep_quality_coverage,
  recovery_coverage,fatigue_coverage,readiness_coverage,
  average_sleep_minutes,sleep_duration_variability_minutes,average_sleep_quality,
  average_recovery,average_fatigue,average_readiness,
  confidence,reason_codes
) VALUES (
  current_setting('test.a_id')::uuid,DATE '2099-01-07',7,DATE '2099-01-01',
  0,0,0,5,5,5,
  'unobserved','unobserved','unobserved','complete','complete','complete',
  NULL,NULL,NULL,4.0,2.0,4.0,'high','{}'::text[]
);

-- Athlete B: execution issue -> execution review takes priority.
WITH ins AS (
  INSERT INTO public.health_nutrition_rolling_states (
    athlete_id,window_end_date,window_days,window_start_date,calendar_day_count,
    observed_day_count,sufficient_day_count,partial_day_count,unobserved_day_count,
    observation_coverage_ratio,sufficient_coverage_ratio,
    energy_comparable_day_count,energy_in_target_day_count,energy_target_adherence_ratio,
    protein_comparable_day_count,protein_in_target_day_count,protein_target_adherence_ratio,
    coverage_status,confidence,reason_codes,parameter_set
  ) VALUES (
    current_setting('test.b_id')::uuid,DATE '2099-01-07',7,DATE '2099-01-01',7,
    7,7,0,0,1,1,7,3,0.42857,7,7,1,'complete','moderate','{}'::text[],'{}'::jsonb
  )
  RETURNING id
)
SELECT set_config('test.b_rolling_id',(SELECT id::text FROM ins),true);

INSERT INTO public.health_nutrition_decisions (
  athlete_id,as_of_date,window_days,rolling_state_id,plan_version_id,strategy_type,
  decision_status,decision_class,decision_code,target_domain,confidence,reason_codes,
  plan_adjustment_status,plan_adjustment_reason_codes,observed_day_count,sufficient_day_count,
  energy_comparable_day_count,protein_comparable_day_count,energy_target_adherence_ratio,
  protein_target_adherence_ratio,rolling_coverage_status,rolling_confidence,
  evidence_snapshot,algorithm_version,parameter_set,record_status
) VALUES (
  current_setting('test.b_id')::uuid,DATE '2099-01-07',7,
  current_setting('test.b_rolling_id')::uuid,NULL,'maintenance',
  'ready','execution','review_energy_execution','energy','moderate',
  ARRAY['ENERGY_ADHERENCE_BELOW_THRESHOLD'],'paused','{}'::text[],
  7,7,7,7,0.42857,1,'complete','moderate','{}'::jsonb,
  'M7_NUTRITION_DECISION_V1','{}'::jsonb,'current'
);

-- Evaluate athlete A as its owner.
SELECT set_config('request.jwt.claim.sub',current_setting('test.a_owner'),true);
SET LOCAL ROLE authenticated;

SELECT set_config(
  'test.a_run',
  public.health_f11_evaluate_integrated_decision(
    current_setting('test.a_id')::uuid,DATE '2099-01-07',7
  )::text,
  true
);

SELECT set_config(
  'test.a_run_replay',
  public.health_f11_evaluate_integrated_decision(
    current_setting('test.a_id')::uuid,DATE '2099-01-07',7
  )::text,
  true
);

DO $$
DECLARE
  v_confidence text;
BEGIN
  IF current_setting('test.a_run') <> current_setting('test.a_run_replay') THEN
    RAISE EXCEPTION 'F11 TESTES MT idempotency failed';
  END IF;

  SELECT confidence INTO v_confidence
  FROM public.health_integrated_decisions
  WHERE run_id=current_setting('test.a_run')::uuid
    AND decision_scope='nutrition_plan_review'
    AND decision_status='ready'
    AND decision_code='review_nutrition_plan_candidate'
    AND action_status='none';

  IF v_confidence <> 'moderate' THEN
    RAISE EXCEPTION 'F11 TESTES MT plan candidate expected moderate confidence, got %',v_confidence;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.health_integrated_decisions
    WHERE run_id=current_setting('test.a_run')::uuid
      AND action_status<>'none'
  ) THEN
    RAISE EXCEPTION 'F11 TESTES MT automatic action unexpectedly present';
  END IF;
END $$;

RESET ROLE;

-- Evaluate athlete B as its owner to create a non-vacuous foreign row.
SELECT set_config('request.jwt.claim.sub',current_setting('test.b_owner'),true);
SET LOCAL ROLE authenticated;

SELECT set_config(
  'test.b_run',
  public.health_f11_evaluate_integrated_decision(
    current_setting('test.b_id')::uuid,DATE '2099-01-07',7
  )::text,
  true
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.health_integrated_decisions
    WHERE run_id=current_setting('test.b_run')::uuid
      AND decision_scope='nutrition_execution'
      AND decision_status='ready'
      AND decision_code='review_nutrition_execution'
      AND action_status='none'
  ) THEN
    RAISE EXCEPTION 'F11 TESTES MT execution priority failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.health_integrated_decisions
    WHERE run_id=current_setting('test.b_run')::uuid
      AND decision_scope='nutrition_plan_review'
      AND decision_status='paused'
      AND 'NUTRITION_EXECUTION_REVIEW_PRECEDES_PLAN_REVIEW'=ANY(reason_codes)
  ) THEN
    RAISE EXCEPTION 'F11 TESTES MT plan review was not paused behind execution';
  END IF;
END $$;

RESET ROLE;

-- Cross-athlete RLS + write authorization, from A against B.
SELECT set_config('request.jwt.claim.sub',current_setting('test.a_owner'),true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.health_integrated_decision_runs
  WHERE athlete_id=current_setting('test.b_id')::uuid;
  IF v_count<>0 THEN
    RAISE EXCEPTION 'F11 TESTES MT cross-athlete run SELECT leak';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.health_integrated_decisions
  WHERE athlete_id=current_setting('test.b_id')::uuid;
  IF v_count<>0 THEN
    RAISE EXCEPTION 'F11 TESTES MT cross-athlete decision SELECT leak';
  END IF;

  BEGIN
    PERFORM public.health_f11_evaluate_integrated_decision(
      current_setting('test.b_id')::uuid,DATE '2099-01-07',7
    );
    RAISE EXCEPTION 'F11 TESTES MT cross-athlete evaluate unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='F11 TESTES MT cross-athlete evaluate unexpectedly succeeded' THEN
      RAISE;
    END IF;
  END;
END $$;

RESET ROLE;

ROLLBACK;

SELECT 'F11_TESTES_MT_FUNCTIONAL_PASS' AS result;
