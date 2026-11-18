# F4-CAND — MINI MAPA DE READINESS E BLOQUEIOS DE PROMOÇÃO

**Projeto:** PAINEL CENTRAL / SHOPEE-OAUTH-MULTICONTAS-01  
**Data:** 18/11/2026  
**Autoridade:** Camada Mestre  
**Natureza:** preparação técnica de candidata, sem deploy nem autorização de merge.

## 1. Sequência executada e evidências

| ID | Verificação | Evidência | Situação |
|---|---|---|---|
| CAND-01 | Conferir branches e relações com #911 | GitHub Compare: `main...#911` divergiu (9 ahead / 43 behind). `#911...branch F4` também divergente (106 ahead / 9 behind). A branch F4 frente à `main` divergiu (82 ahead / 19 behind) no instante da consulta | **Observado — bloqueio para merge direto** |
| CAND-02 | Regressão de comportamento Celivio + universal | PR #930 e #931 com testes Node/Deno/PostgreSQL descartável; importação de testes e condições de compatibilidade | **Aprovado sinteticamente; integração completa de ancestry pendente** |
| CAND-03 | Inventário do pacote Hub | Dockerfile, package.json e server.mjs conferidos; Dockerfile agora importa explicitamente start, handoff e refresh universais | **Concluído** |
| CAND-04 | Proteção JWT no endpoint de elegibilidade | `supabase/config.toml` declara `[functions.shopee-oauth-connect-eligibility] verify_jwt=true`; função revalida token no Auth server-side | **Concluído em branch** |
| CAND-05 | Build + runtime default-off | GitHub Actions `44321989853`: Docker build local, container temporário, `/health`, rota universal desabilitada retorna 503, verificador de config e fontes | **CI aprovado** |
| CAND-06 | Configuração de produção | Flags, Secrets, IAM, revisão Cloud Run e migration real não consultadas/aplicadas neste bloco | **Pendente** |
| CAND-07 | Promoção e homologação | Nenhum push de imagem, deploy, integração de PR, API Config, grants, OAuth real ou tráfego | **Não autorizado** |

## 2. Encadeamento e divergência de bases

História pretendida: `#922 F3-A → #924 F3-B → #928 F3-C → #929 F3-D → #930 reconciliação #911 → #931 F4 → #932 preflight → #933 Gateway → #934 readiness → #935 package`.

A PR `#911` foi aberta separadamente sobre `main`. **Não confundir** sincronização semântica de comportamento em #930 com Git merge/rebase completo: há alterações de `main` e #911 não presentes no ancestral da pilha universal, e vice-versa. É obrigatório revisar diferenças do estado vigente e criar uma candidata de integração de código sem destruir PRs ou alterar base aprovada, com resolução explícita de conflitos e CI reproduzível.

## 3. Matriz mínima de ambiente (não alterar nesta fase)

| Contrato | Origem ou uso | Critério para candidata |
|---|---|---|
| `SHOPEE_OAUTH_UNIVERSAL_START_ENABLED` | Hub universal start | Ausente/`false` ao construir e implantar candidata |
| `SHOPEE_OAUTH_UNIVERSAL_CALLBACK_ENABLED` | Hub callback | Ausente/`false` ao construir e implantar candidata |
| `SHOPEE_LIVE_PARTNER_ID` | Hub | ID autorizado 2047685; não registrar partner key |
| `SHOPEE_LIVE_PARTNER_KEY` | Secret do Hub | Referência de segredo existente; não ler valor/logar |
| `SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY` | Secret do Hub | Identidade da chave já usada; não recriptografar dados produtivos |
| `SHOPEE_LIVE_REDIRECT_URI` | Hub OAuth | Callback oficial mantido no Gateway vigente |
| `PAINEL_PUBLIC_ORIGIN` | Edge eligibility | Origem exata do Painel, sem wildcard |
| `SHOPEE_OAUTH_HANDOFF_START_URL` | Edge eligibility | Host oficial e nova rota universal; não ativar sem Gateway e candidata aprovados |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Edge Core | Não passar service_role ao Hub; autorização server-side |
| Grants e aprovações por loja | Supabase Core | Não criar em produção sem governança e auditoria |
| `SHOPEE_LIVE_OAUTH_REFRESH_ENABLED` | Endpoint refresh legado | Preservar configuração atual; não ativar refresh universal automático |

**Observação:** CI demonstra apenas código e ambiente sintético. A presença desses parâmetros em Cloud Run, Edge Functions e secret bindings reais **não foi verificada**.

## 4. Gates explícitos de rollback / produção

Baseline confirmado no Cloud Shell pelo proprietário em 18/11/2026: revisão `integration-hub-00167-hm8` com 100% do tráfego, rollback `integration-hub-00166-tvl` Ready, Gateway `integration-hub-oauth` na config `oauth-celivio-20261116-v1`, Scheduler `shopee-adao-intake-v1` PAUSED. **Reconfirmar na janela de intervenção; não assumir persistência indefinida.**

- Nenhuma configuração produtiva do Gateway é substituída como parte de F4-CAND.
- Antes de promover, preservar config Gateway anterior, revisão Cloud Run e percentuais de tráfego, tags de validação e estado do Scheduler.
- Rollback de Gateway deve voltar ao API Config anterior; Cloud Run deve voltar ao tráfego anterior. Essas são orientações de planejamento, **não comandos autorizados nem testes executados**.
- Não executar rollback de migrations destrutivamente; exigir plano explícito de compatibilidade e recuperação, sem perda de grants, tokens ou conexões.
- Não autorizar OAuth real de Celivio ou qualquer conta nova a partir desta PR.

## 5. Decisão

**F4-CAND — inventário de código, empacotamento e gate de default-off validados em CI.**  
**Bloqueios para homologação:** divergência de branches; integrações definitivas com `main` e #911; verificação autenticada de IAM/secrets/env; migrações produtivas; backend publicado no Gateway; candidata Cloud Run isolada e operação real.  

**Próximo bloco em escopo:** preparar *branch de integração de código* a partir da `main` atual, reconciliando diffs necessários e mantendo PRs históricas intactas, com testes e sem deploy. Se houver conflito não trivial, registrar o bloqueio em vez de forçar merge.
