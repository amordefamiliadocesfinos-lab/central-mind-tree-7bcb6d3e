# F11 — TESTES MT — BLOQUEIO DE CREDENCIAL GITHUB

**Data:** 08/11/2026  
**Status:** BLOQUEADO SOMENTE POR CREDENCIAL GITHUB ACTIONS  
**Escopo:** Git/GitHub only  
**Lovable:** não utilizado  
**Produção:** não alterada

## Estado técnico

A implementação F11 está validada em CI descartável e regressões.

O workflow `Health F11 TESTES MT Validation` foi criado com alvo fixo:

`enfekhgcsbzovxtqdlwh`

Run de verificação:

`42495092289`

Resultado operacional:

`F11_TESTES_MT_SKIPPED_NO_GITHUB_CREDENTIALS`

Nenhuma conexão ao banco foi realizada.

## Por que está bloqueado

O repositório não expõe atualmente nenhum dos secrets aceitos pelo workflow:

- `TESTES_MT_DATABASE_URL`
- `TESTES_MT_DB_URL`
- `SUPABASE_TESTES_MT_DATABASE_URL`
- `SUPABASE_TESTES_MT_DB_URL`
- `SUPABASE_TEST_DATABASE_URL`
- `SUPABASE_ACCESS_TOKEN`
- `TESTES_MT_SUPABASE_ACCESS_TOKEN`
- `SUPABASE_TESTES_MT_ACCESS_TOKEN`

Também não há senha de teste disponível:
- `TESTES_MT_DB_PASSWORD`
- `SUPABASE_TESTES_MT_DB_PASSWORD`
- `SUPABASE_TEST_DB_PASSWORD`

## Limitação da conexão GitHub atual

A conexão GitHub disponível para esta operação não permite criar ou editar Actions Secrets. Endpoints de secrets são tratados como sensíveis e não são expostos.

Portanto não é possível materializar a credencial dentro do repositório por esta sessão sem sair da diretriz Git-only.

## Controle de segurança

O workflow:
- fixa o project ref TESTES MT;
- recusa database URL cuja identidade não contenha `enfekhgcsbzovxtqdlwh`;
- aplica somente as quatro migrations F11;
- executa pós-check estrutural e de segurança;
- executa smoke funcional em transação com rollback;
- confirma que nenhum dado sintético 2099 persiste.

## Ação única necessária

Criar no repositório GitHub Actions um secret de teste, preferencialmente:

`TESTES_MT_DATABASE_URL`

Depois executar manualmente:

`Health F11 TESTES MT Validation`

Nenhuma alteração de código adicional é necessária para iniciar essa homologação.

## Governança

Até o run real em TESTES MT:
- PR #499 permanece Draft;
- Gate A implementação permanece fechado;
- Gate B permanece fechado;
- Gate C permanece fechado;
- F12/F13 permanecem bloqueados.
