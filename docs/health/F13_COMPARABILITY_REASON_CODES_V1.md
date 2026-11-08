# F13 — COMPARABILITY AND REASON CODES v1

**Status:** DOCUMENTAL

---

## 1. Fonte/identidade

- SOURCE_ATHLETE_MISMATCH
- SOURCE_DATE_MISMATCH
- SOURCE_WINDOW_MISMATCH

---

## 2. Training

- TRAINING_CURRENT_PERIOD_AVAILABLE
- TRAINING_PRIOR_PERIOD_AVAILABLE
- TRAINING_CURRENT_PERIOD_EMPTY
- TRAINING_PRIOR_PERIOD_EMPTY

Período vazio pode ser dado factual válido:
zero sessões concluídas.

Isso é diferente de query error.

---

## 3. Nutrition

- NUTRITION_CURRENT_STATE_MISSING
- NUTRITION_PRIOR_STATE_MISSING
- NUTRITION_CURRENT_COVERAGE_LOW
- NUTRITION_PRIOR_COVERAGE_LOW
- NUTRITION_COMPARISON_AVAILABLE

A v1 pode mostrar comparação mesmo com confidence low, mas deve preservar a confidence.

---

## 4. Body

- BODY_CURRENT_STATE_MISSING
- BODY_PRIOR_STATE_MISSING
- BODY_CURRENT_COVERAGE_LOW
- BODY_PRIOR_COVERAGE_LOW
- BODY_COMPARISON_AVAILABLE

Não exigir que todas as métricas corporais estejam presentes.

---

## 5. Recovery

- RECOVERY_CURRENT_STATE_MISSING
- RECOVERY_PRIOR_STATE_MISSING
- RECOVERY_CURRENT_COVERAGE_LOW
- RECOVERY_PRIOR_COVERAGE_LOW
- RECOVERY_COMPARISON_AVAILABLE

---

## 6. Review run

- NO_COMPARABLE_DOMAINS
- PARTIAL_LONGITUDINAL_COVERAGE
- LONGITUDINAL_COMPARISON_AVAILABLE

---

## 7. Policy markers

- CLINICAL_COMPARISON_EXCLUDED_V1
- NO_AUTOMATIC_REPLANNING_V1
- NO_CAUSAL_INFERENCE_V1
- HUMAN_OUTCOME_REQUIRED_V1

---

## 8. Diferenças

F13 pode persistir diferenças numéricas.

Exemplos:
- completed_sessions_delta;
- avg_energy_kcal_delta;
- weight_latest_kg_delta_between_period_ends;
- average_recovery_delta.

Nome da métrica deve deixar claro o que está sendo subtraído.

---

## 9. Sem julgamento automático

Não criar reason codes:
- PROGRESS_GOOD;
- PROGRESS_BAD;
- RECOVERY_BAD;
- DIET_FAILED;
- TRAINING_FAILED.

Dados descrevem.

Humano revisa.

---

## 10. Causalidade

Proibido produzir:
“peso mudou porque recuperação caiu”.

Permitido:
“no período atual, peso e recuperação apresentaram estas diferenças observadas”.

Correlação visual não vira conclusão causal.
