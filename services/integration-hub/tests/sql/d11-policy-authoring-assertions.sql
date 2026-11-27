-- Synthetic assertions; run in dedicated disposable DB.
DO $$ BEGIN
 ASSERT NOT has_function_privilege('anon','public.append_shopee_cycle_policy_revision(uuid,integer,uuid,text,jsonb,text)','EXECUTE');
 ASSERT NOT has_function_privilege('service_role','public.append_shopee_cycle_policy_revision(uuid,integer,uuid,text,jsonb,text)','EXECUTE');
 ASSERT NOT has_table_privilege('authenticated','public.shopee_cycle_policy_revisions','INSERT');
 ASSERT NOT has_table_privilege('d11_policy_author','public.shopee_cycle_policy_revisions','UPDATE');
 ASSERT NOT has_table_privilege('d11_policy_author','public.shopee_cycle_policy_revisions','DELETE');
 ASSERT NOT (SELECT rolbypassrls OR rolsuper OR rolcanlogin FROM pg_roles WHERE rolname='d11_policy_author');
END $$;
SET ROLE authenticated;
DO $$
DECLARE a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; q uuid:='11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; x jsonb;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','',false);
 ASSERT public.append_shopee_cycle_policy_revision(a,0,q,'configure',public.d11_fixture_config(),'fixture/approval')->>'status'='author_refused';
 PERFORM set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',false);
 ASSERT public.append_shopee_cycle_policy_revision(a,0,q,'configure',public.d11_fixture_config(),'fixture/approval')->>'status'='author_refused';
 PERFORM set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',false);
 ASSERT public.append_shopee_cycle_policy_revision(a,0,q,'configure',public.d11_fixture_config(),'fixture/approval')->>'status'='author_refused';
 PERFORM set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',false);
 ASSERT public.append_shopee_cycle_policy_revision(a,0,q,'configure',public.d11_fixture_config()||'{"authorized_by":"fake"}','fixture/approval')->>'status'='invalid_request';
 x:=public.append_shopee_cycle_policy_revision(a,0,q,'configure',public.d11_fixture_config(),'fixture/approval');
 ASSERT x->>'status'='recorded' AND x->>'revision'='1',x::text;
 ASSERT public.append_shopee_cycle_policy_revision(a,0,q,'configure',public.d11_fixture_config(),'fixture/approval')->>'status'='already_recorded';
 ASSERT public.append_shopee_cycle_policy_revision(a,0,q,'configure',public.d11_fixture_config(),'different/approval')->>'status'='request_collision';
 ASSERT public.append_shopee_cycle_policy_revision(a,0,gen_random_uuid(),'pause',null,'fixture/pause')->>'status'='revision_conflict';
 ASSERT public.append_shopee_cycle_policy_revision('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',0,gen_random_uuid(),'configure',public.d11_fixture_config(),'fixture/approval')->>'status'='recorded';
END $$;
RESET ROLE;
DO $$ BEGIN
 ASSERT (SELECT count(*) FROM public.shopee_cycle_policy_revisions)=2;
 ASSERT NOT EXISTS(SELECT 1 FROM public.shopee_cycle_policy_revisions WHERE authorized_by<>'cccccccc-cccc-4ccc-8ccc-cccccccccccc' OR request_id IS NULL);
END $$;

-- Prepare two distinct synthetic candidates, each with canonical order and fresh Raw.
INSERT INTO public.shopee_cycle_orders(channel_account_id,order_sn) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','D11SYNTHETIC1'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','D11SYNTHETIC1');
INSERT INTO public.orders(id,channel_account_id,order_number,channel,sale_origin,deleted_at,status,operational_status) VALUES
 ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','D11SYNTHETIC1','shopee','shopee_open_platform',null,'pendente','todo'),
 ('bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','D11SYNTHETIC1','shopee','shopee_open_platform',null,'pendente','todo');
DO $$ BEGIN
 ASSERT public.acquire_shopee_cycle('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->>'status'='acquired';
 ASSERT public.acquire_shopee_cycle('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')->>'status'='acquired';
END $$;
INSERT INTO public.marketplace_raw_snapshots(channel_account_id,source,environment,external_entity_type,endpoint,external_entity_id,payload,payload_hash,observed_at)
SELECT a,'shopee_open_platform','live','order','/api/v2/order/get_order_detail','D11SYNTHETIC1',
 jsonb_build_object('response',jsonb_build_object('order_list',jsonb_build_array(jsonb_build_object(
 'order_sn','D11SYNTHETIC1','create_time',floor(extract(epoch FROM clock_timestamp()))::bigint-60,
 'order_status','READY_TO_SHIP','split_up',false,'package_list',jsonb_build_array(jsonb_build_object('package_number','PKG1','logistics_status','LOGISTICS_READY')))))),
 repeat('a',64),clock_timestamp() FROM unnest(ARRAY['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid]) a;

SELECT public.d11_fixture_observe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','fixture_race_a');
SELECT public.d11_fixture_observe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','fixture_race_b');
