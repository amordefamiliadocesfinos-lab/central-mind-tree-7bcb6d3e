# M7 — NUTRITION DECISION — ACCEPTANCE REPORT

**Data:** 07/11/2026  
**Branch:** `feat/health-m7-nutrition-decision-20261107`  
**Base:** `main@90f43449a4163dac7e15652c3b38ba5fe4378a5d`

## Escopo

M7 converte estado M6 em decisão nutricional determinística e auditável.

Fronteira:
- M5 = fatos
- M6 = estado
- M7 = decisão
- ação/publicação = etapa separada

M7 v1 não altera plano, meta, receita ou diário automaticamente.

## Entregas

- `health_nutrition_decisions`
- `health_m7_evaluate_nutrition_decision`
- Decision Ledger append-only por supersession
- Data Sufficiency Contract
- confidence + reason codes
- evidence snapshot
- algorithm_version + parameter_set
- UI "Decisão nutricional" na página Alimentação
- botão explícito "Avaliar decisão"

## Regras v1

Data sufficient:
- mínimo = ceil(70% da janela) de dias sufficient;
- mesmo mínimo para dias comparáveis de energia e proteína;
- coverage não pode ser unobserved/sparse;
- deve existir plano publicado aplicável à data.

Com dados suficientes:
- energia < 80% e proteína < 80% → review_energy_and_protein_execution
- energia < 80% → review_energy_execution
- proteína < 80% → review_protein_execution
- ambas >= 80% → maintain_plan

## Ajuste do plano

M7 v1 mantém:
- `plan_adjustment_status = paused`
- `BODY_RESPONSE_REQUIRED_FOR_PLAN_ADJUSTMENT`

Ajuste energético não será emitido sem Body/Físico.

## Testes no ambiente oficial

Ambiente:
- PAINEL CENTRAL — TESTES MT
- Supabase `enfekhgcsbzovxtqdlwh`

### Cenário A — insuficiência de dados
1/7 dia sufficient.

Resultado:
- decision_status = paused
- decision_class = data_quality
- decision_code = review_data_quality
- reason codes de insuficiência presentes

PASS.

### Cenário B — baixa execução
5/7 dias sufficient/comparáveis com energia e proteína abaixo da meta.

Resultado:
- decision_status = ready
- decision_class = execution
- decision_code = review_energy_and_protein_execution
- confidence = moderate
- plan adjustment = paused

PASS.

### Cenário C — manter plano
7/7 dias sufficient/comparáveis.
Energia e proteína com aderência 100%.

Resultado:
- decision_status = ready
- decision_class = maintenance
- decision_code = maintain_plan
- confidence = high
- plan adjustment = paused

PASS.

### Ledger
Segunda avaliação do mesmo atleta/data/janela:
- 1 current
- 1 superseded

PASS.

### Segurança
- cross-athlete evaluate: BLOQUEADO
- cross-athlete SELECT: 0 linhas
- UPDATE direto: BLOQUEADO
- RLS: ativo
- policy pública: SELECT com health_can_read_athlete
- SECURITY DEFINER com search_path fixo
- anon EXECUTE: false
- authenticated EXECUTE: true

PASS.

## Produção

Nenhuma migration M7 aplicada em produção.
Nenhum deploy M7 executado.

## CI

GitHub Actions run: `42415840553`

- npm ci: PASS
- lint Health: PASS
- build completo do PAINEL CENTRAL: PASS
- workflow temporário removido após validação

## Gate

M7 tecnicamente pronta para PR Draft.

- merge em main: NÃO EXECUTADO
- migration M7 em produção: NÃO EXECUTADA
- deploy M7: NÃO EXECUTADO

Próximo passo: abrir PR Draft e parar no gate de merge.
