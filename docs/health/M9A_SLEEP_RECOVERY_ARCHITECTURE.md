# M9A — SLEEP & RECOVERY ARCHITECTURE

## Status

**ARQUITETURA v1 FECHADA PARA DESENHO TÉCNICO — NÃO IMPLEMENTADA**

Este documento define a frente M9A após o encerramento da M8.

Nenhuma tabela, RPC, migration, deploy ou dado real é criado por este documento.

Decisões congeladas:
`M9_ARCHITECTURAL_DECISIONS_V1.md`

## Missão

Criar a camada longitudinal de **sono, recuperação, fadiga, sonolência e prontidão percebida** do CCH.

Fronteira oficial:

- M8 = fatos corporais + estado corporal;
- M9A = fatos de sono/recuperação + estado longitudinal de sono/recuperação;
- planejamento/intervenção = camada posterior;
- decisão integrada = camada posterior ao contrato explícito do Motor Integrado CCH.

M9A descreve o que foi observado. Não prescreve mudança de treino, alimentação, medicação ou tratamento.

## Fontes especialistas herdadas

Fonte funcional especializada:
- `04 — SONO E RECUPERAÇÃO`

Princípios preservados:
- sono é componente central, não periférico;
- registrar o que existe sem inventar o que falta;
- tempo na cama != tempo dormindo;
- qualidade percebida != medida objetiva;
- fadiga geral, muscular, mental e sonolência não são equivalentes;
- associação != causalidade;
- dispositivos/wearables são fontes estimadas e devem carregar origem;
- histórico longitudinal é preservado;
- sinais potencialmente relevantes para saúde devem poder ser encaminhados, sem diagnóstico pelo diário.

## Princípios M9A

- `unknown != zero`;
- fato != percepção != estado != hipótese != decisão != ação;
- dado declarado != dado de dispositivo != dado calculado;
- não converter texto qualitativo em escala numérica automaticamente;
- não assumir sono contínuo entre horário de deitar e acordar;
- correção não apaga silenciosamente o fato original;
- estado derivado é recalculável e versionado;
- nenhum valor isolado produz recomendação automática;
- nenhuma associação entre sono e outro módulo é tratada como causalidade automática;
- cobertura é calculada por dimensão.

## Tabelas v1

### health_sleep_periods

Representa episódio/período de sono ou tentativa de sono.

Preserva, quando conhecidos:
- atleta;
- instante/local date de referência;
- horário de deitar;
- horário estimado de início do sono;
- horário de despertar final;
- horário de levantar;
- duração declarada do sono;
- tempo na cama calculável;
- duração de sono calculável somente quando a evidência permitir;
- despertares;
- duração acordado quando conhecida;
- tipo `nocturnal/nap/other`;
- fonte;
- confiança;
- timezone/contexto;
- observações;
- `client_event_id`;
- status `active/superseded/voided`;
- vínculo de supersession.

Regra:
apenas deitar + acordar permite calcular **tempo na cama**, não sono efetivo.

### health_recovery_checkins

Observações subjetivas/diárias.

A unidade factual é **uma métrica observada dentro de um check-in**. Várias métricas coletadas na mesma interação compartilham um `checkin_event_id`; cada linha preserva seu próprio `metric_code`.

Idempotência v1:
- unique lógico `(athlete_id, checkin_event_id, metric_code)`;
- replay do mesmo check-in não duplica a mesma métrica;
- métricas ausentes no check-in permanecem desconhecidas.

Métricas v1:
- `sleep_quality`;
- `sleepiness`;
- `general_fatigue`;
- `muscular_fatigue`;
- `mental_fatigue`;
- `physical_recovery`;
- `training_readiness`;
- `muscle_soreness`;
- `disposition`.

Cada métrica pode ter:
- `value_ordinal` 1–5 opcional;
- `raw_text` opcional;
- `scale_version`;
- fonte/confiança;
- data/hora.

Direção positiva:
`sleep_quality`, `physical_recovery`, `training_readiness`, `disposition`.

Direção negativa:
`sleepiness`, `general_fatigue`, `muscular_fatigue`, `mental_fatigue`, `muscle_soreness`.

Texto qualitativo não é convertido automaticamente em número.

### health_sleep_device_observations

Métricas produzidas por wearable/aplicativo/dispositivo.

Catálogo canônico v1:
- `sleep_duration_minutes_estimated`;
- `time_in_bed_minutes`;
- `sleep_latency_minutes_estimated`;
- `wake_after_sleep_onset_minutes_estimated`;
- `awakenings_count_estimated`;
- `awake_minutes_estimated`;
- `sleep_stage_light_minutes_estimated`;
- `sleep_stage_deep_minutes_estimated`;
- `sleep_stage_rem_minutes_estimated`;
- `resting_heart_rate_bpm`;
- `hrv_rmssd_ms`;
- `respiratory_rate_breaths_per_min`.

Preservar:
- valor/unidade;
- provider/device;
- janela/instante;
- `external_id`;
- confiança;
- versão de algoritmo/provider quando disponível.

Estágios permanecem explicitamente estimados.

## RPCs v1

- `health_m9_record_sleep_period`
- `health_m9_void_sleep_period`
- `health_m9_record_recovery_checkin`
- `health_m9_void_recovery_checkin`
- `health_m9_record_device_observations`
- `health_m9_void_device_observation`
- `health_m9_refresh_sleep_recovery_state`

Importação de dispositivo deve suportar lote idempotente.

## Estado longitudinal

### health_sleep_recovery_rolling_states

Janelas:
- 7 dias;
- 14 dias;
- 28 dias.

O estado guarda cobertura por dimensão, não apenas cobertura geral.

Dimensões:
- duração;
- timing;
- qualidade;
- recuperação;
- fadiga;
- prontidão.

Para cada dimensão:
- `unobserved`: 0 dias;
- `sparse`: >0 e <50%;
- `partial`: >=50% e <70%;
- `complete`: >=70%.

Suficiência v1:
- 7 dias: 5;
- 14 dias: 10;
- 28 dias: 20.

Somente dimensões suficientes podem produzir agregado/tendência classificado como suficiente.

O estado pode incluir:
- dias observados por dimensão;
- média de duração comparável;
- variabilidade de duração;
- regularidade de horários quando calculável;
- agregados de escalas comparáveis;
- cochilos observados;
- cobertura por dimensão;
- confiança;
- `reason_codes`;
- `algorithm_version`;
- data de cálculo.

Não existe score composto de prontidão na v1.

## Reason codes mínimos

- `NO_SLEEP_DATA`;
- `NO_USABLE_SLEEP_DURATION`;
- `TIME_IN_BED_ONLY`;
- `INSUFFICIENT_SLEEP_COVERAGE`;
- `INSUFFICIENT_SLEEP_TIMING_COVERAGE`;
- `RECOVERY_UNOBSERVED`;
- `FATIGUE_UNOBSERVED`;
- `READINESS_UNOBSERVED`;
- `DEVICE_ESTIMATE_ONLY`;
- `MIXED_SLEEP_SOURCES`;
- `INSUFFICIENT_COMPARABLE_DAYS`;
- `HRV_METHOD_NOT_COMPARABLE`.

Reason code descreve condição do dado; não é diagnóstico.

## Conexões intermódulo

M9A pode gerar conexões para:
- 00 — Central;
- 01 — Treino;
- 02 — Alimentação;
- 03/M8 — Físico/Body;
- 05/M9B — Saúde/Exames/Biomarcadores;
- 06 — Planejamento Integrado;
- 07 — Base Científica.

Conexão = merece análise conjunta, não causa comprovada.

## Segurança e privacidade

Na futura implementação:
- mesmo `athlete_id` e matriz de autorização Health;
- RLS deny-by-default;
- anon sem acesso;
- escrita factual por RPC versionada;
- `SECURITY DEFINER` somente quando necessário com `search_path` fixo;
- cross-athlete obrigatório;
- projeções externas somente por contrato explícito.

## Correções

- supersession para substituição factual;
- void para anulação;
- estado recalculável;
- histórico nunca destruído silenciosamente.

## UI v1

Rota final:
`/saude/recuperacao`

Mobile-first.

Blocos:
- registro simples do sono;
- check-in de recuperação;
- estado 7/14/28 por dimensão;
- histórico;
- origem/confiança;
- unknown explícito;
- conexões sem diagnóstico.

## Fora do escopo M9A v1

- diagnóstico de transtorno de sono;
- interpretação clínica automática de estágios;
- prescrição;
- alteração automática de treino/dieta;
- recomendação terapêutica;
- score composto de prontidão governando treino;
- causalidade inferida de correlação;
- wearable obrigatório.

## Critério de saída arquitetural

**ATENDIDO DOCUMENTALMENTE.**

O desenho técnico v1 correspondente foi concluído na própria PR #487 e submetido à revisão final documental.

Implementação, migrations e gates permanecem separados.
