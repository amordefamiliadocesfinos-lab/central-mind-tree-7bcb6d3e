\set ON_ERROR_STOP on
-- Self-contained PostgreSQL 17 sandbox. NEVER point this at the Core.
BEGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE TABLE public.app_admin_capabilities(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 auth_user_id uuid NOT NULL,
 capability text NOT NULL CHECK (capability IN ('provision_users','nucleo_manage')),
 active boolean NOT NULL DEFAULT true,
 revoked_at timestamptz
);
CREATE TABLE public.nucleo_development_workstreams(id bigint PRIMARY KEY,code text NOT NULL);
CREATE TABLE public.nucleo_development_evidence(id bigint PRIMARY KEY,workstream_id bigint NOT NULL);
CREATE TABLE public.nucleo_development_dependencies(id bigint PRIMARY KEY,workstream_id bigint NOT NULL);
INSERT INTO public.app_admin_capabilities(auth_user_id,capability,active) VALUES
('11111111-1111-4111-8111-111111111111','nucleo_manage',true),
('22222222-2222-4222-8222-222222222222','provision_users',true);
INSERT INTO public.nucleo_development_workstreams VALUES (1,'NUC'),(2,'NUC-M5');
INSERT INTO public.nucleo_development_evidence VALUES (10,2),(11,2);
INSERT INTO public.nucleo_development_dependencies VALUES (20,2);
GRANT SELECT ON public.app_admin_capabilities, public.nucleo_development_workstreams,
 public.nucleo_development_evidence, public.nucleo_development_dependencies TO authenticated;
ALTER TABLE public.app_admin_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nucleo_development_workstreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nucleo_development_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nucleo_development_dependencies ENABLE ROW LEVEL SECURITY;
-- Exact policy shape from Core's source-of-truth read policies; no service-role access.
CREATE POLICY app_admin_capabilities_select_own ON public.app_admin_capabilities
 FOR SELECT TO authenticated USING (auth_user_id = (SELECT auth.uid()) AND active = true AND revoked_at IS NULL);
CREATE POLICY nucleo_m3_workstreams_read ON public.nucleo_development_workstreams
 FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.app_admin_capabilities c WHERE c.auth_user_id=(SELECT auth.uid())
 AND c.capability='nucleo_manage' AND c.active AND c.revoked_at IS NULL));
CREATE POLICY nucleo_m4_evidence_read ON public.nucleo_development_evidence
 FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.app_admin_capabilities c WHERE c.auth_user_id=(SELECT auth.uid())
 AND c.capability='nucleo_manage' AND c.active AND c.revoked_at IS NULL));
CREATE POLICY nucleo_m3_dependencies_read ON public.nucleo_development_dependencies
 FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.app_admin_capabilities c WHERE c.auth_user_id=(SELECT auth.uid())
 AND c.capability='nucleo_manage' AND c.active AND c.revoked_at IS NULL));
COMMIT;

-- Stage 1: authenticated session can read exactly the seeded rows.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $assert$
BEGIN
 IF (SELECT count(*) FROM public.app_admin_capabilities WHERE capability='nucleo_manage')<>1
 OR (SELECT count(*) FROM public.nucleo_development_workstreams)<>2
 OR (SELECT count(*) FROM public.nucleo_development_evidence)<>2
 OR (SELECT count(*) FROM public.nucleo_development_dependencies)<>1
 THEN RAISE EXCEPTION 'Stage 1 expected authorized visibility'; END IF;
END $assert$;
COMMIT;
\echo PASS 1 authorized session reads all sandbox rows

-- Stage 2: user who only has provision_users cannot manage Nucleo.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
DO $assert$
BEGIN
 IF (SELECT count(*) FROM public.app_admin_capabilities WHERE capability='nucleo_manage')<>0
 OR (SELECT count(*) FROM public.nucleo_development_workstreams)<>0
 OR (SELECT count(*) FROM public.nucleo_development_evidence)<>0
 OR (SELECT count(*) FROM public.nucleo_development_dependencies)<>0
 THEN RAISE EXCEPTION 'Stage 2 privilege leakage'; END IF;
END $assert$;
COMMIT;
\echo PASS 2 provision_users does not imply nucleo_manage

-- Stage 3: external admin revokes during the already authenticated client's lifetime.
UPDATE public.app_admin_capabilities
 SET active=false,revoked_at=clock_timestamp()
 WHERE auth_user_id='11111111-1111-4111-8111-111111111111'
 AND capability='nucleo_manage';
-- Same database session and JWT user, no sign out, new statement/transaction.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $assert$
BEGIN
 IF (SELECT count(*) FROM public.app_admin_capabilities WHERE capability='nucleo_manage')<>0
 OR (SELECT count(*) FROM public.nucleo_development_workstreams)<>0
 OR (SELECT count(*) FROM public.nucleo_development_evidence)<>0
 OR (SELECT count(*) FROM public.nucleo_development_dependencies)<>0
 THEN RAISE EXCEPTION 'Stage 3 revocation did not propagate on fresh statement'; END IF;
END $assert$;
COMMIT;
\echo PASS 3 same authenticated session loses access after admin revocation

-- Stage 4: revocation affects no independent principals.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
DO $assert$
BEGIN
 IF (SELECT count(*) FROM public.nucleo_development_workstreams)<>0
 THEN RAISE EXCEPTION 'Stage 4 unexpected visibility'; END IF;
END $assert$;
COMMIT;
\echo PASS 4 third identity cannot read protected rows

-- Stage 5: restoration returns access only on a new RLS-authorized request.
UPDATE public.app_admin_capabilities SET active=true,revoked_at=NULL
 WHERE auth_user_id='11111111-1111-4111-8111-111111111111'
 AND capability='nucleo_manage';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $assert$
BEGIN
 IF (SELECT count(*) FROM public.app_admin_capabilities WHERE capability='nucleo_manage')<>1
 OR (SELECT count(*) FROM public.nucleo_development_workstreams)<>2
 OR (SELECT count(*) FROM public.nucleo_development_evidence)<>2
 THEN RAISE EXCEPTION 'Stage 5 regrant did not restore visibility'; END IF;
END $assert$;
COMMIT;
\echo PASS 5 regrant restores access on the next authorized request

-- Stage 6: authenticated role never gets table write privileges to the grant table.
DO $assert$
BEGIN
 IF has_table_privilege('authenticated','public.app_admin_capabilities','UPDATE')
 OR has_table_privilege('authenticated','public.app_admin_capabilities','DELETE')
 OR has_table_privilege('authenticated','public.app_admin_capabilities','INSERT')
 THEN RAISE EXCEPTION 'Stage 6 client can modify its own capability'; END IF;
END $assert$;
\echo PASS 6 client cannot grant/revoke itself
\echo M5 POSTGRES17 REVOCATION LAB: SIX STAGES PASS
