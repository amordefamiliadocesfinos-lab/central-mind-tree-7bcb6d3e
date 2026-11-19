-- E5-E throwaway database only. E2 test base establishes two synthetic owners.
ALTER TABLE public.health_athletes ADD COLUMN auth_user_id uuid REFERENCES auth.users(id);
UPDATE public.health_athletes SET auth_user_id=owner_auth_user_id;
INSERT INTO auth.users VALUES ('33333333-3333-4333-8333-333333333333');
-- Faithful copied M0 permission functions; no synthetic 'coach bypass' shortcut.
ALTER TABLE public.health_athletes ADD COLUMN status text NOT NULL DEFAULT 'active';
CREATE TABLE public.health_athlete_access(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 athlete_id uuid NOT NULL REFERENCES public.health_athletes(id),
 principal_auth_user_id uuid NOT NULL REFERENCES auth.users(id),
 access_role text NOT NULL CHECK(access_role IN('athlete','owner','coach','guardian')),
 can_read boolean NOT NULL DEFAULT true,can_write boolean NOT NULL DEFAULT false,
 can_manage_access boolean NOT NULL DEFAULT false,
 revoked_at timestamptz
);
-- Delegation to coach has all three permissions, but never equals subject identity.
INSERT INTO public.health_athlete_access(athlete_id,principal_auth_user_id,access_role,
 can_read,can_write,can_manage_access)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '33333333-3333-4333-8333-333333333333','coach',true,true,true);
-- Official M0 helper bodies (read/write/manage).
CREATE OR REPLACE FUNCTION public.health_can_read_athlete(p_athlete_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.health_athletes ha
        WHERE ha.id = p_athlete_id
          AND (ha.auth_user_id = auth.uid() OR ha.owner_auth_user_id = auth.uid())
          AND ha.status <> 'archived'
      )
      OR EXISTS (
        SELECT 1
        FROM public.health_athlete_access haa
        WHERE haa.athlete_id = p_athlete_id
          AND haa.principal_auth_user_id = auth.uid()
          AND haa.revoked_at IS NULL
          AND haa.can_read = true
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.health_can_write_athlete(p_athlete_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.health_athletes ha
        WHERE ha.id = p_athlete_id
          AND (ha.auth_user_id = auth.uid() OR ha.owner_auth_user_id = auth.uid())
          AND ha.status <> 'archived'
      )
      OR EXISTS (
        SELECT 1
        FROM public.health_athlete_access haa
        WHERE haa.athlete_id = p_athlete_id
          AND haa.principal_auth_user_id = auth.uid()
          AND haa.revoked_at IS NULL
          AND haa.can_write = true
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.health_can_manage_athlete_access(p_athlete_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.health_athletes ha
        WHERE ha.id = p_athlete_id
          AND (ha.auth_user_id = auth.uid() OR ha.owner_auth_user_id = auth.uid())
          AND ha.status <> 'archived'
      )
      OR EXISTS (
        SELECT 1
        FROM public.health_athlete_access haa
        WHERE haa.athlete_id = p_athlete_id
          AND haa.principal_auth_user_id = auth.uid()
          AND haa.revoked_at IS NULL
          AND haa.can_manage_access = true
      )
    );
$$;


GRANT EXECUTE ON FUNCTION public.health_can_read_athlete(uuid),
 public.health_can_write_athlete(uuid),
 public.health_can_manage_athlete_access(uuid) TO authenticated;

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
