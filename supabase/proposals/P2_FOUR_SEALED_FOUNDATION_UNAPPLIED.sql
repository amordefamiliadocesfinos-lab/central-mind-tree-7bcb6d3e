-- P2 FOUR FAMILIES — SCHEMA CANDIDATE ONLY. DO NOT APPLY TO PRODUCTION.
-- Deliberately outside supabase/migrations: NOT an authorized migration.
-- Requires separate review, generated migration via Supabase CLI, disposable-DB tests,
-- authorization of schema deployment, physical inventory reconciliation, then cutover.
-- No orders/receipts, ledgers, mappings or historical grams are changed by this proposal.
-- It is forbidden to interpret this schema as production-ready or create initial balances.
--
-- Deliberate split: this ledger tracks ORIGINAL/INTACT containers only.
-- Existing inventory.quantity in grams remains distinct, and is NEVER seeded from
-- this ledger or vice versa. Open-to-grams requires a later authorized ATOMIC RPC.
CREATE TABLE public.p2_four_sealed_stock (
 product_id uuid NOT NULL REFERENCES public.products(id),
 storage_location_id uuid NOT NULL REFERENCES public.storage_locations(id),
 physical_state text NOT NULL,
 units integer NOT NULL DEFAULT 0 CHECK (units >= 0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (product_id,storage_location_id,physical_state),
 CONSTRAINT p2_four_state_identity CHECK (
  (product_id='0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b'::uuid
   AND physical_state IN ('originalBoxes27','intactUnits395'))
  OR (product_id IN (
   '6f43ad65-74d5-4db9-b931-1ecd6d124987'::uuid,
   'ef118d1c-e7c7-45e3-b796-3a9908840f3c'::uuid)
   AND physical_state='originalPackages1kg')
  OR (product_id='d913f0f2-4893-4985-9976-fcd9119a57b1'::uuid
   AND physical_state='originalBuckets98')
 )
);
CREATE TABLE public.p2_four_sealed_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_key text NOT NULL UNIQUE CHECK(length(btrim(event_key)) BETWEEN 1 AND 250),
 product_id uuid NOT NULL,
 storage_location_id uuid NOT NULL,
 physical_state text NOT NULL,
 operation text NOT NULL CHECK (operation IN ('receipt','open','dispatch','transfer_in')),
 units integer NOT NULL CHECK (units > 0),
 previous_balance integer NOT NULL CHECK (previous_balance >= 0),
 new_balance integer NOT NULL CHECK (new_balance >= 0),
 reference_type text NOT NULL,
 reference_id uuid NOT NULL,
 physical_evidence_reference text NOT NULL CHECK(length(btrim(physical_evidence_reference))>0),
 created_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (product_id,storage_location_id,physical_state)
  REFERENCES public.p2_four_sealed_stock(product_id,storage_location_id,physical_state),
 CONSTRAINT p2_four_balance_movement CHECK (
  (operation IN ('receipt','transfer_in') AND new_balance=previous_balance+units)
  OR (operation IN ('open','dispatch') AND new_balance=previous_balance-units)
 )
);
CREATE INDEX p2_four_events_lookup ON public.p2_four_sealed_events
 (product_id,storage_location_id,created_at DESC);

ALTER TABLE public.p2_four_sealed_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p2_four_sealed_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY p2_four_stock_read ON public.p2_four_sealed_stock
 FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY p2_four_events_read ON public.p2_four_sealed_events
 FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
REVOKE ALL ON public.p2_four_sealed_stock, public.p2_four_sealed_events
 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.p2_four_sealed_stock, public.p2_four_sealed_events
 TO authenticated;

-- There is intentionally NO UPDATE/INSERT authorization or mutable RPC here.
-- All states initialize EMPTY; this proposal creates neither balances nor events.
-- Before any migration: decide ONE trusted writer shared with receipt/open/dispatch,
-- with: role checks, validated physical evidence, advisory lock per product/location,
-- row locks, unique event key with matching payload, one atomic transaction,
-- paired gram movements on opening only, rejection of invalid source states,
-- fail-closed of generic inventory path for these precise presentation IDs,
-- and independent physical sign-off by Operações.
-- The PR must remain DRAFT until this stage is implemented and tested.
