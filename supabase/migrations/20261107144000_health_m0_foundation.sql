-- M0 Health foundation: athlete identity, access delegation, and private storage.
-- Scope intentionally minimal. No workout/nutrition/body facts are created here.

CREATE TABLE public.health_athletes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name text NOT NULL CHECK (btrim(display_name) <> ''),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  owner_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_by_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT health_athletes_one_login_per_subject UNIQUE (auth_user_id)
);

CREATE TABLE public.health_athlete_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  principal_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_role text NOT NULL CHECK (access_role IN ('athlete', 'owner', 'coach', 'guardian')),
  can_read boolean NOT NULL DEFAULT true,
  can_write boolean NOT NULL DEFAULT false,
  can_manage_access boolean NOT NULL DEFAULT false,
  granted_by_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT health_athlete_access_revocation_consistency CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

CREATE INDEX health_athletes_auth_user_idx
  ON public.health_athletes(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE UNIQUE INDEX health_athlete_access_one_active_principal
  ON public.health_athlete_access(athlete_id, principal_auth_user_id)
  WHERE revoked_at IS NULL;

CREATE INDEX health_athlete_access_principal_idx
  ON public.health_athlete_access(principal_auth_user_id, athlete_id)
  WHERE revoked_at IS NULL;

CREATE INDEX health_athlete_access_athlete_idx
  ON public.health_athlete_access(athlete_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.health_athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_athlete_access ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.health_athletes, public.health_athlete_access FROM PUBLIC, anon;
REVOKE ALL ON public.health_athletes, public.health_athlete_access FROM authenticated;

GRANT SELECT, INSERT ON public.health_athletes TO authenticated;
GRANT UPDATE (display_name, status, updated_at) ON public.health_athletes TO authenticated;

GRANT SELECT, INSERT, DELETE ON public.health_athlete_access TO authenticated;
GRANT UPDATE (
  access_role,
  can_read,
  can_write,
  can_manage_access,
  revoked_at,
  updated_at
) ON public.health_athlete_access TO authenticated;

-- Security helper functions live in public because this project exposes public.
-- EXECUTE is explicitly restricted; callers must still pass RLS on target tables.

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

REVOKE ALL ON FUNCTION public.health_can_read_athlete(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.health_can_write_athlete(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.health_can_manage_athlete_access(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.health_can_read_athlete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.health_can_write_athlete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.health_can_manage_athlete_access(uuid) TO authenticated;

-- A logged-in person may create their own athlete profile or a supervised
-- athlete without login. The creator is the initial owner in both cases.
CREATE POLICY health_athletes_insert_owned
ON public.health_athletes
FOR INSERT
TO authenticated
WITH CHECK (
  owner_auth_user_id = auth.uid()
  AND created_by_auth_user_id = auth.uid()
  AND (auth_user_id IS NULL OR auth_user_id = auth.uid())
);

CREATE POLICY health_athletes_select_authorized
ON public.health_athletes
FOR SELECT
TO authenticated
USING (public.health_can_read_athlete(id));

CREATE POLICY health_athletes_update_owner_or_subject
ON public.health_athletes
FOR UPDATE
TO authenticated
USING (
  auth_user_id = auth.uid()
  OR owner_auth_user_id = auth.uid()
)
WITH CHECK (
  auth_user_id = auth.uid()
  OR owner_auth_user_id = auth.uid()
);

-- Access rows are visible only to the subject or explicitly authorized principals.
CREATE POLICY health_athlete_access_select_authorized
ON public.health_athlete_access
FOR SELECT
TO authenticated
USING (
  principal_auth_user_id = auth.uid()
  OR public.health_can_manage_athlete_access(athlete_id)
  OR public.health_can_read_athlete(athlete_id)
);

-- Only the athlete subject or an explicit access manager may delegate access.
CREATE POLICY health_athlete_access_insert_manager
ON public.health_athlete_access
FOR INSERT
TO authenticated
WITH CHECK (
  granted_by_auth_user_id = auth.uid()
  AND public.health_can_manage_athlete_access(athlete_id)
);

CREATE POLICY health_athlete_access_update_manager
ON public.health_athlete_access
FOR UPDATE
TO authenticated
USING (public.health_can_manage_athlete_access(athlete_id))
WITH CHECK (
  public.health_can_manage_athlete_access(athlete_id)
  AND granted_by_auth_user_id IS NOT NULL
);

CREATE POLICY health_athlete_access_delete_manager
ON public.health_athlete_access
FOR DELETE
TO authenticated
USING (public.health_can_manage_athlete_access(athlete_id));

-- Private Health storage. All object paths must begin with athlete_id/.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'health-private',
  'health-private',
  false,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'application/pdf'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Expected path: <athlete_uuid>/<category>/<object_name>
-- Example: <athlete_uuid>/progress/<media_uuid>.jpg
CREATE POLICY health_private_storage_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'health-private'
  AND public.health_can_read_athlete(
    CASE
      WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN ((storage.foldername(name))[1])::uuid
      ELSE NULL
    END
  )
);

CREATE POLICY health_private_storage_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'health-private'
  AND public.health_can_write_athlete(
    CASE
      WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN ((storage.foldername(name))[1])::uuid
      ELSE NULL
    END
  )
);

CREATE POLICY health_private_storage_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'health-private'
  AND public.health_can_write_athlete(
    CASE
      WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN ((storage.foldername(name))[1])::uuid
      ELSE NULL
    END
  )
)
WITH CHECK (
  bucket_id = 'health-private'
  AND public.health_can_write_athlete(
    CASE
      WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN ((storage.foldername(name))[1])::uuid
      ELSE NULL
    END
  )
);

CREATE POLICY health_private_storage_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'health-private'
  AND public.health_can_write_athlete(
    CASE
      WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN ((storage.foldername(name))[1])::uuid
      ELSE NULL
    END
  )
);
