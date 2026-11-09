# F17 — ANALYTICS VISUAL E HISTÓRICO — ARQUITETURA V1

## 1. Natureza

F17 é uma camada visual read-only.

Ela não modifica qualquer fonte soberana.

## 2. Rota

`/saude/analytics`

## 3. Fonte de treino

Tabelas:
- `health_workout_sessions`;
- `health_workout_sets`.

Critérios:
- sessão concluída;
- séries com status completed;
- apenas período selecionado.

Séries derivadas por dia:
- sessões concluídas;
- séries concluídas;
- repetições registradas;
- volume kg = soma de `load_value * reps` somente quando `load_unit='kg'`.

Não converter:
- lb para kg;
- bodyweight em carga externa.

Ausência de carga/reps permanece ausente do volume.

## 4. Fonte de alimentação

Tabelas:
- `health_food_log_days`;
- `health_meal_logs`;
- `health_meal_items`.

Critérios:
- itens ativos;
- agregado por `log_date`.

Séries:
- energia kcal observada;
- proteína g observada;
- completude do diário.

Dias sem log não são preenchidos com zero.

## 5. Fonte corporal

Tabelas:
- `health_body_assessments`;
- `health_body_measurements`.

Critérios:
- assessment status active;
- métricas existentes.

Séries:
- peso kg;
- cintura cm;
- gordura corporal %.

Não interpolar pontos ausentes.

## 6. Fonte recuperação

Tabelas:
- `health_sleep_periods`;
- `health_recovery_checkins`.

Sono:
- períodos ativos;
- priorizar `calculated_sleep_minutes`;
- fallback para `declared_sleep_minutes`;
- agregado por `sleep_date`.

Percepções:
- apenas status active;
- métricas físicas v1:
  - physical_recovery;
  - training_readiness;
  - general_fatigue;
- quando houver múltiplos registros no mesmo dia, usar média descritiva daquele dia.

## 7. Janelas

O hook recebe:
- 30;
- 90;
- 180.

A consulta usa data inicial inclusiva.

## 8. Componente de gráfico

Usar Recharts já existente no projeto.

Regras:
- responsivo;
- tooltip;
- legenda;
- eixos simples;
- não inventar pontos;
- gaps reais devem permanecer gaps;
- mobile-first.

## 9. Semântica

Gráfico mostra observação ao longo do tempo.

Ele não afirma:
- melhora;
- piora;
- causa;
- eficácia;
- necessidade de ajuste.

## 10. Erro parcial

Se uma consulta de um domínio falhar:
- marcar apenas aquele domínio como indisponível;
- preservar os outros;
- não transformar erro em série vazia “válida”.

## 11. Segurança

Somente SELECT.

F17 não possui RPC própria na v1.

RLS das tabelas de origem continua sendo a fronteira de acesso.

## 12. Exportação

F17 v1 não cria exportação própria.

F15 continua responsável por relatório/exportação.

## 13. Navegação

Adicionar:
- item “Analytics” na navegação Health;
- CTA opcional a partir de Evolução/Hoje.

## 14. Testes

Por decisão atual do usuário, testes estão adiados.

A implementação ainda deve preservar tipos, autoridade e estado de backend sem declarar PASS operacional.
