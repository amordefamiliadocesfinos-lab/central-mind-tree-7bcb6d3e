-- Disposable PostgreSQL 17 fixture for Jornada SKU V1.3. NEVER point to Lovable Cloud.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
CREATE TABLE public.app_users(auth_user_id uuid PRIMARY KEY, role text, is_active boolean);
CREATE FUNCTION public.current_app_user_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
 SELECT role FROM public.app_users WHERE auth_user_id=auth.uid() AND is_active=true LIMIT 1;
$$;
CREATE TABLE public.products(id uuid PRIMARY KEY, sku text NOT NULL);
CREATE TABLE public.marketplace_product_mappings(
 id uuid PRIMARY KEY, marketplace text NOT NULL, channel_account_id uuid,
 external_item_id text,external_model_id text
);
CREATE TABLE public.marketplace_product_mapping_items (
 mapping_id uuid NOT NULL REFERENCES public.marketplace_product_mappings(id),
 product_id uuid NOT NULL REFERENCES public.products(id)
);
INSERT INTO public.app_users VALUES
 ('10000000-0000-0000-0000-000000000001','Administrador',true),
 ('10000000-0000-0000-0000-000000000002','VENDA',true);
INSERT INTO public.products VALUES
 ('20000000-0000-0000-0000-000000000030','TRF-ART-030-M'),
 ('20000000-0000-0000-0000-000000000040','TRF-ART-040-M');
INSERT INTO public.marketplace_product_mappings VALUES
 ('980cb680-5296-4342-b83d-4e09584a3fe0','shopee','d26c7a30-aa4a-4441-8012-600d70453689','23094148715','129843489972'),
 ('980cb680-5296-4342-b83d-4e09584a3fe1','shopee','d26c7a30-aa4a-4441-8012-600d70453689','23094148715','129843489967');
INSERT INTO public.marketplace_product_mapping_items VALUES
 ('980cb680-5296-4342-b83d-4e09584a3fe0','20000000-0000-0000-0000-000000000030'),
 ('980cb680-5296-4342-b83d-4e09584a3fe1','20000000-0000-0000-0000-000000000040');
