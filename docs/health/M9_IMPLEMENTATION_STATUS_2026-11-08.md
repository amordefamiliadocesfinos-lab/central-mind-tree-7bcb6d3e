# M9 — IMPLEMENTATION STATUS — 2026-11-08

## Estado

**IMPLEMENTAÇÃO EM BRANCH — PRODUÇÃO INTACTA**

Base:
`main@ae85e22fd5acd116e6cbbb7c9a5ce21af8075a2c`

Branch:
`feat/health-m9-implementation-20261107`

Gate B produção: **FECHADO**  
Gate C deploy: **FECHADO**

## Implementado na branch

### Migrations geradas pelo Supabase CLI

Os seis arquivos foram criados por `supabase migration new` em GitHub Actions usando `supabase/setup-cli@v3` com CLI v2 stable, e depois preenchidos:

1. `20261108001646_health_m9_sleep_recovery_foundation.sql`
2. `20261108001648_health_m9_sleep_recovery_rpcs.sql`
3. `20261108001650_health_m9_clinical_foundation.sql`
4. `20261108001652_health_m9_clinical_rpcs.sql`
5. `20261108001653_health_m9_security.sql`
6. `20261108001655_health_m9_integrity.sql`

O workflow temporário usado exclusivamente para gerar os nomes/timestamps oficiais foi removido após a geração.

### M9A

Implementados:
- fatos de sono;
- check-ins por métrica com `checkin_event_id`;
- observações de dispositivo;
- estados 7/14/28 por dimensão;
- cobertura `unobserved/sparse/partial/complete`;
- suficiência 5/7, 10/14, 20/28;
- RPCs de registro/void/refresh;
- `unknown != zero`;
- tempo na cama separado de sono efetivo;
- rota `/saude/recuperacao`;
- UI mobile.

### M9B

Implementados:
- documentos clínicos privados;
- staging de extração;
- confirmação/rejeição;
- exames e resultados originais;
- catálogo/aliases internos;
- estado longitudinal de biomarcadores;
- sinais fisiológicos;
- RPCs;
- correção de relatório por supersession/void;
- rota `/saude/exames`;
- UI mobile.

## Segurança implementada

- RLS em todas as tabelas M9;
- `anon` sem acesso;
- fatos/estados SELECT-only para frontend autenticado;
- mutações por RPC;
- `health_can_read_athlete` / `health_can_write_athlete`;
- RPCs privilegiadas com `SET search_path = ''`;
- relações qualificadas por schema;
- EXECUTE revogado de PUBLIC/anon e concedido minimamente a authenticated;
- aliases internos não expostos ao frontend;
- `health-private` reutilizado para documentos;
- path clínico isolado por `athlete_id`.

## Validação descartável

Workflow:
`.github/workflows/health-m9-disposable-validation.yml`

PostgreSQL:
- PostgreSQL 17 descartável;
- fixture sintética Health;
- seis migrations M9 aplicadas em sequência;
- contratos de RPC/idempotência;
- `unknown != zero`;
- catálogo/alias;
- cross-athlete write negado;
- cross-athlete SELECT não-vazio negado;
- anon sem EXECUTE;
- DML direto frontend bloqueado.

Validação concluída:

- GitHub Actions run: `42429860135`;
- conclusão geral: **SUCCESS**;
- PostgreSQL contract: **PASS**;
- seis migrations aplicadas em PostgreSQL 17 descartável: **PASS**;
- cross-athlete negative test não-vazio: **PASS**;
- anon sem EXECUTE M9: **PASS**;
- Health M9 lint: **PASS**;
- full frontend build: **PASS**.

## TESTES MT oficial

Projeto esperado:
`enfekhgcsbzovxtqdlwh`

**NÃO APLICADO. NÃO DECLARAR PASS.**

O conector Supabase desta sessão retornou:
`MCP error -32600: You do not have permission to perform this action`

inclusive para operação de leitura.

O repositório também não expõe workflow/variável nomeada existente para acesso seguro ao TESTES MT.

Portanto:
- nenhuma credencial foi inventada;
- nenhum secret foi criado;
- nenhum banco hospedado foi contornado;
- produção `xkskyutmtlhivvpfxkjg` permanece intocada.

## Próximo gate técnico

Antes de PR Draft de implementação, conforme o Mapa:
1. ✅ CI descartável concluído;
2. obter acesso seguro ao TESTES MT;
3. aplicar migrations no TESTES MT;
4. executar validação RLS/RPC/cross-athlete no TESTES MT;
5. executar advisors;
6. somente com PASS oficial abrir PR Draft de implementação.

Este relatório não autoriza produção ou deploy.
