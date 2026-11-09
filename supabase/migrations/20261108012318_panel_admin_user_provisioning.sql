-- Panel Central: dedicated capability for privileged Auth user provisioning.
-- Authorization is intentionally separate from operational app_users.role.

CREATE TABLE public.app_admin_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  capability text NOT NULL CHECK (capability IN ('provision_users')),
  active boolean NOT NULL DEFAULT true,
  granted_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz NULL,
  CHECK (
    (active = true AND revoked_at IS NULL)
    OR (active = false)
  )
);

CREATE UNIQUE INDEX app_admin_capabilities_active_uidx
ON public.app_admin_capabilities(auth_user_id, capability)
WHERE active = true;

CREATE INDEX app_admin_capabilities_auth_user_idx
ON public.app_admin_capabilities(auth_user_id, capability, active);

ALTER TABLE public.app_admin_capabilities ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.app_admin_capabilities
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.app_admin_capabilities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_admin_capabilities TO service_role;

CREATE POLICY app_admin_capabilities_select_own
ON public.app_admin_capabilities
FOR SELECT
TO authenticated
USING (
  auth_user_id = (select auth.uid())
  AND active = true
  AND revoked_at IS NULL
);

-- Bootstrap the current Panel Central administrator only.
INSERT INTO public.app_admin_capabilities (
  auth_user_id,
  capability,
  active,
  granted_by_auth_user_id
)
VALUES (
  '701c0612-a2da-4a8e-b9f1-4322d801ca8c',
  'provision_users',
  true,
  '701c0612-a2da-4a8e-b9f1-4322d801ca8c'
)
ON CONFLICT DO NOTHING;
