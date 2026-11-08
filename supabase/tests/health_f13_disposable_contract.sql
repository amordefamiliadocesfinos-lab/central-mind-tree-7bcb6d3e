\set ON_ERROR_STOP on

INSERT INTO auth.users(id) VALUES
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');

INSERT INTO public.health_athletes(id,auth_user_id,owner_auth_user_id,status) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','active'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222','active');

INSERT INTO public.health_goals(
  id,athlete_id,goal_type,title,status,priority,is_primary,started_on,target_date
) VALUES (
  'aaaaaaaa-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'hypertrophy','Meta A','active',1,true,DATE '2026-01-01',DATE '2026-12-31'
);

INSERT INTO public.health_goal_phases(
  athlete_id,goal_id,phase_type,title,status,starts_on,ends_on
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'build','Fase atual','active',DATE '2026-09-01',DATE '2026-12-31'
);

-- Static security contract.
DO $$
DECLARE
  v_generate oid;
  v_outcome oid;
  v_cfg text;
BEGIN
  IF has_table_privilege('anon','public.health_longitudinal_review_runs','SELECT') THEN
    RAISE EXCEPTION 'anon unexpectedly has F13 run SELECT';
  END IF;
  IF has_table_privilege('anon','public.health_longitudinal_review_outcomes','SELECT') THEN
    RAISE EXCEPTION 'anon unexpectedly has F13 outcome SELECT';
  END IF;
  IF has_table_privilege('authenticated','public.health_longitudinal_review_runs','INSERT') THEN
    RAISE EXCEPTION 'authenticated unexpectedly has direct F13 INSERT';
  END IF;
  IF NOT has_table_privilege('authenticated','public.health_longitudinal_review_runs','SELECT') THEN
    RAISE EXCEPTION 'authenticated missing F13 run SELECT';
  END IF;

  SELECT p.oid INTO v_generate
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='health_f13_generate_longitudinal_review';

  SELECT p.oid INTO v_outcome
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='health_f13_record_review_outcome';

  IF has_function_privilege('anon',v_generate,'EXECUTE') THEN
    RAISE EXCEPTION 'anon unexpectedly has F13 generate execute';
  END IF;
  IF has_function_privilege('anon',v_outcome,'EXECUTE') THEN
    RAISE EXCEPTION 'anon unexpectedly has F13 outcome execute';
  END IF;

  SELECT array_to_string(p.proconfig,',') INTO v_cfg FROM pg_proc p WHERE p.oid=v_generate;
  IF v_cfg IS NULL OR v_cfg NOT LIKE '%search_path=""%' THEN
    RAISE EXCEPTION 'F13 generate search_path not fixed empty: %',v_cfg;
  END IF;

  SELECT array_to_string(p.proconfig,',') INTO v_cfg FROM pg_proc p WHERE p.oid=v_outcome;
  IF v_cfg IS NULL OR v_cfg NOT LIKE '%search_path=""%' THEN
    RAISE EXCEPTION 'F13 outcome search_path not fixed empty: %',v_cfg;
  END IF;
END $$;

-- R1: athlete A has no longitudinal source history -> paused.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);

SELECT public.health_f13_generate_longitudinal_review(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-11-08',28
) AS run_a_empty \gset
SELECT set_config('test.run_a_empty', :'run_a_empty', false);

DO $$
DECLARE
  v_status text;
  v_available text[];
BEGIN
  SELECT run_status,available_domains
  INTO v_status,v_available
  FROM public.health_longitudinal_review_runs
  WHERE id=current_setting('test.run_a_empty')::uuid;

  IF v_status<>'paused' OR cardinality(v_available)<>0 THEN
    RAISE EXCEPTION 'R1 expected paused with zero domains';
  END IF;
END $$;
RESET ROLE;

-- C4: one historical completed workout establishes training as a known domain.
-- Current and prior periods both have factual zero completed sessions.
INSERT INTO public.health_workout_sessions(
  id,athlete_id,status,started_at,ended_at
) VALUES (
  'aaaaaaaa-1000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'completed','2026-01-01 10:00:00+00','2026-01-01 11:00:00+00'
);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
SELECT public.health_f13_generate_longitudinal_review(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-12-31',28
) AS run_a_zero \gset
SELECT set_config('test.run_a_zero', :'run_a_zero', false);

DO $$
DECLARE
  v_status text;
  v_current integer;
  v_prior integer;
BEGIN
  SELECT run_status,
         (evidence_snapshot#>>'{training,current,completed_session_count}')::integer,
         (evidence_snapshot#>>'{training,prior,completed_session_count}')::integer
  INTO v_status,v_current,v_prior
  FROM public.health_longitudinal_review_runs
  WHERE id=current_setting('test.run_a_zero')::uuid;

  IF v_status<>'available' OR v_current<>0 OR v_prior<>0 THEN
    RAISE EXCEPTION 'C4 factual zero training comparison failed';
  END IF;
END $$;
RESET ROLE;

-- Athlete B: nutrition is the only comparable domain.
INSERT INTO public.health_nutrition_rolling_states(
  athlete_id,window_end_date,window_days,window_start_date,
  observed_day_count,sufficient_day_count,observation_coverage_ratio,sufficient_coverage_ratio,
  avg_energy_kcal,avg_protein_g,avg_carbohydrate_g,avg_fat_g,avg_fiber_g,
  energy_target_adherence_ratio,protein_target_adherence_ratio,
  coverage_status,confidence,reason_codes
) VALUES
(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',DATE '2026-10-11',28,DATE '2026-09-14',
  20,18,0.71428,0.64285,2100,150,220,70,25,0.70,0.80,
  'partial','moderate','{}'
),
(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',DATE '2026-11-08',28,DATE '2026-10-12',
  24,22,0.85714,0.78571,2200,160,230,72,27,0.78,0.85,
  'complete','high','{}'
);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);

SELECT public.health_f13_generate_longitudinal_review(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',DATE '2026-11-08',28
) AS run_b_1 \gset
SELECT set_config('test.run_b_1', :'run_b_1', false);

SELECT public.health_f13_generate_longitudinal_review(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',DATE '2026-11-08',28
) AS run_b_2 \gset
SELECT set_config('test.run_b_2', :'run_b_2', false);

DO $$
DECLARE
  v_available text[];
  v_delta numeric;
  v_count integer;
BEGIN
  IF current_setting('test.run_b_1')<>current_setting('test.run_b_2') THEN
    RAISE EXCEPTION 'R3 replay returned different run';
  END IF;

  SELECT available_domains,
         (evidence_snapshot#>>'{nutrition,delta,avg_energy_kcal}')::numeric
  INTO v_available,v_delta
  FROM public.health_longitudinal_review_runs
  WHERE id=current_setting('test.run_b_1')::uuid;

  IF v_available<>ARRAY['nutrition']::text[] OR v_delta<>100 THEN
    RAISE EXCEPTION 'R2 one-domain comparison failed %, %',v_available,v_delta;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.health_longitudinal_review_runs
  WHERE athlete_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    AND as_of_date=DATE '2026-11-08';
  IF v_count<>1 THEN RAISE EXCEPTION 'R3 replay duplicated run'; END IF;
END $$;

-- O1: explicit human outcome, no specialist mutation.
SELECT public.health_f13_record_review_outcome(
  current_setting('test.run_b_1')::uuid,
  'continue_observation',
  '{}'::text[],
  'Continuar observando.'
) AS outcome_b_1 \gset
SELECT set_config('test.outcome_b_1', :'outcome_b_1', false);

SELECT public.health_f13_record_review_outcome(
  current_setting('test.run_b_1')::uuid,
  'continue_observation',
  '{}'::text[],
  'Continuar observando.'
) AS outcome_b_1_replay \gset
SELECT set_config('test.outcome_b_1_replay', :'outcome_b_1_replay', false);

DO $$
BEGIN
  IF current_setting('test.outcome_b_1')<>current_setting('test.outcome_b_1_replay') THEN
    RAISE EXCEPTION 'outcome replay is not idempotent';
  END IF;
END $$;

-- O2/O3: new human outcome supersedes prior but does not edit nutrition source.
SELECT public.health_f13_record_review_outcome(
  current_setting('test.run_b_1')::uuid,
  'review_nutrition',
  ARRAY['nutrition'],
  'Revisar planejamento nutricional.'
) AS outcome_b_2 \gset
SELECT set_config('test.outcome_b_2', :'outcome_b_2', false);

RESET ROLE;

DO $$
DECLARE
  v_current integer;
  v_old integer;
  v_energy numeric;
BEGIN
  SELECT count(*) FILTER (WHERE record_status='current'),
         count(*) FILTER (WHERE record_status='superseded')
  INTO v_current,v_old
  FROM public.health_longitudinal_review_outcomes
  WHERE review_run_id=current_setting('test.run_b_1')::uuid;

  IF v_current<>1 OR v_old<>1 THEN
    RAISE EXCEPTION 'outcome supersession failed current %, old %',v_current,v_old;
  END IF;

  SELECT avg_energy_kcal INTO v_energy
  FROM public.health_nutrition_rolling_states
  WHERE athlete_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    AND window_end_date=DATE '2026-11-08' AND window_days=28;

  IF v_energy<>2200 THEN
    RAISE EXCEPTION 'F13 outcome mutated nutrition source';
  END IF;
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);

-- Invalid outcome target must fail atomically.
DO $$
BEGIN
  BEGIN
    PERFORM public.health_f13_record_review_outcome(
      current_setting('test.run_b_1')::uuid,
      'review_training',
      ARRAY['nutrition'],
      NULL
    );
    RAISE EXCEPTION 'invalid outcome unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='invalid outcome unexpectedly succeeded' THEN RAISE; END IF;
  END;
END $$;

RESET ROLE;

-- R4: source change -> new fingerprint + supersession.
UPDATE public.health_nutrition_rolling_states
SET avg_energy_kcal=2250
WHERE athlete_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  AND window_end_date=DATE '2026-11-08'
  AND window_days=28;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);

SELECT public.health_f13_generate_longitudinal_review(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',DATE '2026-11-08',28
) AS run_b_3 \gset
SELECT set_config('test.run_b_3', :'run_b_3', false);
RESET ROLE;

DO $$
DECLARE
  v_current integer;
  v_old integer;
BEGIN
  IF current_setting('test.run_b_3')=current_setting('test.run_b_1') THEN
    RAISE EXCEPTION 'R4 source change did not create new run';
  END IF;

  SELECT count(*) FILTER (WHERE record_status='current'),
         count(*) FILTER (WHERE record_status='superseded')
  INTO v_current,v_old
  FROM public.health_longitudinal_review_runs
  WHERE athlete_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    AND as_of_date=DATE '2026-11-08';

  IF v_current<>1 OR v_old<>1 THEN
    RAISE EXCEPTION 'R4 run supersession failed current %, old %',v_current,v_old;
  END IF;
END $$;

-- Non-vacuous cross-athlete RLS and write authorization.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.health_longitudinal_review_runs
  WHERE athlete_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  IF v_count<>0 THEN RAISE EXCEPTION 'cross-athlete F13 run SELECT leak'; END IF;

  SELECT count(*) INTO v_count
  FROM public.health_longitudinal_review_outcomes
  WHERE athlete_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  IF v_count<>0 THEN RAISE EXCEPTION 'cross-athlete F13 outcome SELECT leak'; END IF;

  BEGIN
    PERFORM public.health_f13_generate_longitudinal_review(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',DATE '2026-11-08',28
    );
    RAISE EXCEPTION 'cross-athlete F13 generate unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='cross-athlete F13 generate unexpectedly succeeded' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.health_f13_record_review_outcome(
      current_setting('test.run_b_3')::uuid,
      'continue_observation',
      '{}'::text[],
      NULL
    );
    RAISE EXCEPTION 'cross-athlete F13 outcome unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='cross-athlete F13 outcome unexpectedly succeeded' THEN RAISE; END IF;
  END;
END $$;

RESET ROLE;

-- Structural security and FK-index audit.
DO $$
DECLARE
  v_bad integer;
BEGIN
  SELECT count(*) INTO v_bad
  FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public'
    AND c.relname IN ('health_longitudinal_review_runs','health_longitudinal_review_outcomes')
    AND NOT c.relrowsecurity;
  IF v_bad<>0 THEN RAISE EXCEPTION 'F13 tables without RLS: %',v_bad; END IF;

  SELECT count(*) INTO v_bad
  FROM information_schema.role_table_grants g
  WHERE g.table_schema='public'
    AND g.table_name IN ('health_longitudinal_review_runs','health_longitudinal_review_outcomes')
    AND g.grantee='anon';
  IF v_bad<>0 THEN RAISE EXCEPTION 'anon F13 table grants: %',v_bad; END IF;

  WITH fk AS (
    SELECT c.conname,c.conrelid,c.conkey
    FROM pg_constraint c
    WHERE c.contype='f'
      AND c.conrelid::regclass::text IN (
        'health_longitudinal_review_runs',
        'health_longitudinal_review_outcomes'
      )
  )
  SELECT count(*) INTO v_bad
  FROM fk
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid=fk.conrelid
      AND i.indisvalid
      AND (i.indkey::smallint[])[0:cardinality(fk.conkey)-1]=fk.conkey
  );
  IF v_bad<>0 THEN RAISE EXCEPTION 'F13 foreign keys without leading index: %',v_bad; END IF;
END $$;

SELECT 'F13 disposable contract PASS' AS result;
