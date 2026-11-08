# F13 — TESTES MT — CHECKPOINT DE EXECUÇÃO

**Data:** 08/11/2026  
**Status:** BLOQUEADO POR CREDENCIAL — SEM ALTERAÇÃO DE BANCO  
**Mapa vigente:** CCH v3.4 FROZEN  
**Main após infraestrutura de teste:** `6214f413fd50d777aed76c4bd54001622aebaa21`

## 1. Objetivo executado

Foi criada e integrada a infraestrutura oficial para validar a F13 — Evolução contínua por dados reais — no projeto Supabase canônico de testes:

- TESTES MT ref: `enfekhgcsbzovxtqdlwh`
- workflow: `.github/workflows/health-f13-testes-mt-validation.yml`
- postcheck: `supabase/tests/health_f13_testes_mt_postcheck.sql`
- smoke: `supabase/tests/health_f13_testes_mt_smoke.sql`

A PR de infraestrutura foi a **#510**.

## 2. Execução real

O merge da PR #510 disparou automaticamente:

- workflow run: **42504235068**
- job: **128803301741**
- evento: `push`
- workflow: **Health F13 TESTES MT Validation**

## 3. Resultado

A resolução segura de credenciais executou com sucesso, porém não encontrou nenhum secret compatível com o projeto TESTES MT canônico.

Resultado registrado pelo workflow:

`F13_TESTES_MT_SKIPPED_NO_GITHUB_CREDENTIALS`

Mensagem operacional:

`No compatible GitHub secret is available for canonical TESTES MT connectivity; remote validation is skipped.`

Portanto:

- conexão com TESTES MT: **não realizada**;
- migrations F11 em TESTES MT: **não executadas nesta rodada**;
- migrations F13 em TESTES MT: **não executadas nesta rodada**;
- postcheck F13: **não executado**;
- smoke F13: **não executado**;
- produção: **não acessada**;
- banco produção: **não alterado**;
- dados sintéticos: **não criados**.

O workflow concluiu com sucesso porque o bloqueio de credencial é tratado como SKIP governado, e não como falsa falha funcional.

## 4. Proteções confirmadas

O workflow:

- aceita somente destino que identifique o ref canônico `enfekhgcsbzovxtqdlwh`;
- não contém o ref de produção `xkskyutmtlhivvpfxkjg`;
- não contém os sandboxes `fmbarvtlfuvirwqpuydx` ou `gufyjtdgsdmowubdtdvo`;
- não imprime segredos;
- recusa URL de banco que não identifique o TESTES MT canônico;
- mantém smoke F13 em transação com `ROLLBACK`;
- valida a dependência F11 antes da F13;
- não executa Gate B de produção;
- não executa deploy.

## 5. Credencial necessária

Para destravar a execução real, basta disponibilizar no GitHub Actions **uma** das formas já aceitas pelo workflow:

### Opção A — URL específica do banco TESTES MT

Um dos secrets:

- `TESTES_MT_DATABASE_URL`
- `TESTES_MT_DB_URL`
- `SUPABASE_TESTES_MT_DATABASE_URL`
- `SUPABASE_TESTES_MT_DB_URL`
- `SUPABASE_TEST_DATABASE_URL`

A URL deve identificar o ref canônico `enfekhgcsbzovxtqdlwh`.

### Opção B — Supabase access token

Um dos secrets:

- `SUPABASE_ACCESS_TOKEN`
- `TESTES_MT_SUPABASE_ACCESS_TOKEN`
- `SUPABASE_TESTES_MT_ACCESS_TOKEN`

Opcionalmente acompanhado de:

- `TESTES_MT_DB_PASSWORD`
- `SUPABASE_TESTES_MT_DB_PASSWORD`
- `SUPABASE_TEST_DB_PASSWORD`

## 6. Retomada exata

Quando uma credencial canônica estiver disponível:

1. reexecutar o workflow **Health F13 TESTES MT Validation**;
2. exigir `F11_TESTES_MT_POSTCHECK_PASS`;
3. exigir `F11_TESTES_MT_FUNCTIONAL_PASS`;
4. aplicar F13 em TESTES MT se ausente;
5. exigir `F13_TESTES_MT_POSTCHECK_PASS`;
6. exigir `F13_TESTES_MT_FUNCTIONAL_PASS`;
7. exigir `F13_TESTES_MT_ROLLBACK_PASS`;
8. somente então declarar TESTES MT F13 = PASS;
9. Gate B de produção permanece uma decisão separada e exige autorização explícita.

## 7. Estado soberano após esta execução

- F13 arquitetura: ✅
- F13 implementação: ✅
- F13 CI descartável: ✅
- F13 Gate A / merge: ✅
- infraestrutura TESTES MT F13: ✅
- execução TESTES MT F13: ⏳ bloqueada por credencial
- Gate B produção: ⛔
- Gate C / deploy: ⛔
- homologação longitudinal real: ⛔
- F14: inexistente/bloqueada

Este checkpoint não altera o escopo do Mapa Soberano e não converte ausência de credencial em PASS.
