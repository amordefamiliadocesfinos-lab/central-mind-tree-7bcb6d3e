# F12 — JOURNEY READ CONTRACT v1

**Status:** DOCUMENTAL  
**Princípio:** projeção sem nova fonte de verdade.

---

## 1. Entrada

- athlete_id;
- local_date;
- window_days=7.

---

## 2. Fontes J1

### health_athlete_profiles

Selecionar somente:
- athlete_id;
- updated_at quando existente.

Não trazer notas livres para a projeção.

### health_goals

Selecionar:
- id;
- athlete_id;
- is_primary;
- status;
- goal_type;
- title;
- start_date;
- target_date.

Somente meta primária ativa interessa para o checkpoint J1.

### health_goal_phases

Opcional:
- id;
- goal_id;
- phase_type;
- title;
- status;
- start_date;
- end_date.

---

## 3. Fontes J2

### health_programs

Selecionar:
- id;
- status;
- current_version_id.

### health_program_versions

Selecionar:
- id;
- version_number;
- status;
- published_at quando existente.

### health_cch_queue_entries

Selecionar mínimo necessário:
- id;
- position;
- state/status conforme schema;
- template_id;
- eligible_after;
- reason_codes.

Não recalcular programa.

---

## 4. Fonte J3

### health_workout_sessions

Duas leituras lógicas:
- sessão aberta mais recente;
- sessão completed mais recente.

Selecionar:
- id;
- status;
- started_at;
- ended_at;
- template_id;
- queue_entry_id.

Não carregar séries no resumo de jornada.

---

## 5. Fontes J4

### health_nutrition_rolling_states

Chave:
- athlete_id;
- window_end_date=local_date;
- window_days=7.

Selecionar:
- id;
- coverage_status;
- confidence;
- observed_day_count;
- sufficient_day_count;
- reason_codes.

### health_nutrition_decisions

Chave:
- athlete_id;
- as_of_date=local_date;
- window_days=7;
- record_status=current.

Selecionar:
- id;
- decision_status;
- decision_class;
- decision_code;
- confidence;
- reason_codes;
- algorithm_version.

---

## 6. Fonte J5

### health_body_rolling_states

Chave:
- athlete_id;
- as_of_date=local_date;
- window_days=7.

Selecionar:
- id;
- coverage_status;
- confidence;
- weight_observation_count;
- waist_observation_count;
- body_fat_observation_count;
- reason_codes.

`body_observed=true` somente se:
- coverage_status in partial|complete;
- e soma dos observation counts > 0.

---

## 7. Fonte J6

### health_sleep_recovery_rolling_states

Chave:
- athlete_id;
- as_of_date=local_date;
- window_days=7.

Selecionar:
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
- reason_codes.

`recovery_observed=true` somente quando ao menos uma dimensão:
- coverage partial|complete;
- agregado não nulo.

---

## 8. Fontes J7

### health_integrated_decision_runs

Chave:
- athlete_id;
- as_of_date=local_date;
- window_days=7;
- record_status=current.

Selecionar:
- id;
- run_status;
- algorithm_version;
- created_at.

### health_integrated_decisions

Por run_id:
- id;
- decision_scope;
- decision_status;
- decision_class;
- decision_code;
- confidence;
- reason_codes;
- action_status.

Não carregar evidence_snapshot completo para a tela de jornada.

---

## 9. Contexto M9B opcional

Somente contagens/metadados mínimos já usados pelo Dashboard.

Não carregar:
- valores laboratoriais;
- documentos;
- PDFs;
- signed URLs;
- texto clínico.

---

## 10. Paralelismo

As leituras independentes devem ser executadas em paralelo quando seguro.

Evitar N+1.

J1 e J2 podem exigir leituras dependentes pequenas, mas o hook deve manter limites previsíveis.

---

## 11. Mutação

O hook de leitura F12 não executa RPC de escrita.

A avaliação F11 fica em função/action separada:
`evaluateIntegratedDecision()`.

O método `reload()` é SELECT-only.

---

## 12. Backend F11 ausente

Durante desenvolvimento antecipado v3.3, o ambiente pode ainda não ter schema F11.

A UI deve distinguir:
- erro de backend indisponível;
- ausência de decisão.

Não declarar “sem decisão” quando a tabela/RPC não existe.

Em produção, Gate C F12 não deve ocorrer com dependência F11 incompatível.

---

## 13. Privacidade

A projeção F12 não precisa de:
- fotos;
- documentos clínicos;
- conteúdo de notas;
- payloads de wearable;
- alimentos detalhados;
- séries detalhadas de treino.

Usar somente o mínimo necessário para estágio e navegação.
