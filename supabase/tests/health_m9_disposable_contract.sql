\set ON_ERROR_STOP on

INSERT INTO auth.users(id) VALUES
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');

INSERT INTO public.health_athletes(id,auth_user_id,owner_auth_user_id,status) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','active'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222','active');

-- Seed one real fact for athlete B as database owner so A's later SELECT is a real RLS negative test.
INSERT INTO public.health_sleep_periods (
  athlete_id,sleep_date,period_type,declared_sleep_minutes,data_source,confidence,status
) VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',DATE '2026-11-01','nocturnal',420,
  'USER_REPORTED','moderate','active'
);

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.health_biomarker_catalog;
  IF v_count < 10 THEN RAISE EXCEPTION 'biomarker catalog seed incomplete'; END IF;

  IF has_table_privilege('anon','public.health_sleep_periods','SELECT') THEN
    RAISE EXCEPTION 'anon unexpectedly has sleep SELECT';
  END IF;
  IF has_table_privilege('authenticated','public.health_sleep_periods','INSERT') THEN
    RAISE EXCEPTION 'authenticated unexpectedly has direct sleep INSERT';
  END IF;
  IF NOT has_table_privilege('authenticated','public.health_sleep_periods','SELECT') THEN
    RAISE EXCEPTION 'authenticated missing sleep SELECT';
  END IF;
  IF has_table_privilege('authenticated','public.health_biomarker_aliases','SELECT') THEN
    RAISE EXCEPTION 'aliases unexpectedly exposed';
  END IF;
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);

SELECT public.health_m9_record_sleep_period(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  DATE '2026-11-01',
  'nocturnal',
  '2026-11-01 23:00:00+00',
  NULL,
  '2026-11-02 07:00:00+00',
  '2026-11-02 07:10:00+00',
  NULL,1,NULL,'America/Sao_Paulo','USER_REPORTED','moderate','fixture',
  '10101010-1010-4010-8010-101010101010',NULL
);

-- Same client event must be idempotent.
SELECT public.health_m9_record_sleep_period(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  DATE '2026-11-01','nocturnal',NULL,NULL,NULL,NULL,480,NULL,NULL,NULL,
  'USER_REPORTED','moderate',NULL,
  '10101010-1010-4010-8010-101010101010',NULL
);

DO $$
DECLARE
  v_count integer;
  v_declared integer;
  v_calculated integer;
  v_time_in_bed integer;
BEGIN
  SELECT count(*), max(declared_sleep_minutes), max(calculated_sleep_minutes), max(calculated_time_in_bed_minutes)
  INTO v_count,v_declared,v_calculated,v_time_in_bed
  FROM public.health_sleep_periods
  WHERE athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    AND client_event_id='10101010-1010-4010-8010-101010101010';

  IF v_count <> 1 THEN RAISE EXCEPTION 'sleep idempotency failed'; END IF;
  IF v_declared IS NOT NULL OR v_calculated IS NOT NULL THEN
    RAISE EXCEPTION 'time-in-bed-only record must not become sleep duration on replay';
  END IF;
  IF v_time_in_bed <> 490 THEN RAISE EXCEPTION 'time in bed calculation failed: %',v_time_in_bed; END IF;
END $$;

-- A distinct night with actual declared sleep duration creates one usable sleep day.
SELECT public.health_m9_record_sleep_period(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  DATE '2026-11-02','nocturnal',NULL,NULL,NULL,NULL,480,NULL,NULL,NULL,
  'USER_REPORTED','moderate','duração declarada',
  '20202020-2020-4020-8020-202020202020',NULL
);

SELECT public.health_m9_record_recovery_checkin(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '30303030-3030-4030-8030-303030303030',
  '2026-11-02 08:00:00+00',
  DATE '2026-11-02',
  'sleep_quality',4::smallint,NULL,'USER_REPORTED','moderate',NULL,NULL
);

SELECT public.health_m9_record_recovery_checkin(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '30303030-3030-4030-8030-303030303030',
  '2026-11-02 08:00:00+00',
  DATE '2026-11-02',
  'general_fatigue',2::smallint,NULL,'USER_REPORTED','moderate',NULL,NULL
);

SELECT public.health_m9_refresh_sleep_recovery_state(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DATE '2026-11-02',7
);

DO $$
DECLARE
  v_state public.health_sleep_recovery_rolling_states%ROWTYPE;
BEGIN
  SELECT * INTO v_state FROM public.health_sleep_recovery_rolling_states
  WHERE athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND as_of_date='2026-11-02' AND window_days=7;
  IF v_state.sleep_duration_observed_days <> 1 OR v_state.sleep_duration_coverage <> 'sparse' THEN
    RAISE EXCEPTION 'sleep state coverage failed';
  END IF;
  IF v_state.average_sleep_minutes IS NOT NULL THEN
    RAISE EXCEPTION 'insufficient sleep data must not produce an average';
  END IF;
END $$;

SELECT public.health_m9_record_lab_report(
  p_athlete_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  p_client_event_id => '40404040-4040-4040-8040-404040404040',
  p_results => '[{"original_analyte_name":"Glicose","original_result_text":"92","numeric_value":92,"original_unit":"mg/dL","original_reference_text":"70-99"}]'::jsonb,
  p_laboratory_name => 'Lab Teste',
  p_collected_at => '2026-11-01 10:00:00+00',
  p_fasting_status => 'fasting'
);

DO $$
DECLARE
  v_code text;
  v_count integer;
  v_report_id uuid;
BEGIN
  SELECT id INTO v_report_id FROM public.health_lab_reports
  WHERE athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    AND client_event_id='40404040-4040-4040-8040-404040404040';

  SELECT canonical_code INTO v_code
  FROM public.health_biomarker_results
  WHERE lab_report_id=v_report_id;
  IF v_code <> 'glucose' THEN RAISE EXCEPTION 'biomarker alias mapping failed: %',v_code; END IF;

  SELECT count(*) INTO v_count FROM public.health_biomarker_longitudinal_states
  WHERE athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND canonical_code='glucose';
  IF v_count <> 1 THEN RAISE EXCEPTION 'biomarker state refresh failed'; END IF;
END $$;

SELECT public.health_m9_record_vital_observation(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '2026-11-02 09:00:00+00',DATE '2026-11-02','blood_pressure',120,80,'mmHg',
  'repouso',NULL,'USER_REPORTED','moderate','50505050-5050-4050-8050-505050505050',NULL
);

-- RLS: A cannot read B.
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.health_sleep_periods WHERE athlete_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  IF v_count <> 0 THEN RAISE EXCEPTION 'cross-athlete SELECT leak'; END IF;
END $$;

DO $$
BEGIN
  BEGIN
    PERFORM public.health_m9_record_sleep_period(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',DATE '2026-11-02','nocturnal',
      NULL,NULL,NULL,NULL,480,NULL,NULL,NULL,'USER_REPORTED','moderate',NULL,NULL,NULL
    );
    RAISE EXCEPTION 'cross-athlete write unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='cross-athlete write unexpectedly succeeded' THEN RAISE; END IF;
  END;
END $$;

RESET ROLE;

DO $$
DECLARE
  v_bad integer;
BEGIN
  SELECT count(*) INTO v_bad
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname LIKE 'health_m9_%'
    AND has_function_privilege('anon',p.oid,'EXECUTE');
  IF v_bad <> 0 THEN RAISE EXCEPTION 'anon has M9 RPC execute privileges'; END IF;
END $$;

SELECT 'M9 disposable contract PASS' AS result;
