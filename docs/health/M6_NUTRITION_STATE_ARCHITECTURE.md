# M6 — NUTRITION STATE

## Missão

Transformar os fatos M5 em estado nutricional derivado, auditável e recalculável.

M6 **não prescreve** e **não recomenda ajustes**. A decisão pertence à M7.

## Fronteira

- M5: PLAN/TARGET → CONSUMED facts
- M6: CONSUMED → STATE
- M7: STATE → DECISION

## Princípios

1. Unknown nunca vira zero por conveniência.
2. Somente itens M5 com status `active` entram no estado atual.
3. Correções e voids alteram o estado após recálculo, sem apagar o fato histórico.
4. Metas são copiadas para o estado como snapshot comparativo do cálculo.
5. Aderência longitudinal usa somente dias comparáveis.
6. Médias longitudinais usam dias com estado diário `sufficient`.
7. Ausência de diário é `unobserved`, não baixa ingestão.
8. M6 registra confiança e reason codes, mas não produz recommendation/action.
9. O algoritmo e seus parâmetros são versionados.

## Estado diário

`health_nutrition_daily_states`

Estado possível:
- `unobserved`
- `partial`
- `sufficient`

Um dia é `sufficient` quando:
- existe diário M5;
- o dia está explicitamente `complete`;
- energia é conhecida;
- proteína é conhecida.

Isso é suficiência para **resumo diário M6**, não para uma decisão M7.

## Cobertura nutricional

Se qualquer item ativo tiver nutriente desconhecido, o total daquele nutriente fica NULL.

Exemplo:
- item A: 300 kcal
- item B: energia desconhecida

Resultado M6:
- energia consumida = NULL
- known partial sum não é apresentado como total real
- reason code = `ENERGY_COVERAGE_INCOMPLETE`

## Estado longitudinal

`health_nutrition_rolling_states`

Janelas suportadas:
- 7 dias
- 14 dias
- 28 dias

A janela registra:
- dias observados;
- dias suficientes;
- dias parciais;
- dias não observados;
- cobertura;
- médias nutricionais dos dias suficientes;
- dias comparáveis com metas;
- aderência observada a energia e proteína;
- confiança;
- reason codes.

## Coverage status

- `unobserved`: nenhum dia observado
- `sparse`: < 50% da janela observada
- `partial`: >= 50%, mas janela incompleta ou com dias não suficientes
- `complete`: 100% dos dias observados e suficientes

Esses nomes descrevem cobertura de dados. Não equivalem a aprovação/reprovação nutricional.

## Reason codes iniciais

- NO_FOOD_LOG_DAY
- NO_ACTIVE_MEAL_ITEMS
- COMPLETE_DAY_WITH_NO_ACTIVE_ITEMS
- DAY_NOT_COMPLETE
- ENERGY_COVERAGE_INCOMPLETE
- PROTEIN_COVERAGE_INCOMPLETE
- CARBOHYDRATE_COVERAGE_INCOMPLETE
- FAT_COVERAGE_INCOMPLETE
- FIBER_COVERAGE_INCOMPLETE
- SODIUM_COVERAGE_INCOMPLETE
- NO_ACTIVE_NUTRITION_PLAN
- NO_NUTRITION_TARGET
- NO_OBSERVED_DAYS
- SPARSE_OBSERVATION_COVERAGE
- PARTIAL_WINDOW_COVERAGE
- NO_ENERGY_COMPARABLE_DAYS
- NO_PROTEIN_COMPARABLE_DAYS

## Gate para M7

M7 poderá consumir os estados M6, mas cada decisão deverá possuir seu próprio Data Sufficiency Contract.

M6 não declara automaticamente:
- aumentar calorias;
- reduzir calorias;
- aumentar proteína;
- carb cycling;
- déficit/superávit corporal real;
- mudança de plano.

Essas são decisões, portanto pertencem à M7.
