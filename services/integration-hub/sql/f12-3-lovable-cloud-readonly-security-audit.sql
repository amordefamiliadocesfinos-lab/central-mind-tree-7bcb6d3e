-- F12.3 ADÃO — ONLY READ-ONLY INTEGRITY AUDIT.
-- Execute via authorized Lovable Cloud SQL access. Do not use external
-- Supabase management project. No transactions, no RPC invocation.
-- Output is metadata; never print secret/HMAC, buyer or order numbers.
SELECT
  p.proname AS action_name,
  p.prosecdef AS security_definer,
  pg_get_function_identity_arguments(p.oid) AS signature,
  has_function_privilege('service_role',p.oid,'EXECUTE') AS service_role_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute
FROM pg_proc p
WHERE p.pronamespace='public'::regnamespace
  AND p.proname IN (
    'acquire_shopee_adao_f12_discovery',
    'stage_shopee_adao_f12_discovery',
    'resume_shopee_adao_f12_staged',
    'ack_shopee_adao_f12_discovery'
  )
ORDER BY p.proname;

SELECT
  COUNT(*)::integer AS checkpoint_rows,
  (COUNT(*) FILTER (WHERE phase='staged'))::integer AS staged_rows,
  (COUNT(*) FILTER (
    WHERE channel_account_id<>'b4027369-5abf-4ac1-ab24-862334fae892'::uuid
      OR shop_id<>1156446003
  ))::integer AS out_of_scope_rows
FROM public.shopee_adao_f12_discovery_state;
