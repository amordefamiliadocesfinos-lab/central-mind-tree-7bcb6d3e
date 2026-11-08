# M9B — EXAMS & BIOMARKERS ARCHITECTURE

## Status

**ARQUITETURA v1 FECHADA PARA DESENHO TÉCNICO — NÃO IMPLEMENTADA**

Nenhuma tabela, RPC, migration, arquivo clínico, deploy ou dado real é criado por este documento.

Decisões congeladas:
`M9_ARCHITECTURAL_DECISIONS_V1.md`

## Missão

Criar a camada longitudinal de **exames, biomarcadores e sinais fisiológicos fornecidos**, preservando fonte original e separando dado de interpretação clínica.

M9B:
- registra fatos de saúde fornecidos;
- produz estados estruturais/longitudinais descritivos;
- não diagnostica;
- não substitui profissional;
- não altera treino, alimentação, medicação ou tratamento;
- não cria conduta automaticamente.

## Fonte especialista herdada

`05 — SAÚDE — EXAMES E BIOMARCADORES`

Princípios:
- preservar documento original quando disponível;
- preservar data, unidade, referência e flag original;
- dado clínico != interpretação != hipótese != diagnóstico profissional != conduta;
- fora da referência != diagnóstico;
- dentro da referência != garantia isolada de normalidade;
- comparação exige comparabilidade;
- não coletar por coletar;
- segurança clínica prevalece sobre otimização.

## Princípios M9B

- `unknown != zero`;
- fonte original é patrimônio do registro;
- valor original não é sobrescrito por normalização;
- unidade original é preservada;
- referência pertence àquela coleta/laboratório;
- normalização é derivada e auditável;
- flags estruturais não são diagnóstico;
- correções preservam histórico;
- extração != fato canônico.

## Tabelas v1

### health_clinical_documents

Metadados do documento original privado.

Tipos:
- `laboratory_report`;
- `medical_report`;
- `imaging_report`;
- `device_report`;
- `other_health_document`.

Preserva:
- atleta;
- nome/título original;
- provider/laboratório;
- data;
- `object_path`;
- mime type;
- hash/checksum quando aplicável;
- origem;
- status;
- observações;
- supersession/void.

Storage:
`health-private/<athlete_id>/clinical/<document_id>/...`

### health_clinical_document_extractions

Staging de extração.

Preserva:
- documento;
- status;
- engine/provider;
- versão;
- payload estruturado;
- confiança por campo quando disponível;
- erros/warnings;
- timestamps;
- usuário que confirmou/rejeitou.

Status:
- `pending`;
- `extracting`;
- `extracted`;
- `review_required`;
- `confirmed`;
- `rejected`;
- `failed`.

Extração confirmada pode gerar fatos canônicos via RPC transacional.
Extração não confirmada nunca vira histórico clínico canônico.

### health_lab_reports

Representa relatório/coleta/painel.

Preserva:
- atleta;
- documento/extraction de origem opcional;
- laboratório/provider;
- data/hora da coleta;
- data do resultado;
- jejum/contexto quando conhecidos;
- observações;
- fonte/confiança;
- `client_event_id`;
- status;
- supersession/void.

### health_biomarker_results

Resultado factual por marcador.

Preserva obrigatoriamente quando disponível:
- `original_analyte_name`;
- `original_result_text`;
- valor numérico estruturado opcional;
- `original_unit`;
- `original_reference_text`;
- limites estruturados opcionais;
- `original_flag`;
- método;
- observações;
- confiança.

Campos canônicos são adicionais, nunca substitutos.

### health_biomarker_catalog

Catálogo interno versionável:
- `canonical_code`;
- display name;
- categoria/painel;
- tipo de resultado;
- coding system externo opcional;
- external code opcional;
- coding version opcional;
- status.

LOINC pode ser usado quando houver mapeamento confiável.

### health_biomarker_aliases

Mapeia:
- alias normalizado;
- laboratório/provider opcional;
- `canonical_code`;
- confiança/revisão;
- versão do mapeamento.

O alias original continua no resultado factual.

Fuzzy match nunca confirma LOINC/canonical_code sozinho.

### health_biomarker_longitudinal_states

Estado descritivo por atleta + marcador.

Pode conter:
- último resultado;
- resultado anterior comparável;
- datas;
- número de observações;
- comparabilidade;
- direção matemática `higher/lower/stable/unknown`;
- referência atual;
- flag original atual;
- confiança;
- reason codes;
- `algorithm_version`.

Não declara diagnóstico, risco clínico ou conduta.

### health_vital_observations

Sinais fisiológicos fornecidos:
- pressão arterial;
- frequência cardíaca;
- temperatura;
- saturação;
- frequência respiratória;
- glicemia;
- outros com utilidade real.

Preserva instante, valor, unidade, condição, equipamento/origem e confiança.

## RPCs v1

- `health_m9_register_clinical_document`
- `health_m9_stage_clinical_extraction`
- `health_m9_confirm_clinical_extraction`
- `health_m9_reject_clinical_extraction`
- `health_m9_record_lab_report`
- `health_m9_void_lab_report`
- `health_m9_record_vital_observation`
- `health_m9_void_vital_observation`
- `health_m9_refresh_biomarker_state`

## Interoperabilidade

A modelagem segue compatibilidade conceitual com:
- relatório diagnóstico;
- observações atômicas;
- terminologia opcional;
- unidade original + unidade normalizada separada.

LOINC:
- identificador externo opcional;
- nunca substitui nome original;
- coding version preservada;
- sem auto-confirmação por fuzzy match.

UCUM:
- pode representar unidade normalizada quando conversão for explícita e válida;
- unidade original permanece preservada.

O CCH não se declara uma implementação FHIR completa na M9 v1.

## Comparabilidade

Antes de tendência:
- marcador semanticamente compatível;
- mesma unidade ou conversão versionada válida;
- método/provider/contexto divergente sinalizado;
- referência específica de cada coleta preservada.

Reason codes:
- `NO_BIOMARKER_DATA`;
- `SINGLE_OBSERVATION_ONLY`;
- `UNIT_NOT_COMPARABLE`;
- `METHOD_NOT_COMPARABLE`;
- `MIXED_LAB_CONTEXT`;
- `REFERENCE_RANGE_CHANGED`;
- `NON_NUMERIC_RESULT`;
- `SOURCE_DOCUMENT_MISSING`;
- `COMPARABLE_HISTORY_AVAILABLE`;
- `EXTRACTION_REVIEW_REQUIRED`.

Laboratórios são eventos irregulares: M9B não força 7/14/28 para exames.

## Extração documental v1

Fluxo obrigatório para documento:
1. upload privado;
2. registro do documento;
3. staging da extração;
4. extração;
5. revisão;
6. confirmação/rejeição;
7. somente confirmação gera fatos canônicos.

Entrada manual direta é permitida com fonte `manual/declared`.

Nenhuma interpretação médica é gerada pela extração.

## Flags estruturais

Pode preservar/exibir:
- flag original do laboratório;
- dentro/fora da referência quando explicitamente representável;
- diferença matemática do limite quando inequívoca.

Sempre rotuladas como estruturais, não diagnósticas.

## Segurança

- RLS deny-by-default;
- anon sem acesso;
- documentos em `health-private`;
- signed URLs;
- nenhuma URL pública;
- RPCs privilegiadas com `search_path` fixo;
- cross-athlete obrigatório;
- logs sem conteúdo clínico desnecessário;
- projeção externa mínima e autorizada.

## Correções

- supersession;
- void;
- original preservado;
- estado derivado recalculável.

## UI v1

Rota final:
`/saude/exames`

Mobile-first.

Blocos:
- documentos;
- exames/resultados;
- histórico longitudinal;
- sinais fisiológicos;
- fonte/unidade/referência;
- comparabilidade;
- flags estruturais;
- revisão de extração;
- nenhuma linguagem diagnóstica automática.

## Fora do escopo M9B v1

- diagnóstico automático;
- prescrição;
- alterar medicamento;
- solicitar exames automaticamente para preencher painel;
- risco clínico automatizado sem contrato posterior;
- causalidade automática;
- mudar treino/dieta;
- documento clínico público;
- reinterpretar silenciosamente conduta profissional.

## Critério de saída arquitetural

**ATENDIDO DOCUMENTALMENTE.**

Pode seguir para desenho técnico somente após conferência da PR #487 contra o Mapa Soberano.

Implementação, migrations e gates permanecem separados.
