-- ONLY local Auth fixture: extend the minimal cycle schema to the existing
-- P4 commercial schema. Not part of the generated migration.
DO $$ BEGIN
 IF current_database()<>'postgres' OR current_setting('d11.fixture_local',true) IS DISTINCT FROM 'on'
 THEN RAISE EXCEPTION 'D11 local commercial fixture required'; END IF;
END $$;
ALTER TABLE public.orders ALTER COLUMN id SET DEFAULT gen_random_uuid(),
 ADD COLUMN customer_name text,ADD COLUMN customer_contact text,ADD COLUMN contact_id uuid,
 ADD COLUMN marketplace_account text,ADD COLUMN total_value numeric,ADD COLUMN order_date date,
 ADD COLUMN due_date date,ADD COLUMN order_type text,ADD COLUMN payment_status text,ADD COLUMN payment_method text,
 ADD COLUMN financial_account_id uuid,ADD COLUMN discount_amount numeric,ADD COLUMN shipping_amount numeric,
 ADD COLUMN delivery_snapshot jsonb,ADD COLUMN marketplace_metadata jsonb,ADD COLUMN operational_destination text,
 ADD COLUMN logistics_mode text,ADD COLUMN operational_destination_details jsonb,ADD COLUMN created_at timestamptz DEFAULT now();
CREATE TABLE public.products(id uuid PRIMARY KEY,name text,unit text,deleted_at timestamptz,is_active boolean);
CREATE TABLE public.product_variants(id uuid PRIMARY KEY,product_id uuid,is_active boolean);
CREATE TABLE public.commercial_presentations(
 id uuid PRIMARY KEY,product_id uuid,variant_id uuid,is_active boolean,composition_mode text,
 name text,commercial_unit_label text,conversion_factor numeric);
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
CREATE TABLE public.marketplace_product_mappings(id uuid PRIMARY KEY,marketplace text,marketplace_account text,channel_account_id uuid,external_item_id text,external_model_id text,external_item_key text,product_id uuid,variant_id uuid,physical_multiplier numeric);
CREATE UNIQUE INDEX fixture_official_mapping_unique ON public.marketplace_product_mappings(channel_account_id,external_item_id,external_model_id) WHERE marketplace='shopee' AND external_item_id IS NOT NULL AND external_model_id IS NOT NULL;
CREATE TABLE public.marketplace_product_mapping_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),mapping_id uuid REFERENCES public.marketplace_product_mappings(id) ON DELETE CASCADE,product_id uuid,variant_id uuid,physical_multiplier numeric,position integer);

-- Same physical catalog and exact official mapping structure as P4.
INSERT INTO public.products VALUES
 ('92088a70-8cc0-40ef-a39d-564603df6866','Fixture component A','g',NULL,true),
 ('6f43ad65-74d5-4db9-b931-1ecd6d124987','Fixture component B','g',NULL,true);
INSERT INTO public.marketplace_product_mappings VALUES
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','shopee','D11 synthetic A','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','123','456','fixture','92088a70-8cc0-40ef-a39d-564603df6866',NULL,3);
INSERT INTO public.marketplace_product_mapping_items(mapping_id,product_id,variant_id,physical_multiplier,position) VALUES
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','92088a70-8cc0-40ef-a39d-564603df6866',NULL,3,0),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','6f43ad65-74d5-4db9-b931-1ecd6d124987',NULL,2,1);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_product_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_product_mapping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_separation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.products,public.product_variants,public.commercial_presentations,public.marketplace_product_mappings,
 public.marketplace_product_mapping_items,public.orders,public.order_items,public.order_separation FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.products,public.product_variants,public.commercial_presentations,public.marketplace_product_mappings,
 public.marketplace_product_mapping_items,public.orders,public.order_items,public.order_separation TO service_role;
GRANT UPDATE ON public.products,public.product_variants,public.marketplace_product_mappings,
 public.marketplace_product_mapping_items TO service_role;
\ir ../../../../supabase/proposals/P4_SHOPEE_CORE_COMMERCIAL_SNAPSHOT_UNAPPLIED.sql
\ir d11-intake-writer-parity-fixture.sql
