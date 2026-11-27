-- Existing disposable CI PostgreSQL. All changes rolled back.
BEGIN;
\ir d11-policy-storage-schema.sql
ALTER TABLE public.shopee_oauth_connections ADD COLUMN shop_status text,
 ADD COLUMN authorization_expires_at timestamptz;
ALTER TABLE public.marketplace_raw_snapshots ADD COLUMN id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 ADD COLUMN payload_hash text,ADD COLUMN observed_at timestamptz,ADD COLUMN created_at timestamptz DEFAULT now();
CREATE UNIQUE INDEX d11_fixture_raw_idempotency ON public.marketplace_raw_snapshots
 (source,environment,channel_account_id,external_entity_type,external_entity_id,endpoint,payload_hash);
\ir d11-policy-lease-schema.sql
\ir d11-policy-acquire-candidate.sql
\ir d11-observation-candidate.sql

INSERT INTO public.channel_accounts(id,name,is_active,platform_id) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','D11 synthetic A',true,'11111111-1111-4111-8111-111111111111'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','D11 synthetic B',true,'11111111-1111-4111-8111-111111111111');
INSERT INTO public.shopee_oauth_connections(channel_account_id,shop_id,partner_id,environment,shop_status,authorization_expires_at) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',123,2047685,'live','NORMAL',clock_timestamp()+interval '1 day'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',456,2047685,'live','NORMAL',clock_timestamp()+interval '1 day');
INSERT INTO public.shopee_cycle_policy_revisions
(channel_account_id,revision,environment,shop_id,partner_id,history_cutoff,enabled,paused,capabilities,
 authorized_by,authorized_at,expires_at,evidence_ref,fiscal_mode,shipping_mode,shipping_evidence_ref,document_type)
SELECT ca.id,1,'live',oc.shop_id,2047685,floor(extract(epoch FROM clock_timestamp()))::bigint-3600,
 true,false,'{"discover":true,"intake":true,"ship":true,"label":false,"refresh":false}'::jsonb,
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '4 minutes',
 'fixture/proof','cpf_no_invoice_step','simple_dropoff','fixture/logistics',null
FROM public.channel_accounts ca JOIN public.shopee_oauth_connections oc ON oc.channel_account_id=ca.id
WHERE ca.id IN ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO public.shopee_cycle_orders(channel_account_id,order_sn) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','D11SYNTHETIC1'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','D11SYNTHETIC1');
-- Historic content, captured before this lease; its time must not change.
INSERT INTO public.marketplace_raw_snapshots(channel_account_id,source,environment,external_entity_type,endpoint,external_entity_id,payload,payload_hash,observed_at)
SELECT a,'shopee_open_platform','live','order','/api/v2/order/get_order_detail','D11SYNTHETIC1',
 jsonb_build_object('response',jsonb_build_object('order_list',jsonb_build_array(jsonb_build_object(
 'order_sn','D11SYNTHETIC1','create_time',floor(extract(epoch FROM clock_timestamp()))::bigint-120,
 'order_status','READY_TO_SHIP','split_up',false,'package_list',jsonb_build_array(jsonb_build_object('package_number','PKG1','logistics_status','LOGISTICS_READY')))))),
 repeat('a',64),clock_timestamp()-interval '1 minute'
 FROM unnest(ARRAY['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid]) a;
DO $$ BEGIN
 ASSERT NOT has_function_privilege('anon','public.record_shopee_cycle_observation(uuid,uuid,integer,bigint,text,text,jsonb,text,timestamptz,timestamptz)','EXECUTE');
 ASSERT NOT has_function_privilege('authenticated','public.read_shopee_cycle_observation(uuid,uuid,integer,text)','EXECUTE');
 ASSERT NOT has_table_privilege('authenticated','public.shopee_cycle_observations','INSERT');
 ASSERT NOT has_table_privilege('service_role','public.shopee_cycle_observations','UPDATE');
 ASSERT NOT has_table_privilege('service_role','public.shopee_cycle_observations','DELETE');
END $$;
SET LOCAL ROLE service_role;
DO $$
DECLARE a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; l uuid; l2 uuid; l3 uuid;
 r public.marketplace_raw_snapshots%ROWTYPE; x jsonb; y jsonb; t timestamptz; t2 timestamptz;
BEGIN
 l:=(public.acquire_shopee_cycle(a)->>'lease_id')::uuid;
 l2:=(public.acquire_shopee_cycle(b)->>'lease_id')::uuid;
 SELECT * INTO r FROM public.marketplace_raw_snapshots WHERE channel_account_id=a;
 ASSERT public.read_shopee_cycle_observation(a,l,1,'intake') IS NULL;
 t:=clock_timestamp();
 ASSERT public.record_shopee_cycle_observation(a,l,1,123,'D11SYNTHETIC1',repeat('a',64),r.payload,'req_old',r.observed_at,t)->>'status'='observation_time_refused';
 ASSERT public.record_shopee_cycle_observation(b,l,1,456,'D11SYNTHETIC1',repeat('a',64),r.payload,'req_cross',t,t)->>'status'='observation_lease_refused';
 ASSERT public.record_shopee_cycle_observation(a,l,1,456,'D11SYNTHETIC1',repeat('a',64),r.payload,'req_shop',t,t)->>'status'='observation_policy_refused';
 ASSERT public.record_shopee_cycle_observation(a,l,1,123,'D11SYNTHETIC1',repeat('a',64),r.payload||'{"changed":true}', 'req_payload',t,t)->>'status'='observation_raw_refused';
 ASSERT public.record_shopee_cycle_observation(a,l,1,123,'D11SYNTHETIC1',repeat('b',64),r.payload,'req_hash',t,t)->>'status'='observation_raw_refused';
 ASSERT public.record_shopee_cycle_observation(a,l,1,123,'D11SYNTHETIC1',repeat('a',64),r.payload,'req_future',t,clock_timestamp()+interval '1 minute')->>'status'='observation_time_refused';
 x:=public.record_shopee_cycle_observation(a,l,1,123,'D11SYNTHETIC1',repeat('a',64),r.payload,'req_1',t,clock_timestamp());
 ASSERT x->>'status'='observation_recorded',x::text;
 y:=public.read_shopee_cycle_observation(a,l,1,'intake');
 ASSERT y->>'raw_id'=r.id::text AND y->>'observation_id'=x->>'observation_id';
 ASSERT (y->>'original_observed_at')::timestamptz=r.observed_at;
 ASSERT (y->>'response_received_at')::timestamptz>=t;
 ASSERT public.read_shopee_cycle_observation(a,l,1,'ship') IS NOT NULL;
 ASSERT public.read_shopee_cycle_observation(a,l,1,'label') IS NULL;
 ASSERT public.read_shopee_cycle_observation(b,l2,1,'intake') IS NULL;
 ASSERT public.record_shopee_cycle_observation(a,l,1,123,'D11SYNTHETIC1',repeat('a',64),r.payload,'req_1',t,clock_timestamp())->>'status'='observation_replay_or_out_of_order';
 t2:=clock_timestamp();
 x:=public.record_shopee_cycle_observation(a,l,1,123,'D11SYNTHETIC1',repeat('a',64),r.payload,'req_2',t2,clock_timestamp());
 ASSERT x->>'status'='observation_recorded';
 ASSERT public.read_shopee_cycle_observation(a,l,1,'intake')->>'observation_id'=x->>'observation_id';
 ASSERT (SELECT count(*) FROM public.marketplace_raw_snapshots WHERE channel_account_id=a)=1;
 ASSERT (SELECT count(*) FROM public.shopee_cycle_observations WHERE channel_account_id=a)=2;
 ASSERT (SELECT observed_at FROM public.marketplace_raw_snapshots WHERE id=r.id)=r.observed_at;
 ASSERT public.finish_shopee_cycle(a,l,null,'D11SYNTHETIC1','pending','observed')->>'status'='finished';
 l3:=(public.acquire_shopee_cycle(a)->>'lease_id')::uuid;
 ASSERT l3<>l;
 ASSERT public.read_shopee_cycle_observation(a,l,1,'intake') IS NULL;
 ASSERT public.read_shopee_cycle_observation(a,l3,1,'intake') IS NULL;
 t:=clock_timestamp();
 ASSERT public.record_shopee_cycle_observation(a,l3,1,123,'D11SYNTHETIC1',repeat('a',64),r.payload,'req_1',t,clock_timestamp())->>'status'='observation_replay_or_out_of_order';
 ASSERT public.record_shopee_cycle_observation(a,l3,1,123,'D11SYNTHETIC1',repeat('a',64),r.payload,'req_3',t,clock_timestamp())->>'status'='observation_recorded';
END $$;
RESET ROLE;
-- A newer Raw without matching receipt is ambiguous, so don't use old proof.
INSERT INTO public.marketplace_raw_snapshots(channel_account_id,source,environment,external_entity_type,endpoint,external_entity_id,payload,payload_hash,observed_at)
SELECT channel_account_id,source,environment,external_entity_type,endpoint,external_entity_id,payload||'{"later":true}',repeat('c',64),clock_timestamp()
 FROM public.marketplace_raw_snapshots WHERE channel_account_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET LOCAL ROLE service_role;
DO $$ DECLARE a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; l uuid; BEGIN
 SELECT lease_id INTO l FROM public.shopee_cycle_state WHERE channel_account_id=a;
 ASSERT public.read_shopee_cycle_observation(a,l,1,'intake') IS NULL;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'D11 fresh observation receipt proof passed (rolled back)' AS result;
