-- E5-C isolated authenticated SELECT contracts; NEVER run on a live database.
-- Base fixture supplies auth.uid(), roles, two synthetic owners and two athletes.
-- Owner-only proxy for health_can_read_athlete: DOES NOT validate sharing/coach permissions.
CREATE FUNCTION public.health_can_read_athlete(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.health_can_write_athlete(p_id)
$$;
GRANT EXECUTE ON FUNCTION public.health_can_read_athlete(uuid) TO authenticated;

ALTER TABLE public.health_workout_sessions
 ADD COLUMN program_version_id uuid, ADD COLUMN status text, ADD COLUMN record_status text;
UPDATE public.health_workout_sessions SET
 program_version_id='aaaaaaaa-2000-4000-8000-aaaaaaaaaaaa',
 status='completed',record_status='active';
INSERT INTO public.health_workout_sessions VALUES
 ('ffffffff-1000-4000-8000-fffffffffffb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'bbbbbbbb-2000-4000-8000-bbbbbbbbbbbb','completed','active');
CREATE TABLE public.health_workout_exercises(
 id uuid PRIMARY KEY,athlete_id uuid NOT NULL,session_id uuid NOT NULL,
 exercise_id uuid NOT NULL,status text NOT NULL);
CREATE TABLE public.health_workout_sets(
 id uuid PRIMARY KEY,athlete_id uuid NOT NULL,session_id uuid NOT NULL,
 workout_exercise_id uuid NOT NULL,status text NOT NULL,set_type text NOT NULL,
 load_value numeric,load_unit text,reps integer,rir numeric);
CREATE TABLE public.health_cch_workout_equipment(
 workout_exercise_id uuid PRIMARY KEY,athlete_id uuid NOT NULL,session_id uuid NOT NULL,
 exercise_id uuid NOT NULL,equipment_label text NOT NULL,confirmed_at timestamptz NOT NULL);
CREATE TABLE public.health_recovery_checkins(
 id uuid PRIMARY KEY,athlete_id uuid NOT NULL,observed_on date,
 metric_code text NOT NULL,value_ordinal smallint,status text NOT NULL);
CREATE TABLE public.health_consents(
 id uuid PRIMARY KEY,athlete_id uuid NOT NULL,consent_type text NOT NULL CHECK(
 consent_type IN ('health_data_processing','private_media_storage','media_analysis',
 'coach_sharing','notifications')),decision text NOT NULL,
 policy_version text NOT NULL,occurred_at timestamptz NOT NULL);
CREATE TABLE public.health_goals(
 id uuid PRIMARY KEY,athlete_id uuid NOT NULL,goal_type text NOT NULL,status text NOT NULL,
 is_primary boolean NOT NULL);

INSERT INTO public.health_workout_exercises VALUES
 ('dddddddd-1000-4000-8000-ddddddddddda','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'ffffffff-1000-4000-8000-ffffffffffff','cccccccc-1000-4000-8000-cccccccccccc','completed'),
 ('dddddddd-1000-4000-8000-dddddddddddb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'ffffffff-1000-4000-8000-fffffffffffb','cccccccc-1000-4000-8000-cccccccccccc','completed');
INSERT INTO public.health_workout_sets VALUES
 ('dddddddd-2000-4000-8000-ddddddddddda','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'ffffffff-1000-4000-8000-ffffffffffff','dddddddd-1000-4000-8000-ddddddddddda',
 'completed','working',80,'kg',8,2),
 ('dddddddd-2000-4000-8000-dddddddddddb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'ffffffff-1000-4000-8000-fffffffffffb','dddddddd-1000-4000-8000-dddddddddddb',
 'completed','working',80,'kg',8,2);
INSERT INTO public.health_cch_workout_equipment VALUES
 ('dddddddd-1000-4000-8000-ddddddddddda','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'ffffffff-1000-4000-8000-ffffffffffff','cccccccc-1000-4000-8000-cccccccccccc',
 'Machine A','2026-11-19T10:00:00Z'),
 ('dddddddd-1000-4000-8000-dddddddddddb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'ffffffff-1000-4000-8000-fffffffffffb','cccccccc-1000-4000-8000-cccccccccccc',
 'Machine B','2026-11-19T10:00:00Z');
INSERT INTO public.health_recovery_checkins VALUES
 ('dddddddd-3000-4000-8000-ddddddddddda','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '2026-11-19','recovery',4,'active'),
 ('dddddddd-3000-4000-8000-dddddddddddb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 '2026-11-19','recovery',4,'active');
INSERT INTO public.health_consents VALUES
 ('dddddddd-4000-4000-8000-ddddddddddda','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'health_data_processing','granted','health-m1-v1','2026-11-19T10:00:00Z'),
 ('dddddddd-4000-4000-8000-dddddddddddb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'health_data_processing','granted','health-m1-v1','2026-11-19T10:00:00Z');
INSERT INTO public.health_goals VALUES
 ('dddddddd-5000-4000-8000-ddddddddddda','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'hypertrophy','active',true),
 ('dddddddd-5000-4000-8000-dddddddddddb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'hypertrophy','active',true);

-- Match the SELECT expressions in M4, V8 and M1 migration sources.
-- No grants for modifications in this isolated E5 read-only test.
REVOKE ALL ON public.health_workout_sessions FROM authenticated;
GRANT SELECT ON public.health_workout_sessions TO authenticated;
ALTER TABLE public.health_workout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY e5_sessions_select ON public.health_workout_sessions FOR SELECT TO authenticated
 USING (public.health_can_read_athlete(athlete_id));
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['health_workout_exercises','health_workout_sets',
  'health_cch_workout_equipment','health_recovery_checkins','health_consents','health_goals']
 LOOP
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.health_can_read_athlete(athlete_id))',
   'e5_select_'||t,t);
 END LOOP;
END $$;

-- A synthetic role can only read its own athlete's six evidence tables and sessions.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $$
DECLARE t text; own_count integer; foreign_count integer;
BEGIN
 FOREACH t IN ARRAY ARRAY['health_workout_sessions','health_workout_exercises',
 'health_workout_sets','health_cch_workout_equipment','health_recovery_checkins',
 'health_consents','health_goals'] LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',t) INTO own_count;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE athlete_id=$1',t)
   INTO foreign_count USING 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid;
  IF own_count<>1 OR foreign_count<>0 THEN
   RAISE EXCEPTION 'E5-A synthetic identity isolation failed: % (%, %)',t,own_count,foreign_count;
  END IF;
 END LOOP;
 IF (SELECT count(*) FROM public.health_workout_sessions s
  JOIN public.health_workout_exercises e ON e.session_id=s.id
  JOIN public.health_workout_sets w ON w.workout_exercise_id=e.id
  JOIN public.health_cch_workout_equipment q ON q.workout_exercise_id=e.id)<>1 THEN
  RAISE EXCEPTION 'E5-A joined read isolation failed';
 END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
DO $$
DECLARE t text; own_count integer; foreign_count integer;
BEGIN
 FOREACH t IN ARRAY ARRAY['health_workout_sessions','health_workout_exercises',
 'health_workout_sets','health_cch_workout_equipment','health_recovery_checkins',
 'health_consents','health_goals'] LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',t) INTO own_count;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE athlete_id=$1',t)
   INTO foreign_count USING 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
  IF own_count<>1 OR foreign_count<>0 THEN
   RAISE EXCEPTION 'E5-B synthetic identity isolation failed: % (%, %)',t,own_count,foreign_count;
  END IF;
 END LOOP;
END $$;
SELECT set_config('request.jwt.claim.sub','',false);
DO $$
BEGIN
 IF (SELECT count(*) FROM public.health_workout_sets)<>0 OR
    (SELECT count(*) FROM public.health_consents)<>0 THEN
  RAISE EXCEPTION 'E5 unauthenticated context must not read athlete evidence';
 END IF;
END $$;
RESET ROLE;

-- The deployed M1 CHECK constraint forbids a novel E5 consent_type.
DO $$
BEGIN
 BEGIN
  INSERT INTO public.health_consents VALUES
   ('dddddddd-4000-4000-8000-dddddddddddc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'e5_personalized_review','granted','e5-v1',now());
  RAISE EXCEPTION 'E5 consent was unexpectedly accepted by the M1 schema';
 EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS: current M1 consent type constraint blocks E5-specific decision';
 END;
END $$;
-- The E5 extraction role must not be able to mutate any of its sources.
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['health_workout_sessions','health_workout_exercises',
 'health_workout_sets','health_cch_workout_equipment','health_recovery_checkins',
 'health_consents','health_goals'] LOOP
  IF has_table_privilege('authenticated',format('public.%I',t),'INSERT') OR
   has_table_privilege('authenticated',format('public.%I',t),'UPDATE') OR
   has_table_privilege('authenticated',format('public.%I',t),'DELETE') THEN
   RAISE EXCEPTION 'E5 test read-only scope has write grants for %',t;
  END IF;
 END LOOP;
END $$;
SELECT 'CCH_E5_ISOLATED_RLS_CONTRACT_PASS' AS result;
