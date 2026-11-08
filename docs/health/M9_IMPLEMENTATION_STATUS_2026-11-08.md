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

Os arquivos foram criados por `supabase migration new` em GitHub Actions usando `supabase/setup-cli@v3` com CLI v2 stable, e depois preenchidos:

1. `20261108001646_health_m9_sleep_recovery_foundation.sql`
2. `20261108001648_health_m9_sleep_recovery_rpcs.sql`
3. `20261108001650_health_m9_clinical_foundation.sql`
4. `20261108001652_health_m9_clinical_rpcs.sql`
5. `20261108001653_health_m9_security.sql`
6. `20261108001655_health_m9_integrity.sql`
7. `20261108003645_health_m9_performance_indexes.sql`

A 7ª migration foi criada após o pós-DDL do TESTES MT identificar FKs sem índice líder. As migrations já aplicadas não foram reescritas.

Os workflows temporários usados exclusivamente para gerar os nomes/timestamps oficiais foram removidos após a geração.

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

Projeto Lovable TESTES MT:
`864ced4a-32ea-4aad-8491-181eba297291`

Backend:
Lovable Cloud PostgreSQL / Supabase stack.

O conector Supabase MCP autenticado nesta sessão não possui permissão sobre o ref canônico documentado, portanto a execução foi feita pelo transporte de banco do Lovable Cloud do projeto TESTES MT — sem usar Builder/agent e sem alterar produção.

Identidade do ambiente foi confirmada antes do DDL por:
- stack Supabase habilitada;
- conjunto de tabelas Health M0–M8 idêntico ao projeto Lovable de produção;
- funções M8 presentes;
- `health-private` privado presente;
- nenhuma tabela/RPC M9 pré-existente.

### Aplicação

As 7 migrations da branch foram aplicadas no TESTES MT em ordem.

Resultado:
- 12 tabelas M9 presentes;
- 17 RPCs M9 presentes;
- todas as RPCs com `SECURITY DEFINER` + `SET search_path = ''`;
- RLS habilitado nas 12 tabelas;
- `authenticated` com SELECT apenas nas superfícies expostas;
- `anon` sem table grants M9;
- `anon` e PUBLIC sem EXECUTE das RPCs;
- aliases internos sem exposição frontend;
- catálogo: 18 biomarcadores / 40 aliases;
- bucket `health-private`: privado, 50 MB, PDF/JPEG/PNG/WebP permitidos;
- policies de Storage isoladas por primeiro segmento = `athlete_id`.

### Homologação funcional transacional

Executada no TESTES MT com `BEGIN ... ROLLBACK`, sem deixar dados artificiais.

PASS:
- escrita direta de fato pelo frontend bloqueada;
- escrita via RPC autorizada para atleta próprio;
- replay idempotente de sono;
- `unknown != zero`: tempo na cama não virou duração efetiva de sono;
- check-in multimétrica por `checkin_event_id`;
- estado 7 dias com insuficiência preservada;
- alias de Glicose -> `glucose`;
- estado longitudinal de biomarcador;
- staging + confirmação de extração;
- confirmação idempotente;
- sinal fisiológico;
- cross-athlete SELECT não-vazio bloqueado;
- cross-athlete RPC write bloqueado.

Resultado textual:
`M9_TESTES_MT_FUNCTIONAL_PASS`

Após a migration de índices:
`M9_TESTES_MT_POST_INDEX_PASS`

### Pós-DDL / advisor equivalente

O Supabase MCP oficial não enxerga o projeto TESTES MT desta conexão, então `get_advisors` não pôde ser executado nesse ref.

Foi executado audit SQL equivalente sobre:
- RLS;
- grants;
- EXECUTE;
- policies;
- `search_path`;
- Storage;
- índices líderes de foreign keys.

O primeiro audit encontrou FKs sem índice líder. Em vez de reescrever migration já aplicada, foi criada pelo CLI a 7ª migration:
`20261108003645_health_m9_performance_indexes.sql`.

Pós-aplicação:
- FKs M9 sem índice líder: **0**;
- tabelas M9 sem RLS: **0**;
- RPCs M9 executáveis por anon: **0**;
- grants M9 para anon: **0**.

## Próximo gate técnico

1. ✅ CI descartável;
2. ✅ TESTES MT identificado;
3. ✅ 7 migrations aplicadas no TESTES MT;
4. ✅ RLS/RPC/cross-athlete homologados no TESTES MT;
5. ✅ pós-DDL/advisor SQL equivalente sem pendências M9;
6. concluir CI final da branch;
7. abrir PR Draft de implementação.

Produção `xkskyutmtlhivvpfxkjg` permanece intocada.

Gate B produção e Gate C deploy permanecem fechados.

Este relatório não autoriza produção ou deploy.
