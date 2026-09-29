export const REVIEW_SESSION_AUDIENCE = 'shopee-review';
export const REVIEW_SESSION_TTL_SECONDS = 30 * 60;
export const PBKDF2_ITERATIONS = 310_000;

export type ReviewSessionPayload = {
  aud: typeof REVIEW_SESSION_AUDIENCE;
  exp: number;
  iat: number;
  jti: string;
  sub: 'shopee-review';
  version: number;
};

const encoder = new TextEncoder();

function base64urlEncode(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function base64urlDecode(value: string) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

export function constantTimeEqual(left: string, right: string) {
  let mismatch = left.length ^ right.length;
  const maxLength = Math.max(left.length, right.length);
  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

export async function derivePasswordHash(password: string, salt: string) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: base64urlDecode(salt), iterations: PBKDF2_ITERATIONS }, material, 256);
  return base64urlEncode(new Uint8Array(bits));
}

export async function hashAuditIdentifier(value: string, auditSecret: string) {
  return base64urlEncode(await hmac(value, auditSecret));
}

export async function createReviewSession(secret: string, version: number, sessionId: string, now = Date.now()) {
  const payload: ReviewSessionPayload = {
    aud: REVIEW_SESSION_AUDIENCE,
    exp: Math.floor(now / 1000) + REVIEW_SESSION_TTL_SECONDS,
    iat: Math.floor(now / 1000),
    jti: sessionId,
    sub: 'shopee-review',
    version,
  };
  const encodedPayload = base64urlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = base64urlEncode(await hmac(encodedPayload, secret));
  return `${encodedPayload}.${signature}`;
}

export async function verifyReviewSession(token: string, secret: string, version: number, now = Date.now()): Promise<ReviewSessionPayload | null> {
  const [encodedPayload, signature, ...extra] = token.split('.');
  if (!encodedPayload || !signature || extra.length) return null;
  const expectedSignature = base64urlEncode(await hmac(encodedPayload, secret));
  if (!constantTimeEqual(signature, expectedSignature)) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(encodedPayload))) as ReviewSessionPayload;
    const currentSeconds = Math.floor(now / 1000);
    if (payload.aud !== REVIEW_SESSION_AUDIENCE || payload.sub !== 'shopee-review' || payload.version !== version || !payload.jti) return null;
    if (!Number.isInteger(payload.exp) || !Number.isInteger(payload.iat) || payload.exp <= currentSeconds || payload.exp - payload.iat > REVIEW_SESSION_TTL_SECONDS) return null;
    return payload;
  } catch {
    return null;
  }
}
