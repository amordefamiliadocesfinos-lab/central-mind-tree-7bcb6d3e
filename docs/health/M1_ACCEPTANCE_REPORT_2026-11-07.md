# M1 Acceptance Report — Identidade, Perfil e Objetivos

Data: 07/11/2026  
Branch: `feat/health-m1-profile-goals-20261107`  
PR: #475  
Base: `feat/health-m0-foundation-20261107`  
Migration: `20261107151317_health_m1_profile_goals`

## Resultado executivo

**M1 HEALTH: PASS**

A M1 transformou a fundação da M0 em um perfil funcional de atleta com dados estáveis, objetivo/fase, contexto de treino, preferências e consentimentos, preservando a separação entre domínios.

Nenhum dado pessoal real foi criado durante testes.

## Escopo entregue

### Perfil básico
`health_athlete_profiles`
- data de nascimento;
- altura;
- experiência de treino;
- lado dominante;
- observações.

Peso, medidas e fotos permanecem fora desta tabela e pertencem ao domínio Body/Evolução.

### Objetivos
`health_goals`
- objetivo principal;
- tipo;
- título;
- prioridade;
- status;
- datas;
- observações.

Regra:
- no máximo uma meta primária ativa por atleta.

### Fases
`health_goal_phases`
- fase atual;
- tipo;
- título;
- status;
- período;
- objetivo da fase.

Regra:
- no máximo uma fase ativa por atleta;
- FK composta garante que a fase pertence à meta do mesmo atleta.

### Locais de treino
`health_training_locations`
- local principal;
- tipo;
- status;
- observações.

Regra:
- no máximo um local primário ativo por atleta.

### Equipamento declarado
`health_declared_equipment`
- nome;
- categoria livre;
- disponibilidade;
- local;
- futura ligação `catalog_equipment_id`.

Este registro é contexto declarado. O catálogo universal de equipamentos será soberano na M2.

### Preferências
`health_athlete_preferences`
- duração preferida;
- sessões por semana;
- horário;
- local padrão;
- unidade métrica;
- observações.

Preferência nunca supera segurança, recuperação ou suficiência de dados.

### Consentimentos
`health_consents`
- tipo;
- decisão;
- versão da política;
- ator;
- instante;
- detalhes.

Modelo append-only:
- cliente autenticado pode SELECT/INSERT;
- não recebe UPDATE/DELETE;
- mudança de decisão cria novo evento.

## Banco e segurança

- 7 tabelas M1 criadas;
- RLS habilitada nas 7;
- `anon` sem grants;
- `authenticated` recebe somente operações necessárias;
- policies usam os helpers Health soberanos da M0:
  - `health_can_read_athlete`;
  - `health_can_write_athlete`;
  - `health_can_manage_athlete_access`;
- a prova cross-user dos helpers foi concluída na M0;
- ferramenta bloqueou nova simulação manual de JWT nesta M1, portanto não houve tentativa de contornar essa proteção;
- integridade relacional foi testada diretamente no banco sem depender da RLS.

## Testes transacionais de integridade

PASS:
- authenticated sem `auth.uid()` não enxerga dados por RLS;
- anon sem SELECT;
- consentimento sem UPDATE/DELETE;
- segunda meta primária ativa bloqueada;
- segunda fase ativa bloqueada;
- fase apontando para meta de outro atleta bloqueada por FK;
- equipamento apontando para local de outro atleta bloqueado;
- preferência apontando para local de outro atleta bloqueada;
- todos os dados sintéticos revertidos.

## Migration

Gerada pelo Supabase CLI 2.121.0:
`20261107151317_health_m1_profile_goals.sql`

Fluxo:
1. migration name gerado por CLI;
2. SQL versionado;
3. dry-run `BEGIN/ROLLBACK`: PASS;
4. revisão de FKs compostas;
5. dry-run corrigido: PASS;
6. aplicação via Lovable Cloud: PASS;
7. ledger `supabase_migrations.schema_migrations` reconciliado;
8. rollback manual versionado.

## Frontend

### Hook
`useHealthProfileM1`

Responsabilidades:
- carregar perfil;
- carregar meta/fase ativa;
- carregar local/equipamentos;
- carregar preferências;
- derivar decisão mais recente de consentimentos;
- salvar cada bloco de forma independente.

### Página
`/saude/perfil`

Blocos:
1. Perfil básico;
2. Objetivo e fase;
3. Local e equipamentos;
4. Preferências;
5. Consentimentos.

Nenhum dado pessoal é pré-gravado automaticamente.

## Validação técnica

- `npm ci`: PASS;
- ESLint M1: PASS, zero erros/avisos;
- `npm run build`: PASS.

## Mobile-first

Larguras:
- 320 px: PASS;
- 360 px: PASS;
- 375 px: PASS;
- 390 px: PASS;
- 412 px: PASS;
- 430 px: PASS.

Gates:
- zero overflow horizontal: PASS;
- header/nav sem regressão: PASS;
- cards dentro do viewport: PASS;
- controles principais >=44px: PASS;
- labels/campos não cortados: PASS;
- Objetivo/Fase utilizável: PASS;
- Local/Equipamentos utilizável: PASS;
- Preferências utilizável: PASS;
- 5 consentimentos visíveis/clicáveis: PASS;
- footer não cobre conteúdo final: PASS;
- zero page errors Health: PASS.

Smoke 375px:
- altura preenchida;
- experiência selecionada;
- objetivo preenchido/salvo em memória;
- fase habilitada após objetivo;
- local preenchido;
- equipamento adicionado;
- duração/sessões preenchidas;
- consentimento alternado;
- zero requisições REST `health_*`.

## Persistência após testes

- health_athletes = 0;
- health_athlete_profiles = 0;
- health_goals = 0;
- health_goal_phases = 0;
- health_training_locations = 0;
- health_declared_equipment = 0;
- health_athlete_preferences = 0;
- health_consents = 0.

## Critérios M1-AC

| ID | Critério | Resultado |
|---|---|---|
| M1-AC-01 | Migration oficial gerada pelo Supabase CLI | PASS |
| M1-AC-02 | 7 superfícies M1 com RLS | PASS |
| M1-AC-03 | grants mínimos | PASS |
| M1-AC-04 | consentimentos append-only | PASS |
| M1-AC-05 | integridade atleta + meta/local | PASS |
| M1-AC-06 | uma meta primária ativa | PASS |
| M1-AC-07 | uma fase ativa | PASS |
| M1-AC-08 | um local primário ativo | PASS |
| M1-AC-09 | Perfil funcional via Supabase/RLS | PASS |
| M1-AC-10 | nenhum valor pessoal automático | PASS |
| M1-AC-11 | mobile 320–430px | PASS |
| M1-AC-12 | controles principais >=44px | PASS |
| M1-AC-13 | lint M1 + build | PASS |
| M1-AC-14 | dados sintéticos não persistem | PASS |
| M1-AC-15 | ledger + rollback | PASS |

## Itens deliberadamente fora da M1

- peso/medidas/fotos;
- catálogo universal de exercícios/equipamentos;
- programas/filas CCH;
- sessão de treino;
- Motor CCH;
- recuperação;
- nutrição funcional;
- AI Coach.

## Gate de continuidade

**M1 aprovada para continuidade para M2 — Catálogos.**

O merge do PR #475 permanece separado do aceite técnico e depende primeiro do fluxo de integração da M0.
