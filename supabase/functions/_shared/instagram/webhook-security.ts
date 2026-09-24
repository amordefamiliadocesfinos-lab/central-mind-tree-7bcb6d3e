function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

export function isInstagramWebhookVerification(url: URL, verifyToken: string) {
  return url.searchParams.get('hub.mode') === 'subscribe'
    && Boolean(verifyToken)
    && url.searchParams.get('hub.verify_token') === verifyToken;
}

export async function hasValidMetaSignature(raw: string, signature: string | null, secret: string) {
  if (!secret || !signature?.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  const expected = `sha256=${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  return equal(expected, signature);
}
