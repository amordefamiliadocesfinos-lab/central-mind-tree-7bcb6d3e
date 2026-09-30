Deno.test('portal de revisão não contém acesso direto a dados produtivos ou segredos de backend', async () => {
  const files = [
    './portal.ts',
    '../../shopee-review-auth/index.ts',
  ];
  const prohibited = ['@/integrations/supabase/client', 'signInWithPassword', 'sessionStorage', 'localStorage', 'X-Shopee-Review-Session', 'Authorization'];
  for (const file of files) {
    const source = await Deno.readTextFile(new URL(file, import.meta.url));
    for (const value of prohibited) {
      if (source.includes(value)) throw new Error(`Acesso ou segredo proibido no bundle: ${file} (${value})`);
    }
  }
});

Deno.test('função deixa o token exclusivamente no cookie HttpOnly', async () => {
  const source = await Deno.readTextFile(new URL('../../shopee-review-auth/index.ts', import.meta.url));
  for (const required of ['Set-Cookie', 'sessionCookie(token, expiresAt)', 'tokenFromCookie(request)', "route === '/login'", "route === '/logout'"]) {
    if (!source.includes(required)) throw new Error(`Contrato first-party ausente: ${required}`);
  }
  if (source.includes('token, expires_in_seconds') || source.includes("headers.get('x-shopee-review-session')")) {
    throw new Error('Token legado retornado ou aceito pela função');
  }
});
