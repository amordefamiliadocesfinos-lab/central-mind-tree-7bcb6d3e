# M9 — TECHNICAL DESIGN v1

**Status:** DESENHO TÉCNICO FECHADO — IMPLEMENTAÇÃO NÃO INICIADA  
**Base:** `main@4d6ebbeb71f39b9f3c39a07604e6e1f6a2fe54ae`  
**PR:** #487  
**ADR:** `M9_ARCHITECTURAL_DECISIONS_V1.md`

Este documento traduz a arquitetura M9A/M9B para um blueprint implementável sem aplicar DDL, migration, banco ou deploy.

## 1. Regra de implementação

Quando a implementação for autorizada, os arquivos de migration deverão ser criados pelo CLI com `supabase migration new <nome>`. Este documento define nomes lógicos e ordem; não congela timestamps manualmente.

Ordem lógica:

1. `health_m9_sleep_recovery_foundation`
2. `health_m9_sleep_recovery_rpcs`
3. `health_m9_clinical_foundation`
4. `health_m9_clinical_rpcs`
5. `health_m9_security`
6. `health_m9_integrity`

Nenhuma migration M9 existe ainda.

## 2. Padrão transversal de tabelas

Toda tabela factual por atleta deve usar:
- `id uuid primary key default gen_random_uuid()`;
- `athlete_id uuid not null references public.health_athletes(id) on delete cascade`;
- `created_by_auth_user_id uuid null references auth.users(id) on delete set null default auth.uid()`;
- `created_at timestamptz not null default now()`;
- `status` quando houver correção factual;
- índices com `athlete_id` como primeira coluna para consultas/RLS;
- `client_event_id` quando a criação for idempotente;
- unique parcial/lógica suficiente para impedir replay sem apagar histórico.

Correção:
- fato incorreto: supersession;
- fato inválido: void;
- derived state: recalculável/upsert por chave natural.

## 3. M9A — schema blueprint

### health_sleep_periods

Colunas mínimas:
- `id`
- `athlete_id`
- `sleep_date date not null`
- `period_type text not null check in ('nocturnal','nap','other')`
- `bed_at timestamptz null`
- `sleep_start_at timestamptz null`
- `final_wake_at timestamptz null`
- `out_of_bed_at timestamptz null`
- `declared_sleep_minutes integer null`
- `calculated_time_in_bed_minutes integer null`
- `calculated_sleep_minutes integer null`
- `awakenings_count integer null`
- `awake_during_period_minutes integer null`
- `timezone text null`
- `data_source text not null`
- `confidence text not null`
- `notes text null`
- `client_event_id uuid null`
- `status text not null default 'active'`
- `supersedes_sleep_period_id uuid null`
- `void_reason text null`
- `status_changed_at timestamptz null`
- audit columns.

Regras:
- minutos >= 0;
- nenhum cálculo deve preencher sono efetivo apenas com `bed_at/final_wake_at`;
- `calculated_time_in_bed_minutes` só quando timestamps permitem;
- `calculated_sleep_minutes` somente quando origem permitir;
- unique `(athlete_id, client_event_id)` quando client_event_id não nulo;
- supersession não pode apontar para si.

Índices:
- `(athlete_id, sleep_date desc)`;
- `(athlete_id, status, sleep_date desc)`;
- `(supersedes_sleep_period_id)` parcial;
- `(created_by_auth_user_id)` parcial.

### health_recovery_checkins

Uma linha por **métrica observada** no check-in; valores subjetivos em JSONB **não** são preferidos como fonte principal.

Métricas da mesma interação compartilham `checkin_event_id uuid not null`.

Estrutura:
- `id`
- `athlete_id`
- `observed_at`
- `observed_on`
- `metric_code`
- `value_ordinal smallint null check between 1 and 5`
- `raw_text text null`
- `scale_version text not null default 'M9_RECOVERY_ORDINAL_V1'`
- `data_source`
- `confidence`
- `checkin_event_id`
- `client_event_id` opcional para evento de transporte/replay;
- status/supersession/void;
- audit.

Checks/uniques:
- ao menos um de `value_ordinal` ou `raw_text` deve existir;
- unique `(athlete_id, checkin_event_id, metric_code)`;
- supersession deve permanecer no mesmo atleta e mesma semântica de métrica.

Métricas v1:
- sleep_quality
- sleepiness
- general_fatigue
- muscular_fatigue
- mental_fatigue
- physical_recovery
- training_readiness
- muscle_soreness
- disposition

Índice:
`(athlete_id, metric_code, observed_on desc, observed_at desc)`.

### health_sleep_device_observations

- `id`
- `athlete_id`
- `observed_at`
- `observed_on`
- `window_start_at/window_end_at`
- `metric_code`
- `numeric_value`
- `unit_code`
- `provider`
- `device_model`
- `external_id`
- `provider_algorithm_version`
- `confidence`
- `raw_metadata jsonb null`
- `client_event_id`
- status/void;
- audit.

Idempotência:
preferir unique por `(athlete_id, provider, external_id, metric_code)` quando `external_id` existir; fallback por client_event_id.

### health_sleep_recovery_rolling_states

Uma linha por atleta/data/janela.

- `athlete_id`
- `as_of_date`
- `window_days check in (7,14,28)`
- `window_start_date`
- contadores por dimensão;
- cobertura por dimensão;
- médias/variabilidade somente quando comparáveis;
- `confidence`;
- `reason_codes text[]`;
- `algorithm_version='M9_SLEEP_RECOVERY_STATE_V1'`;
- `computed_at`.

Unique:
`(athlete_id, as_of_date, window_days)`.

## 4. M9A — RPC blueprint

### health_m9_record_sleep_period
Entrada:
- athlete_id;
- timestamps/durações opcionais;
- period_type;
- source/confidence;
- notes;
- client_event_id;
- supersedes id opcional.

Regras:
- `health_can_write_athlete`;
- idempotência;
- validar superseded no mesmo atleta;
- transação atômica;
- retornar id.

### health_m9_record_recovery_checkin
Entrada:
- athlete_id;
- checkin_event_id;
- observed_at/on;
- metric_code;
- ordinal/raw_text;
- client_event_id opcional;
- supersedes id.

Repetir o mesmo `checkin_event_id + metric_code` retorna a linha já registrada em vez de duplicar.

### health_m9_record_device_observations
Entrada em lote JSONB.
- máximo de linhas por chamada definido na implementação;
- validar catálogo;
- idempotência por external_id/client_event_id;
- não preencher métrica desconhecida no estado canônico.

### void RPCs
- localizar atleta pelo id do fato;
- autorizar;
- exigir reason;
- status `voided`;
- preservar linha.

### health_m9_refresh_sleep_recovery_state
- janela apenas 7/14/28;
- cobertura por dimensão;
- limiares 5/7, 10/14, 20/28;
- `unknown != zero`;
- `MIXED_SLEEP_SOURCES` e `HRV_METHOD_NOT_COMPARABLE`;
- upsert do derived state.

## 5. M9B — schema blueprint

### health_clinical_documents

- `id`
- `athlete_id`
- `document_type`
- `original_filename`
- `document_date`
- `provider_name`
- `object_path`
- `mime_type`
- `sha256 text null`
- `data_source`
- `notes`
- status/supersession/void;
- audit.

Checks:
- object_path começa por `athlete_id::text || '/clinical/'`;
- rejeitar `..` no path;
- v1 UI aceita PDF/JPEG/PNG/WebP.

### health_clinical_document_extractions

- `id`
- `document_id`
- `athlete_id`
- `status`
- `engine_provider`
- `engine_version`
- `structured_payload jsonb`
- `field_confidences jsonb`
- `warnings jsonb`
- `error_message`
- `confirmed_by_auth_user_id`
- `confirmed_at`
- `rejected_by_auth_user_id`
- `rejected_at`
- audit.

FK composto document_id + athlete_id.

Status:
pending/extracting/extracted/review_required/confirmed/rejected/failed.

### health_lab_reports

- `id`
- `athlete_id`
- `document_id null`
- `extraction_id null`
- `laboratory_name`
- `collected_at`
- `resulted_at`
- `fasting_status`
- `collection_context jsonb`
- `data_source`
- `confidence`
- `client_event_id`
- notes/status/supersession/void;
- audit.

### health_biomarker_results

- `id`
- `lab_report_id`
- `athlete_id`
- `original_analyte_name`
- `canonical_code null`
- `original_result_text`
- `numeric_value null`
- `original_unit null`
- `normalized_value null`
- `normalized_unit_ucum null`
- `original_reference_text null`
- `reference_low null`
- `reference_high null`
- `original_flag null`
- `method_text null`
- `confidence`
- notes;
- audit.

Nenhum campo normalizado substitui o original.

### health_biomarker_catalog

Referência global, não por atleta:
- `canonical_code primary key`
- `display_name`
- `category`
- `expected_value_type`
- `external_coding_system null`
- `external_code null`
- `coding_version null`
- `status`
- audit.

### health_biomarker_aliases

- `id`
- `normalized_alias`
- `provider_name null`
- `canonical_code`
- `mapping_confidence`
- `mapping_version`
- `reviewed_by_auth_user_id null`
- audit.

### health_biomarker_longitudinal_states

- `id`
- `athlete_id`
- `canonical_code`
- `as_of_date`
- último/anterior comparável;
- unidade;
- contagem;
- `comparability_status`;
- `direction_status`;
- referência/flag atual;
- confidence/reason_codes;
- `algorithm_version='M9_BIOMARKER_STATE_V1'`;
- computed_at.

Não usar 7/14/28 para laboratório.

### health_vital_observations

- `id`
- `athlete_id`
- `observed_at/on`
- `metric_code`
- `numeric_value`
- `secondary_numeric_value null` para pares como PA;
- `unit_code`
- `condition_text`
- `device_text`
- `data_source`
- confidence;
- client_event_id/status/supersession/void;
- audit.

## 6. M9B — RPC blueprint

### health_m9_register_clinical_document
Registra metadados após upload Storage bem-sucedido.
Não manipula binário por SQL.

### health_m9_void_clinical_document
- resolve athlete_id pelo documento;
- exige autorização de escrita;
- exige motivo;
- marca metadado como voided;
- não apaga binário silenciosamente;
- remoção física do arquivo é ação separada/destrutiva e deve seguir política explícita.

### health_m9_stage_clinical_extraction
Cria/atualiza staging; não cria fatos clínicos.

### health_m9_confirm_clinical_extraction
Transação:
1. autorizar atleta;
2. lock da extraction;
3. exigir status extracted/review_required;
4. validar payload mínimo;
5. criar lab_report;
6. criar biomarker_results;
7. marcar extraction confirmed;
8. retornar lab_report_id.

Se qualquer item falhar, rollback total.

### health_m9_reject_clinical_extraction
Marca rejected com auditoria; não apaga documento.

### health_m9_record_lab_report
Entrada manual direta.
Cria report + resultados em transação.
Fonte = manual/declared ou professional_recorded conforme contrato.

Na v1, resultados filhos são imutáveis. Correção de marcador ocorre por supersession/void do relatório e criação de relatório substituto.

### health_m9_refresh_biomarker_state
- comparar somente resultados ativos;
- exigir comparabilidade;
- preservar não comparável como estado válido;
- sem interpretação clínica.

## 7. Segurança das funções

Para cada nova RPC privilegiada:
- autorização do atleta dentro da função;
- `SECURITY DEFINER` somente quando necessária para escrita RPC-only;
- `SET search_path = ''`;
- todas as relações chamadas com schema explícito;
- `REVOKE ALL ... FROM PUBLIC, anon, authenticated`;
- `GRANT EXECUTE ... TO authenticated`;
- nenhuma função pública deve confiar apenas no role;
- frontend nunca recebe service/secret key.

O helper existente `public.health_can_read_athlete/write_athlete` continua a autoridade de acesso nesta fase; M9 não o reescreve.

## 8. Storage

Reutilizar bucket:
`health-private`.

Não alterar diretamente tabelas do schema `storage`.

Path clínico:
`<athlete_id>/clinical/<document_id>/<filename-safe>`.

A M0 já autoriza Storage pelo primeiro segmento `athlete_id`. M9 deve reutilizar esse contrato; qualquer alteração de policy exige revisão separada.

## 9. Grants/Data API

Tabelas por atleta:
- `anon`: nenhum grant;
- `authenticated`: SELECT somente;
- INSERT/UPDATE/DELETE direto: revogado;
- mutação: RPC.

Derived state:
- SELECT authenticated autorizado;
- write somente RPC.

Catálogo global:
- SELECT authenticated;
- mutação somente migration/admin, não frontend.

Extractions:
- SELECT authenticated autorizado ao atleta;
- write somente RPC.

## 10. Integridade

A migration lógica `health_m9_integrity` deverá consolidar:
- checks de intervalos plausíveis estruturais sem diagnóstico;
- paths seguros;
- consistência status/void_reason;
- consistência supersession;
- imutabilidade prática dos filhos `health_biomarker_results` via ausência de DML direto;
- índices de RLS;
- constraints de idempotência;
- FKs compostas com athlete_id quando evitarem cross-athlete linkage.

## 11. Critério de conclusão do desenho técnico

Este blueprint é suficiente para implementar a M9 sem decidir novos conceitos de domínio durante a migration.

Ainda não autoriza implementação/aplicação.
