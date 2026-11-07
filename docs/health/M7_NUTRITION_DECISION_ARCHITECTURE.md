# M7 — NUTRITION DECISION

## Missão

Converter o estado M6 em uma decisão nutricional determinística, explicável, auditável e não destrutiva.

Fronteira oficial:

- M5 = fatos
- M6 = estado
- M7 = decisão
- plano/publicação = ação separada

M7 **não altera automaticamente** plano, meta, receita ou diário.

## Decision Ledger

Tabela: `health_nutrition_decisions`

Cada avaliação congela:
- janela M6 usada;
- plano/estratégia vigente;
- cobertura;
- dias suficientes;
- dias comparáveis;
- aderência de energia;
- aderência de proteína;
- confiança;
- reason codes;
- versão do algoritmo;
- parâmetros de decisão.

A decisão corrente pode ser supersedida por nova avaliação, mas o registro anterior permanece histórico.

## Data Sufficiency Contract — v1

Para uma decisão de execução/maintenance estar `ready`:

- janela suportada: 7, 14 ou 28 dias;
- mínimo de dias suficientes = ceil(70% da janela);
- mínimo de dias comparáveis de energia = mesmo limiar;
- mínimo de dias comparáveis de proteína = mesmo limiar;
- coverage não pode ser `unobserved` ou `sparse`;
- deve existir plano nutricional publicado aplicável à data.

Se qualquer requisito falhar:

- `decision_status = paused`
- `decision_class = data_quality`
- `decision_code = review_data_quality`

`DECISION_PAUSED` é um resultado válido, não uma falha.

## Regras v1

Com dados suficientes:

- energia < 80% de aderência e proteína < 80%:
  - review_energy_and_protein_execution
- energia < 80%:
  - review_energy_execution
- proteína < 80%:
  - review_protein_execution
- energia e proteína >= 80%:
  - maintain_plan

Essas regras avaliam **execução**, não eficácia fisiológica do plano.

## Ajuste energético

M7 v1 não aumenta nem reduz calorias automaticamente.

Mesmo quando a decisão de execução está `ready`:

- `plan_adjustment_status = paused`
- reason code:
  - `BODY_RESPONSE_REQUIRED_FOR_PLAN_ADJUSTMENT`

Motivo: aderência alimentar não prova resposta corporal. Ajustar energia exige evidência do módulo Body/Físico, que vem na fase seguinte do mapa.

Quando Body estiver disponível, M7 poderá ganhar uma nova versão do algoritmo sem reescrever decisões antigas.

## Segurança

- tabela M7 é SELECT-only para frontend;
- escrita somente por RPC;
- RPC exige `health_can_write_athlete`;
- RLS protege leitura;
- `SECURITY DEFINER` usa search_path fixo;
- nenhuma função pública para UPDATE/DELETE direto;
- cross-athlete deve ser testado.

## Princípios

- unknown != zero
- fact != state != decision != action
- decisão exige suficiência
- histórico é append-only por supersession
- algoritmo e parâmetros são versionados
- nenhuma decisão silenciosa
- nenhuma mudança automática de plano na v1
