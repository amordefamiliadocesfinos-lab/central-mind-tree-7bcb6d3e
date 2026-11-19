# CCH E2 — laboratório React autenticado e descartável

**Mapas:** CCH V1.0 FROZEN e soberano v5.4. Não iniciar E3 ou F23.

A PR #974 acrescenta teste de ciclo SQL integral; esta etapa amplia a verificação para o **componente React real** `HealthProgramPage.tsx` carregado no Vite dentro de um GitHub Actions temporário. Seus hooks Supabase são substituídos **somente no bundle de teste** por hooks ligados a um servidor HTTP local e banco PostgreSQL 17 descartável. Não existem chaves, URLs, tokens, contas ou registros de produção nesse processo.

O navegador abre um login **sintético**, recebe cookie HttpOnly para uma das duas identidades de fixture e acessa a interface React original. O backend faz `SET LOCAL ROLE authenticated` e `auth.uid()` por solicitação. O teste percorre objetivo, recuperação, dor, proposta antes/depois, cancelamento sem escrita, edição com justificativa, troca de ordem, substituição provisória, prévia F22 e publicação M3 para gerar somente a fila sintética. Verifica também acesso cruzado negado, proteção do histórico, idempotência e erros React; salva capturas como artefato temporário.

**Separação das provas:**
- Teste do motor: unidade sintética.
- Testes SQL E2B/E2C/F22/M3: contratos reais executados em banco descartável.
- Navegador: componente React original, porém hooks/banco substituídos em build isolado; **não** prova a implantação remota oficial.
- Work no navegador de produção: apenas versão publicada em modo leitura, sem draft. **Permanece parcial.**

**Guardas:** servidor somente em 127.0.0.1; processo recusa banco que não tenha URL exata `postgres://postgres:e2-local-only@127.0.0.1:5432/e2_disposable`, e recusa ausência de `CCH_E2_ISOLATED=YES`. Sem deploy Lovable, sem edições reais, sem publicação de atleta.

**Critério de aceite:** verde em ambas as pipelines isoladas e relatório visual de produção de versão de código/fluxo autorizado. Não marcar E2 como plenamente homologada sem reconhecer essa distinção.
