-- P2 design only: UNAPPLIED candidate for both canonical receipt and order
-- generic inventory loops. Requires a verified sealed ledger and canonical
-- routing before any call site is enabled. Do not deploy this independently.
--
-- The generic loop must not silently consume/credit grams for these four
-- products. Any nonstandard P2 presentation remains quarantined pending a
-- separate, explicit policy for loose/opened quantities. This function is
-- a proposed guard; it does NOT modify the existing live entrypoints.
CREATE OR REPLACE FUNCTION public.p2_four_assert_generic_inventory_safe(
 p_product_id uuid, p_presentation_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $p2$
BEGIN
 IF p_product_id IN (
   '0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b'::uuid,
   '6f43ad65-74d5-4db9-b931-1ecd6d124987'::uuid,
   'ef118d1c-e7c7-45e3-b796-3a9908840f3c'::uuid,
   'd913f0f2-4893-4985-9976-fcd9119a57b1'::uuid
 ) THEN
   RAISE EXCEPTION 'p2_four_original_or_ambiguous_inventory_requires_sealed_routing';
 END IF;
END;
$p2$;
REVOKE ALL ON FUNCTION public.p2_four_assert_generic_inventory_safe(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;

-- FUTURE INTEGRATION (not implemented in this proposal):
-- 1. Receipt: recognize official purchase_presentation IDs BEFORE generic
--    INSERT INTO inventory, call p2_four_apply_internal in same transaction.
--    For all remaining lines call the guard before generic stock writes.
-- 2. Order: recognize official commercial_presentation IDs BEFORE generic
--    UPDATE inventory, call p2_four_apply_internal for the original physical
--    state in the same transaction. Exclude recognized lines from generic
--    grouping; guard all ambiguous P2 products, even if ID is NULL.
-- 3. Canonical wrapper must verify order/receipt ownership, lifecycle,
--    per-line identity, qty, verified physical ledger, signed evidence,
--    active location, authorized actor, and operation event key.
-- 4. Keep #416/#418 fail-closed protections active through separate
--    staging authorization and tested cutover.
-- 5. Revalidate any legitimate non-original loose-gram transactions via
--    separate approved policy; never silently exempt them here.
