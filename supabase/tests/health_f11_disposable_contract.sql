\set ON_ERROR_STOP on

INSERT INTO auth.users(id) VALUES
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');

INSERT INTO public.health_athletes(id,auth_user_id,owner_auth_user_id,status) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','active'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222','active');

-- Static security contracts.
DO $$
DECLARE
  v_proc oid;
  v_search_path text;
BEGIN
  IF has_table_privilege('anon','public.health_integrated_decision_runs','SELECT') THEN
    RAISE EXCEPTION 'anon unexpectedly has F11 run SELECT';
  END IF;
  IF has_table_privilege('anon','public.health_integrated_decisions','SELECT') THEN
    RAISE EXCEPTION 'anon unexpectedly has F11 decision SELECT';
  END IF;
  IF has_table_privilege('authenticated','public.health_integrated_decision_runs','INSERT') THEN
    RAISE EXCEPTION 'authenticated unexpectedly has direct F11 INSERT';
  END IF;
  IF NOT has_table_privilege('authenticated','public.health_integrated_decision_runs','SELECT') THEN
    RAISE EXCEPTION 'authenticated missing F11 run SELECT';
  END IF;

  SELECT p.oid INTO v_proc
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='health_f11_evaluate_integrated_decision';

  IF has_function_privilege('anon',v_proc,'EXECUTE') THEN
    RAISE EXCEPTION 'anon unexpectedly has F11 evaluator execute';
  END IF;

  IF has_function_privilege('public',v_proc,'EXECUTE') THEN
    RAISE EXCEPTION 'PUBLIC unexpectedly has F11 evaluator execute';
  END IF;

  SELECT array_to_string(p.proconfig,',') INTO v_search_path
  FROM pg_proc p WHERE p.oid=v_proc;
  IF v_search_path IS NULL OR v_search_path NOT LIKE '%search_path=""%' THEN
    RAISE EXCEPTION 'F11 evaluator search_path is not fixed empty: %',v_search_path;
  END IF;
END $$;

-- T1: no sources -> paused, no invented values.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);

SELECT public.health_f11_evaluate_integrated_decision(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-11-01',7
) AS run_t1 \gset

DO $$
DECLARE
  v_status text;
  v_count integer;
  v_has_missing boolean;
BEGIN
  SELECT run_status INTO v_status
  FROM public.health_integrated_decision_runs
  WHERE id=:'run_t1'::uuid;

  SELECT count(*) INTO v_count
  FROM public.health_integrated_decisions
  WHERE run_id=:'run_t1'::uuid AND decision_status='paused';

  SELECT EXISTS (
    SELECT 1 FROM public.health_integrated_decisions
    WHERE run_id=:'run_t1'::uuid
      AND 'NUTRITION_DECISION_MISSING'=ANY(reason_codes)
  ) INTO v_has_missing;

  IF v_status<>'paused' OR v_count<>2 OR NOT v_has_missing THEN
    RAISE EXCEPTION 'T1 failed status %, paused %, missing %',v_status,v_count,v_has_missing;
  END IF;
END $$;

RESET ROLE;

-- Seed T2 paused nutrition.
INSERT INTO public.health_nutrition_decisions(
  athlete_id,as_of_date,window_days,decision_status,decision_class,decision_code,target_domain,
  confidence,reason_codes,plan_adjustment_status,rolling_coverage_status,rolling_confidence
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-11-02',7,
  'paused','data_quality','review_data_quality','overall','low',
  ARRAY['INSUFFICIENT_SUFFICIENT_DAYS'],'paused','sparse','low'
);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
SELECT public.health_f11_evaluate_integrated_decision(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-11-02',7
) AS run_t2 \gset

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.health_integrated_decisions
    WHERE run_id=:'run_t2'::uuid
      AND decision_scope='nutrition_plan_review'
      AND decision_status='paused'
      AND 'NUTRITION_DECISION_PAUSED'=ANY(reason_codes)
  ) THEN
    RAISE EXCEPTION 'T2 paused nutrition did not pause integrated plan review';
  END IF;
END $$;
RESET ROLE;

-- T3 execution priority.
INSERT INTO public.health_nutrition_decisions(
  athlete_id,as_of_date,window_days,decision_status,decision_class,decision_code,target_domain,
  confidence,reason_codes,plan_adjustment_status,rolling_coverage_status,rolling_confidence
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-11-03',7,
  'ready','execution','review_energy_execution','energy','moderate',
  ARRAY['ENERGY_ADHERENCE_BELOW_THRESHOLD'],'paused','complete','moderate'
);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
SELECT public.health_f11_evaluate_integrated_decision(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-11-03',7
) AS run_t3 \gset

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.health_integrated_decisions
    WHERE run_id=:'run_t3'::uuid
      AND decision_scope='nutrition_execution'
      AND decision_status='ready'
      AND decision_code='review_nutrition_execution'
      AND action_status='none'
  ) THEN RAISE EXCEPTION 'T3 execution decision missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.health_integrated_decisions
    WHERE run_id=:'run_t3'::uuid
      AND decision_scope='nutrition_plan_review'
      AND decision_status='paused'
      AND 'NUTRITION_EXECUTION_REVIEW_PRECEDES_PLAN_REVIEW'=ANY(reason_codes)
  ) THEN RAISE EXCEPTION 'T3 plan review priority rule failed'; END IF;
END $$;
RESET ROLE;

-- T4: non-execution nutrition, body/recovery absent.
INSERT INTO public.health_nutrition_decisions(
  athlete_id,as_of_date,window_days,decision_status,decision_class,decision_code,target_domain,
  confidence,reason_codes,plan_adjustment_status,rolling_coverage_status,rolling_confidence
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-11-04',7,
  'ready','maintenance','maintain_plan','overall','high',
  ARRAY['ENERGY_AND_PROTEIN_ADHERENCE_ACCEPTABLE'],'paused','complete','high'
);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
SELECT public.health_f11_evaluate_integrated_decision(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-11-04',7
) AS run_t4 \gset

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.health_integrated_decisions
    WHERE run_id=:'run_t4'::uuid
      AND decision_scope='nutrition_plan_review'
      AND decision_status='paused'
      AND 'BODY_STATE_MISSING'=ANY(reason_codes)
      AND 'RECOVERY_STATE_MISSING'=ANY(reason_codes)
  ) THEN RAISE EXCEPTION 'T4 missing body/recovery failed'; END IF;
END $$;
RESET ROLE;

-- T5: body exists but has no comparable response; recovery sufficient.
INSERT INTO public.health_nutrition_decisions(
  athlete_id,as_of_date,window_days,decision_status,decision_class,decision_code,target_domain,
  confidence,reason_codes,plan_adjustment_status,rolling_coverage_status,rolling_confidence
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-11-05',7,
  'ready','maintenance','maintain_plan','overall','high',
  ARRAY['ENERGY_AND_PROTEIN_ADHERENCE_ACCEPTABLE'],'paused','complete','high'
);
INSERT INTO public.health_body_rolling_states(
  athlete_id,as_of_date,window_days,window_start_date,weight_observation_count,weight_latest_kg,
  coverage_status,confidence
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-11-05',7,DATE '2026-10-30',1,94.0,
  'complete','high'
);
INSERT INTO public.health_sleep_recovery_rolling_states(
  athlete_id,as_of_date,window_days,window_start_date,recovery_observed_days,fatigue_observed_days,
  readiness_observed_days,recovery_coverage,fatigue_coverage,readiness_coverage,
  average_recovery,average_fatigue,average_readiness,confidence
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-11-05',7,DATE '2026-10-30',
  5,5,5,'complete','complete','complete',4.0,2.0,4.0,'high'
);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
SELECT public.health_f11_evaluate_integrated_decision(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-11-05',7
) AS run_t5 \gset
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.health_integrated_decisions
    WHERE run_id=:'run_t5'::uuid
      AND 'BODY_RESPONSE_INSUFFICIENT'=ANY(reason_codes)
  ) THEN RAISE EXCEPTION 'T5 body response insufficiency failed'; END IF;
END $$;
RESET ROLE;

-- T6: body sufficient, recovery absent.
INSERT INTO public.health_nutrition_decisions(
  athlete_id,as_of_date,window_days,decision_status,decision_class,decision_code,target_domain,
  confidence,reason_codes,plan_adjustment_status,rolling_coverage_status,rolling_confidence
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-11-06',7,
  'ready','maintenance','maintain_plan','overall','moderate',
  ARRAY['ENERGY_AND_PROTEIN_ADHERENCE_ACCEPTABLE'],'paused','complete','moderate'
);
INSERT INTO public.health_body_rolling_states(
  athlete_id,as_of_date,window_days,window_start_date,weight_observation_count,weight_latest_kg,
  weight_change_kg,coverage_status,confidence
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-11-06',7,DATE '2026-10-31',5,93.5,-0.5,
  'complete','moderate'
);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
SELECT public.health_f11_evaluate_integrated_decision(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-11-06',7
) AS run_t6 \gset
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.health_integrated_decisions
    WHERE run_id=:'run_t6'::uuid AND 'RECOVERY_STATE_MISSING'=ANY(reason_codes)
  ) THEN RAISE EXCEPTION 'T6 recovery missing failed'; END IF;
END $$;
RESET ROLE;

-- T7: all required sources sufficient -> plan review candidate ready.
INSERT INTO public.health_nutrition_decisions(
  athlete_id,as_of_date,window_days,decision_status,decision_class,decision_code,target_domain,
  confidence,reason_codes,plan_adjustment_status,rolling_coverage_status,rolling_confidence
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-11-07',7,
  'ready','maintenance','maintain_plan','overall','high',
  ARRAY['ENERGY_AND_PROTEIN_ADHERENCE_ACCEPTABLE'],'paused','complete','high'
);
INSERT INTO public.health_body_rolling_states(
  athlete_id,as_of_date,window_days,window_start_date,weight_observation_count,weight_latest_kg,
  weight_change_kg,weight_trend_kg_per_week,coverage_status,confidence,computed_at
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-11-07',7,DATE '2026-11-01',6,93.0,-1.0,-0.8,
  'complete','moderate','2026-11-07 12:00:00+00'
);
INSERT INTO public.health_sleep_recovery_rolling_states(
  athlete_id,as_of_date,window_days,window_start_date,recovery_observed_days,fatigue_observed_days,
  readiness_observed_days,recovery_coverage,fatigue_coverage,readiness_coverage,
  average_recovery,average_fatigue,average_readiness,confidence,computed_at
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-11-07',7,DATE '2026-11-01',
  5,5,5,'complete','complete','complete',4.0,2.0,4.0,'high','2026-11-07 12:00:00+00'
);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
SELECT public.health_f11_evaluate_integrated_decision(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-11-07',7
) AS run_t7a \gset
SELECT public.health_f11_evaluate_integrated_decision(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-11-07',7
) AS run_t7b \gset

DO $$
DECLARE
  v_count integer;
  v_conf text;
BEGIN
  IF :'run_t7a'::uuid <> :'run_t7b'::uuid THEN
    RAISE EXCEPTION 'T10 replay returned different run ids';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.health_integrated_decision_runs
  WHERE athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    AND as_of_date=DATE '2026-11-07'
    AND window_days=7;
  IF v_count<>1 THEN RAISE EXCEPTION 'T10 replay duplicated run'; END IF;

  SELECT confidence INTO v_conf
  FROM public.health_integrated_decisions
  WHERE run_id=:'run_t7a'::uuid
    AND decision_scope='nutrition_plan_review'
    AND decision_status='ready'
    AND decision_code='review_nutrition_plan_candidate'
    AND action_status='none';
  IF v_conf<>'moderate' THEN
    RAISE EXCEPTION 'T7 integrated confidence expected moderate, got %',v_conf;
  END IF;
END $$;
RESET ROLE;

-- T11: same state IDs but changed source content must change fingerprint and supersede.
UPDATE public.health_body_rolling_states
SET weight_change_kg=-1.2, computed_at='2026-11-07 13:00:00+00'
WHERE athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  AND as_of_date=DATE '2026-11-07' AND window_days=7;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
SELECT public.health_f11_evaluate_integrated_decision(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-11-07',7
) AS run_t11 \gset
RESET ROLE;

DO $$
DECLARE
  v_current integer;
  v_superseded integer;
BEGIN
  IF :'run_t11'::uuid = :'run_t7a'::uuid THEN
    RAISE EXCEPTION 'T11 changed source content did not change run';
  END IF;
  SELECT count(*) FILTER (WHERE record_status='current'),
         count(*) FILTER (WHERE record_status='superseded')
  INTO v_current,v_superseded
  FROM public.health_integrated_decision_runs
  WHERE athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    AND as_of_date=DATE '2026-11-07' AND window_days=7;
  IF v_current<>1 OR v_superseded<>1 THEN
    RAISE EXCEPTION 'T11 supersession failed current %, superseded %',v_current,v_superseded;
  END IF;
END $$;

-- T8: source window mismatch.
INSERT INTO public.health_nutrition_decisions(
  athlete_id,as_of_date,window_days,decision_status,decision_class,decision_code,target_domain,
  confidence,reason_codes,plan_adjustment_status,rolling_coverage_status,rolling_confidence
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-11-08',14,
  'ready','maintenance','maintain_plan','overall','high',
  ARRAY['ENERGY_AND_PROTEIN_ADHERENCE_ACCEPTABLE'],'paused','complete','high'
);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
SELECT public.health_f11_evaluate_integrated_decision(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-11-08',7
) AS run_t8 \gset
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.health_integrated_decisions
    WHERE run_id=:'run_t8'::uuid AND 'SOURCE_WINDOW_MISMATCH'=ANY(reason_codes)
  ) THEN RAISE EXCEPTION 'T8 window mismatch reason missing'; END IF;
END $$;
RESET ROLE;

-- T9: source date mismatch.
INSERT INTO public.health_nutrition_decisions(
  athlete_id,as_of_date,window_days,decision_status,decision_class,decision_code,target_domain,
  confidence,reason_codes,plan_adjustment_status,rolling_coverage_status,rolling_confidence
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-11-10',7,
  'ready','maintenance','maintain_plan','overall','high',
  ARRAY['ENERGY_AND_PROTEIN_ADHERENCE_ACCEPTABLE'],'paused','complete','high'
);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
SELECT public.health_f11_evaluate_integrated_decision(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-11-09',7
) AS run_t9 \gset
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.health_integrated_decisions
    WHERE run_id=:'run_t9'::uuid AND 'SOURCE_DATE_MISMATCH'=ANY(reason_codes)
  ) THEN RAISE EXCEPTION 'T9 date mismatch reason missing'; END IF;
END $$;
RESET ROLE;

-- T12: invalid evaluator input must fail and must not persist a fake paused decision.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $$
BEGIN
  BEGIN
    PERFORM public.health_f11_evaluate_integrated_decision(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-11-11',30
    );
    RAISE EXCEPTION 'T12 invalid window unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='T12 invalid window unexpectedly succeeded' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.health_integrated_decision_runs
    WHERE athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND as_of_date=DATE '2026-11-11'
  ) THEN RAISE EXCEPTION 'T12 failure persisted a run'; END IF;
END $$;

-- Seed and evaluate athlete B to make the cross-athlete RLS test non-vacuous.
INSERT INTO public.health_nutrition_decisions(
  athlete_id,as_of_date,window_days,decision_status,decision_class,decision_code,target_domain,
  confidence,reason_codes,plan_adjustment_status,rolling_coverage_status,rolling_confidence
) VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',DATE '2026-11-07',7,
  'ready','execution','review_energy_execution','energy','moderate',
  ARRAY['ENERGY_ADHERENCE_BELOW_THRESHOLD'],'paused','complete','moderate'
);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
SELECT public.health_f11_evaluate_integrated_decision(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',DATE '2026-11-07',7
);
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.health_integrated_decision_runs
  WHERE athlete_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  IF v_count<>0 THEN RAISE EXCEPTION 'cross-athlete F11 run SELECT leak'; END IF;

  SELECT count(*) INTO v_count
  FROM public.health_integrated_decisions
  WHERE athlete_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  IF v_count<>0 THEN RAISE EXCEPTION 'cross-athlete F11 decision SELECT leak'; END IF;
END $$;

DO $$
BEGIN
  BEGIN
    PERFORM public.health_f11_evaluate_integrated_decision(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',DATE '2026-11-07',7
    );
    RAISE EXCEPTION 'cross-athlete F11 evaluate unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='cross-athlete F11 evaluate unexpectedly succeeded' THEN RAISE; END IF;
  END;
END $$;

RESET ROLE;

SELECT 'F11 disposable contract PASS' AS result;
