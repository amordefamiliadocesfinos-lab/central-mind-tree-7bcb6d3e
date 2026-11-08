# F10 — DASHBOARD INTEGRADO — READ CONTRACT v1

**Status:** CONTRATO DOCUMENTAL
**Autoridade:** F10 Dashboard Integrado
**Princípio:** projeção read-only sobre M0→M9

## 1. Contrato geral

Modelo conceitual:

~~~ts
type DashboardAvailability =
  | "available"
  | "unknown"
  | "error"
  | "not_applicable";

type DashboardFreshness =
  | "today"
  | "historical"
  | "not_applicable";

type DashboardDomainSnapshot = {
  domain: "training" | "nutrition" | "body" | "recovery" | "exams";
  availability: DashboardAvailability;
  freshness: DashboardFreshness;
  asOf: string | null;
  confidence: "low" | "moderate" | "high" | null;
  coverage: string | null;
  reasonCodes: string[];
  href: string;
};
~~~

Campos ausentes permanecem null.

## 2. Treino

Fonte primária:
health_workout_sessions.

Filtro:
- atleta atual;
- status active|paused;
- mais recente.

Campos mínimos:
- id;
- status;
- started_at;
- session_template_id.

Fonte de próximo treino:
health_cch_queue_entries.

Filtro:
- atleta atual;
- state queued|eligible|prioritized;
- menor queue_position.

Campos:
- id;
- state;
- queue_position;
- session_template_id.

Template:
health_session_templates, somente quando houver session_template_id.

Semântica:
- sessão ativa prevalece sobre fila;
- ausência de ambos não é erro;
- nenhum cálculo de desempenho.

## 3. Alimentação

Hoje:
health_nutrition_daily_states.

Chave:
- athlete_id;
- state_date = hoje.

Campos:
- observed_meal_count;
- observed_item_count;
- energy_kcal_consumed;
- protein_g_consumed;
- energy_target_status;
- protein_target_status;
- completeness_status;
- state_status;
- confidence;
- reason_codes;
- calculated_at.

7 dias:
health_nutrition_rolling_states.

Chave:
- athlete_id;
- window_end_date = hoje preferencial;
- window_days = 7.

Campos:
- observed_day_count;
- sufficient_day_count;
- observation_coverage_ratio;
- coverage_status;
- confidence;
- reason_codes;
- calculated_at.

Decisão existente:
health_nutrition_decisions.

Chave:
- athlete_id;
- as_of_date = hoje preferencial;
- window_days = 7;
- record_status = current.

Campos:
- decision_status;
- decision_class;
- decision_code;
- target_domain;
- confidence;
- reason_codes;
- plan_adjustment_status;
- plan_adjustment_reason_codes;
- algorithm_version;
- created_at.

F10 nunca chama a RPC de avaliação M7.

## 4. Corpo

Fonte:
health_body_rolling_states.

Preferência:
- as_of_date = hoje;
- window_days = 7.

Fallback:
- último estado anterior, explicitamente marcado historical.

Campos:
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
- photo_set_count;
- latest_bmi;
- coverage_status;
- confidence;
- reason_codes;
- computed_at.

Não buscar fotos.

## 5. Sono/Recuperação

Fonte:
health_sleep_recovery_rolling_states.

Preferência:
- as_of_date = hoje;
- window_days = 7.

Fallback:
- último estado anterior marcado historical.

Campos:
- sleep_duration_observed_days;
- sleep_timing_observed_days;
- sleep_quality_observed_days;
- recovery_observed_days;
- fatigue_observed_days;
- readiness_observed_days;
- sleep_duration_coverage;
- sleep_timing_coverage;
- sleep_quality_coverage;
- recovery_coverage;
- fatigue_coverage;
- readiness_coverage;
- average_sleep_minutes;
- average_sleep_quality;
- average_recovery;
- average_fatigue;
- average_readiness;
- confidence;
- reason_codes;
- computed_at.

Nenhuma agregação entre métricas positivas e negativas.

## 6. Exames

Último exame confirmado:
health_lab_reports.

Filtro:
- athlete_id;
- status = active.

Ordenação:
- collected_at desc;
- resulted_at desc;
- created_at desc.

Campos:
- id;
- laboratory_name;
- collected_at;
- resulted_at;
- confidence;
- data_source;
- created_at.

Marcadores do último exame:
health_biomarker_results.

Uso:
- somente count por lab_report_id.

Estados longitudinais:
health_biomarker_longitudinal_states.

Uso:
- contagem de estados disponíveis;
- data mais recente de cálculo.

Não sintetizar direção em “bom/ruim”.

Sinal fisiológico:
health_vital_observations.

Uso:
- data do último registro ativo;
- metric_code opcionalmente exibível como contexto.

Não interpretar valor.

Extração aguardando revisão:
health_clinical_document_extractions.

Filtro:
- athlete_id;
- status extracted|review_required.

Uso:
- count.

Não carregar payload clínico no Dashboard.

## 7. Perfil

health_athletes fornece:
- display_name;
- athlete_id;
- status.

Pode usar display_name no cabeçalho.

F10 v1 não cria percentual de perfil completo.

## 8. Ordem visual

1. Treino;
2. Alimentação;
3. Sono/Recuperação;
4. Evolução corporal;
5. Exames/Biomarcadores.

Prioridade de UI não significa prioridade clínica.

## 9. Normalização visual

available:
há fonte suficiente para apresentar pelo menos um estado/valor.

unknown:
fonte ausente ou estado explicitamente unobserved.

error:
a query daquele domínio falhou.

not_applicable:
exemplo: não existe sessão ativa, mas isso não é erro.

## 10. Reason codes

F10 pode:
- exibir reason codes existentes em linguagem amigável;
- criar apenas códigos de UI/integração, como DASHBOARD_SOURCE_UNAVAILABLE ou DASHBOARD_HISTORICAL_STATE.

Esses códigos não entram nos ledgers especialistas.

## 11. Escrita proibida

No carregamento do Dashboard é proibido chamar:
- health_m6_refresh_daily_state;
- health_m6_refresh_rolling_state;
- health_m7_evaluate_nutrition_decision;
- health_m8_refresh_body_state;
- health_m9_refresh_sleep_recovery_state;
- health_m9_refresh_biomarker_state;
- qualquer RPC de record/void/supersede.

A tela é estritamente read-only na v1.
