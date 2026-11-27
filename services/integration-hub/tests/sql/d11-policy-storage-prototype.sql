-- D11 disposable PostgreSQL prototype only. Not a migration; no production seed.
-- Run after cycle-fixture.sql in the existing CI service. All objects rolled back.
BEGIN;

CREATE TABLE public.shopee_cycle_policy_revisions (
  channel_account_id uuid NOT NULL REFERENCES public.channel_accounts(id),
  revision integer NOT NULL CHECK(revision > 0),
  environment text NOT NULL CHECK(environment = 'live'),
  shop_id bigint NOT NULL CHECK(shop_id > 0),
  partner_id bigint NOT NULL CHECK(partner_id = 2047685),
  enabled boolean NOT NULL DEFAULT false,
  paused boolean NOT NULL DEFAULT true,
  capabilities jsonb NOT NULL DEFAULT '{"discover":false,"intake":false,"ship":false,"label":false,"refresh":false}'::jsonb,
  page_size integer NOT NULL DEFAULT 5 CHECK(page_size BETWEEN 1 AND 5),
  max_actions_per_cycle integer NOT NULL DEFAULT 1 CHECK(max_actions_per_cycle BETWEEN 1 AND 3),
  work_budget_ms integer NOT NULL DEFAULT 48000 CHECK(work_budget_ms BETWEEN 1 AND 48000),
  history_cutoff bigint NOT NULL CHECK(history_cutoff > 0),
  fiscal_mode text,
  shipping_mode text,
  document_type text,
  authorized_by uuid,
  authorized_at timestamptz,
  expires_at timestamptz,
  evidence_ref text,
  shipping_evidence_ref text,
  PRIMARY KEY(channel_account_id,revision),
  CHECK (jsonb_typeof(capabilities)='object'
    AND capabilities ?& ARRAY['discover','intake','ship','label','refresh']
    AND capabilities - ARRAY['discover','intake','ship','label','refresh'] = '{}'::jsonb
    AND jsonb_typeof(capabilities->'discover')='boolean'
    AND jsonb_typeof(capabilities->'intake')='boolean'
    AND jsonb_typeof(capabilities->'ship')='boolean'
    AND jsonb_typeof(capabilities->'label')='boolean'
    AND jsonb_typeof(capabilities->'refresh')='boolean'),
  CHECK ((capabilities->'intake')<>'true'::jsonb OR (capabilities->'discover')='true'::jsonb),
  CHECK ((capabilities->'ship')<>'true'::jsonb OR (capabilities->'intake')='true'::jsonb),
  CHECK ((capabilities->'label')<>'true'::jsonb OR (capabilities->'intake')='true'::jsonb),
  CHECK ((capabilities->'refresh')<>'true'::jsonb OR (capabilities->'discover')='true'::jsonb),
  CHECK (NOT enabled OR (authorized_by IS NOT NULL AND authorized_at IS NOT NULL
    AND expires_at IS NOT NULL AND expires_at>authorized_at
    AND evidence_ref IS NOT NULL AND length(btrim(evidence_ref)) BETWEEN 1 AND 300)),
  CHECK ((capabilities->'ship')<>'true'::jsonb OR (fiscal_mode IS NOT NULL
    AND fiscal_mode IN ('cpf_no_invoice_step','pj_shopee_issuer')
    AND shipping_mode IS NOT NULL AND shipping_mode='simple_dropoff'
    AND shipping_evidence_ref IS NOT NULL AND length(btrim(shipping_evidence_ref)) BETWEEN 1 AND 300)),
  CHECK ((capabilities->'label')<>'true'::jsonb OR
    (document_type IS NOT NULL AND document_type='NORMAL_AIR_WAYBILL'))
);

ALTER TABLE public.shopee_cycle_policy_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shopee_cycle_policy_revisions FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.shopee_cycle_policy_revisions TO service_role;

-- The fixture owner may insert synthetic revision records for testing. There
-- is deliberately no application writer, authorization bypass, or live row.
INSERT INTO public.channel_accounts(id,name,is_active,platform_id)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','D11 SYNTHETIC',true,'11111111-1111-4111-8111-111111111111');
INSERT INTO public.shopee_cycle_policy_revisions
(channel_account_id,revision,environment,shop_id,partner_id,history_cutoff)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'live',123,2047685,1795800000);

DO $$
DECLARE role_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.shopee_cycle_policy_revisions
     WHERE enabled OR NOT paused OR capabilities <> '{"discover":false,"intake":false,"ship":false,"label":false,"refresh":false}'::jsonb)
  THEN RAISE EXCEPTION 'default-off failed'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.shopee_cycle_policy_revisions'::regclass)
  THEN RAISE EXCEPTION 'RLS not enabled'; END IF;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF has_table_privilege(role_name,'public.shopee_cycle_policy_revisions','SELECT')
       OR has_table_privilege(role_name,'public.shopee_cycle_policy_revisions','INSERT')
       OR has_table_privilege(role_name,'public.shopee_cycle_policy_revisions','UPDATE')
       OR has_table_privilege(role_name,'public.shopee_cycle_policy_revisions','DELETE')
    THEN RAISE EXCEPTION 'unexpected public role privilege: %',role_name; END IF;
  END LOOP;
  IF NOT has_table_privilege('service_role','public.shopee_cycle_policy_revisions','SELECT')
     OR has_table_privilege('service_role','public.shopee_cycle_policy_revisions','INSERT')
     OR has_table_privilege('service_role','public.shopee_cycle_policy_revisions','UPDATE')
     OR has_table_privilege('service_role','public.shopee_cycle_policy_revisions','DELETE')
  THEN RAISE EXCEPTION 'service role must be read-only'; END IF;
  BEGIN
    UPDATE public.shopee_cycle_policy_revisions SET enabled=true;
    RAISE EXCEPTION 'enabled without authority accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.shopee_cycle_policy_revisions SET capabilities='{"discover":false,"intake":false,"ship":true,"label":false,"refresh":false}';
    RAISE EXCEPTION 'invalid dependencies accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.shopee_cycle_policy_revisions SET capabilities='{"discover":true,"intake":true,"ship":true,"label":false,"refresh":false}';
    RAISE EXCEPTION 'missing fiscal/logistics evidence accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.shopee_cycle_policy_revisions SET capabilities='{"discover":true,"intake":true,"ship":false,"label":true,"refresh":false}';
    RAISE EXCEPTION 'unsupported document accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.shopee_cycle_policy_revisions SET max_actions_per_cycle=4;
    RAISE EXCEPTION 'unsafe limit accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.shopee_cycle_policy_revisions
    (channel_account_id,revision,environment,shop_id,partner_id,history_cutoff)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'live',123,2047685,1795800000);
    RAISE EXCEPTION 'duplicate revision accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;

-- A subsequent revision can pause an account without editing the old record.
-- This is a synthetic owner fixture, not a design for authorizing writes.
INSERT INTO public.shopee_cycle_policy_revisions
(channel_account_id,revision,environment,shop_id,partner_id,history_cutoff)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',2,'live',123,2047685,1795800000);

SET LOCAL ROLE service_role;
DO $$
BEGIN
  IF (SELECT revision FROM public.shopee_cycle_policy_revisions
      WHERE channel_account_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      ORDER BY revision DESC LIMIT 1)<>2
  THEN RAISE EXCEPTION 'latest revision unavailable'; END IF;
  BEGIN
    UPDATE public.shopee_cycle_policy_revisions SET paused=false;
    RAISE EXCEPTION 'service role write unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'D11 protected policy storage prototype passed (rolled back)' AS result;
