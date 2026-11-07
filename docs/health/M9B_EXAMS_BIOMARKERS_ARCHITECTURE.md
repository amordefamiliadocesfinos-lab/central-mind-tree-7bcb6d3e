# M9B — EXAMS & BIOMARKERS ARCHITECTURE

## Status

**ARQUITETURA DOCUMENTAL — NÃO IMPLEMENTADA**

Este documento abre formalmente a frente M9B após o encerramento da M8.

Nenhuma tabela, RPC, migration, arquivo clínico, deploy ou dado real é criado por este documento.

## Missão

Criar a camada longitudinal de **exames, biomarcadores e sinais fisiológicos fornecidos**, preservando a fonte original e separando dado de interpretação clínica.

Fronteira oficial:

- M9B registra e organiza fatos de saúde fornecidos;
- M9B pode produzir estados estruturais/longitudinais descritivos;
- M9B não produz diagnóstico;
- M9B não substitui profissional de saúde;
- M9B não altera treino, alimentação, medicação ou tratamento automaticamente;
- decisões integradas pertencem a contratos posteriores.

## Fonte especialista herdada

Fonte funcional especializada:
- `05 — SAÚDE — EXAMES E BIOMARCADORES`

Princípios preservados:
- documento original deve ser preservado quando disponível;
- data, unidade, referência e sinalização original não podem ser removidas;
- dado clínico != interpretação != hipótese != diagnóstico profissional != conduta profissional;
- resultado fora da referência != diagnóstico;
- resultado dentro da referência != garantia isolada de ausência de problema;
- comparação longitudinal exige contexto e comparabilidade;
- não coletar exame apenas para preencher painel;
- segurança clínica prevalece sobre otimização.

## Princípios M9B

- `unknown != zero`;
- fonte original é patrimônio do registro;
- valor original nunca é silenciosamente normalizado ou substituído;
- unidade original é obrigatória quando existente;
- intervalo de referência pertence ao exame/laboratório daquela coleta;
- conversão de unidade, quando existir futuramente, deve gerar valor derivado separado;
- comparabilidade não é assumida quando unidade, método, laboratório ou contexto divergem;
- flags estruturais não são diagnóstico;
- fatos clínicos não viram ação automática;
- correções preservam histórico.

## Contrato factual proposto

### 1. health_clinical_documents

Metadados de documentos originais enviados ao domínio Saúde.

Tipos possíveis:
- laboratory_report;
- medical_report;
- imaging_report;
- device_report;
- other_health_document.

Metadados:
- atleta;
- tipo;
- título/nome original;
- data do documento;
- provider/laboratório quando conhecido;
- `object_path`;
- mime type;
- hash/checksum quando aplicável;
- origem;
- status;
- observações;
- vínculo de supersession/void.

Binários devem permanecer privados.

Caminho conceitual:
`health-private/<athlete_id>/clinical/<document_id>/...`

Acesso somente por autorização do atleta e URLs assinadas quando necessário.

### 2. health_lab_reports

Representa um exame/coleta/painel laboratorial.

Preserva:
- atleta;
- documento de origem opcional;
- laboratório/provider;
- data/hora de coleta;
- data do resultado;
- condição de jejum quando conhecida;
- contexto de coleta quando conhecido;
- observações;
- fonte;
- confiança;
- status;
- `client_event_id`;
- supersession/void.

### 3. health_biomarker_results

Resultado factual por marcador.

Preserva:
- `lab_report_id`;
- nome original do marcador;
- código canônico opcional;
- resultado original textual;
- valor numérico estruturado somente quando seguro;
- unidade original;
- intervalo de referência original textual;
- limites estruturados opcionais quando inequívocos;
- flag original do laboratório;
- método quando informado;
- observações;
- status;
- confiança.

Regra central:
o registro original deve permitir reconstruir o que estava no documento sem depender de interpretação posterior.

### 4. health_vital_observations

Observações fisiológicas que não exigem um painel laboratorial.

Exemplos:
- pressão arterial;
- frequência cardíaca;
- temperatura;
- saturação;
- frequência respiratória;
- glicemia quando fornecida;
- outros sinais com utilidade real.

Cada observação preserva:
- instante;
- valor(es);
- unidade;
- condição;
- equipamento/origem;
- confiança;
- observações.

Não comparar indiscriminadamente medições feitas em condições incompatíveis.

## Normalização e catálogo

M9B deve aceitar o **nome original** como fonte primária.

Um catálogo canônico de biomarcadores poderá mapear aliases para um `canonical_code`, mas:
- o alias original permanece preservado;
- o mapeamento é versionado;
- nenhum resultado é descartado por falta de mapeamento;
- unidade original permanece registrada;
- conversão futura exige regra explícita e auditável.

## Estado longitudinal proposto

Laboratórios são eventos irregulares. Portanto, M9B **não força 7/14/28 como estado primário de exames laboratoriais**.

### health_biomarker_longitudinal_states

Estado descritivo por atleta + marcador canônico/original.

Pode incluir:
- resultado mais recente;
- resultado anterior comparável;
- data mais recente;
- unidade original/normalizada quando aplicável;
- quantidade de observações;
- comparabilidade;
- direção estrutural `higher/lower/stable/unknown` somente quando matematicamente válida;
- referência do laboratório do resultado atual;
- flag original atual;
- cobertura histórica;
- confiança;
- reason codes;
- algorithm_version.

Este estado não declara:
- doença;
- risco clínico;
- necessidade terapêutica;
- causa;
- conduta.

### Sinais fisiológicos repetidos

Para sinais como pressão/frequência cardíaca, estados rolling podem ser considerados futuramente quando houver densidade de dados suficiente. Não são obrigatórios para a primeira implementação de M9B.

## Comparabilidade

Antes de calcular tendência entre resultados:
- marcador deve ser semanticamente compatível;
- unidade deve ser a mesma ou convertível por regra versionada;
- método/laboratório/contexto divergente deve ser sinalizado;
- comparação não deve apagar o intervalo de referência específico de cada coleta.

Reason codes possíveis:
- `NO_BIOMARKER_DATA`;
- `SINGLE_OBSERVATION_ONLY`;
- `UNIT_NOT_COMPARABLE`;
- `METHOD_NOT_COMPARABLE`;
- `MIXED_LAB_CONTEXT`;
- `REFERENCE_RANGE_CHANGED`;
- `NON_NUMERIC_RESULT`;
- `SOURCE_DOCUMENT_MISSING`;
- `COMPARABLE_HISTORY_AVAILABLE`.

## Flags estruturais

M9B pode preservar/mostrar:
- sinalização original do laboratório;
- fora/dentro da referência quando isso estiver explicitamente disponível no documento;
- diferença matemática em relação ao limite de referência quando estruturalmente inequívoca.

Essas flags devem ser rotuladas como **estruturais**, não diagnósticas.

## Documentos e extração

Fluxo futuro:

1. receber documento privado;
2. preservar binário original;
3. extrair dados;
4. apresentar/registrar dados estruturados;
5. manter vínculo com a fonte;
6. separar extração de interpretação.

Se houver incerteza de leitura:
- não inventar;
- registrar necessidade de revisão;
- não corrigir silenciosamente número aparentemente estranho.

## Conexões intermódulo

Achados podem ser encaminhados para análise em:
- 00 — Central;
- 01 — Treino;
- 02 — Alimentação;
- 03/M8 — Físico/Body;
- 04/M9A — Sono/Recuperação;
- 06 — Planejamento Integrado;
- 07 — Base Científica.

Conexão significa **merece análise conjunta**, não causalidade.

## Segurança e privacidade

Na futura implementação:
- RLS deny-by-default;
- anon sem acesso;
- leitura/escrita por autorização do atleta;
- documentos no `health-private`;
- signed URLs;
- nenhuma URL pública de documento clínico;
- RPCs privilegiadas com `search_path` fixo;
- cross-athlete obrigatório;
- logs não devem expor conteúdo clínico desnecessário;
- módulos externos recebem somente projeções mínimas explicitamente autorizadas.

## Correções

Padrão:
- supersession para correção factual;
- void para invalidação;
- documento original preservado;
- valor antigo não é apagado silenciosamente;
- estados derivados são recalculáveis.

## UI futura

Rota sugerida:
- `/saude/saude` ou rota equivalente definida antes da implementação.

Mobile-first.

Blocos esperados:
- documentos/exames;
- painel de resultados;
- histórico longitudinal;
- sinais fisiológicos;
- fonte/unidade/referência visíveis;
- flags estruturais claramente separadas de interpretação;
- estado de comparabilidade;
- nenhuma linguagem diagnóstica automática.

A rota final deve ser escolhida antes da implementação para evitar conflito semântico ou duplicação no shell.

## Fora do escopo M9B v1

- diagnóstico automático;
- prescrição;
- interrupção/alteração de medicamento;
- solicitação automática de exames para “completar painel”;
- classificação de risco clínico automatizada sem contrato específico posterior;
- explicação causal automática de desempenho, sono ou composição corporal;
- mudança automática de treino/dieta;
- transformação de documento clínico em dado público;
- reinterpretação silenciosa de conduta profissional.

## Critério de saída arquitetural

M9B só pode avançar para implementação após:
- arquitetura versionada aprovada;
- modelo de documentos/exames/resultados revisado;
- estratégia de catálogo/aliases revisada;
- regras de comparabilidade e reason codes revisadas;
- política de Storage privado/RLS revisada;
- critérios de aceitação M9 aprovados;
- rota final decidida;
- branch baseada na `main` vigente e sem divergência não reconciliada.
