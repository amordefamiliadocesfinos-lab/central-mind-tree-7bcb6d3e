import { constantTimeEqual, createReviewSession, derivePasswordHash, verifyReviewSession } from './auth.ts';

Deno.test('sessão de revisão expira em 30 minutos e não é JWT do Supabase', async () => {
  const token = await createReviewSession('test-secret', 4, '00000000-0000-4000-8000-000000000001', 0);
  if ((await verifyReviewSession(token, 'test-secret', 4, 30 * 60 * 1000)) === null) throw new Error('Sessão deveria ser válida no limite');
  if ((await verifyReviewSession(token, 'test-secret', 4, 30 * 60 * 1000 + 1)) !== null) throw new Error('Sessão vencida foi aceita');
  if (token.split('.').length !== 2) throw new Error('Token de revisão não deve ser um JWT de três partes');
});

Deno.test('sessão é invalidada por rotação de versão ou assinatura', async () => {
  const token = await createReviewSession('test-secret', 1, '00000000-0000-4000-8000-000000000001', 0);
  if ((await verifyReviewSession(token, 'test-secret', 2, 1)) !== null) throw new Error('Versão diferente deve revogar sessão');
  if ((await verifyReviewSession(token, 'other-secret', 1, 1)) !== null) throw new Error('Segredo diferente deve revogar sessão');
});

Deno.test('hash PBKDF2 e comparação constante validam somente a senha correta', async () => {
  const salt = 'c2hv cGVlLXJldmlldy1zYWx0'.replaceAll(' ', '');
  const expected = await derivePasswordHash('senha-correta', salt);
  if (!constantTimeEqual(expected, await derivePasswordHash('senha-correta', salt))) throw new Error('Senha correta não validou');
  if (constantTimeEqual(expected, await derivePasswordHash('senha-incorreta', salt))) throw new Error('Senha incorreta validou');
});
