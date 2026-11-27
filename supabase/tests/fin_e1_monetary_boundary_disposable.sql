-- Isolated fixture only. Never execute against the official database.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE public.orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_number text, customer_name text, customer_contact text, contact_id uuid, channel text, status text,
 total_value numeric, order_date date, due_date date, delivery_date date, financial_due_date date, notes text, order_type text, payment_status text, payment_method text, financial_account_id uuid,
 discount_amount numeric, shipping_amount numeric, marketplace_account text, channel_account_id uuid, sale_origin text, sale_request_key uuid UNIQUE, operational_destination text, logistics_mode text, operational_destination_details jsonb
);
CREATE TABLE public.order_items (order_id uuid REFERENCES public.orders(id), product_id uuid, variant_id uuid, quantity numeric, unit_price numeric, notes text, commercial_presentation_id uuid, commercial_group_id uuid, commercial_presentation_name text, commercial_unit_label text, commercial_conversion_factor numeric, commercial_quantity numeric, physical_unit_label text);
CREATE TABLE public.financial_categories (id uuid DEFAULT gen_random_uuid(), is_active boolean, type text, name text);
INSERT INTO public.financial_categories (is_active,type,name) VALUES(true,'receber','Vendas');
CREATE TABLE public.financial_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), type text, description text, value numeric, due_date date, original_due_date date, competence_date date, order_id uuid REFERENCES public.orders(id), contact_id uuid, category_id uuid, account_id uuid, payment_method text, sales_channel text, marketplace_account text, notes text, created_at timestamptz DEFAULT now());
CREATE TABLE public.financial_movements (entry_id uuid REFERENCES public.financial_entries(id), account_id uuid, value numeric, movement_date date, notes text);
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
\ir ../../docs/architecture/proposals/FIN_E1_3_UNIFIED_SALE_MONETARY_BOUNDARY_NAO_APLICAR.sql
REVOKE ALL ON FUNCTION public.create_unified_sale_unguarded_01b(jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_unified_sale_unguarded_01b(jsonb,jsonb) TO service_role;
DO $test$
DECLARE
 req uuid := gen_random_uuid(); acct uuid := gen_random_uuid(); prod uuid := gen_random_uuid(); grp uuid := gen_random_uuid(); r jsonb; replay jsonb; items jsonb;
BEGIN
 items := jsonb_build_array(jsonb_build_object('product_id',prod,'quantity',6,'commercial_quantity',3,'commercial_conversion_factor',2,'commercial_presentation_name','Kit','commercial_unit_label','kit','physical_unit_label','un','unit_price',10.005,'commercial_group_id',grp));
 r := public.create_unified_sale_unguarded_01b(jsonb_build_object('order_number','TEST-PAID','payment_status','pago','financial_account_id',acct,'sale_request_key',req,'discount_amount',0.01,'shipping_amount',2.00),items);
 IF (r->>'total_value')::numeric <> 32.01 THEN RAISE EXCEPTION 'aggregate round failed: %',r; END IF;
 IF NOT EXISTS(SELECT 1 FROM orders WHERE id=(r->>'order_id')::uuid AND total_value=32.01 AND discount_amount=0.01 AND shipping_amount=2) THEN RAISE EXCEPTION 'order total failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM financial_entries WHERE id=(r->>'financial_entry_id')::uuid AND value=32.01) THEN RAISE EXCEPTION 'receivable total failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM financial_movements WHERE entry_id=(r->>'financial_entry_id')::uuid AND value=32.01 AND account_id=acct) THEN RAISE EXCEPTION 'movement total failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM order_items WHERE order_id=(r->>'order_id')::uuid AND quantity=6 AND unit_price=10.005 AND commercial_group_id=grp AND commercial_quantity=3) THEN RAISE EXCEPTION 'commercial snapshot changed'; END IF;
 replay := public.create_unified_sale_unguarded_01b(jsonb_build_object('sale_request_key',req),items);
 IF replay->>'already_registered'<>'true' OR replay->>'order_id'<>r->>'order_id' OR (SELECT count(*) FROM orders)<>1 OR (SELECT count(*) FROM financial_movements)<>1 THEN RAISE EXCEPTION 'replay failed'; END IF;
 r := public.create_unified_sale_unguarded_01b('{"order_number":"TEST-PENDING"}',jsonb_build_array(jsonb_build_object('product_id',prod,'quantity',1,'unit_price',1.004)));
 IF (r->>'total_value')::numeric<>1.00 OR EXISTS(SELECT 1 FROM financial_movements WHERE entry_id=(r->>'financial_entry_id')::uuid) THEN RAISE EXCEPTION 'pending failed'; END IF;
 r := public.create_unified_sale_unguarded_01b('{"order_number":"TEST-TIE"}',jsonb_build_array(jsonb_build_object('product_id',prod,'quantity',1,'unit_price',1.005)));
 IF (r->>'total_value')::numeric<>1.01 THEN RAISE EXCEPTION 'tie failed'; END IF;
 BEGIN
  PERFORM public.create_unified_sale_unguarded_01b('{"order_number":"TEST-ZERO"}',jsonb_build_array(jsonb_build_object('product_id',prod,'quantity',1,'unit_price',0.004)));
  RAISE EXCEPTION 'unexpected zero accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'O total da venda deve ser maior que zero.' THEN RAISE; END IF;
 END;
 IF EXISTS(SELECT 1 FROM orders WHERE order_number='TEST-ZERO') THEN RAISE EXCEPTION 'zero persisted'; END IF;
 IF has_function_privilege('authenticated','public.create_unified_sale_unguarded_01b(jsonb,jsonb)','EXECUTE') OR has_function_privilege('anon','public.create_unified_sale_unguarded_01b(jsonb,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'helper ACL failed'; END IF;
 RAISE NOTICE 'PASS: paid, pending, tie, zero, replay, snapshot and fixture ACL';
END;
$test$;
ROLLBACK;
