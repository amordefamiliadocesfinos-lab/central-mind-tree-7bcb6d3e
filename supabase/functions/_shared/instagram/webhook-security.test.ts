import { hasValidMetaSignature, isInstagramWebhookVerification } from './webhook-security.ts';

Deno.test('aceita somente a verificação GET com token configurado', () => {
  const valid = new URL('https://example.test?hub.mode=subscribe&hub.verify_token=token-sanitizado&hub.challenge=123');
  const invalid = new URL('https://example.test?hub.mode=subscribe&hub.verify_token=outro');
  if (!isInstagramWebhookVerification(valid, 'token-sanitizado')) throw new Error('Verificação válida foi rejeitada');
  if (isInstagramWebhookVerification(invalid, 'token-sanitizado')) throw new Error('Verificação inválida foi aceita');
});

Deno.test('valida HMAC SHA-256 e rejeita assinatura inválida', async () => {
  const raw = '{"object":"instagram"}';
  const secret = 'secret-sanitizado';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  const signature = `sha256=${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  if (!await hasValidMetaSignature(raw, signature, secret)) throw new Error('Assinatura válida foi rejeitada');
  if (await hasValidMetaSignature(raw, 'sha256:invalida', secret)) throw new Error('Assinatura inválida foi aceita');
});
