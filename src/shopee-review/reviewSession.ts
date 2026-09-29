const STORAGE_KEY = 'pc.shopee-review.session';

type LoginResponse = { token?: string; expires_in_seconds?: number; error?: string };
type VerifyResponse = { ok?: boolean; expires_at?: string; error?: string };

function apiUrl() {
  const base = import.meta.env.VITE_SUPABASE_URL;
  return base ? `${base}/functions/v1/shopee-review-auth` : null;
}

async function request(payload: Record<string, unknown>, token?: string) {
  const url = apiUrl();
  if (!url) throw new Error('Portal de revisão não configurado neste ambiente.');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Shopee-Review-Session': token } : {}),
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error || 'Não foi possível validar o acesso de revisão.');
  return body;
}

export function getStoredReviewSession() {
  return sessionStorage.getItem(STORAGE_KEY);
}

export function clearStoredReviewSession() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export async function loginReview(username: string, password: string) {
  const body = await request({ action: 'login', username, password }) as LoginResponse;
  if (!body.token) throw new Error('Resposta de revisão inválida.');
  sessionStorage.setItem(STORAGE_KEY, body.token);
  return body.expires_in_seconds ?? 0;
}

export async function verifyReviewSession() {
  const token = getStoredReviewSession();
  if (!token) return null;
  try {
    const body = await request({ action: 'verify' }, token) as VerifyResponse;
    return body.ok ? body.expires_at ?? null : null;
  } catch {
    clearStoredReviewSession();
    return null;
  }
}

export async function logoutReview() {
  const token = getStoredReviewSession();
  try {
    if (token) await request({ action: 'logout' }, token);
  } finally {
    clearStoredReviewSession();
  }
}
