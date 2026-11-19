-- E5-E throwaway database only. E2 test base establishes two synthetic owners.
ALTER TABLE public.health_athletes ADD COLUMN auth_user_id uuid REFERENCES auth.users(id);
UPDATE public.health_athletes SET auth_user_id=owner_auth_user_id;
INSERT INTO auth.users VALUES ('33333333-3333-4333-8333-333333333333');
-- Coach has delegated management/write permissions to A only. Is NOT athlete A.
CREATE OR REPLACE FUNCTION public.health_can_manage_athlete_access(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.health_can_write_athlete(p_id) OR
  (auth.uid()='33333333-3333-4333-8333-333333333333'::uuid AND
   p_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid)
$$;
CREATE OR REPLACE FUNCTION public.health_can_write_athlete(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND (EXISTS
  (SELECT 1 FROM public.health_athletes a WHERE a.id=p_id
   AND a.owner_auth_user_id=auth.uid()) OR
  (auth.uid()='33333333-3333-4333-8333-333333333333'::uuid
   AND p_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid))
$$;
CREATE OR REPLACE FUNCTION public.health_can_read_athlete(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.health_can_write_athlete(p_id)
$$;
GRANT EXECUTE ON FUNCTION public.health_can_manage_athlete_access(uuid),
 public.health_can_read_athlete(uuid),public.health_can_write_athlete(uuid) TO authenticated;

CREATE TABLE public.health_consents(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 athlete_id uuid NOT NULL REFERENCES public.health_athletes(id),
 consent_type text NOT NULL CONSTRAINT health_consents_consent_type_check CHECK
 (consent_type IN ('health_data_processing','private_media_storage','media_analysis','coach_sharing','notifications')),
 decision text NOT NULL CHECK (decision IN ('granted','denied','revoked')),
 policy_version text NOT NULL CHECK (btrim(policy_version)<>''),
 actor_auth_user_id uuid NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
 occurred_at timestamptz NOT NULL DEFAULT now(),details jsonb,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.health_consents ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT ON public.health_consents TO authenticated;
CREATE POLICY health_consents_select ON public.health_consents FOR SELECT TO authenticated
 USING(public.health_can_read_athlete(athlete_id));
CREATE POLICY health_consents_insert ON public.health_consents FOR INSERT TO authenticated
 WITH CHECK (public.health_can_manage_athlete_access(athlete_id)
 AND actor_auth_user_id=auth.uid());
ALTER TABLE public.health_workout_sessions ADD COLUMN status text NOT NULL DEFAULT 'completed';
ALTER TABLE public.health_workout_sessions ADD COLUMN record_status text NOT NULL DEFAULT 'active';
INSERT INTO public.health_workout_sessions(id,athlete_id) VALUES
 ('ffffffff-1000-4000-8000-fffffffffffb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
 ('ffffffff-1000-4000-8000-fffffffffffc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
UPDATE public.health_workout_sessions SET status='paused'
 WHERE id='ffffffff-1000-4000-8000-fffffffffffc';
ALTER TABLE public.health_workout_sessions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.health_workout_sessions TO authenticated;
CREATE POLICY e5e_sessions_select ON public.health_workout_sessions FOR SELECT TO authenticated
 USING(public.health_can_read_athlete(athlete_id));
CREATE TABLE public.health_workout_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 athlete_id uuid NOT NULL REFERENCES public.health_athletes(id),
 session_id uuid NOT NULL,
 workout_exercise_id uuid,workout_set_id uuid,
 event_type text NOT NULL CHECK(event_type IN ('note','session_completed','session_started')),
 source text NOT NULL DEFAULT 'user' CHECK(source IN ('user','system','sync')),
 client_event_id uuid NOT NULL,occurred_at timestamptz NOT NULL DEFAULT now(),
 recorded_at timestamptz NOT NULL DEFAULT now(),payload jsonb,
 created_by_auth_user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
 UNIQUE(athlete_id,client_event_id));
-- E2 fixture lacks a composite session uniqueness; reconstruct corresponding M4 constraint.
ALTER TABLE public.health_workout_sessions ADD CONSTRAINT health_workout_sessions_id_athlete_unique
 UNIQUE(id,athlete_id);
ALTER TABLE public.health_workout_events ADD CONSTRAINT health_workout_events_session_athlete_fkey
 FOREIGN KEY(session_id,athlete_id) REFERENCES public.health_workout_sessions(id,athlete_id);
ALTER TABLE public.health_workout_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT ON public.health_workout_events TO authenticated;
CREATE POLICY health_workout_events_select ON public.health_workout_events FOR SELECT TO authenticated
 USING(public.health_can_read_athlete(athlete_id));
CREATE POLICY health_workout_events_insert ON public.health_workout_events FOR INSERT TO authenticated
 WITH CHECK(public.health_can_write_athlete(athlete_id)
 AND (created_by_auth_user_id IS NULL OR created_by_auth_user_id=auth.uid()));
