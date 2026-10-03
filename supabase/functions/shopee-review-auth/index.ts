import { createClient } from 'npm:@supabase/supabase-js@2';
import { constantTimeEqual, createReviewSession, derivePasswordHash, hashAuditIdentifier, verifyReviewSession } from '../_shared/shopee-review/auth.ts';
import { isPersistedReviewSessionActive, isPortalEnabled, revokeReviewSession, reviewAttemptIdentifier, type ReviewControl } from '../_shared/shopee-review/security.ts';
import { createNonce, expiredSessionCookie, parseCookie, renderPortalPage, REVIEW_COOKIE_NAME, reviewFixtures, routeFromRequestPath, securityHeaders, sessionCookie } from '../_shared/shopee-review/portal.ts';

const MAX_BODY_BYTES = 8 * 1024;
const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60;
type ReviewSession = { id: string; expires_at: string; revoked_at: string | null; session_version: number };

function clientAddress(request: Request) { return request.headers.get('cf-connecting-ip'); }
function functionOrigin(request: Request) { return new URL(request.url).origin; }
function canonicalProjectOrigin() {
  const url = Deno.env.get('SUPABASE_URL');
  if (!url) return null;
  try { return new URL(url).origin; } catch { return null; }
}
function isOwnOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  return origin === functionOrigin(request) || origin === canonicalProjectOrigin();
}
function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...securityHeaders(createNonce(), 'application/json; charset=utf-8'), ...extra } });
}
function html(available: boolean) {
  const nonce = createNonce();
  return new Response(renderPortalPage(nonce, available), { status: 200, headers: securityHeaders(nonce, 'text/html; charset=utf-8') });
}
async function activeSession(load: () => Promise<{ data: ReviewSession | null; error: unknown }>, version: number) {
  const { data, error } = await load();
  return !error && isPersistedReviewSessionActive(data as ReviewSession | null, version);
}
function requireJsonPost(request: Request) {
  return request.method === 'POST' && request.headers.get('content-type')?.split(';')[0] === 'application/json' && isOwnOrigin(request);
}
function tokenFromCookie(request: Request) { return parseCookie(request.headers.get('cookie'), REVIEW_COOKIE_NAME); }

Deno.serve(async (request) => {
  const route = routeFromRequestPath(new URL(request.url).pathname);
  if (request.method === 'GET' && route === '/') {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const url = Deno.env.get('SUPABASE_URL');
    if (!serviceRoleKey || !url) return html(false);
    const db = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data } = await db.from('shopee_review_portal_control').select('enabled,expires_at,session_version').eq('id', true).maybeSingle<ReviewControl>();
    return html(isPortalEnabled(data));
  }
  if (route === '/login' || route === '/logout') {
    if (!requireJsonPost(request)) return json({ error: 'Origem ou formato de solicitação não autorizado' }, 403, { 'Set-Cookie': expiredSessionCookie() });
  } else if (route !== '/session' && route !== '/data') return json({ error: 'Rota não encontrada' }, 404);
  if (request.method !== 'GET' && request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) return json({ error: 'Payload too large' }, 413);

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const url = Deno.env.get('SUPABASE_URL');
  const username = Deno.env.get('SHOPEE_REVIEW_USERNAME');
  const passwordSalt = Deno.env.get('SHOPEE_REVIEW_PASSWORD_SALT');
  const passwordHash = Deno.env.get('SHOPEE_REVIEW_PASSWORD_HASH');
  const sessionSecret = Deno.env.get('SHOPEE_REVIEW_SESSION_SECRET');
  const auditSecret = Deno.env.get('SHOPEE_REVIEW_AUDIT_SECRET');
  if (!serviceRoleKey || !url || !username || !passwordSalt || !passwordHash || !sessionSecret || !auditSecret) return json({ error: 'Portal de revisão não configurado' }, 503);
  const db = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: control, error: controlError } = await db.from('shopee_review_portal_control').select('enabled,expires_at,session_version').eq('id', true).maybeSingle<ReviewControl>();
  if (controlError || !control || !isPortalEnabled(control)) return json({ error: 'Portal de revisão indisponível' }, 403, { 'Set-Cookie': expiredSessionCookie() });

  if (route === '/login') {
    let input: { username?: string; password?: string };
    try { input = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
    if (typeof input.username !== 'string' || typeof input.password !== 'string') return json({ error: 'Solicitação inválida' }, 400);
    const attemptKey = await hashAuditIdentifier(reviewAttemptIdentifier(clientAddress(request), input.username), auditSecret);
    const { data: attempt, error: attemptError } = await db.rpc('consume_shopee_review_login_attempt', { p_attempt_key: attemptKey, p_max_attempts: MAX_ATTEMPTS, p_window_seconds: WINDOW_SECONDS });
    if (attemptError || !attempt?.allowed) return json({ error: 'Muitas tentativas. Aguarde antes de tentar novamente.' }, 429);
    const valid = constantTimeEqual(input.username.trim(), username) && constantTimeEqual(await derivePasswordHash(input.password, passwordSalt), passwordHash);
    await db.rpc('complete_shopee_review_login_attempt', { p_attempt_id: attempt.attempt_id, p_outcome: valid ? 'success' : 'failure' });
    if (!valid) return json({ error: 'Credenciais de revisão inválidas' }, 401);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const { data: sessionRecord, error: sessionError } = await db.from('shopee_review_sessions').insert({ expires_at: expiresAt, session_version: control.session_version }).select('id').single();
    if (sessionError || !sessionRecord?.id) return json({ error: 'Não foi possível criar a sessão de revisão' }, 503);
    const token = await createReviewSession(sessionSecret, control.session_version, sessionRecord.id);
    return json({ ok: true, expires_at: expiresAt }, 200, { 'Set-Cookie': sessionCookie(token, expiresAt) });
  }

  const token = tokenFromCookie(request);
  const session = token ? await verifyReviewSession(token, sessionSecret, control.session_version) : null;
  if (!session || !await activeSession(async () => {
    const { data, error } = await db.from('shopee_review_sessions').select('id,expires_at,revoked_at,session_version').eq('id', session.jti).maybeSingle();
    return { data: data as ReviewSession | null, error };
  }, control.session_version)) return json({ error: 'Sessão de revisão inválida ou expirada' }, 401, { 'Set-Cookie': expiredSessionCookie() });
  if (route === '/session') return json({ ok: true, expires_at: new Date(session.exp * 1000).toISOString() });
  if (route === '/data') return json(reviewFixtures);
  const revoked = await revokeReviewSession({ revoke: async (sessionId) => {
    const { data, error } = await db.from('shopee_review_sessions').update({ revoked_at: new Date().toISOString() }).eq('id', sessionId).is('revoked_at', null).select('id').maybeSingle();
    return !error && Boolean(data?.id);
  } }, session.jti);
  if (!revoked) return json({ error: 'Não foi possível encerrar a sessão de revisão' }, 503);
  return json({ ok: true }, 200, { 'Set-Cookie': expiredSessionCookie() });
});
