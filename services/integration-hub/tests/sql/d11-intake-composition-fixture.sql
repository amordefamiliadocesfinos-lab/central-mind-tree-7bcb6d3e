-- Disposable fixture reused by single and independent-session tests.
DO $$ BEGIN ASSERT current_database()='p4_shopee_writer_disposable'; END $$;
CREATE TABLE public.shopee_oauth_connections(channel_account_id uuid,shop_id bigint,partner_id bigint,environment text,shop_status text,authorization_expires_at timestamptz);
CREATE TABLE public.order_documents(id uuid PRIMARY KEY,order_id uuid,document_type text);
CREATE TABLE public.marketplace_raw_snapshots(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),channel_account_id uuid,source text,environment text,external_entity_type text,endpoint text,external_entity_id text,payload jsonb,payload_hash text,observed_at timestamptz,created_at timestamptz DEFAULT now());
CREATE TABLE public.marketplace_product_mappings(id uuid PRIMARY KEY,marketplace text,marketplace_account text,channel_account_id uuid,external_item_id text,external_model_id text,external_item_key text,product_id uuid,variant_id uuid,physical_multiplier numeric);
CREATE UNIQUE INDEX fixture_official_mapping_unique ON public.marketplace_product_mappings(channel_account_id,external_item_id,external_model_id) WHERE marketplace='shopee' AND external_item_id IS NOT NULL AND external_model_id IS NOT NULL;
CREATE TABLE public.marketplace_product_mapping_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),mapping_id uuid REFERENCES public.marketplace_product_mappings(id) ON DELETE CASCADE,product_id uuid,variant_id uuid,physical_multiplier numeric,position integer);
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;
GRANT UPDATE ON public.marketplace_product_mappings,public.marketplace_product_mapping_items,public.products,public.product_variants TO service_role;
\ir ../../../../supabase/migrations/20261020225826_shopee_minimum_cycle_state.sql
\ir d11-policy-storage-schema.sql
\ir d11-policy-lease-schema.sql
\ir d11-policy-acquire-candidate.sql
\ir d11-preflight-lifecycle-candidate.sql
\ir d11-observation-candidate.sql
\ir d11-observation-fixture-helper.sql
\ir ../../../../supabase/proposals/P4_SHOPEE_CORE_COMMERCIAL_SNAPSHOT_UNAPPLIED.sql
\ir d11-intake-writer-parity-fixture.sql
\ir d11-intake-composition-candidate.sql
INSERT INTO public.channel_accounts(id,name,platform_id,is_active)
VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','D11 synthetic A','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
INSERT INTO public.shopee_oauth_connections VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',123,2047685,'live','NORMAL',clock_timestamp()+interval '1 day');
INSERT INTO public.shopee_cycle_policy_revisions(channel_account_id,revision,environment,shop_id,partner_id,history_cutoff,enabled,paused,capabilities,authorized_by,authorized_at,expires_at,evidence_ref)
VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',1,'live',123,2047685,floor(extract(epoch FROM clock_timestamp()))::bigint-3600,true,false,'{"discover":true,"intake":true,"ship":false,"label":false,"refresh":false}','dddddddd-dddd-4ddd-8ddd-dddddddddddd',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '4 minutes','fixture/intake');
INSERT INTO public.marketplace_product_mappings VALUES
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','shopee','D11 synthetic A','cccccccc-cccc-4ccc-8ccc-cccccccccccc','123','456','fixture','92088a70-8cc0-40ef-a39d-564603df6866',NULL,3);
INSERT INTO public.marketplace_product_mapping_items(mapping_id,product_id,variant_id,physical_multiplier,position) VALUES
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','92088a70-8cc0-40ef-a39d-564603df6866',NULL,3,0),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','6f43ad65-74d5-4db9-b931-1ecd6d124987',NULL,2,1);
INSERT INTO public.shopee_cycle_orders(channel_account_id,order_sn) VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','D11SYNTHETIC1');
INSERT INTO public.marketplace_raw_snapshots(channel_account_id,source,environment,external_entity_type,endpoint,external_entity_id,payload_hash,observed_at,payload)
VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','shopee_open_platform','live','order','/api/v2/order/get_order_detail','D11SYNTHETIC1',repeat('a',64),clock_timestamp()-interval '1 minute',
 jsonb_build_object('response',jsonb_build_object('order_list',jsonb_build_array(jsonb_build_object('order_sn','D11SYNTHETIC1','create_time',floor(extract(epoch FROM clock_timestamp()))::bigint-120,'order_status','READY_TO_SHIP','split_up',false,'total_amount',20,'payment_method','Pix','message_to_seller','fixture packing note','package_list',jsonb_build_array(jsonb_build_object('package_number','PKG1','logistics_status','LOGISTICS_READY')),'item_list',jsonb_build_array(jsonb_build_object('item_id',123,'model_id',456,'model_quantity_purchased',2,'model_discounted_price',10)))))));

CREATE FUNCTION public.d11_fixture_projection() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $fixture$
 SELECT jsonb_build_object('channel_account_id','cccccccc-cccc-4ccc-8ccc-cccccccccccc','marketplace_account','D11 synthetic A','order_number','D11SYNTHETIC1',
 'order_date',to_char(to_timestamp((SELECT (payload#>>'{response,order_list,0,create_time}')::bigint FROM public.marketplace_raw_snapshots WHERE channel_account_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc')) AT TIME ZONE 'UTC','YYYY-MM-DD'),
 'total_value',20,'payment_method','Pix','external_status','READY_TO_SHIP','buyer_message','fixture packing note','items',jsonb_build_array(
 '{"product_id":"92088a70-8cc0-40ef-a39d-564603df6866","variant_id":null,"quantity":6,"commercial_quantity":2,"physical_multiplier":3,"unit_price":10,"item_id":"123","model_id":"456","mapping_id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","composition_position":0}'::jsonb,
 '{"product_id":"6f43ad65-74d5-4db9-b931-1ecd6d124987","variant_id":null,"quantity":4,"commercial_quantity":2,"physical_multiplier":2,"unit_price":0,"item_id":"123","model_id":"456","mapping_id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","composition_position":1}'::jsonb));
$fixture$;
REVOKE ALL ON FUNCTION public.d11_fixture_projection() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.d11_fixture_projection() TO service_role;
