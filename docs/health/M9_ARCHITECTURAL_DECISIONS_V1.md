# M9 — ARCHITECTURAL DECISIONS v1

**Data:** 07/11/2026  
**Status:** CONGELADO PARA DESENHO TÉCNICO — AINDA NÃO IMPLEMENTADO  
**Base:** `main@4d6ebbeb71f39b9f3c39a07604e6e1f6a2fe54ae`  
**Branch:** `docs/health-m9-architecture-20261107`

Este ADR resolve as sete decisões que bloqueavam o desenho técnico da M9.

Nada neste documento autoriza migration, banco, deploy ou dado real.

---

## D1 — Nomes finais de tabelas e RPCs

### M9A — tabelas

- `health_sleep_periods`
- `health_recovery_checkins`
- `health_sleep_device_observations`
- `health_sleep_recovery_rolling_states`

### M9A — RPCs

- `health_m9_record_sleep_period`
- `health_m9_void_sleep_period`
- `health_m9_record_recovery_checkin`
- `health_m9_void_recovery_checkin`
- `health_m9_record_device_observations`
- `health_m9_void_device_observation`
- `health_m9_refresh_sleep_recovery_state`

`health_m9_record_device_observations` deve aceitar lote idempotente para importações, preservando origem/provider e identificador externo quando disponível.

### M9B — tabelas

- `health_clinical_documents`
- `health_clinical_document_extractions`
- `health_lab_reports`
- `health_biomarker_results`
- `health_biomarker_catalog`
- `health_biomarker_aliases`
- `health_biomarker_longitudinal_states`
- `health_vital_observations`

### M9B — RPCs

- `health_m9_register_clinical_document`
- `health_m9_stage_clinical_extraction`
- `health_m9_confirm_clinical_extraction`
- `health_m9_reject_clinical_extraction`
- `health_m9_record_lab_report`
- `health_m9_void_lab_report`
- `health_m9_record_vital_observation`
- `health_m9_void_vital_observation`
- `health_m9_refresh_biomarker_state`

RPCs de extração não podem transformar conteúdo extraído automaticamente em fatos canônicos sem confirmação explícita na v1.

---

## D2 — Cobertura e suficiência M9A

Janelas:
- 7 dias;
- 14 dias;
- 28 dias.

Cobertura é calculada **por dimensão**, não por um contador genérico.

Dimensões mínimas:
- `sleep_duration`;
- `sleep_timing`;
- `sleep_quality`;
- `recovery`;
- `fatigue`;
- `readiness`.

Para cada dimensão:

- `unobserved`: 0 dias observados;
- `sparse`: >0 e <50% dos dias da janela;
- `partial`: >=50% e <70%;
- `complete`: >=70%.

Limiar de suficiência v1 para agregados/tendência:
- 7 dias: **5 dias**;
- 14 dias: **10 dias**;
- 28 dias: **20 dias**.

Atingir cobertura em uma dimensão não autoriza preencher outra.

Exemplo:
5 noites com duração conhecida e 1 check-in de fadiga:
- duração pode estar `complete`;
- fadiga continua `sparse`.

`unknown != zero` permanece obrigatório.

---

## D3 — Escalas subjetivas M9A

A v1 usa escala ordinal opcional **1–5**, sempre acompanhada por `metric_code`, `scale_version` e possibilidade de `raw_text`.

### Direção positiva — maior = melhor

- `sleep_quality`
- `physical_recovery`
- `training_readiness`
- `disposition`

Âncoras:
1 = muito ruim/muito baixa  
2 = ruim/baixa  
3 = razoável/intermediária  
4 = boa  
5 = muito boa

### Direção negativa — maior = pior/mais intenso

- `sleepiness`
- `general_fatigue`
- `muscular_fatigue`
- `mental_fatigue`
- `muscle_soreness`

Âncoras:
1 = ausente/muito baixa  
2 = baixa  
3 = moderada  
4 = alta  
5 = muito alta

Regras:
- texto qualitativo pode existir sem número;
- o sistema não converte automaticamente "dormi bem" em 4;
- não criar score composto de prontidão na v1;
- métricas de direções opostas não são somadas sem contrato posterior versionado.

---

## D4 — Catálogo mínimo de wearable M9A

Catálogo v1:

### Sono
- `sleep_duration_minutes_estimated`
- `time_in_bed_minutes`
- `sleep_latency_minutes_estimated`
- `wake_after_sleep_onset_minutes_estimated`
- `awakenings_count_estimated`
- `awake_minutes_estimated`
- `sleep_stage_light_minutes_estimated`
- `sleep_stage_deep_minutes_estimated`
- `sleep_stage_rem_minutes_estimated`

### Recuperação fisiológica complementar
- `resting_heart_rate_bpm`
- `hrv_rmssd_ms`
- `respiratory_rate_breaths_per_min`

Obrigatório preservar:
- provider;
- device/model quando disponível;
- instante/janela;
- unidade;
- external_id quando existir;
- confiança/origem;
- algoritmo/provider version quando disponível.

Regras:
- estágio de sono é sempre rotulado como estimativa;
- HRV sem método compatível não é comparado automaticamente;
- séries de providers distintos podem coexistir, mas `MIXED_SLEEP_SOURCES` deve poder bloquear comparações fortes;
- métricas não catalogadas podem ser preservadas em staging/raw payload, mas não entram automaticamente no estado canônico.

---

## D5 — Catálogo e aliases de biomarcadores M9B

### Catálogo

`health_biomarker_catalog` deve conter:
- `canonical_code` interno estável;
- display name;
- categoria/painel;
- tipo de resultado esperado quando útil;
- coding system externo opcional;
- external code opcional;
- coding version opcional;
- status ativo/inativo.

### Aliases

`health_biomarker_aliases` mapeia:
- alias normalizado;
- provider/laboratório opcional;
- `canonical_code`;
- confiança/revisão;
- versão do mapeamento.

### Padrão externo

LOINC é permitido como identificador externo preferencial quando houver mapeamento confiável, mas:
- não é obrigatório;
- não substitui o nome original do laboratório;
- não deve ser atribuído por fuzzy match sem revisão;
- versão/coding system deve ser preservada.

Unidade original permanece fonte factual.

Uma unidade normalizada opcional pode usar representação UCUM quando houver conversão explícita, auditável e semanticamente válida.

### Resultado original

`health_biomarker_results` preserva sempre:
- `original_analyte_name`;
- `original_result_text`;
- `original_unit`;
- `original_reference_text`;
- `original_flag`.

Campos canônicos/normalizados são adicionais, nunca substitutos.

---

## D6 — Rotas finais

### M9A
**`/saude/recuperacao`**

A rota já existe no shell como espaço reservado e será ocupada pela M9A.

### M9B
**`/saude/exames`**

Não usar `/saude/saude`.

O shell poderá rotular a navegação como **Exames** ou **Saúde**, mas a URL canônica v1 é `/saude/exames`.

---

## D7 — Extração documental e revisão M9B

A v1 adota **staging obrigatório** para extração de documentos clínicos.

Fluxo:

1. upload privado do documento para `health-private/<athlete_id>/clinical/<document_id>/...`;
2. registro em `health_clinical_documents`;
3. criação de extração em `health_clinical_document_extractions`;
4. extração automática ou assistida;
5. status `extracted` ou `review_required`;
6. apresentação dos campos extraídos para confirmação;
7. somente após confirmação: RPC transacional cria `health_lab_reports` + `health_biomarker_results`;
8. vínculo permanente entre fato canônico, extração e documento original.

Status v1:
- `pending`;
- `extracting`;
- `extracted`;
- `review_required`;
- `confirmed`;
- `rejected`;
- `failed`.

Regra soberana:
**extração != fato clínico canônico**.

Na v1, dados derivados de documento só entram no histórico canônico após confirmação explícita por usuário autorizado.

Entrada manual direta continua possível, registrada com fonte `manual/declared`, sem exigir documento.

A extração deve preservar:
- engine/provider;
- versão do engine/model;
- confidence por campo quando disponível;
- payload estruturado de staging;
- erros de leitura;
- timestamp;
- usuário que confirmou/rejeitou.

Nenhuma interpretação médica é gerada nessa etapa.

---

## Alinhamento de interoperabilidade

O desenho M9B segue a separação conceitual:
- documento/relatório diagnóstico;
- resultados atômicos/observações;
- terminologia opcional;
- unidade original + normalização separada.

Referências técnicas:
- HL7 FHIR DiagnosticReport: https://hl7.org/fhir/diagnosticreport.html
- HL7 FHIR Observation: https://hl7.org/fhir/R5/observation.html
- LOINC: https://loinc.org/
- UCUM: https://unitsofmeasure.org/

O CCH não se declara uma implementação FHIR completa na M9 v1. O objetivo é manter compatibilidade conceitual e evitar um modelo proprietário impossível de interoperar depois.

---

## Resultado da revisão arquitetural

As sete decisões que bloqueavam o desenho técnico estão **RESOLVIDAS**.

A M9 está apta a avançar para:
- desenho técnico de migrations/RPCs;
- matriz RLS;
- casos de teste;
- desenho de UI mobile.

Isso **não** autoriza:
- aplicar migration em TESTES MT;
- alterar banco canônico;
- merge da PR #487;
- deploy.

Essas ações continuam sujeitas ao Mapa Soberano e aos Gates.
