-- Disposable PostgreSQL only. These are minimal table contracts, NOT a seed
-- for production. No remote Supabase project or Shopee credential is used.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE TABLE public.digital_platforms(id uuid PRIMARY KEY,name text,is_active boolean,group_type text,parent_id uuid);
CREATE TABLE public.channel_accounts(id uuid PRIMARY KEY,name text,is_active boolean,platform_id uuid);
CREATE TABLE public.shopee_oauth_connections(channel_account_id uuid,shop_id bigint,partner_id bigint,environment text);
CREATE TABLE public.orders(id uuid PRIMARY KEY,channel_account_id uuid,order_number text,channel text,sale_origin text,deleted_at timestamptz);
CREATE TABLE public.order_documents(id uuid PRIMARY KEY,order_id uuid,document_type text);
CREATE TABLE public.marketplace_raw_snapshots(channel_account_id uuid,source text,environment text,
  external_entity_type text,endpoint text,external_entity_id text,payload jsonb);
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;
INSERT INTO public.digital_platforms VALUES('11111111-1111-4111-8111-111111111111','Shopee',true,'marketplace',null);
INSERT INTO public.channel_accounts VALUES('8a8ad166-0317-4597-8be6-e43fb46b4d1b','SHOPEE VIVIANE',true,'11111111-1111-4111-8111-111111111111');
INSERT INTO public.shopee_oauth_connections VALUES('8a8ad166-0317-4597-8be6-e43fb46b4d1b',531736366,2047685,'live');
INSERT INTO public.orders VALUES('22222222-2222-4222-8222-222222222222','8a8ad166-0317-4597-8be6-e43fb46b4d1b','SYNTHETIC001','shopee','shopee_open_platform',null);
INSERT INTO public.marketplace_raw_snapshots
 SELECT '8a8ad166-0317-4597-8be6-e43fb46b4d1b','shopee_open_platform','live','order',
 '/api/v2/order/get_order_detail',sn,jsonb_build_object('response',jsonb_build_object('order_list',jsonb_build_array(jsonb_build_object('order_sn',sn))))
 FROM unnest(ARRAY['SYNTHETIC001','SYNTHETIC002','SYNTHETIC003']) AS t(sn);
