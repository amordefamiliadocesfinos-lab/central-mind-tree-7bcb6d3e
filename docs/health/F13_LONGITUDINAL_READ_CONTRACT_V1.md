# F13 — LONGITUDINAL READ CONTRACT v1

**Status:** DOCUMENTAL  
**Janela padrão:** 28 dias

---

## 1. Entrada

- athlete_id;
- as_of_date;
- window_days=28.

A v1 não aceita 7/14 dias para revisão longitudinal principal.

---

## 2. Períodos

current:
- end = as_of_date;
- start = as_of_date - 27.

prior:
- end = as_of_date - 28;
- start = as_of_date - 55.

Todos os snapshots devem guardar as quatro datas.

---

## 3. Goal context

### health_goals

Selecionar meta:
- athlete_id;
- status=active;
- is_primary=true.

Campos mínimos:
- id;
- goal_type;
- title;
- priority;
- started_on;
- target_date;
- updated_at.

### health_goal_phases

Campos:
- id;
- goal_id;
- phase_type;
- title;
- status;
- starts_on;
- ends_on.

A fase é contexto, não requisito de comparação.

---

## 4. Training comparison

### health_workout_sessions

Filtro por cada período:
- athlete_id;
- status=completed;
- ended_at dentro do intervalo inclusivo.

Métricas:
- completed_session_count.

### health_workout_sets

Join somente com sessões concluídas do mesmo período.

Métricas:
- completed_set_count;
- distinct_exercise_count via health_workout_exercises.

Não agregar load_value globalmente.

Não misturar kg/lb/bodyweight.

---

## 5. Nutrition comparison

### health_nutrition_rolling_states

Current:
- athlete_id;
- window_days=28;
- window_end_date=as_of_date.

Prior:
- athlete_id;
- window_days=28;
- window_end_date=as_of_date-28.

Exige data exata.

Campos:
- id;
- observed_day_count;
- sufficient_day_count;
- observation_coverage_ratio;
- sufficient_coverage_ratio;
- avg_energy_kcal;
- avg_protein_g;
- avg_carbohydrate_g;
- avg_fat_g;
- avg_fiber_g;
- energy_target_adherence_ratio;
- protein_target_adherence_ratio;
- coverage_status;
- confidence;
- reason_codes;
- algorithm_version;
- calculated_at.

---

## 6. Body comparison

### health_body_rolling_states

Current:
- as_of_date;
- window_days=28.

Prior:
- as_of_date-28;
- window_days=28.

Campos:
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
- algorithm_version;
- computed_at.

---

## 7. Recovery comparison

### health_sleep_recovery_rolling_states

Mesmas datas exatas da seção anterior.

Campos:
- id;
- observed day counts;
- coverage por dimensão;
- average_sleep_minutes;
- sleep_duration_variability_minutes;
- average_sleep_quality;
- average_recovery;
- average_fatigue;
- average_readiness;
- confidence;
- reason_codes;
- algorithm_version;
- computed_at.

---

## 8. F11 context

Selecionar, se existente, último run dentro de cada período.

Mostrar:
- run id;
- as_of_date;
- window_days;
- run_status;
- algorithm_version.

Carregar decisões filhas resumidas:
- decision_scope;
- decision_status;
- decision_code;
- target_domain;
- confidence;
- reason_codes.

F11 é contexto histórico.

Não precisa possuir window_days=28 para ser mostrado como contexto, desde que sua data pertença explicitamente ao período.

---

## 9. M9B

A leitura longitudinal F13 v1 não carrega resultados clínicos.

Pode consultar somente existência/contagem de contexto clínico confirmado, se necessário à UI.

---

## 10. Snapshot mínimo

O run F13 pode persistir:

- IDs de fontes;
- datas;
- métricas comparadas;
- coverage/confidence;
- reason codes;
- versões de algoritmo;
- diferenças calculadas.

Não persistir:
- fotos;
- documentos;
- PDFs;
- notas clínicas integrais;
- séries completas de treino;
- alimentos individuais;
- payloads de wearable.

---

## 11. Erro vs ausência

Query error:
- domain status=error.

Fonte não materializada:
- domain status=unavailable.

Não converter erro técnico em ausência de dado.

---

## 12. Unknown

Null permanece null.

Não usar zero como substituto de:
- média ausente;
- tendência ausente;
- adesão não comparável;
- biometria não observada.
