-- D11 lease proof, on the same disposable DB as existing cycle tests.
BEGIN;
\ir d11-policy-storage-schema.sql
ALTER TABLE public.shopee_oauth_connections ADD COLUMN shop_status text,
  ADD COLUMN authorization_expires_at timestamptz;
\ir d11-policy-lease-schema.sql
\ir d11-policy-acquire-candidate.sql
\ir d11-preflight-lifecycle-candidate.sql

INSERT INTO public.channel_accounts(id,name,is_active,platform_id) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','D11 synthetic A',true,'11111111-1111-4111-8111-111111111111'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','D11 synthetic B',true,'11111111-1111-4111-8111-111111111111'),
('b4027369-5abf-4ac1-ab24-862334fae892','SHOPEE ADÃO',true,'11111111-1111-4111-8111-111111111111');
INSERT INTO public.shopee_oauth_connections(channel_account_id,shop_id,partner_id,environment,shop_status,authorization_expires_at) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',123,2047685,'live','NORMAL',clock_timestamp()+interval '1 day'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',456,2047685,'live','NORMAL',clock_timestamp()+interval '1 day'),
('b4027369-5abf-4ac1-ab24-862334fae892',1156446003,2047685,'live','NORMAL',clock_timestamp()+interval '1 day');

DO $$
DECLARE a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
BEGIN
 ASSERT public.acquire_shopee_cycle(a)->>'status'='account_refused';
 ASSERT NOT EXISTS(SELECT 1 FROM public.shopee_cycle_state WHERE channel_account_id=a);
 ASSERT NOT has_function_privilege('anon','public.read_shopee_cycle_policy(uuid)','EXECUTE');
 ASSERT NOT has_function_privilege('authenticated','public.check_shopee_cycle_policy_lease(uuid,uuid,integer,text)','EXECUTE');
 ASSERT NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.read_shopee_cycle_policy(uuid)'::regprocedure);
END $$;

INSERT INTO public.shopee_cycle_policy_revisions
(channel_account_id,revision,environment,shop_id,partner_id,history_cutoff,enabled,paused,capabilities,
 authorized_by,authorized_at,expires_at,evidence_ref)
SELECT ca.id,1,'live',oc.shop_id,2047685,floor(extract(epoch FROM clock_timestamp()))::bigint-3600,
 true,false,'{"discover":true,"intake":false,"ship":false,"label":false,"refresh":false}'::jsonb,
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '4 minutes','fixture/proof'
FROM public.channel_accounts ca JOIN public.shopee_oauth_connections oc ON oc.channel_account_id=ca.id
WHERE ca.id IN ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

SET LOCAL ROLE service_role;
DO $$
DECLARE a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 x jsonb; y jsonb; l uuid; l2 uuid;
BEGIN
 x:=public.acquire_shopee_cycle(a); l:=(x->>'lease_id')::uuid;
 ASSERT x->>'status'='acquired' AND x->>'policy_revision'='1';
 ASSERT (x->>'expires_at')::timestamptz <=
   (SELECT expires_at FROM public.shopee_cycle_policy_revisions WHERE channel_account_id=a);
 ASSERT public.acquire_shopee_cycle(a)->>'status'='busy';
 y:=public.acquire_shopee_cycle(b); l2:=(y->>'lease_id')::uuid;
 ASSERT y->>'status'='acquired' AND l<>l2;
 ASSERT public.check_shopee_cycle_policy_lease(a,l,1,'discover');
 ASSERT NOT public.check_shopee_cycle_policy_lease(a,l,1,'ship');
 ASSERT NOT public.check_shopee_cycle_policy_lease(b,l,1,'discover');
 ASSERT NOT public.check_shopee_cycle_policy_lease(a,l,2,'discover');
 ASSERT public.check_shopee_cycle_policy_lease(b,l2,1,'discover');
END $$;
RESET ROLE;

-- Simulate an append-only revocation by the fixture owner, NOT a real writer.
INSERT INTO public.shopee_cycle_policy_revisions(channel_account_id,revision,environment,shop_id,partner_id,history_cutoff)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',2,'live',123,2047685,1);
SET LOCAL ROLE service_role;
DO $$
DECLARE a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; l uuid; l2 uuid; x jsonb;
BEGIN
 SELECT lease_id INTO l FROM public.shopee_cycle_state WHERE channel_account_id=a;
 SELECT lease_id INTO l2 FROM public.shopee_cycle_state WHERE channel_account_id=b;
 ASSERT (public.read_shopee_cycle_policy(a)->'policy'->>'revision')='2';
 ASSERT NOT public.check_shopee_cycle_policy_lease(a,l,1,'discover');
 ASSERT public.acquire_shopee_cycle(a)->>'status'='account_refused';
 ASSERT public.check_shopee_cycle_policy_lease(b,l2,1,'discover');
 ASSERT public.finish_shopee_cycle(a,l,null,null,'pending','policy_paused')->>'status'='finished';
 ASSERT NOT public.check_shopee_cycle_policy_lease(a,l,1,'discover');
 ASSERT public.finish_shopee_cycle(b,l2,null,null,'pending','discovered')->>'status'='finished';
 x:=public.acquire_shopee_cycle('b4027369-5abf-4ac1-ab24-862334fae892');
 ASSERT x->>'status'='acquired' AND NOT (x ? 'policy_revision');
END $$;
RESET ROLE;

-- Lifecycle proof: discover-only policy cannot admit preflight.
SET LOCAL ROLE service_role;
DO $$ BEGIN
 ASSERT public.acquire_shopee_d11_preflight('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')->>'status'='account_refused';
 ASSERT public.acquire_shopee_d11_preflight('b4027369-5abf-4ac1-ab24-862334fae892')->>'status'='account_refused';
 ASSERT NOT has_function_privilege('authenticated','public.acquire_shopee_d11_preflight(uuid)','EXECUTE');
 ASSERT NOT has_function_privilege('anon','public.finish_shopee_d11_preflight(uuid,uuid,integer,text,text)','EXECUTE');
END $$;
RESET ROLE;
INSERT INTO public.shopee_cycle_policy_revisions
(channel_account_id,revision,environment,shop_id,partner_id,history_cutoff,enabled,paused,capabilities,
 authorized_by,authorized_at,expires_at,evidence_ref)
SELECT channel_account_id,2,environment,shop_id,partner_id,history_cutoff,true,false,
 '{"discover":true,"intake":true,"ship":false,"label":false,"refresh":false}'::jsonb,
 authorized_by,clock_timestamp(),clock_timestamp()+interval '4 minutes',evidence_ref
 FROM public.shopee_cycle_policy_revisions WHERE channel_account_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND revision=1;
SET LOCAL ROLE service_role;
DO $$ DECLARE b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; x jsonb; l uuid;
BEGIN
 x:=public.acquire_shopee_d11_preflight(b);l:=(x->>'lease_id')::uuid;
 ASSERT x->>'status'='acquired' AND x->>'policy_revision'='2' AND x->>'candidate_order_sn' IS NULL;
 ASSERT public.acquire_shopee_d11_preflight(b)->>'status'='busy';
 ASSERT public.finish_shopee_d11_preflight(b,l,1,NULL,'d11_preflight_no_candidate')->>'status'='stale_lease';
 ASSERT public.finish_shopee_d11_preflight(b,l,2,NULL,'complete')->>'status'='invalid_request';
 ASSERT public.finish_shopee_d11_preflight(b,l,2,NULL,'d11_preflight_no_candidate')->>'status'='finished';
 ASSERT public.finish_shopee_d11_preflight(b,l,2,NULL,'d11_preflight_no_candidate')->>'status'='stale_lease';
END $$;
RESET ROLE;
INSERT INTO public.shopee_cycle_orders(channel_account_id,order_sn) VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','D11SYNTHETIC1');
SET LOCAL ROLE service_role;
DO $$ DECLARE b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; x jsonb; l uuid;
BEGIN
 x:=public.acquire_shopee_d11_preflight(b);l:=(x->>'lease_id')::uuid;
 ASSERT x->>'candidate_order_sn'='D11SYNTHETIC1';
 ASSERT public.finish_shopee_d11_preflight(b,l,2,'OTHERORDER1','d11_preflight_verified_existing')->>'status'='stale_lease';
 ASSERT public.finish_shopee_d11_preflight(b,l,2,'D11SYNTHETIC1','d11_preflight_no_candidate')->>'status'='invalid_request';
END $$;
RESET ROLE;
INSERT INTO public.shopee_cycle_policy_revisions(channel_account_id,revision,environment,shop_id,partner_id,history_cutoff)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',3,'live',456,2047685,1);
SET LOCAL ROLE service_role;
DO $$ DECLARE b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; l uuid; before_row jsonb; after_row jsonb;
BEGIN
 SELECT lease_id,to_jsonb(s) INTO l,before_row FROM public.shopee_cycle_state s WHERE channel_account_id=b;
 ASSERT NOT public.check_shopee_cycle_policy_lease(b,l,2,'intake');
 ASSERT public.finish_shopee_d11_preflight(b,l,2,'D11SYNTHETIC1','d11_preflight_scope_refused')->>'status'='finished';
 SELECT to_jsonb(s) INTO after_row FROM public.shopee_cycle_state s WHERE channel_account_id=b;
 ASSERT before_row->'time_from'=after_row->'time_from' AND before_row->'time_to'=after_row->'time_to' AND before_row->'cursor'=after_row->'cursor';
 ASSERT (SELECT state FROM public.shopee_cycle_orders WHERE channel_account_id=b AND order_sn='D11SYNTHETIC1')='pending';
 ASSERT public.acquire_shopee_d11_preflight(b)->>'status'='account_refused';
END $$;
RESET ROLE;

-- Legacy Viviane retains original contract, including rejection of wrong shop.
UPDATE public.shopee_oauth_connections SET shop_id=999 WHERE channel_account_id='8a8ad166-0317-4597-8be6-e43fb46b4d1b';
DO $$ BEGIN
 ASSERT public.acquire_shopee_cycle('8a8ad166-0317-4597-8be6-e43fb46b4d1b')->>'status'='account_refused';
END $$;
-- Duplicate official connections and expired authorization fail closed.
INSERT INTO public.shopee_oauth_connections SELECT * FROM public.shopee_oauth_connections
 WHERE channel_account_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
DO $$ BEGIN
 ASSERT public.acquire_shopee_cycle('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')->>'status'='account_refused';
END $$;
ROLLBACK;
SELECT 'D11 protected reader + existing lease revision proof passed (rolled back)' AS result;
