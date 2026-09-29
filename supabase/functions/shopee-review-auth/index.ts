import { createClient } from 'npm:@supabase/supabase-js@2';
import { constantTimeEqual, createReviewSession, derivePasswordHash, hashAuditIdentifier, verifyReviewSession } from '../_shared/shopee-review/auth.ts';
import { isAllowedReviewOrigin, isPersistedReviewSessionActive, isPortalEnabled, revokeReviewSession, reviewAttemptIdentifier, REVIEW_ORIGIN, type ReviewControl } from '../_shared/shopee-review/security.ts';

const MAX_BODY_BYTES = 8 * 1024;
const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60;
type ReviewSession = { id: string; expires_at: string; revoked_at: string | null; session_version: number };

function clientAddress(request: Request) {
  return request.headers.get('cf-connecting-ip');
}

function readSession(request: Request) {
  const token = request.headers.get('x-shopee-review-session');
  return token?.trim() || null;
}

function responseHeaders(request: Request) {
  const origin = request.headers.get('origin');
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...(origin === REVIEW_ORIGIN ? { 'Access-Control-Allow-Origin': REVIEW_ORIGIN, 'Vary': 'Origin' } : {}),
  };
}

const json = (request: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: responseHeaders(request) });

async function activeSession(db: any, sessionId: string, version: number) {
  const { data, error } = await db.from('shopee_review_sessions').select('id,expires_at,revoked_at,session_version').eq('id', sessionId).maybeSingle();
  return !error && isPersistedReviewSessionActive(data as ReviewSession | null, version);
}

Deno.serve(async (request) => {
  if (!isAllowedReviewOrigin(request.headers.get('origin'))) return json(request, { error: 'Origem não autorizada' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...responseHeaders(request), 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Shopee-Review-Session', 'Access-Control-Max-Age': '600' } });
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed' }, 405);
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) return json(request, { error: 'Payload too large' }, 413);

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const url = Deno.env.get('SUPABASE_URL');
  const username = Deno.env.get('SHOPEE_REVIEW_USERNAME');
  const passwordSalt = Deno.env.get('SHOPEE_REVIEW_PASSWORD_SALT');
  const passwordHash = Deno.env.get('SHOPEE_REVIEW_PASSWORD_HASH');
  const sessionSecret = Deno.env.get('SHOPEE_REVIEW_SESSION_SECRET');
  const auditSecret = Deno.env.get('SHOPEE_REVIEW_AUDIT_SECRET');
  if (!serviceRoleKey || !url || !username || !passwordSalt || !passwordHash || !sessionSecret || !auditSecret) return json(request, { error: 'Portal de revisão não configurado' }, 503);

  let input: { action?: string; username?: string; password?: string };
  try { input = await request.json(); } catch { return json(request, { error: 'JSON inválido' }, 400); }
  const db = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: control, error: controlError } = await db.from('shopee_review_portal_control').select('enabled,expires_at,session_version').eq('id', true).maybeSingle<ReviewControl>();
  if (controlError || !control || !isPortalEnabled(control)) return json(request, { error: 'Portal de revisão indisponível' }, 403);

  if (input.action === 'verify' || input.action === 'logout') {
    const token = readSession(request);
    const session = token ? await verifyReviewSession(token, sessionSecret, control.session_version) : null;
    if (!session || !await activeSession(db, session.jti, control.session_version)) return json(request, { error: 'Sessão de revisão inválida ou expirada' }, 401);
    if (input.action === 'logout') {
      const revoked = await revokeReviewSession({ revoke: async (sessionId) => {
        const { data, error } = await db.from('shopee_review_sessions').update({ revoked_at: new Date().toISOString() }).eq('id', sessionId).is('revoked_at', null).select('id').maybeSingle();
        return !error && Boolean(data?.id);
      } }, session.jti);
      if (!revoked) return json(request, { error: 'Não foi possível encerrar a sessão de revisão' }, 503);
    }
    return json(request, { ok: true, expires_at: new Date(session.exp * 1000).toISOString() });
  }

  if (input.action !== 'login' || typeof input.username !== 'string' || typeof input.password !== 'string') return json(request, { error: 'Solicitação inválida' }, 400);
  const attemptKey = await hashAuditIdentifier(reviewAttemptIdentifier(clientAddress(request), input.username), auditSecret);
  const { data: attempt, error: attemptError } = await db.rpc('consume_shopee_review_login_attempt', { p_attempt_key: attemptKey, p_max_attempts: MAX_ATTEMPTS, p_window_seconds: WINDOW_SECONDS });
  if (attemptError || !attempt?.allowed) return json(request, { error: 'Muitas tentativas. Aguarde antes de tentar novamente.' }, 429);

  const suppliedHash = await derivePasswordHash(input.password, passwordSalt);
  const valid = constantTimeEqual(input.username.trim(), username) && constantTimeEqual(suppliedHash, passwordHash);
  await db.rpc('complete_shopee_review_login_attempt', { p_attempt_id: attempt.attempt_id, p_outcome: valid ? 'success' : 'failure' });
  if (!valid) return json(request, { error: 'Credenciais de revisão inválidas' }, 401);

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const { data: sessionRecord, error: sessionError } = await db.from('shopee_review_sessions').insert({ expires_at: expiresAt, session_version: control.session_version }).select('id').single();
  if (sessionError || !sessionRecord?.id) return json(request, { error: 'Não foi possível criar a sessão de revisão' }, 503);
  const token = await createReviewSession(sessionSecret, control.session_version, sessionRecord.id);
  return json(request, { token, expires_in_seconds: 30 * 60 });
});
