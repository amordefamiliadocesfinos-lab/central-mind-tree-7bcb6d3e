-- ISOLATED TEST ONLY: run after applying the UNAPPLIED proposal to a
-- disposable PostgreSQL clone. NEVER run this against the production Cloud.
-- Read-only catalog assertions and ROLLBACK. This is not a transactional
-- movement/receiving/dispatch test (those entrypoints do not exist yet).
BEGIN;
DO $p2$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='public' AND c.relname IN ('p2_four_sealed_stock','p2_four_sealed_events');
 IF n<>2 THEN RAISE EXCEPTION 'p2_missing_candidate_tables'; END IF;
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='public' AND c.relname IN ('p2_four_sealed_stock','p2_four_sealed_events')
   AND c.relrowsecurity;
 IF n<>2 THEN RAISE EXCEPTION 'p2_rls_required'; END IF;
 IF has_table_privilege('anon','public.p2_four_sealed_stock','SELECT')
 OR has_table_privilege('anon','public.p2_four_sealed_stock','INSERT')
 OR has_table_privilege('authenticated','public.p2_four_sealed_stock','INSERT')
 OR has_table_privilege('authenticated','public.p2_four_sealed_events','INSERT')
 OR has_table_privilege('authenticated','public.p2_four_sealed_stock','UPDATE')
 OR has_table_privilege('authenticated','public.p2_four_sealed_events','DELETE')
 THEN RAISE EXCEPTION 'p2_public_write_or_read_access'; END IF;
 SELECT count(*) INTO n FROM public.p2_four_sealed_stock;
 IF n<>0 THEN RAISE EXCEPTION 'p2_unapproved_initial_balances'; END IF;
 SELECT count(*) INTO n FROM public.p2_four_sealed_events;
 IF n<>0 THEN RAISE EXCEPTION 'p2_unapproved_initial_events'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='p2_four_state_identity')
 OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='p2_four_balance_movement')
 THEN RAISE EXCEPTION 'p2_identity_or_movement_constraint_missing'; END IF;
END $p2$;
ROLLBACK;
