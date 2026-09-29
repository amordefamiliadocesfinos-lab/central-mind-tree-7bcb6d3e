Deno.test('a migration limita tentativas de forma serializada e exclusiva ao service role', async () => {
  const migration = await Deno.readTextFile(new URL('../../../migrations/20260929120000_shopee_review_portal_isolation.sql', import.meta.url));
  for (const requiredClause of [
    "pg_advisory_xact_lock(hashtext('shopee-review:' || p_attempt_key))",
    'p_max_attempts < 1 or p_max_attempts > 10',
    'p_window_seconds < 60 or p_window_seconds > 3600',
    'revoke all on function public.consume_shopee_review_login_attempt(text, integer, integer) from public, anon, authenticated',
    'grant execute on function public.consume_shopee_review_login_attempt(text, integer, integer) to service_role',
  ]) {
    if (!migration.includes(requiredClause)) throw new Error(`Contrato de rate limit ausente: ${requiredClause}`);
  }
});
