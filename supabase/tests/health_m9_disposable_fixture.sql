-- Disposable PostgreSQL fixture for M9. Never run in hosted Supabase.
CREATE SCHEMA IF NOT EXISTS auth;

DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true),'')::uuid
$$;

CREATE TABLE public.health_athletes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NULL REFERENCES auth.users(id),
  owner_auth_user_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'active'
);

CREATE TABLE public.health_athlete_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  principal_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_read boolean NOT NULL DEFAULT true,
  can_write boolean NOT NULL DEFAULT false,
  revoked_at timestamptz NULL
);

CREATE OR REPLACE FUNCTION public.health_can_read_athlete(p_athlete_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.health_athletes a
      WHERE a.id=p_athlete_id AND a.status <> 'archived'
        AND (a.auth_user_id=auth.uid() OR a.owner_auth_user_id=auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.health_athlete_access x
      WHERE x.athlete_id=p_athlete_id AND x.principal_auth_user_id=auth.uid()
        AND x.revoked_at IS NULL AND x.can_read=true
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.health_can_write_athlete(p_athlete_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.health_athletes a
      WHERE a.id=p_athlete_id AND a.status <> 'archived'
        AND (a.auth_user_id=auth.uid() OR a.owner_auth_user_id=auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.health_athlete_access x
      WHERE x.athlete_id=p_athlete_id AND x.principal_auth_user_id=auth.uid()
        AND x.revoked_at IS NULL AND x.can_write=true
    )
  )
$$;

REVOKE ALL ON FUNCTION public.health_can_read_athlete(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.health_can_write_athlete(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.health_can_read_athlete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.health_can_write_athlete(uuid) TO authenticated;
