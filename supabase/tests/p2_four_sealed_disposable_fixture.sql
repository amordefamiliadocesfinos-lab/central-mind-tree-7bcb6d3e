-- Synthetic minimum PostgreSQL fixture for GitHub Actions ephemeral DB ONLY.
-- Never run on Lovable Cloud / any real project. No production data is copied.
-- A fresh postgres:17 service is created and disposed for each CI execution.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE SQL STABLE AS $$ SELECT NULL::uuid $$;
CREATE TABLE public.products(id uuid PRIMARY KEY);
CREATE TABLE public.storage_locations(
  id uuid PRIMARY KEY, name text NOT NULL UNIQUE, is_active boolean NOT NULL
);
CREATE TABLE public.inventory(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id),
  variant_id uuid,
  location text NOT NULL,
  location_id uuid REFERENCES public.storage_locations(id),
  quantity numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX inventory_synthetic_identity
  ON public.inventory(product_id,location)
  WHERE variant_id IS NULL;
CREATE TABLE public.inventory_movements(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id),
  variant_id uuid,
  movement_type text NOT NULL,
  quantity numeric NOT NULL,
  previous_balance numeric NOT NULL,
  new_balance numeric NOT NULL,
  location text NOT NULL,
  reference_type text NOT NULL,
  reference_id uuid NOT NULL,
  event_key text NOT NULL UNIQUE,
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.p2_disposable_test_marker(
  id integer PRIMARY KEY CHECK (id=1),
  marker text NOT NULL CHECK (marker='GITHUB_ACTIONS_SYNTHETIC_ONLY')
);
INSERT INTO public.p2_disposable_test_marker VALUES
  (1,'GITHUB_ACTIONS_SYNTHETIC_ONLY');
INSERT INTO public.products(id) VALUES
 ('0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b'),
 ('6f43ad65-74d5-4db9-b931-1ecd6d124987'),
 ('ef118d1c-e7c7-45e3-b796-3a9908840f3c'),
 ('d913f0f2-4893-4985-9976-fcd9119a57b1');
INSERT INTO public.storage_locations(id,name,is_active) VALUES
 ('b1ef7322-86f9-4cf4-9d52-39ba32911ef6','Fábrica',true);
INSERT INTO public.inventory(product_id,location,location_id,quantity)
SELECT p.id,'Fábrica','b1ef7322-86f9-4cf4-9d52-39ba32911ef6'::uuid,0
FROM public.products p;
