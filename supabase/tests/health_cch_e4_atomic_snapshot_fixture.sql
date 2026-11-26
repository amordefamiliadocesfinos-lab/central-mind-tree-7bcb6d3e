-- Disposable PostgreSQL only. Deliberately reduced M3/M4 tables; no real identities.
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$f$;
GRANT USAGE ON SCHEMA auth TO authenticated,anon;
CREATE FUNCTION public.health_can_read_athlete(uuid) RETURNS boolean LANGUAGE sql STABLE AS $f$
 SELECT auth.uid() IS NOT NULL AND auth.uid()=$1
$f$;
CREATE TABLE public.health_programs(id uuid PRIMARY KEY,athlete_id uuid NOT NULL);
CREATE TABLE public.health_program_versions(id uuid PRIMARY KEY,athlete_id uuid NOT NULL,program_id uuid NOT NULL);
CREATE TABLE public.health_session_templates(id uuid PRIMARY KEY,athlete_id uuid NOT NULL,program_version_id uuid NOT NULL,code text,status text);
CREATE TABLE public.health_workout_sessions(id uuid PRIMARY KEY,athlete_id uuid NOT NULL,program_version_id uuid,session_template_id uuid,started_at timestamptz,status text,record_status text);
CREATE TABLE public.health_workout_sets(id uuid PRIMARY KEY,athlete_id uuid NOT NULL,session_id uuid NOT NULL,status text,set_type text,reps integer,rir numeric,load_value numeric,load_unit text);
DO $fixture$
DECLARE name text;
BEGIN
 FOREACH name IN ARRAY ARRAY['health_programs','health_program_versions','health_session_templates','health_workout_sessions','health_workout_sets'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',name);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',name);
  EXECUTE format('CREATE POLICY isolated_read ON public.%I FOR SELECT TO authenticated USING (public.health_can_read_athlete(athlete_id))',name);
 END LOOP;
END
$fixture$;
INSERT INTO public.health_programs VALUES
 ('a1000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('a1000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('b1000000-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO public.health_program_versions VALUES
 ('a2000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000001'),
 ('b2000000-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b1000000-0000-4000-8000-000000000001');
INSERT INTO public.health_session_templates VALUES
 ('a3000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a2000000-0000-4000-8000-000000000001','A1','active'),
 ('b3000000-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b2000000-0000-4000-8000-000000000001','B1','active');
INSERT INTO public.health_workout_sessions VALUES
 ('a4000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','2026-11-24T12:00:00Z','completed','active'),
 ('a4000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','2026-11-25T12:00:00Z','completed','voided'),
 ('b4000000-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b2000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','2026-11-24T12:00:00Z','completed','active');
INSERT INTO public.health_workout_sets VALUES
 ('a5000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000001','completed','working',8,2,80,'kg'),
 ('a5000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000001','completed','warmup',8,4,40,'kg'),
 ('b5000000-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b4000000-0000-4000-8000-000000000001','completed','working',10,2,20,'kg');
