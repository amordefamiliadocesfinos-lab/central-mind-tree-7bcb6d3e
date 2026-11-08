# F11 — DECISION TAXONOMY AND REASON CODES v1

**Status:** DOCUMENTAL

---

## 1. Decision status

- ready
- paused

---

## 2. Decision class

v1:
- data_quality
- execution
- plan_review

Não criar classe clinical.

---

## 3. Decision codes

### decision_paused

Uso:
capacidade não elegível por ausência/suficiência.

### review_data_quality

Uso:
dados obrigatórios existem parcialmente, mas não sustentam a capacidade.

### review_nutrition_execution

Uso:
propaga prioridade de execução M7.

### review_nutrition_plan_candidate

Uso:
M7 + M8 + M9A tornam revisão humana de plano elegível.

---

## 4. Target domain

v1:
- nutrition

O schema pode ser extensível, mas implementação v1 não deve liberar:
- training;
- recovery;
- clinical;
- overall

como alvos decisórios sem nova versão arquitetural.

---

## 5. Reason codes — fonte/identidade

- SOURCE_ATHLETE_MISMATCH
- SOURCE_DATE_MISMATCH
- SOURCE_WINDOW_MISMATCH
- SOURCE_RECORD_NOT_CURRENT

---

## 6. Reason codes — M7

- NUTRITION_DECISION_MISSING
- NUTRITION_DECISION_PAUSED
- NUTRITION_EXECUTION_REVIEW_REQUIRED
- NUTRITION_EXECUTION_REVIEW_PRECEDES_PLAN_REVIEW

Os reason codes originais M7 devem ser preservados separadamente em evidence/source_reason_codes.

F11 não rebatiza os motivos M7 como se fossem próprios.

---

## 7. Reason codes — M8

- BODY_STATE_MISSING
- BODY_COVERAGE_TOO_LOW
- BODY_RESPONSE_INSUFFICIENT
- BODY_RESPONSE_AVAILABLE

BODY_RESPONSE_AVAILABLE não afirma resposta boa/ruim.

---

## 8. Reason codes — M9A

- RECOVERY_STATE_MISSING
- RECOVERY_COVERAGE_TOO_LOW
- RECOVERY_CONTEXT_INSUFFICIENT
- RECOVERY_CONTEXT_AVAILABLE

RECOVERY_CONTEXT_AVAILABLE não afirma recuperação boa/ruim.

---

## 9. Reason codes — política

- CLINICAL_DECISION_INPUT_EXCLUDED_V1
- TRAINING_DECISION_CAPABILITY_DISABLED_V1
- NO_AUTOMATIC_ACTION_ALLOWED_V1

Esses códigos podem ser salvos no parameter/evidence snapshot e não precisam aparecer como problemas ao usuário.

---

## 10. Exibição

UI deve traduzir reason codes para texto humano.

Exemplo:

BODY_RESPONSE_INSUFFICIENT
→ “Ainda não há resposta corporal comparável suficiente para revisar o plano.”

A UI não deve mostrar texto alarmista.

---

## 11. Versionamento

Reason code não deve mudar de significado silenciosamente.

Mudança semântica exige:
- novo code; ou
- nova algorithm_version documentada.

---

## 12. Compatibilidade

A taxonomia v1 é deliberadamente pequena.

Adicionar:
- treino;
- recuperação como alvo;
- decisão clínica;
- ação automática

exige nova versão arquitetural.
