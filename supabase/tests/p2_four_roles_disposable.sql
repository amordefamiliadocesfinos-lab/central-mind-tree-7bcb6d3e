-- DISPOSABLE PostgreSQL 17 ONLY. Role/access regression on P2 candidates.
-- Requires synthetic schema, P2 proposals, and canonical candidate functions.
-- The tests do not simulate a real JWT or real authorization; they ensure
-- no direct DB execution permission was accidentally exposed by DDL.
BEGIN;
DO $p2$
DECLARE
 n integer;
 fname text;
 signature text;
BEGIN
 IF to_regclass('public.p2_disposable_test_marker') IS NULL
 THEN RAISE EXCEPTION 'p2_role_test_requires_disposable_database';END IF;
 FOR signature IN SELECT unnest(ARRAY[
  'public.p2_four_apply_internal(text,text,integer,uuid,text,text,uuid,text,uuid)',
  'public.p2_four_receipt_adapter_candidate(uuid,uuid,uuid,numeric,numeric,uuid,uuid,uuid)',
  'public.p2_four_dispatch_adapter_candidate(uuid,uuid,uuid,numeric,numeric,uuid,uuid)',
  'public.p2_four_assert_generic_inventory_safe(uuid,uuid)'
 ]) LOOP
  IF to_regprocedure(signature) IS NULL THEN
   RAISE EXCEPTION 'p2_function_missing: %',signature;
  END IF;
  IF has_function_privilege('anon',signature,'EXECUTE')
    OR has_function_privilege('authenticated',signature,'EXECUTE')
    OR has_function_privilege('service_role',signature,'EXECUTE')
  THEN RAISE EXCEPTION 'p2_direct_rpc_exposed: %',signature;
  END IF;
 END LOOP;
 -- The finalizer and stock event are privileged internal entrypoints.
 -- A client-writable custom GUC cannot grant EXECUTE on their own.
 FOR signature IN SELECT unnest(ARRAY[
  'public.apply_order_stock_event(uuid,text)',
  'public.finalize_order_separation_unguarded_01b(uuid)'
 ]) LOOP
  IF to_regprocedure(signature) IS NULL THEN RAISE EXCEPTION 'p2_canonical_function_missing: %',signature; END IF;
  IF has_function_privilege('anon',signature,'EXECUTE')
     OR has_function_privilege('authenticated',signature,'EXECUTE')
  THEN RAISE EXCEPTION 'p2_canonical_internal_exposed: %',signature; END IF;
  IF has_function_privilege('service_role',signature,'EXECUTE')
  THEN RAISE EXCEPTION 'p2_service_role_internal_access_forbidden: %',signature; END IF;
 END LOOP;
 SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
 WHERE ns.nspname='public'
  AND p.proname IN (
   'p2_four_apply_internal',
   'p2_four_receipt_adapter_candidate',
   'p2_four_dispatch_adapter_candidate'
  ) AND p.prosecdef IS TRUE
    AND EXISTS (
      SELECT 1 FROM unnest(p.proconfig) AS setting
      WHERE setting LIKE 'search_path=%'
        AND setting NOT LIKE '%public%'
        AND setting NOT LIKE '%pg_temp%'
    );
 IF n<>3 THEN RAISE EXCEPTION 'p2_definer_search_path_not_locked: %',n;END IF;
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='public'
 AND c.relname IN ('p2_four_sealed_stock','p2_four_sealed_events')
 AND c.relrowsecurity IS TRUE;
 IF n<>2 THEN RAISE EXCEPTION 'p2_ledger_rls_disabled';END IF;
 IF has_table_privilege('anon','public.p2_four_sealed_stock','SELECT')
 OR has_table_privilege('anon','public.p2_four_sealed_events','SELECT')
 OR has_table_privilege('authenticated','public.p2_four_sealed_stock','UPDATE')
 OR has_table_privilege('authenticated','public.p2_four_sealed_events','INSERT')
 OR has_table_privilege('service_role','public.p2_four_sealed_stock','UPDATE')
 THEN RAISE EXCEPTION 'p2_broad_ledger_grant';END IF;
END $p2$;
-- Exercise SQL access as separate roles (not as owner). SET ROLE does not
-- simulate auth.uid(), so this verifies permissions, not user role policies.
SET LOCAL ROLE authenticated;
DO $p2$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.p2_four_apply_internal('sorbato','receipt',1,
   'b1ef7322-86f9-4cf4-9d52-39ba32911ef6',
   'role-test:'||gen_random_uuid()::text,'purchase_receipt',
   gen_random_uuid(),'UNTRUSTED ROLE',
   'c9d1d89d-366a-42c0-b691-f56bad36af7f');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'p2_authenticated_direct_mutation_allowed';END IF;
 -- Spoofing a transaction-local GUC is NOT authorization. Database grants
 -- must still block an authenticated caller from invoking stock debits.
 PERFORM set_config('app.p2_four_separation_order_id',gen_random_uuid()::text,true);
 denied:=false;
 BEGIN
  PERFORM public.apply_order_stock_event(gen_random_uuid(),'shipped');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'p2_spoofed_guc_bypassed_acl';END IF;
 denied:=false;
 BEGIN
  PERFORM public.finalize_order_separation_unguarded_01b(gen_random_uuid());
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'p2_authenticated_can_call_internal_finalizer';END IF;
END $p2$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $p2$
DECLARE denied boolean := false;
BEGIN
 BEGIN
  PERFORM public.apply_order_stock_event(gen_random_uuid(),'shipped');
 EXCEPTION WHEN insufficient_privilege THEN denied := true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'p2_internal_execute_permission_regression'; END IF;
 denied := false;
 BEGIN
  PERFORM public.finalize_order_separation_unguarded_01b(gen_random_uuid());
 EXCEPTION WHEN insufficient_privilege THEN denied := true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'p2_internal_finalizer_permission_regression'; END IF;
END $p2$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $p2$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.p2_four_dispatch_adapter_candidate(
   '6f43ad65-74d5-4db9-b931-1ecd6d124987',NULL,
   '684d4a55-5d3a-4c18-be47-818a1a3bc074',1,1000,
   gen_random_uuid(),gen_random_uuid());
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'p2_anon_direct_dispatch_allowed';END IF;
END $p2$;
RESET ROLE;
ROLLBACK;
