-- F24 disposable only: minimal tables for executing the existing F19 RPC code.
-- NEVER deploy this fixture or treat its simplified auth shim as production RLS.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
 AS $$ SELECT 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid $$;
CREATE OR REPLACE FUNCTION public.health_can_write_athlete(p_athlete_id uuid)
 RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT p_athlete_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
 $$;
CREATE TABLE public.health_workout_sessions (
 id uuid PRIMARY KEY, athlete_id uuid NOT NULL, status text NOT NULL
);
CREATE TABLE public.health_workout_exercises (
 id uuid PRIMARY KEY, athlete_id uuid NOT NULL, session_id uuid NOT NULL,
 status text NOT NULL, planned_sets_min integer, planned_sets_max integer
);
CREATE TABLE public.health_workout_sets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), athlete_id uuid NOT NULL,
 session_id uuid NOT NULL, workout_exercise_id uuid NOT NULL,
 set_number integer NOT NULL, status text NOT NULL, rest_seconds integer
);
CREATE TABLE public.health_workout_timer_intervals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), athlete_id uuid NOT NULL,
 session_id uuid NOT NULL, workout_exercise_id uuid NOT NULL,
 workout_set_id uuid, interval_type text NOT NULL, set_number integer,
 status text NOT NULL, client_event_id uuid NOT NULL,
 created_by_auth_user_id uuid, started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 target_seconds integer, pause_accumulated_seconds integer NOT NULL DEFAULT 0,
 paused_at timestamptz, ended_at timestamptz, actual_seconds integer,
 UNIQUE (athlete_id,client_event_id)
);
CREATE TABLE public.health_workout_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), athlete_id uuid NOT NULL,
 session_id uuid, workout_exercise_id uuid, workout_set_id uuid,
 event_type text NOT NULL, source text, client_event_id uuid NOT NULL,
 occurred_at timestamptz, payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_by_auth_user_id uuid,
 UNIQUE (athlete_id,client_event_id)
);
INSERT INTO public.health_workout_sessions VALUES
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','active');
INSERT INTO public.health_workout_exercises VALUES
 ('dddddddd-dddd-dddd-dddd-dddddddddddd','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'cccccccc-cccc-cccc-cccc-cccccccccccc','active',3,3),
 ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'cccccccc-cccc-cccc-cccc-cccccccccccc','pending',3,3);
INSERT INTO public.health_workout_sets(id,athlete_id,session_id,workout_exercise_id,set_number,status)
 SELECT ('10000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'cccccccc-cccc-cccc-cccc-cccccccccccc',
 'dddddddd-dddd-dddd-dddd-dddddddddddd',n,'completed'
 FROM generate_series(1,3) AS n;
INSERT INTO public.health_workout_timer_intervals
 (id,athlete_id,session_id,workout_exercise_id,workout_set_id,interval_type,
  set_number,status,client_event_id,started_at,target_seconds)
 VALUES (
 '20000000-0000-0000-0000-000000000003',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'cccccccc-cccc-cccc-cccc-cccccccccccc',
 'dddddddd-dddd-dddd-dddd-dddddddddddd',
 '10000000-0000-0000-0000-000000000003',
 'rest',3,'running','30000000-0000-0000-0000-000000000003',
 clock_timestamp()-interval '120 seconds',90);
