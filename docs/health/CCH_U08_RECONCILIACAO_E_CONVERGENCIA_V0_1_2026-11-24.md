# CCH U08 — Reconciliação estratégica e inventário de convergência V0.1
Data: 24/11/2026 (Brasil). Autoridade: [Mapa Soberano V6.0 FROZEN](CCH_MAPA_SOBERANO_UNIFICADO_V6_0_FROZEN_2026-11-24.md), Issue #966. Documento complementar de inventário, não mapa concorrente, não autorização de implementação. Sem dados pessoais, consultas ao banco, migrations, grants, Storage, alteração de atleta ou deploy.
## 1. Fontes originais recuperadas
Arquitetura ARQUITETURA_SISTEMA_SAUDE_DESENVOLVIMENTO_INDIVIDUAL_v1(1).txt (11/09/2026, Library file_0000000053c4820ebc0f4472af16a347), e documentos de especialidades 01 Markdown.md (file_000000005efc820e9b903dc57a2cdc84), 02 Markdown(1).md (file_000000007338820e95136c857d1439ce), 03 Markdown(2).md (file_00000000e0dc820ea48031b7c6c1f17e), 04 Markdown(3).md (file_00000000ba38820e921bbe01e21b1136), 05 Markdown(4).md (file_00000000423c820eab20a614de0e8d76), 06 Markdown(5).md (file_0000000046c8820e8642e52c53d05e25), 07 Markdown(6).md (file_000000007b54820e8c4abff95ad0fbcb). Referências ao acervo do proprietário; não copiar registros pessoais presentes nos originais. Reconciliação baseada nos trechos de missão e conexões recuperados, não auditoria integral das versões posteriores de cada especialista. Central 00 supervisiona; 01–05 registram fatos; 06 coordena decisões; 07 sustenta evidência. Baseline progressivo, sem bloquear registros por lacunas. Conexão intermodular significa hipótese para análise, não causa comprovada.
## 2. Inventário estático verificável na main
Fontes: `src/modules/health/HealthModule.tsx` (blob 053c5fea513583ad9e813c267529e99933db49cc), `src/integrations/supabase/types.ts` (7b80a409fc7c9ec4917e445d079dd30be8ebba29), `src/App.tsx` (bb76760c6ceecd6867f9aa0a2e5fd4b6eb73f737). Prefixo de rota /saude. Guard HealthAccessGuard existente; não confundir presença de guard com homologação RLS.
| Domínio | Rotas/páginas existentes | Contratos existentes | Limite da evidência |
|---|---|---|---|
| 00 Central | hoje / HealthDashboardPage | F10 dashboard, F11 decisão integrada, F12 jornada | visão de cinco domínios, não motor clínico |
| Perfil | perfil / HealthProfilePage | M1, health_athletes, health_athlete_profiles, health_goals, health_consents | não equiparar consentimento genérico a E5 |
| 01 Treino | treino, treino/atividades, treino/historico, treino/programa | M2/M3/M4, F19/F20/F21/F22, E2/E3 | manter U01/U02/U03; não duplicar histórico |
| 02 Alimentação | alimentacao / HealthNutritionPage | M5 diário/receitas, M6 estados, M7 decisão, health_nutrition_plans e versões/metas | estimativa não é medida; não presumir adoção de carb cycling |
| 03 Físico | evolucao / HealthBodyPage | M8, M1, health_body_measurements, assessments, photo_sets, photos, rolling_states | fotos privadas, comparação com protocolo e consentimento; não diagnosticar por aparência |
| 04 Recuperação | recuperacao / HealthRecoveryPage | M9, health_sleep_periods, sleep_device_observations, recovery_checkins, sleep_recovery_rolling_states | não inferir revisão E5 de ordinal ou proximidade temporal |
| 05 Saúde | exames / HealthExamsPage | M9, health_lab_reports, biomarker_results/catalog, clinical_documents/extractions, vital_observations | preservar unidade, fonte, referência; avaliação profissional quando pertinente |
| 06 Planejamento | revisao, replanejamento, relatorios, rotina, analytics | F13 revisão, F14 decisão, F16 lembretes, F17 analytics | não criar fluxo paralelo; ver limites F11/F13/F14 abaixo |
| 07 Ciência | biblioteca / HealthLibraryPage | useHealthCatalogs M2 | biblioteca existente é catálogo de exercício, não repositório científico comprovado; acervo 07 existe documentalmente |
## 3. Convergência existente e lacunas
F10 (`useHealthDashboardF10.ts`, blob 7bcbd6b148c8126192f78ef784f38a70af4b8712) lê estados de treino, nutrição, físico, recuperação e exames por atleta, incluindo disponibilidade, data, cobertura, confiança e motivos. F11 (`useHealthIntegratedDecisionF11.ts`, d7008edf69bb0d4a79bca328f6535e38cc220e45) consulta health_integrated_decision_runs/decisions e RPC health_f11_evaluate_integrated_decision; escopos atuais nutrition_execution e nutrition_plan_review, com contexto corporal/recuperação e alinhamento de data/janela. Não declarar decisão integrada universal. Tipos loose não confirmam implantação backend; hook trata indisponibilidade. F13 (`useHealthLongitudinalReviewF13.ts`,  fonte lida na main nesta auditoria) compara janelas e registra resultado explícito, 28 dias na chamada atual. F14 (`useHealthReplanningF14.ts`, bd9522887059d8a771b609995686a0118eec95db) usa caso vinculado a revisão e itens goal/training/nutrition/body/recovery, decisões manter/revisar/adiar/não aplicável, sem automatizar clínica. Exames e ciência não são domínios de item F14 observados. Não ampliar enums nem RPCs nesta entrega.
## 4. Contrato estratégico de convergência (proposta documental)
Reutilizar perfil M1 e fontes especialistas; levar à Central somente resumo autorizado com identificador de origem, atleta, janela/data, unidade, método, cobertura, confiança, status, limitações e versão do cálculo. Preservar dado medido, declarado, estimado, calculado, visual e interpretação como categorias distintas. Ausência não é zero. Sem copiar fotos, laudos ou sintomas em novos snapshots sem autorização e minimização. F10 estado atual → F11 quando escopo aplicável → F13 revisão longitudinal → F14 decisão humana → módulo especialista (M3/E2/F22 ou M7 conforme contratos vigentes) → nova observação. Nenhum gatilho automático de intervenção; saúde tem prioridade sobre desempenho. Ciência 07 documenta referência, população, ano, qualidade, aplicabilidade e limitações; não inventar biblioteca científica a partir de M2.
## 5. Dependências e próximos atos
A) Reconciliar apenas divergências verificadas com responsáveis 02–07; recuperar versões vigentes e evidências específicas por área antes de propor novos escopos.
B) Contraprova futura de rotas e contratos F10/F11/F13/F14, usando identidades sintéticas e autorização própria: troca de atleta, erro/fonte ausente, divergência temporal, snapshot antigo, decisão humana, nenhuma mutação automática. Diferenciar consulta de RPC que grava decisão/revisão. Sem acionar tais RPCs nesta auditoria estática.
C) Ciência, fotos, exames e eventual ponte mental: apenas proposta; exigir regras próprias de acesso, consentimento, revisão, retenção e aprovação. Não abrir F23/E5 real ou P3/P5/P6 produtivos.
D) Contraprovas CCH U01–U07 continuam registradas na #966, adiadas até últimas sequências possíveis, sem dispensar gates. Próximo ato sugerido: consolidar backlog de homologação e reconciliar heads/diffs antes de qualquer integração autorizada; não iniciar outro módulo sem despacho.
## 6. Estado
Inventário de rotas e contratos principais confirmado no código; não exaustivo de migrations, políticas, testes, versões de mapas adjacentes ou execução real. Nenhuma evidência de publicação remota ou eficácia individual produzida. U08 permanece estratégica. V6.0 FROZEN intacto.


## 7. Continuidade U08 — contrato de passagem entre especialidades V0.2
Autoridade: V6.0 FROZEN. Refinamento exclusivamente documental da convergência existente. Não cria API, tabela, fila, motor, telemetria, consentimento ou nova autorização. Não confundir proposta abaixo com campos efetivamente persistidos.

### 7.1 Passagem de responsabilidade e evidência
| Origem | Entrega consultiva mínima | Destino e limite |
|---|---|---|
| 01 Treino M3/M4/F21/E3 | versão de origem, exposições válidas, cobertura e comparabilidade, limitações | F10/F13/F14; revisão de prescrição exclusivamente E2/M3/F22 |
| 02 Alimentação M5/M6/M7 | janela, cobertura alimentar, método de estimativa, estado nutricional e decisão vigente | F10/F11/F13/F14; revisão de plano no especialista, não no treino |
| 03 Físico M8 | tendência, protocolo de medida, cobertura e incerteza | F10/F11/F13/F14; não encaminhar bytes de fotos, inferir percentual de gordura ou diagnosticar |
| 04 Recuperação M9 | observações declaradas/medidas, janela e cobertura | F10/F11/F13/F14; não converter ordinal em revisão E5 por sessão |
| 05 Exames M9 | disponibilidade, fonte, unidade, referência e necessidade de avaliação apropriada | F10 e especialista de saúde; não introduzir domínio clínico em F14 |
| 07 Ciência | referência, população, desfecho, qualidade, aplicabilidade, limites | suporte à interpretação humana; catálogo M2 não substitui acervo científico |
| 00/06 Central e planejamento | revisão, decisão humana, origem e pendências | devolver decisão ao especialista responsável; não duplicar registro ou autopublicar |

### 7.2 Regras de junção consultiva
- Mesmo atleta e escopo autorizado em cada fonte. Fonte ausente, erro, desatualização ou divergência de janela devem permanecer distintos; nenhuma substituição por zero, dado anterior sem rótulo ou observação de outro atleta.
- F10 é visão atual, não diagnóstico. F11 continua limitado ao escopo nutricional observado. F13 é revisão longitudinal conforme contrato existente. F14 mantém domínios goal/training/nutrition/body/recovery. Não ampliar por analogia.
- Não exigir que todos os domínios estejam completos para registrar treino ou alimentação. Bloquear apenas a conclusão específica dependente da fonte ausente, mantendo ações independentes válidas.
- Conexão entre tendências de peso, desempenho, alimentação e sono é motivo para investigação, não causalidade. Manter hipóteses, fatos e decisões humanas separados. Não usar exame ou imagem para decidir medicamento, diagnóstico ou prescrição automática.
- Reavaliar origem, versão e atualidade antes de decisão. Nenhuma passagem documental autoriza leitura de dados reais adicionais, chamada RPC de escrita ou uso de E5.

### 7.3 Casos de continuidade a homologar posteriormente
| ID | Caso sintético | Resultado esperado |
|---|---|---|
| U08-C01 | Nutrição indisponível e treino disponível | preservar registro de treino; não concluir adequação energética |
| U08-C02 | Peso e treino em janelas divergentes | mostrar fontes separadas; não afirmar relação temporal |
| U08-C03 | Troca de atleta durante leitura | descartar contexto anterior, impedir decisão cruzada |
| U08-C04 | Revisão nutricional elegível no F11 | encaminhar especialista existente, sem alteração automática |
| U08-C05 | Exame potencialmente relevante | encaminhar avaliação apropriada, sem item clínico novo F14 |
| U08-C06 | Recuperação ordinal disponível sem vínculo explícito | contexto M9 permitido conforme contrato, E5 continua bloqueada |
| U08-C07 | Atleta decide manter plano | preservar versão, histórico e decisão humana |
| U08-C08 | Fonte científica não revisada | indicar lacuna, não apresentar hipótese como evidência validada |

Casos preparados documentalmente, não executados. A U08 mantém caráter estratégico; implementação adicional exige autoridade das especialidades e decisão explícita. Sem alterar V6.0. Homologações gerais seguem postergadas por determinação do proprietário.
