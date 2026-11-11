\set ON_ERROR_STOP on
-- Simula APENAS contratos mínimos necessários. Banco descartável do GitHub Actions.
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $roles$;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO authenticated,anon;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
CREATE TABLE public.app_admin_capabilities (
 id uuid primary key default gen_random_uuid(),
 auth_user_id uuid not null,
 capability text not null check(capability in ('provision_users')),
 active boolean not null default true,
 granted_by_auth_user_id uuid,
 created_at timestamptz not null default now(),
 revoked_at timestamptz,
 check ((active = true and revoked_at is null) or active=false)
);
CREATE UNIQUE INDEX app_admin_capabilities_active_uidx ON public.app_admin_capabilities(auth_user_id,capability) WHERE active=true;
ALTER TABLE public.app_admin_capabilities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_admin_capabilities FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.app_admin_capabilities TO authenticated;
CREATE POLICY app_admin_capabilities_select_own ON public.app_admin_capabilities
FOR SELECT TO authenticated USING (auth_user_id=(SELECT auth.uid()) AND active=true AND revoked_at IS NULL);
-- Não armazenar identidades de usuários reais nos testes.
INSERT INTO public.app_admin_capabilities(auth_user_id,capability)
VALUES
 ('11111111-1111-4111-8111-111111111111','provision_users'),
 ('22222222-2222-4222-8222-222222222222','provision_users');
