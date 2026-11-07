> **SUPERSESSÃO CONDICIONADA AO MERGE DA PR #486.** Enquanto a v2 não estiver incorporada à `main` por merge autorizado, esta v1 permanece a fonte soberana vigente. Após o merge, a fonte soberana passa a ser `docs/health/CCH_MAPA_SOBERANO_E_METODO_DE_TRABALHO_v2.md` e este arquivo permanece apenas como registro histórico.

# MAPA SOBERANO DO CCH / SAÚDE NO PAINEL CENTRAL

**Documento:** Governança Mestre CCH / Saúde  
**Versão:** v1.0  
**Data:** 07/11/2026  
**Status:** VIGENTE - referência obrigatória antes de qualquer evolução Health/CCH  
**Objetivo:** garantir que o CCH seja desenvolvido como módulo do **PAINEL CENTRAL canônico**, sem aplicação, repositório, banco ou fluxo paralelo.

---

## 1. DECISÃO CENTRAL

O CCH / Saúde pertence ao **mesmo PAINEL CENTRAL de produção**.

Não será tratado como aplicativo separado.

A partir deste documento:

- código Health/CCH deve existir no repositório canônico do PAINEL CENTRAL;
- banco Health/CCH deve usar o Supabase canônico do PAINEL CENTRAL;
- desenvolvimento deve ser feito por **Git/GitHub + código**, não pelo construtor/agent da Lovable;
- Lovable não é ferramenta de autoria do CCH; pode ser usada apenas como superfície visual/publicação após gates;
- nenhuma memória de chat, nome de projeto, screenshot ou ambiente antigo pode prevalecer sobre as fontes soberanas.

---

## 2. MAPA SOBERANO DE AMBIENTES

### 2.1 Produção canônica

| Componente | Valor soberano |
|---|---|
| Produto | PAINEL CENTRAL |
| Lovable Project ID | `1720a410-34cd-4410-995c-8c92c7edf16b` |
| Workspace Lovable | `CnJuZjhEM85JYVXyDyUv` |
| Repositório GitHub | `amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e` |
| Branch canônica | `main` |
| HEAD auditado | `34ea5066565cfc3ee68c53bfa944b30d4f43e0e0` |
| Baseline funcional anterior | `cf3693ccda9c0bea68c7c1c73be714a660f6cf4d` |
| Supabase produção | `xkskyutmtlhivvpfxkjg` |
| URL publicada | `https://central-mind-tree.lovable.app` |

**Nota:** o HEAD `34ea506...` foi gerado durante a auditoria da Camada Mestre e alterou apenas `.lovable/plan.md`. Não incorporou código funcional Health.

### 2.2 Ambiente oficial de testes

| Componente | Valor |
|---|---|
| Lovable Project | PAINEL CENTRAL — TESTES MT |
| Lovable Project ID | `864ced4a-32ea-4aad-8491-181eba297291` |
| Supabase testes | `enfekhgcsbzovxtqdlwh` |
| Uso | homologação e validação antes de produção |

### 2.3 Não canônicos / sandbox

Não são backend oficial do PAINEL CENTRAL:

- `gufyjtdgsdmowubdtdvo`
- `fmbarvtlfuvirwqpuydx`

Podem ser usados somente como sandbox descartável. Não contam como implantação oficial.

### 2.4 Repositórios históricos

Não usar como origem atual:

- `amordefamiliadocesfinos-lab/central-mind-tree`
- `amordefamiliadocesfinos-lab/central-mind-tree-bc2f05ee`

Origem canônica atual:

`amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e @ main`

---

## 3. HIERARQUIA DAS FONTES DE VERDADE

Quando fontes divergirem, prevalece:

1. **Identidade canônica:** Lovable Project ID + repo/branch GitHub + Supabase Project Ref.
2. **Git/GitHub canônico:** `main`, commits, migrations, PRs e diffs.
3. **Banco canônico:** `schema_migrations`, `information_schema`, funções, policies, RLS e dados reais.
4. **Documentação soberana versionada:** arquitetura mestre, este documento e ADRs.
5. **Ambiente oficial de testes:** evidência comportamental antes de produção.
6. **Auxiliares:** preview, logs, relatórios e screenshots.
7. **Não soberanas:** memória de chat, nome visual, recência, branch/repo histórico e suposição.

**Regra:** fonte inferior nunca corrige silenciosamente uma fonte superior.

---

## 4. STOP RULES

Antes de código, migration, SQL, deploy ou publicação Health/CCH, confirmar:

```text
Lovable Project ID = 1720a410-34cd-4410-995c-8c92c7edf16b
GitHub repo       = amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e
Base              = main
Supabase produção = xkskyutmtlhivvpfxkjg
Supabase testes   = enfekhgcsbzovxtqdlwh
```

**PARAR** se:

- migration não existir como arquivo Git versionado;
- commit base não estiver registrado;
- houver alteração paralela no `main` ainda não reconciliada;
- diff contiver arquivos fora do escopo;
- houver tentativa de usar Lovable Builder/agent para escrever o CCH;
- houver necessidade de force push, reset destrutivo, DROP ou reescrita de migration aplicada;
- houver dúvida sobre identidade do banco.

---

## 5. REGRA DE OURO - NÃO USAR O CONSTRUTOR DA LOVABLE PARA O CCH

### Proibido

- Lovable AI Builder/chat agent para criar ou editar código do CCH;
- plan mode da Lovable para produzir documentação operacional do CCH;
- migrations criadas/aplicadas somente pela Lovable sem arquivo correspondente no Git;
- deploy usado como forma de sincronizar código não versionado.

### Permitido

Lovable pode ser usada apenas para:

- visualizar projeto/preview;
- consultar metadados em leitura;
- verificar resultado visual já versionado;
- publicar/deploy **após gate explícito** e com `main` aprovado.

---

## 6. MÉTODO DE TRABALHO OFICIAL - GIT FIRST

### Etapa 0 - Preflight obrigatório

```text
PROJETO: PAINEL CENTRAL
LOVABLE: 1720a410-34cd-4410-995c-8c92c7edf16b
REPO: amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e
BASE: main
BASE SHA: <confirmar>
TEST DB: enfekhgcsbzovxtqdlwh
PROD DB: xkskyutmtlhivvpfxkjg
ESCOPO: <fase/módulo>
```

### Etapa 1 - Git

1. fetch do repositório canônico;
2. atualizar `main`;
3. registrar SHA base;
4. criar branch específica;
5. nunca trabalhar diretamente em `main`;
6. commits pequenos e identificáveis;
7. nunca force push.

Padrões:

- `reconcile/health-m0-m6-main-YYYYMMDD`
- `feat/health-m7-nutrition-decision-YYYYMMDD`
- `fix/health-<tema>-YYYYMMDD`

### Etapa 2 - Implementação

- Codex/editor local/ferramentas Git;
- código em `src/modules/health/`;
- migrations em `supabase/migrations/`;
- nenhuma mutation de produção durante desenvolvimento;
- nenhuma funcionalidade duplicada;
- mobile-first.

### Etapa 3 - Banco oficial de testes

Toda migration nova deve ser validada em:

`enfekhgcsbzovxtqdlwh`

Fluxo:

1. confirmar Project Ref;
2. aplicar migrations na ordem;
3. executar regressão;
4. testar RLS/cross-athlete;
5. rodar Supabase Advisors;
6. corrigir antes do PR final.

### Etapa 4 - CI / Build

No mínimo:

- `npm ci`;
- `npm run build`;
- lint/testes existentes;
- TypeScript;
- mobile 320/360/390/430 px;
- alvos touch >= 44 px;
- navegação/shell.

### Etapa 5 - PR

- PR Draft durante desenvolvimento;
- diff restrito;
- migrations documentadas;
- resultados de teste;
- advisors;
- build;
- ADRs para warnings aceitos;
- nenhuma alteração lateral.

### Etapa 6 - Gate de merge

Merge em `main` exige autorização explícita do proprietário.

### Etapa 7 - Gate de banco de produção

Antes de DDL em `xkskyutmtlhivvpfxkjg`:

1. confirmar Project Ref;
2. confirmar migration no `main`;
3. confirmar que não foi aplicada;
4. revisar SQL final;
5. PASS em testes oficiais;
6. autorização explícita.

Aplicar **somente migrations ausentes**.

### Etapa 8 - Pós-deploy

Sem dados artificiais em produção:

- confirmar migrations;
- confirmar tabelas/funções/policies;
- confirmar RLS;
- rodar Advisors;
- registrar resultado.

### Etapa 9 - Publicação

Deploy/publicação do PAINEL CENTRAL é gate explícito.

---

## 7. ESTADO REAL DO CCH / HEALTH

### 7.1 Produção canônica

O Supabase `xkskyutmtlhivvpfxkjg` possui Health M0→M4 aplicado:

| Versão | Migration |
|---|---|
| 20261107144000 | health_m0_foundation |
| 20261107151317 | health_m1_profile_goals |
| 20261107153621 | health_m2_catalogs |
| 20261107153848 | health_m2_declared_equipment_catalog_fk |
| 20261107155747 | health_m3_program_cch |
| 20261107160110 | health_m3_program_rpcs |
| 20261107161317 | health_m4_live_workout |

Foram observadas 27 tabelas `health_*` no banco canônico.

### 7.2 Divergência atual

No `main` canônico:

- não existe `src/modules/health`;
- migrations Health ainda não estão incorporadas;
- Saúde ainda não está visível como módulo funcional do Painel publicado.

Logo:

**Banco:** M0→M4 presentes.  
**Código main:** Health ausente.

Essa divergência deve ser resolvida antes de M7.

### 7.3 M5 / M6

M5 e M6 foram desenvolvidos/testados em branches `feat/health-*` e ambientes não canônicos.

São ativos de engenharia a preservar, mas:

- não contam como integração oficial;
- não contam como deploy do PAINEL CENTRAL;
- precisam ser reconciliados com `main`;
- precisam ser validados em `enfek...`;
- só depois podem seguir para `xks...`.

### 7.4 M7

M7 - Nutrition Decision fica **congelada** até a reconciliação M0→M6.

---

## 8. INVENTÁRIO FUNCIONAL M0→M7

| Fase | Nome | Escopo | Estado |
|---|---|---|---|
| M0 | Foundation | Atleta, acesso, papéis, RLS | DB prod aplicado; reconciliar código |
| M1 | Profile & Goals | Perfil, metas, fases, preferências | DB prod aplicado; reconciliar código |
| M2 | Catalogs | Exercícios, músculos, equipamentos, alimentos | DB prod aplicado; reconciliar código |
| M3 | Program CCH | Programas, versões, templates, prioridades | DB prod aplicado; reconciliar código |
| M4 | Live Workout | Sessões, exercícios, séries, eventos | DB prod aplicado; reconciliar frontend/código |
| M5 | Nutrition Foundation | Planos, receitas, snapshots, diário | Preservar branches; reconciliar |
| M6 | Nutrition State | Estado diário/longitudinal, cobertura, confiança | Preservar branches; reconciliar |
| M7 | Nutrition Decision | Decisão explicável e Data Sufficiency | Congelada |

### Migrations M5 conhecidas

- `20261107170000_health_m5a_core.sql`
- `20261107170010_health_m5a_integrity.sql`
- `20261107170020_health_m5a_security.sql`
- `20261107170100_health_m5c_recipe_nutrition_snapshots.sql`
- `20261107170200_health_m5b_plan_rpcs.sql`
- `20261107170210_health_m5b_recipe_rpcs.sql`
- `20261107170220_health_m5b_meal_log_rpc.sql`
- `20261107170230_health_m5b_meal_correction_rpcs.sql`
- `20261107170240_health_m5b_privileges.sql`
- `20261107182900_health_m5_food_log_day_lifecycle.sql`

### Migrations M6 conhecidas

- `20261107183000_health_m6_nutrition_state.sql`
- `20261107183100_health_m6_state_rpcs.sql`
- `20261107183200_health_m6_state_security.sql`

---

## 9. DESTINO TÉCNICO DENTRO DO PAINEL CENTRAL

### Código

```text
src/modules/health/
  HealthModule.tsx
  types/
  hooks/
  pages/
  ui/
  components/
```

### Rotas e navegação

- base `/saude/*`;
- integração ao shell existente;
- entrada Saúde no padrão de navegação/overflow;
- sem segundo menu global;
- mobile-first.

### Banco e segurança

Tudo Health/CCH no mesmo Supabase:

`xkskyutmtlhivvpfxkjg`

- RLS obrigatório;
- `health_athlete_access`;
- `auth.uid()`;
- mutações sensíveis via RPC;
- cross-athlete sempre testado.

---

## 10. PLANO OFICIAL DE RECONCILIAÇÃO M0→M6

### R0 - Congelar
Nenhuma feature nova Health/M7 até finalizar reconciliação.

### R1 - Auditoria somente leitura
Comparar M0→M4 do banco `xks...` com branches Health:

- tabelas;
- colunas;
- constraints;
- índices;
- funções;
- policies;
- grants;
- triggers;
- migration history.

**Nunca reaplicar M0→M4 em produção.**

### R2 - Branch de reconciliação

Criar a partir do `main` atual:

`reconcile/health-m0-m6-main-20261107`

Registrar SHA base.

### R3 - Recuperar M0→M4 no histórico do código

Incorporar migrations/código correspondentes sem alterar o estado já existente em produção.

Se byte-identidade do SQL histórico não puder ser provada, validar equivalência semântica por schema diff e registrar ADR.

### R4 - Incorporar M5/M6

Trazer ativos das branches Health para a branch de reconciliação.

Nenhuma migration M5/M6 vai para produção nesta etapa.

### R5 - Ambiente oficial de testes

Usar:

- Lovable testes: `864ced4a-32ea-4aad-8491-181eba297291`
- Supabase testes: `enfekhgcsbzovxtqdlwh`

### R6 - Frontend/mobile

Validar:

- `/saude/*`;
- shell;
- navegação;
- 320/360/390/430 px;
- touch;
- loading/error/empty;
- sessão real.

### R7 - CI

`npm ci` + build + lint/testes.

### R8 - PR para main

PR com:

- diff;
- migrations;
- schema diff;
- resultados;
- advisors;
- build;
- ADRs.

**Gate de merge.**

### R9 - Produção

Após merge + autorização:

- confirmar `xks...`;
- aplicar somente M5/M6/lifecycle ausentes;
- nunca reaplicar M0→M4;
- pós-check sem dados artificiais.

**Gate de DDL.**

### R10 - Publicação

Publicar PAINEL CENTRAL somente após autorização.

### R11 - Homologação real

Só depois liberar M7.

---

## 11. SEQUÊNCIA DE PRODUTO APÓS RECONCILIAÇÃO

1. Reconciliação M0→M6
2. M7 - Nutrition Decision
3. Físico / Body
4. Sono / Recuperação / Biomarcadores
5. Dashboard Integrado
6. Motor Integrado CCH
7. Jornada real completa
8. Evolução contínua por dados reais

---

## 12. PRINCÍPIOS CCH

- `unknown != zero`;
- planejamento != execução;
- fato != observação != inferência != decisão;
- histórico não é reescrito silenciosamente;
- correção por supersession quando auditabilidade exigir;
- decisão exige suficiência;
- `DECISION_PAUSED` é resultado válido;
- algoritmo/parameter set versionados;
- recomendação explicável;
- IA auxilia; regras determinísticas governam decisões críticas;
- especialista não invade outro domínio;
- não duplicar dado com fonte soberana.

---

## 13. GATES DE AUTORIZAÇÃO EXPLÍCITA

### Gate A - Merge
Qualquer PR Health/CCH entrando em `main`.

### Gate B - Banco
Qualquer DDL/migration em `xkskyutmtlhivvpfxkjg`.

### Gate C - Deploy
Publicação do PAINEL CENTRAL.

### Gate D - Destrutivo

Sempre exigir autorização para:

- DROP;
- reset;
- force push;
- reescrever migration aplicada;
- remover migration history;
- substituir dados reais;
- perder histórico.

---

## 14. CHECKLIST OBRIGATÓRIO

```text
[ ] Projeto Lovable canônico confirmado
[ ] Repo canônico confirmado
[ ] main atualizado
[ ] SHA base registrado
[ ] Supabase teste confirmado
[ ] Supabase produção confirmado
[ ] Branch criada do main
[ ] Escopo escrito
[ ] Nenhum uso do Lovable Builder
[ ] Migrations versionadas antes de aplicação
[ ] Teste no ambiente oficial
[ ] RLS/cross-athlete testado
[ ] Advisors revisados
[ ] npm ci PASS
[ ] build PASS
[ ] mobile PASS
[ ] diff sem alterações laterais
[ ] PR Draft revisado
[ ] Gate de merge autorizado
[ ] Gate de banco autorizado
[ ] Pós-deploy verificado
[ ] Gate de publicação autorizado
[ ] Documentação atualizada
```

---

## 15. CONTINUIDADE ENTRE CHATS / ESPECIALISTAS

Para abrir nova frente, fornecer:

1. este documento;
2. arquitetura do módulo;
3. branch/PR;
4. SHA base;
5. estado das migrations;
6. decisão pendente.

Não transferir contexto por memória solta.

Conflito de fonte = **PARAR e reconciliar antes de executar**.

---

## 16. FONTES UTILIZADAS

Fontes verificadas em 07/11/2026:

1. Knowledge do projeto Lovable canônico `1720a410-34cd-4410-995c-8c92c7edf16b`.
2. `supabase/config.toml` do PAINEL CENTRAL produção.
3. `supabase/config.toml` do PAINEL CENTRAL — TESTES MT.
4. GitHub `amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e`.
5. Branch `main` e commits auditados.
6. `supabase_migrations.schema_migrations` do banco canônico.
7. `information_schema.tables` do banco canônico.
8. Parecer da Camada Mestre, auditoria 07/11/2026.

---

## 17. MAPA SOBERANO - RESUMO

```text
PAINEL CENTRAL PROD
  Lovable: 1720a410-34cd-4410-995c-8c92c7edf16b
  Repo:    amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e
  Branch:  main
  DB:      xkskyutmtlhivvpfxkjg
  URL:     central-mind-tree.lovable.app

PAINEL CENTRAL TESTES
  Lovable: 864ced4a-32ea-4aad-8491-181eba297291
  DB:      enfekhgcsbzovxtqdlwh

NÃO CANÔNICOS
  gufyjtdgsdmowubdtdvo
  fmbarvtlfuvirwqpuydx
  central-mind-tree
  central-mind-tree-bc2f05ee

HEALTH ATUAL
  Prod DB: M0→M4 presentes
  main: código/migrations Health ausentes
  M5/M6: preservar e reconciliar
  M7: congelada

MÉTODO
  GIT FIRST
  NO LOVABLE BUILDER
  TESTE OFICIAL
  PR
  GATES EXPLÍCITOS
  PRODUÇÃO SOMENTE APÓS MERGE E VALIDAÇÃO
```

---

## 18. DIRETRIZ FINAL

**Este documento é o guardrail operacional do CCH.**

Nenhuma nova fase deve começar fora deste mapa.

Próxima execução permitida:

**AUDITORIA DE RECONCILIAÇÃO M0→M4 - SOMENTE LEITURA**

Comparar o banco canônico `xkskyutmtlhivvpfxkjg` com os arquivos das branches Health e preparar a branch:

`reconcile/health-m0-m6-main-20261107`

Até essa auditoria fechar, **M7 permanece congelada**.
