-- CCH E2B disposable fixture. NEVER run in production.
CREATE SCHEMA auth;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT NULLIF(current_setting('request.jwt.claim.sub', true),'')::uuid
$$;
GRANT USAGE ON SCHEMA auth,public TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE TABLE public.health_athletes(id uuid PRIMARY KEY,owner_auth_user_id uuid NOT NULL REFERENCES auth.users(id));
CREATE TABLE public.health_programs(id uuid PRIMARY KEY,athlete_id uuid NOT NULL REFERENCES health_athletes(id),current_version_id uuid);
CREATE TABLE public.health_program_versions(
 id uuid PRIMARY KEY,program_id uuid NOT NULL REFERENCES health_programs(id),
 athlete_id uuid NOT NULL REFERENCES health_athletes(id),status text NOT NULL);
CREATE TABLE public.health_session_templates(
 id uuid PRIMARY KEY,program_version_id uuid NOT NULL REFERENCES health_program_versions(id),
 athlete_id uuid NOT NULL REFERENCES health_athletes(id));
CREATE TABLE public.health_exercises(id uuid PRIMARY KEY,is_active boolean NOT NULL);
CREATE TABLE public.health_exercise_equivalences(
 id uuid PRIMARY KEY,source_exercise_id uuid NOT NULL REFERENCES health_exercises(id),
 target_exercise_id uuid NOT NULL REFERENCES health_exercises(id),
 equivalence_type text,confidence text);
CREATE TABLE public.health_exercise_muscles(exercise_id uuid,muscle_group_id uuid,role text);
CREATE TABLE public.health_session_template_exercises(
 id uuid PRIMARY KEY,session_template_id uuid NOT NULL REFERENCES health_session_templates(id),
 athlete_id uuid NOT NULL REFERENCES health_athletes(id),exercise_id uuid NOT NULL REFERENCES health_exercises(id),
 sequence_order integer NOT NULL,
 prescription_notes text,
 UNIQUE(session_template_id,sequence_order));
CREATE TABLE public.health_workout_sessions(id uuid PRIMARY KEY,athlete_id uuid);
CREATE TABLE public.health_cch_queue_entries(id uuid PRIMARY KEY,athlete_id uuid);

CREATE FUNCTION public.health_can_write_athlete(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.health_athletes WHERE id=p_id AND owner_auth_user_id=auth.uid())
$$;
GRANT EXECUTE ON FUNCTION public.health_can_write_athlete(uuid) TO authenticated;
GRANT SELECT ON public.health_athletes,public.health_programs,
 public.health_program_versions,public.health_session_templates,
 public.health_exercises,public.health_exercise_equivalences,
 public.health_exercise_muscles,public.health_session_template_exercises TO authenticated;
GRANT UPDATE ON public.health_session_template_exercises TO authenticated;
ALTER TABLE public.health_session_template_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_e2 ON public.health_session_template_exercises FOR SELECT TO authenticated
 USING(public.health_can_write_athlete(athlete_id));
CREATE POLICY update_e2 ON public.health_session_template_exercises FOR UPDATE TO authenticated
 USING(public.health_can_write_athlete(athlete_id) AND EXISTS(
  SELECT 1 FROM public.health_session_templates t JOIN public.health_program_versions v
   ON v.id=t.program_version_id
  WHERE t.id=health_session_template_exercises.session_template_id AND t.athlete_id=health_session_template_exercises.athlete_id
  AND v.athlete_id=health_session_template_exercises.athlete_id AND v.status='draft'))
 WITH CHECK(public.health_can_write_athlete(athlete_id) AND EXISTS(
  SELECT 1 FROM public.health_session_templates t JOIN public.health_program_versions v
   ON v.id=t.program_version_id
  WHERE t.id=health_session_template_exercises.session_template_id AND t.athlete_id=health_session_template_exercises.athlete_id
  AND v.athlete_id=health_session_template_exercises.athlete_id AND v.status='draft'));
GRANT EXECUTE ON FUNCTION public.health_can_write_athlete(uuid) TO authenticated;

INSERT INTO auth.users VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
INSERT INTO public.health_athletes VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222');
INSERT INTO public.health_programs VALUES
 ('aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-2000-4000-8000-aaaaaaaaaaaa'),
 ('bbbbbbbb-1000-4000-8000-bbbbbbbbbbbb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbbbbbb-2000-4000-8000-bbbbbbbbbbbb');
INSERT INTO public.health_program_versions VALUES
 ('aaaaaaaa-2000-4000-8000-aaaaaaaaaaaa','aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','published'),
 ('aaaaaaaa-2000-4000-8000-aaaaaaaaaaab','aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','draft'),
 ('bbbbbbbb-2000-4000-8000-bbbbbbbbbbbb','bbbbbbbb-1000-4000-8000-bbbbbbbbbbbb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','published'),
 ('bbbbbbbb-2000-4000-8000-bbbbbbbbbbbc','bbbbbbbb-1000-4000-8000-bbbbbbbbbbbb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','draft');
INSERT INTO public.health_session_templates VALUES
 ('aaaaaaaa-3000-4000-8000-aaaaaaaaaaaa','aaaaaaaa-2000-4000-8000-aaaaaaaaaaab','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('aaaaaaaa-3000-4000-8000-aaaaaaaaaaab','aaaaaaaa-2000-4000-8000-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('aaaaaaaa-3000-4000-8000-aaaaaaaaaaac','aaaaaaaa-2000-4000-8000-aaaaaaaaaaab','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-3000-4000-8000-bbbbbbbbbbbb','bbbbbbbb-2000-4000-8000-bbbbbbbbbbbc','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO public.health_exercises VALUES
 ('cccccccc-1000-4000-8000-cccccccccccc',true),
 ('cccccccc-2000-4000-8000-cccccccccccc',true),
 ('cccccccc-3000-4000-8000-cccccccccccc',true),
 ('cccccccc-4000-4000-8000-cccccccccccc',true),
 ('cccccccc-5000-4000-8000-cccccccccccc',false);
INSERT INTO public.health_exercise_equivalences VALUES
 ('dddddddd-1000-4000-8000-dddddddddddd','cccccccc-1000-4000-8000-cccccccccccc','cccccccc-2000-4000-8000-cccccccccccc','same_primary_muscle','provisional'),
 ('dddddddd-2000-4000-8000-dddddddddddd','cccccccc-1000-4000-8000-cccccccccccc','cccccccc-3000-4000-8000-cccccccccccc','same_pattern','provisional'),
 ('dddddddd-3000-4000-8000-dddddddddddd','cccccccc-1000-4000-8000-cccccccccccc','cccccccc-5000-4000-8000-cccccccccccc','same_pattern','provisional');
INSERT INTO public.health_exercise_muscles VALUES
 ('cccccccc-1000-4000-8000-cccccccccccc','eeeeeeee-1000-4000-8000-eeeeeeeeeeee','primary'),
 ('cccccccc-2000-4000-8000-cccccccccccc','eeeeeeee-1000-4000-8000-eeeeeeeeeeee','primary'),
 ('cccccccc-3000-4000-8000-cccccccccccc','eeeeeeee-2000-4000-8000-eeeeeeeeeeee','primary');
INSERT INTO public.health_session_template_exercises VALUES
 ('aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa','aaaaaaaa-3000-4000-8000-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-1000-4000-8000-cccccccccccc',1,NULL),
 ('aaaaaaaa-4000-4000-8000-aaaaaaaaaaab','aaaaaaaa-3000-4000-8000-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-4000-4000-8000-cccccccccccc',2,NULL),
 ('aaaaaaaa-4000-4000-8000-aaaaaaaaaaac','aaaaaaaa-3000-4000-8000-aaaaaaaaaaab','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-1000-4000-8000-cccccccccccc',1,NULL),
 ('aaaaaaaa-4000-4000-8000-aaaaaaaaaaad','aaaaaaaa-3000-4000-8000-aaaaaaaaaaac','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-4000-4000-8000-cccccccccccc',1,NULL),
 ('bbbbbbbb-4000-4000-8000-bbbbbbbbbbbb','bbbbbbbb-3000-4000-8000-bbbbbbbbbbbb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-1000-4000-8000-cccccccccccc',1,NULL);
INSERT INTO public.health_workout_sessions VALUES ('ffffffff-1000-4000-8000-ffffffffffff','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO public.health_cch_queue_entries VALUES ('ffffffff-2000-4000-8000-ffffffffffff','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
