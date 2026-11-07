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
- NO_NUTRITION_PLAN_FOR_DATE
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


## Dependência de lifecycle M5

A validação da M6 mostrou que a completude do diário precisa ser um fato explícito e auditável.

Foi adicionado o patch:
- `health_food_log_day_events`;
- `health_m5_complete_food_log_day`;
- `health_m5_reopen_food_log_day`;
- bloqueio de criação direta de dia já `complete`;
- bloqueio de alteração de refeições/itens enquanto o dia estiver concluído.

Regra operacional:
1. registrar/corrigir refeições com o dia aberto;
2. concluir explicitamente;
3. M6 pode classificar o estado;
4. para corrigir depois, reabrir o dia;
5. realizar a correção;
6. concluir novamente;
7. recalcular M6.

## ADR-M6-SEC-01 — RPCs privilegiadas

As RPCs de lifecycle e refresh de estado permanecem `SECURITY DEFINER` intencionalmente.

Motivo:
- tabelas derivadas M6 são SELECT-only para o frontend;
- lifecycle não pode ser alterado por UPDATE direto;
- o cálculo deve gravar estado derivado sem abrir privilégios de escrita ampla.

Controles:
- `SET search_path = public, pg_temp`;
- autorização explícita por `health_can_read_athlete` ou `health_can_write_athlete`;
- `REVOKE ALL` de PUBLIC/anon;
- EXECUTE apenas para `authenticated` nas RPCs públicas necessárias;
- helper `health_m6_target_status` permanece interno;
- RLS protege todas as leituras;
- cross-athlete testado e bloqueado no sandbox.

Os warnings do Supabase para funções `SECURITY DEFINER` executáveis por authenticated são aceitos e documentados por este ADR.
