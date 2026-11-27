-- D11 disposable PostgreSQL prototype only. Not a migration; no production seed.
-- Run after cycle-fixture.sql in the existing CI service. All objects rolled back.
BEGIN;

\ir d11-policy-storage-schema.sql

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
