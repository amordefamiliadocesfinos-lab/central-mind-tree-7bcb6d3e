-- FIN E1.2/E1.3 | Controlled additive FUNCTION-only change | 2026-11-27
-- Authorized by proprietor: round FINAL monetary aggregate to 2 decimals for NEW unified sales.
-- Does not modify rows, item prices/quantities, legacy permissions, wrapper, identities or history.
-- Prior reviewed source: PR #1188, CI #46028932342.
-- PostgreSQL DO is one atomic statement; any failed assertion rolls back CREATE OR REPLACE.
-- Allows idempotent re-application if Lovable Cloud already deployed the identical reviewed function.
DO $fin_e1$
DECLARE
  v_signature constant text := 'public.create_unified_sale_unguarded_01b(jsonb,jsonb)';
  v_baseline_hash constant text := '9116e5ed4d37c3d31c89c3228a5aca2f';
  v_approved_hash constant text := '062c28d51539641e2b86b943603556af';
  v_old constant text := 'v_total := GREATEST(v_subtotal - v_discount + v_shipping, 0);';
  v_new constant text := 'v_total := round(GREATEST(v_subtotal - v_discount + v_shipping, 0), 2);';
  v_proc regprocedure := to_regprocedure('public.create_unified_sale_unguarded_01b(jsonb,jsonb)');
  v_oid oid;
  v_owner oid;
  v_acl aclitem[];
  v_source text;
  v_target text;
  v_security_definer boolean;
  v_owner_after oid;
  v_acl_after aclitem[];
  v_security_after boolean;
  v_oid_after oid;
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);
  PERFORM set_config('statement_timeout', '30s', true);
  PERFORM pg_advisory_xact_lock(hashtext('fin_e1_sale_monetary_boundary'));
  IF v_proc IS NULL THEN
    RAISE EXCEPTION 'FIN E1.3 aborted: canonical sale helper missing';
  END IF;
  SELECT p.oid, p.proowner, p.proacl, p.prosecdef, pg_get_functiondef(p.oid)
    INTO v_oid, v_owner, v_acl, v_security_definer, v_source
    FROM pg_proc p WHERE p.oid = v_proc;
  IF v_security_definer IS DISTINCT FROM true
     OR has_function_privilege('anon', v_proc, 'EXECUTE')
     OR has_function_privilege('authenticated', v_proc, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_proc, 'EXECUTE')
  THEN
    RAISE EXCEPTION 'FIN E1.3 aborted: security/ACL baseline differs';
  END IF;
  IF md5(v_source) = v_approved_hash THEN
    RAISE NOTICE 'FIN E1.3 already applied; no changes';
    RETURN;
  END IF;
  IF md5(v_source) <> v_baseline_hash THEN
    RAISE EXCEPTION 'FIN E1.3 aborted: unexpected function definition (%)', md5(v_source);
  END IF;
  v_target := replace(v_source, v_old, v_new);
  IF v_target = v_source OR md5(v_target) <> v_approved_hash THEN
    RAISE EXCEPTION 'FIN E1.3 aborted: unexpected source transformation';
  END IF;
  EXECUTE v_target;
  SELECT p.oid, p.proowner, p.proacl, p.prosecdef
    INTO v_oid_after, v_owner_after, v_acl_after, v_security_after
    FROM pg_proc p WHERE p.oid = v_proc;
  IF v_oid_after IS DISTINCT FROM v_oid
    OR v_owner_after IS DISTINCT FROM v_owner
    OR v_acl_after IS DISTINCT FROM v_acl
    OR v_security_after IS DISTINCT FROM v_security_definer
    OR md5(pg_get_functiondef(v_proc)) <> v_approved_hash
    OR has_function_privilege('anon', v_proc, 'EXECUTE')
    OR has_function_privilege('authenticated', v_proc, 'EXECUTE')
    OR NOT has_function_privilege('service_role', v_proc, 'EXECUTE')
  THEN
    RAISE EXCEPTION 'FIN E1.3 aborted: post-change function/ACL mismatch';
  END IF;
  RAISE NOTICE 'FIN E1.3 applied: final aggregate rounded, function/owner/ACL preserved';
END
$fin_e1$;
