-- Disposable database only; role and JWT fixtures are synthetic.
\if :{?d11_real_auth}
-- The consolidated candidate is applied later as a single local migration.
\else
\ir d11-policy-storage-schema.sql
\endif
ALTER TABLE public.shopee_oauth_connections ADD COLUMN shop_status text,
 ADD COLUMN authorization_expires_at timestamptz;
ALTER TABLE public.orders ADD COLUMN status text, ADD COLUMN operational_status text;
ALTER TABLE public.marketplace_raw_snapshots ADD COLUMN observed_at timestamptz;
\if :{?d11_real_auth}
\else
\ir d11-policy-lease-schema.sql
\ir d11-policy-acquire-candidate.sql
\endif
\ir ../../../../supabase/migrations/20261015233000_shopee_shipping_arrangement_idempotency.sql
\ir ../../../../supabase/migrations/20261111160000_f11_adao_shipping_claim_operational_state.sql
\ir ../../../../supabase/migrations/20261111180000_f11_adao_rejected_shipping_recovery.sql
\if :{?d11_real_auth}
\else
\ir d11-policy-claim-candidate.sql
\endif

\if :{?d11_real_auth}
-- Real Auth: use the existing local GoTrue auth schema and auth.uid().
\else
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
\endif
CREATE TABLE public.app_users(id uuid PRIMARY KEY,auth_user_id uuid,role text,is_active boolean);
\if :{?d11_real_auth}
-- The HTTP proof will create users through real GoTrue.
\else
INSERT INTO auth.users VALUES
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc'),('dddddddd-dddd-4ddd-8ddd-dddddddddddd'),('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
INSERT INTO public.app_users SELECT id,id,'Administrador',id<>'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' FROM auth.users;
\endif
-- Match the relevant RLS boundary observed in Core, even in synthetic CI.
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopee_oauth_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digital_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopee_oauth_connections ADD COLUMN fixture_ciphertext text;
-- Same registry constraints and privileges as canonical administrative capability.
CREATE TABLE public.app_admin_capabilities(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),auth_user_id uuid NOT NULL REFERENCES auth.users(id),
 capability text NOT NULL CHECK(capability IN ('provision_users','nucleo_manage')),
 active boolean NOT NULL DEFAULT true,granted_by_auth_user_id uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),revoked_at timestamptz,
 CHECK((active AND revoked_at IS NULL) OR NOT active));
CREATE UNIQUE INDEX app_admin_capabilities_active_uidx ON public.app_admin_capabilities(auth_user_id,capability) WHERE active;
ALTER TABLE public.app_admin_capabilities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_admin_capabilities FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.app_admin_capabilities TO authenticated;
CREATE POLICY app_admin_capabilities_select_own ON public.app_admin_capabilities FOR SELECT TO authenticated
 USING(auth_user_id=(SELECT auth.uid()) AND active AND revoked_at IS NULL);

\if :{?d11_real_auth}
\else
\ir d11-policy-authoring-candidate.sql
\endif

\if :{?d11_real_auth}
-- Real Auth identities and test grants are created after local sign-in.
\else
-- Solely synthetic author grant: no corresponding production grant is created.
INSERT INTO public.app_admin_capabilities(auth_user_id,capability) VALUES
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','shopee_manage_cycle_policy'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','provision_users'),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','shopee_manage_cycle_policy');
\endif
INSERT INTO public.channel_accounts(id,name,is_active,platform_id) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','D11 synthetic A',true,'11111111-1111-4111-8111-111111111111'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','D11 synthetic B',true,'11111111-1111-4111-8111-111111111111');
INSERT INTO public.shopee_oauth_connections(channel_account_id,shop_id,partner_id,environment,shop_status,authorization_expires_at) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',123,2047685,'live','NORMAL',clock_timestamp()+interval '1 day'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',456,2047685,'live','NORMAL',clock_timestamp()+interval '1 day');
CREATE FUNCTION public.d11_fixture_config() RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('capabilities','{"discover":true,"intake":true,"ship":true,"label":true,"refresh":false}'::jsonb,
 'page_size',5,'max_actions_per_cycle',1,'work_budget_ms',48000,
 'history_cutoff',floor(extract(epoch FROM date_trunc('day',now())))::bigint-86400,
 'expires_at',date_trunc('day',now())+interval '2 days','fiscal_mode','cpf_no_invoice_step',
 'shipping_mode','simple_dropoff','shipping_evidence_ref','fixture/logistics','document_type','NORMAL_AIR_WAYBILL');
$$;
-- Fixture helper is not an application function.
