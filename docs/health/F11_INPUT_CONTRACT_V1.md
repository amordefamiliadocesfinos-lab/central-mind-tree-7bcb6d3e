# F11 — INPUT CONTRACT v1

**Status:** DOCUMENTAL  
**Princípio:** ler fontes especialistas; nunca reconstruí-las.

---

## 1. Fontes permitidas

### M7 — Nutrição decisão

Tabela:
health_nutrition_decisions

Uso:
fonte decisória especialista.

Obrigatório:
- athlete_id;
- as_of_date;
- window_days;
- record_status=current.

Campos consumidos:
- id;
- decision_status;
- decision_class;
- decision_code;
- target_domain;
- confidence;
- reason_codes;
- plan_adjustment_status;
- plan_adjustment_reason_codes;
- observed_day_count;
- sufficient_day_count;
- rolling_coverage_status;
- rolling_confidence;
- evidence_snapshot;
- algorithm_version;
- parameter_set;
- strategy_type;
- plan_version_id.

Regra:
F11 não recalcula aderência M6/M7.

---

## 2. M8 — Body Evolution

Tabela:
health_body_rolling_states

Uso:
resposta corporal observada.

Chave:
- athlete_id;
- as_of_date;
- window_days.

Campos mínimos:
- id;
- weight_observation_count;
- weight_latest_kg;
- weight_change_kg;
- weight_trend_kg_per_week;
- waist_observation_count;
- waist_latest_cm;
- waist_change_cm;
- body_fat_observation_count;
- body_fat_latest_pct;
- body_fat_change_pct;
- coverage_status;
- confidence;
- reason_codes;
- algorithm_version quando disponível;
- computed_at.

### body_response_available

TRUE somente se:
- coverage_status em partial|complete;
- e pelo menos um canal de resposta possuir comparação real.

Canais válidos:
- weight_change_kg não nulo;
- ou weight_trend_kg_per_week não nulo;
- ou waist_change_cm não nulo;
- ou body_fat_change_pct não nulo.

Um único peso sem mudança/tendência não constitui resposta corporal.

---

## 3. M9A — Sleep/Recovery

Tabela:
health_sleep_recovery_rolling_states

Uso:
contexto de recuperação.

Chave:
- athlete_id;
- as_of_date;
- window_days.

Campos mínimos:
- id;
- recovery_observed_days;
- fatigue_observed_days;
- readiness_observed_days;
- recovery_coverage;
- fatigue_coverage;
- readiness_coverage;
- average_recovery;
- average_fatigue;
- average_readiness;
- confidence;
- reason_codes;
- algorithm_version quando disponível;
- computed_at.

### recovery_context_available

TRUE somente se ao menos uma dimensão entre:
- recovery;
- fatigue;
- readiness

possuir:
- cobertura partial|complete;
- agregado não nulo.

A F11 v1 não soma essas métricas.

A F11 v1 não define score de recuperação.

---

## 4. M3/M4 — Treino

Fontes permitidas apenas como contexto:
- health_workout_sessions;
- health_cch_queue_entries;
- health_session_templates.

Uso possível no evidence_snapshot:
- sessão ativa;
- sessão pausada;
- próxima sessão da fila.

Não são decision-driving inputs v1.

Nenhuma ausência de sessão deve ser interpretada como descanso recomendado.

---

## 5. M9B — Exames

**Não é input decisório v1.**

F11 não consulta valores laboratoriais para escolher decision_code.

A implementação pode registrar apenas uma policy marker estática:

clinical_decision_policy = "excluded_v1"

Não carregar:
- resultados;
- flags;
- referência;
- documentos;
- signed URLs.

---

## 6. Perfil

health_athletes é usado somente para:
- autorização;
- identidade athlete_id;
- status ativo.

Perfil não gera score.

---

## 7. F10

Proibido usar F10 como input.

F10 pode exibir uma decisão F11 no futuro, mas:
F10 != source of truth.

---

## 8. Input snapshot

Estrutura conceitual:

~~~json
{
  "nutrition_decision": {
    "id": "...",
    "algorithm_version": "...",
    "decision_status": "...",
    "decision_class": "...",
    "decision_code": "...",
    "confidence": "...",
    "reason_codes": []
  },
  "body_state": {
    "id": "...",
    "coverage_status": "...",
    "confidence": "...",
    "response_available": true
  },
  "recovery_state": {
    "id": "...",
    "confidence": "...",
    "context_available": true
  },
  "training_context": {
    "active_session_id": null,
    "next_queue_entry_id": "..."
  },
  "clinical_decision_policy": "excluded_v1"
}
~~~

O snapshot contém apenas o necessário para explicar a decisão.

Não duplicar documentos ou séries completas.

---

## 9. Unknown

Fonte inexistente:
- permanece null;
- gera reason code quando obrigatória;
- nunca vira zero;
- nunca é inferida a partir de outra fonte.

---

## 10. Imutabilidade da fonte

A RPC F11 não pode:
- refresh M6;
- avaliar M7;
- refresh M8;
- refresh M9;
- gravar fatos especialistas.

Ela apenas lê estados/decisões já materializados.

Se uma fonte estiver ausente:
DECISION_PAUSED.

Isso evita writes escondidos cross-domain.
