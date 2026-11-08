-- F13 TESTES MT functional smoke.
-- Uses existing athlete identities only. All F13 rows created here are rolled back.
BEGIN;

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.health_athletes
  WHERE status='active' AND owner_auth_user_id IS NOT NULL;
  IF v_count < 2 THEN
    RAISE EXCEPTION 'F13 TESTES MT requires at least two active athlete profiles for non-vacuous cross-athlete tests';
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

-- Generate athlete A review as its owner.
SELECT set_config('request.jwt.claim.sub',current_setting('test.a_owner'),true);
SET LOCAL ROLE authenticated;

SELECT set_config(
  'test.a_run',
  public.health_f13_generate_longitudinal_review(
    current_setting('test.a_id')::uuid,DATE '2099-12-31',28
  )::text,
  true
);

SELECT set_config(
  'test.a_run_replay',
  public.health_f13_generate_longitudinal_review(
    current_setting('test.a_id')::uuid,DATE '2099-12-31',28
  )::text,
  true
);

DO $$
DECLARE
  v_auto boolean;
  v_causal boolean;
BEGIN
  IF current_setting('test.a_run') <> current_setting('test.a_run_replay') THEN
    RAISE EXCEPTION 'F13 TESTES MT run idempotency failed';
  END IF;

  SELECT
    (evidence_snapshot->>'automatic_replanning')::boolean,
    (evidence_snapshot->>'causal_inference')::boolean
  INTO v_auto,v_causal
  FROM public.health_longitudinal_review_runs
  WHERE id=current_setting('test.a_run')::uuid;

  IF COALESCE(v_auto,true) OR COALESCE(v_causal,true) THEN
    RAISE EXCEPTION 'F13 TESTES MT authority boundary failed';
  END IF;
END $$;

SELECT set_config(
  'test.a_outcome_1',
  public.health_f13_record_review_outcome(
    current_setting('test.a_run')::uuid,
    'continue_observation',
    '{}'::text[],
    'TESTES MT transient outcome'
  )::text,
  true
);

SELECT set_config(
  'test.a_outcome_1_replay',
  public.health_f13_record_review_outcome(
    current_setting('test.a_run')::uuid,
    'continue_observation',
    '{}'::text[],
    'TESTES MT transient outcome'
  )::text,
  true
);

DO $$
BEGIN
  IF current_setting('test.a_outcome_1') <> current_setting('test.a_outcome_1_replay') THEN
    RAISE EXCEPTION 'F13 TESTES MT outcome idempotency failed';
  END IF;
END $$;

SELECT set_config(
  'test.a_outcome_2',
  public.health_f13_record_review_outcome(
    current_setting('test.a_run')::uuid,
    'insufficient_data',
    '{}'::text[],
    'TESTES MT supersession check'
  )::text,
  true
);

DO $$
DECLARE
  v_current integer;
  v_old integer;
BEGIN
  SELECT count(*) FILTER (WHERE record_status='current'),
         count(*) FILTER (WHERE record_status='superseded')
  INTO v_current,v_old
  FROM public.health_longitudinal_review_outcomes
  WHERE review_run_id=current_setting('test.a_run')::uuid;

  IF v_current<>1 OR v_old<>1 THEN
    RAISE EXCEPTION 'F13 TESTES MT outcome supersession failed current %, old %',v_current,v_old;
  END IF;
END $$;

RESET ROLE;

-- Generate athlete B review as B to create a non-vacuous foreign row.
SELECT set_config('request.jwt.claim.sub',current_setting('test.b_owner'),true);
SET LOCAL ROLE authenticated;

SELECT set_config(
  'test.b_run',
  public.health_f13_generate_longitudinal_review(
    current_setting('test.b_id')::uuid,DATE '2099-12-31',28
  )::text,
  true
);

RESET ROLE;

-- Cross-athlete RLS + write authorization, from A against B.
SELECT set_config('request.jwt.claim.sub',current_setting('test.a_owner'),true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.health_longitudinal_review_runs
  WHERE athlete_id=current_setting('test.b_id')::uuid;
  IF v_count<>0 THEN
    RAISE EXCEPTION 'F13 TESTES MT cross-athlete run SELECT leak';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.health_longitudinal_review_outcomes
  WHERE athlete_id=current_setting('test.b_id')::uuid;
  IF v_count<>0 THEN
    RAISE EXCEPTION 'F13 TESTES MT cross-athlete outcome SELECT leak';
  END IF;

  BEGIN
    PERFORM public.health_f13_generate_longitudinal_review(
      current_setting('test.b_id')::uuid,DATE '2099-12-31',28
    );
    RAISE EXCEPTION 'F13 TESTES MT cross-athlete generate unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='F13 TESTES MT cross-athlete generate unexpectedly succeeded' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    PERFORM public.health_f13_record_review_outcome(
      current_setting('test.b_run')::uuid,
      'continue_observation',
      '{}'::text[],
      NULL
    );
    RAISE EXCEPTION 'F13 TESTES MT cross-athlete outcome unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='F13 TESTES MT cross-athlete outcome unexpectedly succeeded' THEN
      RAISE;
    END IF;
  END;
END $$;

RESET ROLE;

ROLLBACK;

SELECT 'F13_TESTES_MT_FUNCTIONAL_PASS' AS result;
