# M2 Acceptance Report — Catálogos

Data: 07/11/2026  
Branch: `feat/health-m2-catalogs-20261107`  
PR: #476  
Base: `feat/health-m1-profile-goals-20261107`

Migrations:
- `20261107153621_health_m2_catalogs`
- `20261107153848_health_m2_declared_equipment_catalog_fk`

## Resultado executivo

**M2 HEALTH: PASS**

A M2 criou catálogos globais soberanos de Treino e a fundação do catálogo nutricional, com leitura segura no frontend, versionamento via migrations e biblioteca mobile-first.

## Catálogo de Treino

Entidades:
- `health_muscle_groups`;
- `health_equipment_catalog`;
- `health_exercises`;
- `health_exercise_muscles`;
- `health_exercise_equipment`;
- `health_exercise_equivalences`.

Seeds:
- 16 grupos musculares;
- 17 equipamentos;
- 18 exercícios;
- 32 relações exercício×músculo;
- 23 relações exercício×equipamento;
- 6 equivalências provisórias.

Regras:
- todas as equivalências seed estão como `provisional`;
- nenhuma equivalência aponta para o próprio exercício;
- todos os 18 exercícios possuem músculo e equipamento associados;
- `contribution_weight` permaneceu NULL em 100% das relações seed;
- M2 não cria pesos numéricos arbitrários de participação muscular.

## Ligação M1 → M2

`health_declared_equipment.catalog_equipment_id` agora possui FK opcional para
`health_equipment_catalog.id`.

Comportamento:
- item declarado pode permanecer sem correspondência (`NULL`);
- referência inválida é bloqueada pelo Postgres;
- remoção do item de catálogo usa `ON DELETE SET NULL`.

## Catálogo Nutricional Inicial

Entidades:
- `health_food_sources`;
- `health_foods`.

Fontes registradas:
- TBCA — Tabela Brasileira de Composição de Alimentos;
- USDA FoodData Central.

Estado intencional:
- fontes ativas: 2;
- alimentos: 0.

Nenhum valor de energia/macronutriente foi preenchido por estimativa.
Importações futuras deverão possuir:
- `source_id`;
- `source_food_key`;
- versão/origem;
- qualidade do dado.

## Segurança / Data API

Todas as 8 tabelas de catálogo:
- RLS habilitada;
- `anon`: sem grants;
- `authenticated`: somente SELECT;
- sem INSERT/UPDATE/DELETE pelo frontend.

Teste:
- authenticated lê catálogo;
- tentativa de INSERT como authenticated é bloqueada;
- anon não possui SELECT.

## Migrations

### 20261107153621 — health_m2_catalogs
- nome gerado por Supabase CLI 2.121.0;
- dry-run transacional: PASS;
- aplicação Lovable Cloud: PASS;
- ledger reconciliado;
- rollback versionado.

### 20261107153848 — health_m2_declared_equipment_catalog_fk
- nome gerado por Supabase CLI 2.121.0;
- dry-run: PASS;
- aplicação: PASS;
- ledger reconciliado;
- rollback versionado.

## Frontend

### Hook
`useHealthCatalogs`

Carrega:
- músculos;
- equipamentos;
- exercícios;
- relações exercício×músculo;
- relações exercício×equipamento;
- equivalências;
- fontes nutricionais;
- alimentos.

### Página
`/saude/biblioteca`

Modo Treino:
- contadores;
- busca;
- exercícios;
- músculos primários/secundários;
- equipamentos;
- equivalências provisórias.

Modo Nutrição:
- fontes;
- alimentos;
- estado explícito quando importação ainda não ocorreu.

## Validação técnica

- `npm ci`: PASS;
- ESLint M2: PASS, zero erros/avisos;
- `npm run build`: PASS.

## Mobile-first

Larguras:
- 320 px: PASS;
- 360 px: PASS;
- 375 px: PASS;
- 390 px: PASS;
- 412 px: PASS;
- 430 px: PASS.

Todos os 13 gates:
- zero overflow;
- shell Saúde sem regressão;
- controles >=44px;
- busca utilizável;
- cards sem estouro;
- badges com wrap;
- busca por exercício;
- busca por músculo;
- alternância Nutrição;
- 2 fontes visíveis;
- estado 0 alimentos;
- footer sem cobrir conteúdo;
- zero page errors Health.

Smoke 375px:
- "leg press" → Leg press 45°;
- "quadríceps" → exercícios associados;
- Nutrição → TBCA + USDA_FDC;
- mensagem de importação não executada visível;
- zero chamadas REST `health_*` no harness.

Observação do harness:
- erros HTTP 400 de componentes globais sem sessão real foram observados;
- nenhum erro foi originado no módulo Health.

## Persistência

Dados pessoais Health após M2:
- atletas: 0;
- perfis: 0;
- metas: 0;
- fases: 0;
- locais: 0;
- equipamento declarado: 0;
- preferências: 0;
- consentimentos: 0.

Catálogos persistentes:
- músculos: 16;
- equipamentos: 17;
- exercícios: 18;
- fontes nutricionais: 2;
- alimentos: 0.

## Critérios M2-AC

| ID | Critério | Resultado |
|---|---|---|
| M2-AC-01 | migrations via Supabase CLI | PASS |
| M2-AC-02 | RLS nos catálogos | PASS |
| M2-AC-03 | authenticated read-only / anon sem acesso | PASS |
| M2-AC-04 | seeds treino | PASS |
| M2-AC-05 | Exercise×Muscle sem falsa precisão | PASS |
| M2-AC-06 | Exercise×Equipment normalizado | PASS |
| M2-AC-07 | equivalências provisórias | PASS |
| M2-AC-08 | declared equipment ligado ao catálogo | PASS |
| M2-AC-09 | TBCA/USDA registrados | PASS |
| M2-AC-10 | sem macros inventados | PASS |
| M2-AC-11 | Biblioteca funcional | PASS |
| M2-AC-12 | busca funcional | PASS |
| M2-AC-13 | Nutrição com proveniência/estado | PASS |
| M2-AC-14 | mobile 320–430px | PASS |
| M2-AC-15 | lint + build | PASS |
| M2-AC-16 | ledgers + rollbacks | PASS |

## Itens deliberadamente fora da M2

- biblioteca de mídia de exercícios;
- receitas nutricionais;
- importação massiva TBCA/USDA;
- programas e filas CCH;
- prescrição de treino;
- progressão;
- substituição automática;
- AI Coach.

## Gate de continuidade

**M2 aprovada para continuidade para M3 — Programa / CCH.**

O merge do PR #476 é separado do aceite técnico e depende da integração de M0 e M1.
