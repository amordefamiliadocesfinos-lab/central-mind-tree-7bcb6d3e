# F11 — SUFFICIENCY, PRIORITY AND CONFLICT RULES v1

**Status:** DOCUMENTAL  
**Algoritmo alvo:** F11_INTEGRATED_DECISION_V1

---

## 1. Sem score global

Suficiência é avaliada por capacidade.

Não existe:
- 72% de saúde;
- score integrado;
- readiness global.

---

## 2. Capacidade C1 — review_nutrition_execution

### Requisitos

Obrigatórios:
- decisão M7 current;
- mesma athlete_id;
- mesmo as_of_date;
- mesmo window_days;
- M7 decision_status=ready;
- M7 decision_class=execution.

### Resultado

decision_status:
ready

decision_class:
execution

decision_code:
review_nutrition_execution

target_domain:
nutrition

A reason_codes F11 deve preservar os motivos M7, prefixados ou armazenados separadamente como source_reason_codes.

### Não exige

- Body M8;
- Recovery M9A.

Justificativa:
problema de execução especialista já é suficiente para pedir revisão da execução; exigir outros domínios atrasaria uma revisão sem aumentar a certeza sobre a execução.

---

## 3. Capacidade C2 — review_nutrition_plan_candidate

### Requisitos obrigatórios

1. M7 current existe;
2. M7 decision_status=ready;
3. M7 decision_class != execution;
4. body_response_available=true;
5. recovery_context_available=true;
6. nenhum conflito de identidade/data/janela;
7. nenhuma fonte obrigatória com erro técnico.

### Resultado

decision_status:
ready

decision_class:
plan_review

decision_code:
review_nutrition_plan_candidate

target_domain:
nutrition

### Significado

Dados suficientes para revisão humana integrada do plano.

Não determina:
- direção;
- magnitude;
- alteração;
- nova meta.

---

## 4. Pausa da capacidade C2

Se faltar qualquer requisito obrigatório:

decision_status:
paused

decision_class:
data_quality

decision_code:
review_data_quality

target_domain:
nutrition

Exemplos de motivos:
- NUTRITION_DECISION_MISSING
- NUTRITION_DECISION_PAUSED
- BODY_STATE_MISSING
- BODY_RESPONSE_INSUFFICIENT
- BODY_COVERAGE_TOO_LOW
- RECOVERY_STATE_MISSING
- RECOVERY_CONTEXT_INSUFFICIENT
- RECOVERY_COVERAGE_TOO_LOW
- SOURCE_DATE_MISMATCH
- SOURCE_WINDOW_MISMATCH

---

## 5. Prioridade

Se C1 estiver ready:
- C1 é decisão prioritária;
- C2 não pode ficar ready no mesmo run;
- C2 deve ficar paused com reason code:
NUTRITION_EXECUTION_REVIEW_PRECEDES_PLAN_REVIEW.

Princípio:
corrigir/entender execução antes de revisar estratégia.

---

## 6. Conflitos

### M7 ready execution + M8 resposta disponível

Resultado:
C1 ready;
C2 paused.

Body não sobrepõe execução.

### M7 paused + M8/M9 suficientes

Resultado:
C1 não ready;
C2 paused.

Dados corporais/recuperação não corrigem decisão nutricional pausada.

### M7 ready non-execution + Body suficiente + Recovery ausente

Resultado:
C2 paused.

Não substituir Recovery por Body.

### M7 ready non-execution + Recovery suficiente + Body ausente

Resultado:
C2 paused.

Não substituir Body por Recovery.

---

## 7. Confidence integrada

A F11 v1 não calcula média numérica.

Confidence de uma decisão ready é o menor nível entre as fontes obrigatórias daquela capacidade.

Ordem:
low < moderate < high

C1:
confidence = confidence M7.

C2:
confidence = mínimo entre:
- M7 confidence;
- M8 confidence;
- M9A confidence.

Se qualquer fonte obrigatória possuir confidence low:
a decisão pode continuar ready se a suficiência formal estiver atendida, porém confidence final = low.

Low confidence != paused automaticamente.

Suficiência e confiança são conceitos distintos.

---

## 8. Dados técnicos

Erro de query/RPC:
- run failed ou partial;
- não gerar reason code de dado ausente;
- não converter falha técnica em decisão clínica/operacional.

---

## 9. Training context

Treino pode constar como contexto.

Na v1:
- não influencia C1;
- não influencia C2;
- não gera conflito decisório.

---

## 10. Clinical context

M9B é excluído.

Nenhum original_flag ou resultado altera C1/C2.

---

## 11. Janela padrão

A implementação poderá usar 7 dias como default de UI/RPC.

Mas C2 em 7 dias só fica ready se os próprios estados M8/M9A dessa janela fornecerem resposta/contexto suficiente.

A arquitetura não força fallback para 14/28.

---

## 12. No action

Mesmo decision_status=ready:
- action_status permanece none;
- nenhuma mutation em plano;
- nenhuma mutation em treino.

Ready significa:
“decisão de revisão disponível”.

Não significa:
“ação autorizada”.
