# F4-CAND — INTEGRAÇÃO DE CÓDIGO SOBRE MAIN — CHECKPOINT

**Projeto:** PAINEL CENTRAL / SHOPEE-OAUTH-MULTICONTAS-01  
**Data:** 18/11/2026  
**Estado:** PR #936 draft; integração de conteúdo isolada, sem merge nem deploy.

## 1. Base exata e estratégia

- `main` verificada antes de iniciar: `5fc103d1b1d83ca4fb9c8c770fb9773a5ec078c8`.
- Ancestral comum da main e pilha OAuth: `4144eeddd1981c8975fd7c037cc0e4048ec8aa10`.
- Do ancestral até `main`: seis arquivos do Núcleo, nenhum sobreposto com a frente OAuth.
- Da mesma base até a PR #935: **54 arquivos** de autenticação, testes, migrações, workflows e documentação.
- Técnica empregada: criar uma árvore Git a partir da `main` congelada, acrescentando **somente** os blobs desses 54 arquivos, preservando os outros arquivos da `main`. Sem cherry-pick dos commits históricos, sem resolver conflitos por estratégia `ours` ou `theirs` indiscriminada.
- Conferência: comparação `main...integrate/shopee-oauth-universal-main-f4-20261118` encontrou exatamente os **54 arquivos esperados**, sem faltantes nem extras; branch 2 commits à frente de main na verificação.

## 2. Convivência com PR #911

A PR #911 `73b264c9a2f0ccbc087379b59c530078651eb712` muda quatro arquivos em comparação à base, dentre eles:
- `shopee-live-oauth.mjs` e `shopee-live-oauth.test.mjs`: superfície compartilhada, comportamento Celivio e interface `?via=console` anteriormente reconciliados semanticamente na PR #930. CI de reconciliação deve ser novamente validado na PR #936.
- `docs/operations/SHOPEE_OAUTH_MULTICONTAS_REVISAO_ADAO_CELIVIO_2026-11-17.md`: diagnóstico **histórico** com revisão Cloud Run 00166 (desatualizada frente ao checkpoint de 18/11) e proposta de UX. Documento não foi promovido como fonte operacional vigente.
- `services/integration-hub/scripts/prepare-shopee-console-handoff-cloud-shell.sh`: script histórico com comandos `gcloud builds submit`, push de imagem e `gcloud run services update --no-traffic`. **Não foi incorporado à PR de candidata**, pois seu propósito era a operação de Celivio em branch antiga e seus gates de 27 tags não foram confirmados nesta janela.

PR #911 permanece intacta, aberta e draft. Esta integração **não declara equivalência de ancestralidade Git** com ela, somente preservação testada do comportamento considerado necessário. Revisão funcional externa e consentimento OAuth real ainda pendentes.

## 3. Resultado e impedimentos

- Código integrável preparado numa branch nova a partir da main.
- Testar workflow completo na PR #936: módulos Python/Node/Deno, Docker e PostgreSQL descartável.
- Ainda não verificados em produção: migrations Core, grants, bindings de IAM, segredos, flags, rota Gateway universal, tag de candidata Cloud Run, consentimento Shopee real.
- Não autoriza qualquer comando de deploy, `main` merge, migrations, grants, Scheduler ou substituição de Gateway.
- `oauth-celivio-20261116-v1` permanece config Gateway publicada; candidata OpenAPI V2 somente local no Cloud Shell.
- **Gate seguinte:** avaliar todas as checagens de CI da PR #936; se todas aprovadas, considerar a integração de código tecnicamente preparada, não homologada operacionalmente.

## 4. Princípios de preservação

- `SHOPEE_OAUTH_UNIVERSAL_START_ENABLED` / `SHOPEE_OAUTH_UNIVERSAL_CALLBACK_ENABLED` default-off.
- Partner ID `2047685`; autorização por account+shop pré-aprovados no Core.
- Preservar Shop ID e tokens de Adão/Viviane/Celivio sem assumir consentimento de Celivio homologado.
- Sem nova aplicação Shopee ou rota específica por nova conta.
- Sem tokens, secrets, cookies, estados ou códigos em documentação e logs.

## 5. Resultado dos testes de CI da integração

Executados na PR #936:
- **Aprovados:** F3-A autorização, F3-B handoff, F3-C callback, F3-D refresh, F4 integração sintética, F4 Gateway OpenAPI, F4 candidate readiness, F4 packaging Docker, reconciliação PR #911 e preflight somente leitura.
- **Falha na suíte geral** `Shopee Integration Hub Tests and Docker`, run `44324932736`, no job `logistics-typescript`. Nesse mesmo run, `core-and-cycle-postgres` e `hub-node22-and-container` concluíram com sucesso.
- Log do job falho aponta erros TypeScript em componentes `src/components/nucleo/*` (acesso `PromiseLike.catch`, campos obrigatórios em inserção) e `src/modules/health/hooks/useHealthMealPlanF18.ts` (soma entre união de tipos e número). **Esses arquivos não foram modificados pela PR #936**, segundo a lista de 54 arquivos alterados.
- **Não foi demonstrado que tais falhas existem também na `main`**, pois não houve execução de referência da mesma suíte nesse SHA. Classificação adequada: falha de CI em código fora do delta OAuth; causa/baseline ainda não confirmados.
- Por governança, **não corrigir Núcleo ou Saúde nesta frente**. Encaminhar diagnóstico à camada responsável e preservar o resultado negativo da suíte geral. Enquanto houver CI obrigatória falha, branch não está pronta para merge.

**Estado da candidata:** integração de código preparada; CI específico OAuth aprovado; **gate global de CI não aprovado**. Não promover.
