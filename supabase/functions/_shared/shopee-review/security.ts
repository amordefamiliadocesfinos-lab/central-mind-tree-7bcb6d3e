export const REVIEW_ORIGIN = 'https://central-mind-tree.lovable.app';

export type ReviewControl = { enabled: boolean; expires_at: string | null; session_version: number };

export function isAllowedReviewOrigin(origin: string | null) {
  return origin === REVIEW_ORIGIN;
}

export function isPortalEnabled(control: ReviewControl | null, now = Date.now()) {
  if (!control?.enabled) return false;
  return !control.expires_at || Date.parse(control.expires_at) > now;
}

export function reviewAttemptIdentifier(address: string | null, username: string) {
  // cf-connecting-ip is supplied by the Supabase/Cloudflare edge. If unavailable,
  // a stable fallback plus the credential identifier fails closed into one bucket.
  return `${address?.trim() || 'edge-address-unavailable'}\u0000${username.trim().toLowerCase()}`;
}

export type ReviewSessionStore = {
  revoke: (sessionId: string) => Promise<boolean>;
};

export type PersistedReviewSession = {
  expires_at: string;
  revoked_at: string | null;
  session_version: number;
};

export function isPersistedReviewSessionActive(session: PersistedReviewSession | null, expectedVersion: number, now = Date.now()) {
  if (!session) return false;
  return session.revoked_at === null && session.session_version === expectedVersion && Date.parse(session.expires_at) > now;
}

export async function revokeReviewSession(store: ReviewSessionStore, sessionId: string) {
  try {
    return await store.revoke(sessionId);
  } catch {
    return false;
  }
}
