import { createHash } from 'node:crypto';

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function fromBase64Url(value, field) {
  try {
    const buffer = Buffer.from(requiredText(value, field), 'base64url');
    if (buffer.length === 0) throw new Error('empty');
    return buffer;
  } catch {
    throw new TypeError(`${field} must be valid base64url`);
  }
}

function toBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

export async function encryptShopeeToken(token, secret) {
  const normalizedToken = requiredText(token, 'token');
  const normalizedSecret = requiredText(secret, 'secret');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyBytes = createHash('sha256').update(normalizedSecret).digest();
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt']);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(normalizedToken),
  ));
  return `${toBase64Url(iv)}.${toBase64Url(encrypted)}`;
}

export async function decryptShopeeToken(ciphertext, secret) {
  const normalizedCiphertext = requiredText(ciphertext, 'ciphertext');
  const normalizedSecret = requiredText(secret, 'secret');
  const parts = normalizedCiphertext.split('.');
  if (parts.length !== 2) throw new TypeError('ciphertext must contain iv and encrypted payload');

  const iv = fromBase64Url(parts[0], 'ciphertext iv');
  const encrypted = fromBase64Url(parts[1], 'ciphertext payload');
  if (iv.length !== 12) throw new TypeError('ciphertext iv must be 12 bytes');

  const keyBytes = createHash('sha256').update(normalizedSecret).digest();
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
  try {
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    return new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
  } catch {
    throw new Error('token_decryption_failed');
  }
}
