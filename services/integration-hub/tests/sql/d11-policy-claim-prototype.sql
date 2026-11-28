-- Runs only in the existing disposable PostgreSQL job; rollback all changes.
BEGIN;
\ir d11-policy-storage-schema.sql
ALTER TABLE public.shopee_oauth_connections ADD COLUMN shop_status text,
  ADD COLUMN authorization_expires_at timestamptz;
ALTER TABLE public.orders ADD COLUMN status text, ADD COLUMN operational_status text;
\ir d11-observation-raw-fixture.sql
\ir d11-policy-lease-schema.sql
\ir d11-policy-acquire-candidate.sql
\ir ../../../../supabase/migrations/20261015233000_shopee_shipping_arrangement_idempotency.sql
\ir ../../../../supabase/migrations/20261111160000_f11_adao_shipping_claim_operational_state.sql
\ir ../../../../supabase/migrations/20261111180000_f11_adao_rejected_shipping_recovery.sql
\ir d11-observation-candidate.sql
\ir d11-policy-claim-candidate.sql
\ir d11-preflight-lifecycle-candidate.sql
\ir d11-observation-fixture-helper.sql
-- Disposable fault injection: failure to bind must roll back the fresh claim.
CREATE FUNCTION public.d11_fixture_reject_binding() RETURNS trigger LANGUAGE plpgsql AS $fault$
BEGIN
 IF current_setting('d11.fixture_reject_binding',true)='on' AND NEW.d11_observation_id IS NOT NULL
 THEN RAISE EXCEPTION 'fixture_binding_failure'; END IF;
 RETURN NEW;
END $fault$;
CREATE TRIGGER d11_fixture_binding_failure BEFORE UPDATE ON public.shopee_shipping_arrangement_attempts
 FOR EACH ROW EXECUTE FUNCTION public.d11_fixture_reject_binding();

INSERT INTO public.channel_accounts(id,name,is_active,platform_id) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','D11 synthetic A',true,'11111111-1111-4111-8111-111111111111'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','D11 synthetic B',true,'11111111-1111-4111-8111-111111111111');
INSERT INTO public.shopee_oauth_connections(channel_account_id,shop_id,partner_id,environment,shop_status,authorization_expires_at) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',123,2047685,'live','NORMAL',clock_timestamp()+interval '1 day'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',456,2047685,'live','NORMAL',clock_timestamp()+interval '1 day');
INSERT INTO public.shopee_cycle_policy_revisions
(channel_account_id,revision,environment,shop_id,partner_id,history_cutoff,enabled,paused,capabilities,
 authorized_by,authorized_at,expires_at,evidence_ref,fiscal_mode,shipping_mode,shipping_evidence_ref,document_type,max_actions_per_cycle)
SELECT ca.id,1,'live',oc.shop_id,2047685,floor(extract(epoch FROM clock_timestamp()))::bigint-3600,
 true,false,'{"discover":true,"intake":true,"ship":true,"label":true,"refresh":false}'::jsonb,
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '4 minutes',
 'fixture/proof','cpf_no_invoice_step','simple_dropoff','fixture/logistics','NORMAL_AIR_WAYBILL',CASE WHEN oc.shop_id=123 THEN 2 ELSE 1 END
FROM public.channel_accounts ca JOIN public.shopee_oauth_connections oc ON oc.channel_account_id=ca.id
WHERE ca.id IN ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO public.shopee_cycle_orders(channel_account_id,order_sn) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','D11SYNTHETIC1'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','D11SYNTHETIC1');
INSERT INTO public.orders(id,channel_account_id,order_number,channel,sale_origin,deleted_at,status,operational_status) VALUES
('dddddddd-dddd-4ddd-8ddd-dddddddddddd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','D11SYNTHETIC1','shopee','shopee_open_platform',null,'pendente','todo'),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','D11SYNTHETIC1','shopee','shopee_open_platform',null,'pendente','todo');
DO $$ BEGIN
 ASSERT NOT has_function_privilege('anon','public.claim_shopee_cycle_effect(uuid,uuid,integer,text,bigint,text,text,text,uuid)','EXECUTE');
 ASSERT NOT has_function_privilege('authenticated','public.claim_shopee_cycle_effect(uuid,uuid,integer,text,bigint,text,text,text,uuid)','EXECUTE');
 ASSERT NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.claim_shopee_cycle_effect(uuid,uuid,integer,text,bigint,text,text,text,uuid)'::regprocedure);
END $$;
SET LOCAL ROLE service_role;
DO $$
DECLARE a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; l uuid; x jsonb; obs uuid:='ffffffff-ffff-4fff-8fff-ffffffffffff';
BEGIN
 x:=public.acquire_shopee_cycle(a); l:=(x->>'lease_id')::uuid;
 ASSERT x->>'candidate_order_sn'='D11SYNTHETIC1';
 ASSERT public.acquire_shopee_cycle(b)->>'status'='acquired';
 ASSERT public.claim_shopee_cycle_effect(b,l,1,'ship',456,'D11SYNTHETIC1','PKG1',repeat('a',64),obs)->>'status'='policy_lease_refused';
 ASSERT public.claim_shopee_cycle_effect(a,l,2,'ship',123,'D11SYNTHETIC1','PKG1',repeat('a',64),obs)->>'status'='policy_lease_refused';
 ASSERT public.claim_shopee_cycle_effect(a,l,1,'ship',456,'D11SYNTHETIC1','PKG1',repeat('a',64),obs)->>'status'='policy_admission_refused';
 ASSERT public.claim_shopee_cycle_effect(a,l,1,'ship',123,'D11SYNTHETIC2','PKG1',repeat('a',64),obs)->>'status'='policy_lease_refused';
 ASSERT public.claim_shopee_cycle_effect(a,l,1,'ship',123,'D11SYNTHETIC1','PKG1',repeat('a',64),obs)->>'status'='policy_observation_refused';
END $$;
RESET ROLE;

INSERT INTO public.marketplace_raw_snapshots(channel_account_id,source,environment,external_entity_type,endpoint,external_entity_id,payload,payload_hash,observed_at)
SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','shopee_open_platform','live','order','/api/v2/order/get_order_detail','D11SYNTHETIC1',
 jsonb_build_object('response',jsonb_build_object('order_list',jsonb_build_array(jsonb_build_object(
 'order_sn','D11SYNTHETIC1','create_time',floor(extract(epoch FROM clock_timestamp()))::bigint-60,
 'order_status','READY_TO_SHIP','split_up',false,'package_list',jsonb_build_array(jsonb_build_object('package_number','PKG1','logistics_status','LOGISTICS_READY')))))),
 repeat('a',64),clock_timestamp()-interval '1 minute';

SET LOCAL ROLE service_role;
DO $$
DECLARE a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; l uuid; x jsonb; attempt uuid; obs uuid; old_obs uuid;
BEGIN
 SELECT lease_id INTO l FROM public.shopee_cycle_state WHERE channel_account_id=a;
 ASSERT public.claim_shopee_cycle_effect(a,l,1,'ship',123,'D11SYNTHETIC1','PKG1',repeat('a',64),'ffffffff-ffff-4fff-8fff-ffffffffffff')->>'status'='policy_observation_refused';
 old_obs:=public.d11_fixture_observe(a,'fixture_claim_1');
 obs:=public.d11_fixture_observe(a,'fixture_claim_2');
 ASSERT old_obs<>obs;
 ASSERT public.claim_shopee_cycle_effect(a,l,1,'ship',123,'D11SYNTHETIC1','PKG1',repeat('a',64),NULL)->>'status'='invalid_request';
 ASSERT (SELECT count(*) FROM public.marketplace_raw_snapshots WHERE channel_account_id=a)=1;
 ASSERT (SELECT count(*) FROM public.shopee_cycle_observations WHERE channel_account_id=a)=2;
 ASSERT (SELECT observed_at FROM public.marketplace_raw_snapshots WHERE channel_account_id=a)<(SELECT updated_at FROM public.shopee_cycle_state WHERE channel_account_id=a);
 ASSERT public.claim_shopee_cycle_effect(a,l,1,'ship',123,'D11SYNTHETIC1','PKG1',repeat('a',64),old_obs)->>'status'='policy_observation_refused';
 ASSERT public.claim_shopee_cycle_effect(a,l,1,'label',123,'D11SYNTHETIC1','PKG1',repeat('b',64),obs)->>'status'='policy_external_state_refused';
 ASSERT public.claim_shopee_cycle_effect(a,l,1,'ship',123,'D11SYNTHETIC1','OTHERPKG',repeat('a',64),obs)->>'status'='policy_history_or_package_refused';
 BEGIN
   PERFORM set_config('d11.fixture_reject_binding','on',true);
   PERFORM public.claim_shopee_cycle_effect(a,l,1,'ship',123,'D11SYNTHETIC1','PKG1',repeat('a',64),obs);
   RAISE EXCEPTION 'fixture binding failure unexpectedly accepted';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM<>'fixture_binding_failure' THEN RAISE; END IF;
 END;
 ASSERT NOT EXISTS(SELECT 1 FROM public.shopee_shipping_arrangement_attempts WHERE channel_account_id=a);
 x:=public.claim_shopee_cycle_effect(a,l,1,'ship',123,'D11SYNTHETIC1','PKG1',repeat('a',64),obs);
 ASSERT x->>'status'='claimed' AND (x->>'fresh')::boolean; attempt:=(x->>'attempt_id')::uuid;
 ASSERT public.claim_shopee_cycle_effect(a,l,1,'ship',123,'D11SYNTHETIC1','PKG1',repeat('a',64),obs)->>'status'='already_claimed';
 ASSERT EXISTS(SELECT 1 FROM public.shopee_shipping_arrangement_attempts WHERE id=attempt
   AND d11_observation_id=obs AND d11_lease_id=l AND d11_policy_revision=1);
 BEGIN
   UPDATE public.shopee_shipping_arrangement_attempts SET d11_observation_id=old_obs WHERE id=attempt;
   RAISE EXCEPTION 'binding mutation unexpectedly accepted';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM<>'d11_attempt_binding_immutable' THEN RAISE; END IF;
 END;
 ASSERT public.resolve_shopee_d11_effect(a,l,1,old_obs,'ship',attempt,repeat('a',64),'uncertain')->>'status'='effect_binding_refused';
 ASSERT public.resolve_shopee_d11_effect(a,l,1,obs,'ship',attempt,repeat('a',64),'uncertain')->>'state'='uncertain';
 ASSERT EXISTS(SELECT 1 FROM public.shopee_shipping_arrangement_attempts WHERE id=attempt AND d11_observation_id=obs AND state='uncertain');
 ASSERT public.claim_shopee_cycle_effect(a,l,1,'ship',123,'D11SYNTHETIC1','PKG1',repeat('a',64),obs)->>'status'='uncertain_requires_reconciliation';
 ASSERT public.claim_shopee_cycle_effect(a,l,1,'ship',123,'D11SYNTHETIC1','PKG1',repeat('c',64),obs)->>'status'='claim_fingerprint_mismatch';
 ASSERT (SELECT count(*) FROM public.shopee_shipping_arrangement_attempts WHERE channel_account_id=a)=1;
END $$;
RESET ROLE;

-- A changed package must not reopen an uncertain shipment.
INSERT INTO public.marketplace_raw_snapshots(channel_account_id,source,environment,external_entity_type,endpoint,external_entity_id,payload,payload_hash,observed_at)
SELECT channel_account_id,source,environment,external_entity_type,endpoint,external_entity_id,
 jsonb_set(payload,'{response,order_list,0,package_list,0,package_number}','"PKG2"'),repeat('b',64),clock_timestamp()
 FROM public.marketplace_raw_snapshots WHERE channel_account_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND payload_hash=repeat('a',64);
SET LOCAL ROLE service_role;
DO $$
DECLARE a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; l uuid; obs uuid;
BEGIN
 SELECT lease_id INTO l FROM public.shopee_cycle_state WHERE channel_account_id=a;
 SELECT id INTO obs FROM public.shopee_cycle_observations WHERE channel_account_id=a ORDER BY recorded_at DESC LIMIT 1;
 ASSERT public.claim_shopee_cycle_effect(a,l,1,'ship',123,'D11SYNTHETIC1','PKG1',repeat('a',64),obs)->>'status'='policy_observation_refused';
 obs:=public.d11_fixture_observe(a,'fixture_claim_3');
 ASSERT public.claim_shopee_cycle_effect(a,l,1,'ship',123,'D11SYNTHETIC1','PKG2',repeat('a',64),obs)->>'status'='policy_prior_scope_requires_reconciliation';
END $$;
RESET ROLE;
-- Independently observed PROCESSED does not prove the uncertain POST caused it.
INSERT INTO public.marketplace_raw_snapshots(channel_account_id,source,environment,external_entity_type,endpoint,external_entity_id,payload,payload_hash,observed_at)
SELECT channel_account_id,source,environment,external_entity_type,endpoint,external_entity_id,
 jsonb_set(jsonb_set(payload,'{response,order_list,0,order_status}','"PROCESSED"'),'{response,order_list,0,package_list,0,logistics_status}','"LOGISTICS_REQUEST_CREATED"'),
 repeat('c',64),clock_timestamp() FROM public.marketplace_raw_snapshots
 WHERE channel_account_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND payload_hash=repeat('a',64);
SET LOCAL ROLE service_role;
DO $$
DECLARE a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; l uuid; x jsonb; obs uuid;
BEGIN
 SELECT lease_id INTO l FROM public.shopee_cycle_state WHERE channel_account_id=a;
 obs:=public.d11_fixture_observe(a,'fixture_claim_4');
 ASSERT public.claim_shopee_cycle_effect(a,l,1,'ship',123,'D11SYNTHETIC1','PKG1',repeat('a',64),obs)->>'status'='policy_external_state_refused';
 x:=public.claim_shopee_cycle_effect(a,l,1,'label',123,'D11SYNTHETIC1','PKG1',repeat('b',64),obs);
 ASSERT x->>'status'='claimed' AND (x->>'fresh')::boolean;
 ASSERT EXISTS(SELECT 1 FROM public.shopee_shipping_document_attempts WHERE id=(x->>'attempt_id')::uuid
  AND d11_observation_id=obs AND d11_lease_id=l AND d11_policy_revision=1);
 ASSERT public.claim_shopee_cycle_effect(a,l,1,'label',123,'D11SYNTHETIC1','PKG1',repeat('b',64),obs)->>'status'='already_claimed';
END $$;
RESET ROLE;

-- Account B has an independent one-effect quota, despite the same order SN.
INSERT INTO public.marketplace_raw_snapshots(channel_account_id,source,environment,external_entity_type,endpoint,external_entity_id,payload,payload_hash,observed_at)
SELECT 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',source,environment,external_entity_type,endpoint,external_entity_id,payload,payload_hash,observed_at
 FROM public.marketplace_raw_snapshots WHERE channel_account_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND payload_hash=repeat('a',64);
SET LOCAL ROLE service_role;
DO $quota$
DECLARE b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; l uuid; obs uuid; x jsonb;
BEGIN
 SELECT lease_id INTO l FROM public.shopee_cycle_state WHERE channel_account_id=b;
 obs:=public.d11_fixture_observe(b,'fixture_quota_b1');
 x:=public.claim_shopee_cycle_effect(b,l,1,'ship',456,'D11SYNTHETIC1','PKG1',repeat('a',64),obs);
 ASSERT x->>'status'='claimed';
 ASSERT public.resolve_shopee_shipping_arrangement((x->>'attempt_id')::uuid,repeat('a',64),'uncertain')->>'state'='uncertain';
 ASSERT public.claim_shopee_cycle_effect(b,l,1,'ship',456,'D11SYNTHETIC1','PKG1',repeat('a',64),obs)->>'status'='uncertain_requires_reconciliation';
END $quota$;
RESET ROLE;
INSERT INTO public.marketplace_raw_snapshots(channel_account_id,source,environment,external_entity_type,endpoint,external_entity_id,payload,payload_hash,observed_at)
SELECT 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',source,environment,external_entity_type,endpoint,external_entity_id,payload,payload_hash,clock_timestamp()
 FROM public.marketplace_raw_snapshots WHERE channel_account_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND payload_hash=repeat('c',64);
SET LOCAL ROLE service_role;
DO $quota$
DECLARE b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; l uuid; obs uuid;
BEGIN
 SELECT lease_id INTO l FROM public.shopee_cycle_state WHERE channel_account_id=b;
 obs:=public.d11_fixture_observe(b,'fixture_quota_b2');
 ASSERT public.claim_shopee_cycle_effect(b,l,1,'label',456,'D11SYNTHETIC1','PKG1',repeat('b',64),obs)->>'status'='policy_effect_quota_exhausted';
 ASSERT (SELECT count(*) FROM public.shopee_shipping_arrangement_attempts WHERE channel_account_id=b AND d11_lease_id=l)=1;
 ASSERT NOT EXISTS(SELECT 1 FROM public.shopee_shipping_document_attempts WHERE channel_account_id=b);
 -- A different lease cannot reset the durable shipment attempt, but may
 -- admit the independently observed label within its own effect quota.
 ASSERT public.finish_shopee_cycle(b,l,NULL,'D11SYNTHETIC1','pending','fixture_quota')->>'status'='finished';
 l:=(public.acquire_shopee_cycle(b)->>'lease_id')::uuid;
 ASSERT l IS NOT NULL;
 obs:=public.d11_fixture_observe(b,'fixture_quota_b3');
 ASSERT public.claim_shopee_cycle_effect(b,l,1,'label',456,'D11SYNTHETIC1','PKG1',repeat('b',64),obs)->>'status'='claimed';
 ASSERT (SELECT count(*) FROM public.shopee_shipping_arrangement_attempts WHERE channel_account_id=b)=1;
 ASSERT (SELECT count(*) FROM public.shopee_shipping_document_attempts WHERE channel_account_id=b AND d11_lease_id=l)=1;
END $quota$;
RESET ROLE;

-- Same canonical label identity contract as the existing Core label locator.
CREATE TABLE IF NOT EXISTS public.order_documents(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid,document_type text,
 source text,storage_bucket text,storage_path text,mime_type text,file_size integer);
ALTER TABLE public.order_documents ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.order_documents TO service_role;
SET LOCAL ROLE service_role;
DO $complete$
DECLARE b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; l uuid;
BEGIN
 SELECT lease_id INTO l FROM public.shopee_cycle_state WHERE channel_account_id=b;
 ASSERT public.finish_shopee_d11_preflight(b,l,1,'D11SYNTHETIC1','d11_label_available')->>'status'='candidate_refused';
END $complete$;
RESET ROLE;
INSERT INTO public.order_documents(order_id,document_type,source,storage_bucket,storage_path,mime_type,file_size)
VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','shipping_label','shopee_open_platform','shopee-labels','wrong-path','application/pdf',100);
SET LOCAL ROLE service_role;
DO $complete$
DECLARE b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; l uuid;
BEGIN
 SELECT lease_id INTO l FROM public.shopee_cycle_state WHERE channel_account_id=b;
 ASSERT public.finish_shopee_d11_preflight(b,l,1,'D11SYNTHETIC1','d11_label_available')->>'status'='candidate_refused';
END $complete$;
RESET ROLE;
UPDATE public.order_documents SET storage_path='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/shopee-'||
 encode(sha256(convert_to('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:456:D11SYNTHETIC1:PKG1','UTF8')),'hex')||'.pdf'
 WHERE order_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
SET LOCAL ROLE service_role;
DO $complete$
DECLARE b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; l uuid;
BEGIN
 SELECT lease_id INTO l FROM public.shopee_cycle_state WHERE channel_account_id=b;
 PERFORM public.d11_fixture_observe(b,'fixture_label_finish');
 ASSERT public.finish_shopee_d11_preflight(b,l,1,'D11SYNTHETIC1','d11_label_available')->>'status'='finished';
 ASSERT (SELECT state FROM public.shopee_cycle_orders WHERE channel_account_id=b AND order_sn='D11SYNTHETIC1')='complete';
 ASSERT (SELECT operational_status FROM public.orders WHERE channel_account_id=b AND order_number='D11SYNTHETIC1')='todo';
 ASSERT (SELECT lease_id FROM public.shopee_cycle_state WHERE channel_account_id=b) IS NULL;
END $complete$;
RESET ROLE;
-- Synthetic owner fixture simulates the future authenticated append-only pause.
INSERT INTO public.shopee_cycle_policy_revisions(channel_account_id,revision,environment,shop_id,partner_id,history_cutoff)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',2,'live',123,2047685,1);
SET LOCAL ROLE service_role;
DO $$
DECLARE a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; l uuid; d uuid; obs uuid;
BEGIN
 SELECT lease_id INTO l FROM public.shopee_cycle_state WHERE channel_account_id=a;
 SELECT id INTO obs FROM public.shopee_cycle_observations WHERE channel_account_id=a ORDER BY recorded_at DESC LIMIT 1;
 SELECT id INTO d FROM public.shopee_shipping_document_attempts WHERE channel_account_id=a;
 ASSERT public.claim_shopee_cycle_effect(a,l,1,'label',123,'D11SYNTHETIC1','PKG1',repeat('b',64),obs)->>'status'='policy_admission_refused';
 -- Resolve existing committed attempt without issuing a new claim.
 ASSERT public.resolve_shopee_d11_effect(a,l,2,obs,'label',d,repeat('b',64),'succeeded')->>'status'='effect_binding_refused';
 ASSERT public.resolve_shopee_d11_effect(a,l,1,obs,'label',d,repeat('b',64),'succeeded')->>'state'='succeeded';
 ASSERT public.resolve_shopee_d11_effect(a,l,1,obs,'label',d,repeat('b',64),'uncertain')->>'status'='transition_forbidden';
 ASSERT NOT has_function_privilege('authenticated','public.resolve_shopee_d11_effect(uuid,uuid,integer,uuid,text,uuid,text,text)','EXECUTE');
 ASSERT public.finish_shopee_cycle(a,l,null,'D11SYNTHETIC1','blocked','policy_paused')->>'status'='finished';
 ASSERT (SELECT count(*) FROM public.shopee_shipping_document_attempts WHERE channel_account_id=a)=1;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'D11 policy-bound durable claims proof passed (rolled back)' AS result;
