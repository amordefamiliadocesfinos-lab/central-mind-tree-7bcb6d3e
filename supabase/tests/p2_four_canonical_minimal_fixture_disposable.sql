-- Disposable PostgreSQL only. Minimal dependent tables for proposed
-- canonical P2 receipt/order functions. NOT a migration and NOT production data.
-- Must follow p2_four_sealed_disposable_fixture.sql.
ALTER TABLE public.products ADD COLUMN name text NOT NULL DEFAULT 'Synthetic';
ALTER TABLE public.products ADD COLUMN unit text NOT NULL DEFAULT 'g';
ALTER TABLE public.products ADD COLUMN variation_mode text NOT NULL DEFAULT 'sem_variacao';
CREATE TABLE public.product_variants(
 id uuid PRIMARY KEY,product_id uuid,variant_name text,unit text
);
CREATE TABLE public.orders(id uuid PRIMARY KEY);
CREATE TABLE public.order_items(
 id uuid PRIMARY KEY,order_id uuid NOT NULL,product_id uuid NOT NULL,
 variant_id uuid,quantity numeric NOT NULL,commercial_quantity numeric,
 commercial_presentation_id uuid
);
CREATE TABLE public.purchase_orders(id uuid PRIMARY KEY,status text NOT NULL);
CREATE TABLE public.purchase_receipts(
 id uuid PRIMARY KEY,purchase_order_id uuid NOT NULL,status text NOT NULL,
 storage_location_id uuid NOT NULL,received_at timestamptz,confirmed_at timestamptz,
 confirmed_by uuid,updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.purchase_order_items(
 id uuid PRIMARY KEY,purchase_order_id uuid NOT NULL,product_id uuid NOT NULL,
 variant_id uuid,purchase_presentation_id uuid,purchase_unit_label text
);
CREATE TABLE public.purchase_receipt_items(
 id uuid PRIMARY KEY,purchase_receipt_id uuid NOT NULL,
 purchase_order_item_id uuid NOT NULL,operational_received_qty numeric NOT NULL,
 received_purchase_qty numeric NOT NULL
);
CREATE TABLE public.commercial_presentations(
 id uuid PRIMARY KEY,product_id uuid,variant_id uuid,
 composition_mode text,conversion_factor numeric,commercial_unit_label text
);
CREATE TABLE public.operational_incidents(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 area text,incident_type text,status text,severity text,title text,
 description text,source_type text,source_id uuid,product_id uuid,variant_id uuid,
 expected_quantity numeric,applied_quantity numeric,pending_quantity numeric,
 unit text,event_key text UNIQUE,metadata jsonb,updated_at timestamptz DEFAULT now()
);
-- Other physical families are represented by EMPTY schema-compatible stub
-- ledgers, only to exercise the P2 coexistence gates. Not copies of real data.
CREATE TABLE public.glucodry_sealed_events(event_key text,reference_type text,reference_id uuid);
CREATE TABLE public.maltodextrina_sealed_events(event_key text,reference_type text,reference_id uuid);
CREATE TABLE public.chocolate_sealed_events(event_key text,reference_type text,reference_id uuid);
CREATE TABLE public.amendoim_sealed_events(event_key text,reference_type text,reference_id uuid);
CREATE TABLE public.trufa_pack_sealed_events(event_key text,reference_id uuid,direction text);
CREATE TABLE public.glucodry_sealed_stock(storage_location_id uuid,sacks integer);
CREATE TABLE public.maltodextrina_sealed_stock(storage_location_id uuid,sacks integer);
CREATE TABLE public.chocolate_sealed_stock(storage_location_id uuid,variant_id uuid,sacks integer);
CREATE TABLE public.amendoim_sealed_stock(storage_location_id uuid,sacks integer);
CREATE TABLE public.trufa_pack_sealed_stock(storage_location_id uuid,variant_id uuid,packs integer);
CREATE FUNCTION public.recalculate_purchase_order_receiving_status(p_id uuid)
RETURNS text LANGUAGE sql AS $$SELECT 'parcialmente_recebido'::text$$;
