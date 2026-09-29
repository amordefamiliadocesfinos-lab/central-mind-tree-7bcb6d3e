Deno.test('portal de revisão não contém acesso direto a dados produtivos ou segredos de backend', async () => {
  const files = [
    '../../../../src/pages/ShopeeReviewLogin.tsx',
    '../../../../src/pages/ShopeeReviewPortal.tsx',
    '../../../../src/shopee-review/ReviewSessionContext.tsx',
    '../../../../src/shopee-review/fixtures.ts',
  ];
  const prohibited = ['@/integrations/supabase/client', 'signInWithPassword', '.from(', '.rpc(', 'SUPABASE_SERVICE_ROLE_KEY', 'SHOPEE_REVIEW_PASSWORD_HASH'];
  for (const file of files) {
    const source = await Deno.readTextFile(new URL(file, import.meta.url));
    for (const value of prohibited) {
      if (source.includes(value)) throw new Error(`Acesso ou segredo proibido no bundle: ${file} (${value})`);
    }
  }
});
