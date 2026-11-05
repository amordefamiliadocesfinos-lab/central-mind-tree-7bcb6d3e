-- CI disposable ONLY: minimal canonical schema for Shopee order writer.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$BEGIN
 IF current_database() <> 'p4_shopee_writer_disposable' THEN RAISE EXCEPTION 'p4_test_requires_disposable_database';END IF;
END$$;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA IF NOT EXISTS public;
CREATE TABLE public.digital_platforms(id uuid PRIMARY KEY,name text,group_type text,parent_id uuid,is_active boolean);
CREATE TABLE public.channel_accounts(id uuid PRIMARY KEY,name text,platform_id uuid,is_active boolean);
CREATE TABLE public.products(id uuid PRIMARY KEY,name text,unit text,deleted_at timestamptz,is_active boolean);
CREATE TABLE public.product_variants(id uuid PRIMARY KEY,product_id uuid,is_active boolean);
CREATE TABLE public.commercial_presentations(
 id uuid PRIMARY KEY,product_id uuid,variant_id uuid,is_active boolean,composition_mode text,
 name text,commercial_unit_label text,conversion_factor numeric);
CREATE TABLE public.orders(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_number text,customer_name text,customer_contact text,
 contact_id uuid,channel text,channel_account_id uuid,marketplace_account text,
 status text,operational_status text,total_value numeric,order_date date,due_date date,order_type text,
 payment_status text,payment_method text,financial_account_id uuid,discount_amount numeric,
 shipping_amount numeric,delivery_snapshot jsonb,marketplace_metadata jsonb,operational_destination text,
 logistics_mode text,operational_destination_details jsonb,sale_origin text,deleted_at timestamptz,
 created_at timestamptz DEFAULT now());
CREATE TABLE public.order_items(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid,product_id uuid,variant_id uuid,
 quantity integer,unit_price numeric(20,10),notes text,
 commercial_presentation_id uuid,commercial_presentation_name text,commercial_unit_label text,
 commercial_conversion_factor numeric,commercial_quantity numeric,physical_unit_label text,
 CONSTRAINT order_items_commercial_snapshot_check CHECK (
 ((commercial_presentation_id IS NULL) AND (commercial_presentation_name IS NULL)
  AND (commercial_unit_label IS NULL) AND (commercial_conversion_factor IS NULL)
  AND (commercial_quantity IS NULL) AND (physical_unit_label IS NULL))
 OR ((commercial_presentation_name IS NOT NULL) AND (commercial_unit_label IS NOT NULL)
  AND (physical_unit_label IS NOT NULL) AND (commercial_conversion_factor>0)
  AND (commercial_quantity>0) AND (quantity=commercial_quantity*commercial_conversion_factor))
 ));
CREATE TABLE public.order_separation(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid UNIQUE,separation_status text DEFAULT 'todo');
CREATE UNIQUE INDEX orders_shopee_account_external_unique ON public.orders(channel_account_id,order_number)
 WHERE channel='shopee' AND channel_account_id IS NOT NULL AND deleted_at IS NULL;
INSERT INTO public.digital_platforms VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Shopee','marketplace',NULL,true);
INSERT INTO public.channel_accounts VALUES
 ('b4027369-5abf-4ac1-ab24-862334fae892','SHOPEE ADÃO','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true),
 ('8a8ad166-0317-4597-8be6-e43fb46b4d1b','SHOPEE VIVIANE','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
INSERT INTO public.products VALUES
 ('0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b','Italac','g',NULL,true),
 ('6f43ad65-74d5-4db9-b931-1ecd6d124987','Sorbato','g',NULL,true),
 ('ef118d1c-e7c7-45e3-b796-3a9908840f3c','Acido','g',NULL,true),
 ('d913f0f2-4893-4985-9976-fcd9119a57b1','Ivoti','g',NULL,true),
 ('92088a70-8cc0-40ef-a39d-564603df6866','Legacy','g',NULL,true);
INSERT INTO public.commercial_presentations VALUES
 ('008d57c4-63b6-4c30-80fd-161ca368fd66','0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b',NULL,true,'single','Unidade 395 g','un',395),
 ('b1bdfd2f-0278-4273-9e19-2544c8a3d758','0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b',NULL,true,'single','Caixa 27 x 395 g','caixa',10665),
 ('684d4a55-5d3a-4c18-be47-818a1a3bc074','6f43ad65-74d5-4db9-b931-1ecd6d124987',NULL,true,'single','Pacote 1 kg','pacote',1000),
 ('f093c456-f757-4efe-b575-8177b8b1d607','ef118d1c-e7c7-45e3-b796-3a9908840f3c',NULL,true,'single','kg','kg',1000),
 ('40809f6d-687c-493b-ac4d-67a602cceba0','d913f0f2-4893-4985-9976-fcd9119a57b1',NULL,true,'single','Balde 9,8 kg','balde',9800);
