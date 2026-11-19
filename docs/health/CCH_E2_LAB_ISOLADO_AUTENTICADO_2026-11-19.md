# CCH E2 — laboratório SQL autenticado e descartável

**Escopo congelado:** V1.0 FROZEN; v5.4 soberano. E3 e F23 não abertas.

O GitHub Actions sobe PostgreSQL 17 em contêiner efêmero, com duas identidades fictícias, dois atletas sintéticos, versões `published` e `draft`, RLS e dados M3. A pipeline aplica as **migrações reais E2B e E2C**, extrai sem modificar a função F22 e a função `health_m3_publish_program_version` da migração F22 soberana, e percorre revisão com diff, troca, reordenação, validação estrutural, publicação manual SQL e criação de fila **somente no banco descartável**.

Verifica cruzamento entre atletas, versão publicada original intacta, fila anterior intacta, histórico M4 intacto e prevenção de publicação duplicada. Autenticação é simulada pela role PostgreSQL `authenticated` + `auth.uid()` sintético, representando as restrições do banco; **não é uma sessão HTTP autenticada do Work nem uma prova da interface visual oficial**.

A pipeline não recebe URL/credenciais da produção, não depende de Supabase remoto, não cria dados reais e não usa construtor Lovable. O contêiner é destruído ao fim do job.

**Próxima pendência:** navegador automatizado contra a interface React original com mocks conectados a esse mesmo Postgres descartável, e posteriormente homologação visual em ambiente separado. E2 deve continuar aberta até essas provas.
