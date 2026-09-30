import { isAllowedReviewOrigin, isPersistedReviewSessionActive, isPortalEnabled, revokeReviewSession, reviewAttemptIdentifier } from './security.ts';

Deno.test('origem do portal de revisão é estritamente limitada', () => {
  if (!isAllowedReviewOrigin('https://central-mind-tree.lovable.app')) throw new Error('Origem oficial deveria ser aceita');
  if (isAllowedReviewOrigin('https://malicious.example') || isAllowedReviewOrigin(null)) throw new Error('Origem indevida não pode ser aceita');
});

Deno.test('portal desativado ou expirado falha fechado', () => {
  const now = Date.parse('2026-09-29T12:00:00.000Z');
  if (isPortalEnabled({ enabled: false, expires_at: null, session_version: 1 }, now)) throw new Error('Portal desativado foi aceito');
  if (isPortalEnabled({ enabled: true, expires_at: '2026-09-29T11:59:59.000Z', session_version: 1 }, now)) throw new Error('Portal expirado foi aceito');
  if (!isPortalEnabled({ enabled: true, expires_at: '2026-09-29T12:00:01.000Z', session_version: 1 }, now)) throw new Error('Portal válido foi recusado');
});

Deno.test('identificador de tentativa combina endereço confiável e usuário', () => {
  if (reviewAttemptIdentifier('203.0.113.4', 'Revisor') === reviewAttemptIdentifier('203.0.113.4', 'Outro')) throw new Error('Usuários distintos não podem compartilhar identificador');
  if (!reviewAttemptIdentifier(null, 'Revisor').startsWith('edge-address-unavailable')) throw new Error('Fallback seguro ausente');
});

Deno.test('logout só confirma revogação persistida', async () => {
  if (!await revokeReviewSession({ revoke: async () => true }, 'session')) throw new Error('Revogação persistida deveria ser aceita');
  if (await revokeReviewSession({ revoke: async () => false }, 'session')) throw new Error('Falha de persistência não pode ser sucesso');
  if (await revokeReviewSession({ revoke: async () => { throw new Error('db'); } }, 'session')) throw new Error('Erro de persistência não pode ser sucesso');
});

Deno.test('sessão revogada, expirada ou de versão anterior não permanece válida', () => {
  const now = Date.parse('2026-09-29T12:00:00.000Z');
  const active = { expires_at: '2026-09-29T12:30:00.000Z', revoked_at: null, session_version: 3 };
  if (!isPersistedReviewSessionActive(active, 3, now)) throw new Error('Sessão ativa deveria ser aceita');
  if (isPersistedReviewSessionActive({ ...active, revoked_at: '2026-09-29T12:01:00.000Z' }, 3, now)) throw new Error('Sessão revogada não pode funcionar');
  if (isPersistedReviewSessionActive({ ...active, expires_at: '2026-09-29T11:59:59.000Z' }, 3, now)) throw new Error('Sessão expirada não pode funcionar');
  if (isPersistedReviewSessionActive(active, 4, now)) throw new Error('Incremento de session_version deve invalidar sessão anterior');
});
