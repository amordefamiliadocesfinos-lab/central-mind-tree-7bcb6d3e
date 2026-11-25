# CCH F24 — G4 P5/P6 · Guia contextual e evolução programada · Especificação V0.1
**Data:** 23/11/2026 · **Autoridade:** deliberação Camada Mestre na PR #1022 e Issue #966.
**Estado:** SOMENTE ESPECIFICAÇÃO CONSULTIVA; sem implementação, integração, persistência, IA produtiva, novo motor ou alteração de atletas.
**Mapas preservados:** `CCH_MAPA_SOBERANO_E_METODO_DE_TRABALHO_v5_4_FROZEN.md` e `CCH_MAPA_EVOLUCAO_MOTOR_V1_0_FROZEN_2026-11-18.md`. F24 complementar aberta; F23 fechada; E5 real bloqueada.

## 1. Missão e encaixe com o patrimônio existente
A F24 não decide isoladamente o que é "ideal" para o praticante. Ela **apresenta opções fundamentadas, discretas e contextualizadas** enquanto o atleta executa e quando pede revisão periódica. M4 registra fatos; F19 mantém cronômetro e interação; F21 contém histórico; M2 fornece catálogo de exercícios/aparelhos; E2 prepara propostas por exercício e equivalências; E3 informa cobertura de estímulos e checkpoints sem semanas obrigatórias; F13 informa revisão, F14 registra decisão humana; M3/F22 são os únicos caminhos de edição/publicação controlada.

**Não construir:** motor de progressão paralelo, outra fila/calendário, tabela de conselhos persistidos, autoatualização do programa, autopublicação, intervenção clínica ou telemetria E5.

## 2. Contrato de entrada — somente dados autorizados
| Campo | Fonte e tratamento | Restrição |
|---|---|---|
| `athleteId`, sessão em curso e exercício | M4/F19 com isolamento por atleta | Nenhum vazamento ao trocar atleta, sessão ou aba |
| `goal` | Objetivo atual **escolhido pelo atleta**, não inferido de aparência/peso | `unsure` autoriza explicação de alternativas, não determinação do objetivo |
| `trainingLevel` | Perfil CCH beginner/intermediate/advanced | Qualidade baixa de dados **não rebaixa** praticante avançado |
| `programVersionId` + plano | M3 publicado e snapshot de prescrição | Bloquear conselho associado a versão divergente |
| `exerciseId`, `equipmentId`, rótulo confirmado | M2/M4 e proveniência V8 | Carga numérica comparável exige mesma máquina comprovada e unidade, nunca similaridade por nome |
| Histórico de trabalho | F21/M4 com filtros de atleta, status e origem, completude e limites | Não tratar dados faltantes como zero; observar truncamento e ausência de snapshot transacional |
| Comparabilidade e qualidade | E2/E3, inclusive `sourceTruncated`, proveniência, RIR/reps | Se faltar origem inequívoca, nenhuma progressão numérica individual |
| Recuperação/sintomas | Somente sinais já legitimamente disponíveis e autorizados | Nunca iniciar coleta E5; ausência = desconhecido; sinais adversos encaminham à revisão |
| Preferência de dicas | Apenas estado local de interface na etapa futura, até aprovação específica de persistência | Silenciar e descartar respeitados; sem armazenar novo dado por inferência |

## 3. Contrato de saída P5: até uma orientação por momento
Formato **conceitual**, sem criar API nova:
```text
Insight {
  id, kind: "technique" | "reference" | "option" | "review",
  exerciseId, goal, sourceVersionId,
  title: string, shortMessage: string,
  why: string, evidenceRefs: [citation+year+population+limits],
  provenance: {exercise, machine, unit, observedAt, completeness},
  confidence: "insufficient" | "conditional" | "reviewable",
  limitations: string[],
  alternatives: ["maintain", "review", "consider_draft"],
  canApplyAutomatically: false,
  requiresHumanReview: true,
  draftOnly: true
}
```
- **Prioridade de UX:** nenhuma dica durante série ativa; no descanso/estado pronto apenas se relevante, no máximo **uma por momento**, no máximo uma superfície compacta com botão “Por quê?”. Prescrição e cronômetro são superiores a qualquer card de IA.
- D4 ratificada: dicas curtas, ocasionais e **silenciáveis**; “Ignorar”, “Ver depois”, “Silenciar dicas”; após recusa não insistir no mesmo contexto. Sem piscar, notificação repetitiva, modal forçado ou som.
- Se ausência de dados, oferecer **explicação genérica, rotulada**, não simular referência pessoal: “O aparelho não foi confirmado; não há sugestão de carga comparável.”
- Diferenciar **referência factual** (“Última vez, mesmo aparelho, data”) de **opção** (“Considere...”) e **proposta de draft** (somente editor E2/M3 com diff). Nunca apresentar certeza sobre eficácia ou efeito individual.
- Ação “Aplicar como rascunho” **não executa update durante M4**; no futuro abre revisão do rascunho no caminho E2/M3 existente, com confirmação e publicação humana F22, após gate próprio.
- Antes de emissão: checar identidade/scope, dados completos, validade temporal, status de sessão e publicação; se qualquer checagem falhar, suprimir dicas numéricas. Se fontes E3 divergem, mostrar limitação e sugestão de revisar fontes.

## 4. Matriz de orientação por objetivo — hipóteses revisáveis, não regras duras
| Objetivo | Opções a apresentar | Comprovação e limite |
|---|---|---|
| **Força máxima** | Priorizar prática específica do padrão desejado; cargas relativas maiores e, quando adequado, menos reps; intervalos suficientes para preservar séries de qualidade | Progressão em **kg** somente mesma máquina, unidade, incremento real e evidências comparáveis; sem impor `%1RM` calculado ou descanso fixo |
| **Hipertrofia** | Ajustar volume e esforço de forma revisável; admitir ampla variedade de cargas/reps; manter execução controlada e recuperação | Não eleger exercício universal; volume observado não comprova hipertrofia, tolerância ou dose ótima; sem intensificar apenas por ausência de dor registrada |
| **Técnica/aprendizado** | Informação sobre posicionamento, trajetória, amplitude, controle e variações M2; mídia P3 se futuramente licenciada e autorizada | Não diagnosticar biomecânica por IA sem observação válida; não impor amplitude idêntica para todas as pessoas |
| **Manutenção/agenda reduzida** | Oferecer consolidação de estímulos e ordem flexível, conforme sessão/tempo disponível | Sem rebaixar experiência; sem obrigar número universal de treinos |
| **Recuperação incerta / sinais desfavoráveis** | Rever carga/volume/recuperação com profissional, manter ou adiar revisão de progressão | Evitar proposta de incremento; sintomas importantes exigem avaliação apropriada, não avaliação médica do CCH |
| **Objetivo indefinido** | Mostrar objetivos possíveis com vantagens, limitações e pedido de escolha do atleta | Sem selecionar objetivo automaticamente a partir de peso/fotos ou estereótipos corporais |

## 5. Sugestões dinâmicas de séries, reps, descanso e exercícios
A) **Repetições:** partir da faixa M3 atual; apresentar opções de manter, revisar dentro de faixa ou preparar nova faixa em draft. Dados comparáveis de esforço e execução são necessários para individualização. **Não criar novo `reps_min/reps_max` durante treino ativo**.
B) **Séries:** P1 permite séries extras como **decisão factual do atleta**, mas a IA não clica na opção por ele; número a mais não significa melhora fisiológica.
C) **Descanso:** mostrar descanso M3 prescrito e permitir pausa extra; sugestões de descanso mais longo em esforço alto podem ser informativas e condicionais, sem timer reiniciar sozinho. Diferenças de recuperação e exercício importam.
D) **Carga:** “última execução comparável” é referência, não recomendação. Sugestões quantitativas individualizadas só com mesma máquina comprovada, unidade, incremento real, origem M3/F21 auditável, desempenho e esforço comparáveis, sem sinais conflitantes. Caso contrário, **nenhum número novo**.
E) **Exercícios:** usar relações M2/`e2Alternatives.ts` somente como alternativas com ressalvas de equipamento, estímulo, amplitude, técnica e disponibilidade; equivalência de músculo não significa mesma dose ou carga. Ordem flexível preserva M3.
F) **Técnica:** texto curto e mídia P3 sob demanda (somente após portão próprio); explicar e não insistir. Sem gerar imagem/vídeo enganoso que demonstre um aparelho diferente.

## 6. P6 — checkpoint de evolução e periodização flexível
**Nenhuma agenda compulsória “segunda/terça”, nem “trocar toda quinzena”**. Usar o relatório E3 de continuidade por estímulo e sessões válidas efetivamente executadas. Acionar revisão apenas:
1. Quando atleta solicitar planejamento semanal/quinzenal/periodização;
2. Quando E3 identificar nova exposição comparável ou lacuna relevante de estímulos;
3. Ao mudar objetivo, disponibilidade ou equipamento;
4. Quando histórico descritivo sugerir estagnação/incerteza de recuperação, sem converter correlação em diagnóstico.

**Painel consultivo de planejamento**, sem mutação:
- Objetivo declarado, estágio real e disponibilidade do atleta;
- Grade de estímulos M3 publicada, sessões concluídas F21, lacunas e limites de leitura;
- Opções concorrentes: **manter / consolidar / rever recuperação / considerar progressão seletiva** quando E2/E3 justificarem;
- “Horizonte” informativo: próximas exposições ou microciclo opcional; semana e quinzena são modos de visualização, **não obrigação de duração**;
- Revisão de força, hipertrofia e técnica usa critérios do objetivo e referências científicas, mas só oferece **proposta de draft** com diff antes/depois, fonte, confiança, motivos e botão de revisar no M3;
- Plano **publicado não é reescrito**; somente revisão humana pode aprovar versão via gate F22.
- Se comparação do E3 não é integral/consistente, mostrar estado “evidência limitada”, não construir narrativa de ganho/perda causal.

## 7. Exemplos de mensagens para validação editorial (DADOS INTEIRAMENTE FICTÍCIOS)
1. **Força, evidência suficiente:** “Sua meta é força. Uma opção é priorizar séries pesadas com descanso suficiente. Por quê? A tarefa exige qualidade de esforço e técnica; revise com o planejamento.” **Sem valor numérico novo.**
2. **Máquina divergente:** “A carga anterior foi feita em outro aparelho. É uma referência histórica, não comparação direta; ajuste por percepção e técnica.” **Sem incremento.**
3. **Atleta advanced com registros escassos:** “Seu nível declarado segue avançado. Ainda faltam registros comparáveis para sugerir uma mudança específica.” **Nunca mudar o nível.**
4. **Fadiga/recuperação desconhecidas:** “Sem informação confiável de recuperação, mantenha opções abertas e revise antes de intensificar.” **Sem afirmar estado clínico.**
5. **Série extra 3/3:** “Você completou o planejado. Pode escolher Próximo exercício ou + Série extra.” **Ambas opções equivalentes; nenhuma selecionada pelo motor.**
6. **Revisão de quinzena solicitada:** “Há duas estratégias para revisar: manter estímulos atuais ou considerar ajuste pontual no rascunho; o histórico ainda não comprova qual produzirá mais resultados.” **Sem calendário fixo.**

## 8. Regras de priorização, qualidade, auditoria e revisão humana
| Gate lógico | Se falhar | Resultado seguro |
|---|---|---|
| Consentimento/autoridade da fonte e escopo do atleta | negar acesso | zero dica personalizada; sem leitura cruzada |
| Versão M3 vigente / F22 | divergente, draft sem autoridade | bloquear inferência e remeter a revisão |
| Dados F21/E3 completos, não truncados, sem proveniência contraditória | indeterminado | somente dica geral e limitações explícitas |
| Identidade do aparelho e incremento | desconhecida | zero incremento numérico; sem usar rótulo livre como identidade canônica |
| Recuperação, dor, sinais contraditórios | lacuna/alerta | nenhuma intensificação; caminho de revisão |
| Preferência de silenciar / sugestão recusada | silenciado | nenhuma interrupção |
| Série em execução F19 | ativa | nenhuma sugestão emergente na tela principal |
| E2 draft + revisão humana M3/F22 | não autorizada | nenhum write, publicação ou alteração de fila |

Registrar no **artefato consultivo de revisão existente**, quando houver aprovação futura: fontes e versão, código do motivo, limitações, qualidade, alternativas, ator que decidiu e momento; **não criar tabela nova de mensagens nem gravar sinais sensíveis em G4**.

## 9. Fontes e disciplina científica (consulta em 23/11/2026)
- **ACSM 2026, Position Stand:** Currier e col., *Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews*, `PMID 41843416`, https://pubmed.ncbi.nlm.nih.gov/41843416/ . Visão agregada de revisões, não prescrição individual única.
- **Currier e col. 2023, revisão sistemática e network meta-analysis:** `PMID 37414459`, https://pubmed.ncbi.nlm.nih.gov/37414459/ . Cargas mais altas frequentemente favorecem ranking de força; diversas configurações favorecem hipertrofia, sem converter ranking em prescrição individual automática.
- **Revisão/meta-regressão de volume e frequência 2026:** `PMID 41343037`, https://pubmed.ncbi.nlm.nih.gov/41343037/ . Relação dose-resposta populacional; não estabelece dose ótima individual pela simples contagem de séries.
- **Treinados 2026, revisão sobre variáveis e hipertrofia:** https://www.sciencedirect.com/science/article/pii/S1360859226002561 . Avaliar desfechos e heterogeneidade; extrapolação limitada por população e desenho dos estudos.
- **Falha/RIR:** https://pubmed.ncbi.nlm.nih.gov/38970765/ ; **descanso:** https://pmc.ncbi.nlm.nih.gov/articles/PMC11349676/ . Requerem avaliação contextual e limites dos dados.
**Hierarquia:** posição institucional e revisões atualizadas, revisões com qualidade metodológica, ensaios, opiniões de especialistas/hipóteses. Sempre distinguir `evidência de população` de `inferência para esta pessoa`. Não chamar **melhor exercício absoluto** nem afirmar resultado causal com log de treino.

## 10. Teste de aceitação futuro (ainda NÃO executado) e portões
| ID | Cenário de contraprova | Esperado |
|---|---|---|
| P5-AC01 | Série em execução com dica disponível | nenhuma interrupção |
| P5-AC02 | Descanso com sugestão pertinente | uma dica curta, sem ação automática |
| P5-AC03 | Dica recusada/silenciada | sem repetição no mesmo contexto |
| P5-AC04 | Atleta advanced e confiança limited | advanced preservado, sem numérico |
| P5-AC05 | Máquina diferente/desconhecida | sem incremento, somente referência rotulada |
| P5-AC06 | Histórico RLS/truncado/incompatível | fail-closed e limitação, sem dado inventado |
| P5-AC07 | Dor/sinais desfavoráveis | revisão, sem progressão automática |
| P5-AC08 | Série extra opcional | atleta escolhe sem autoalterar M3 |
| P6-AC01 | Ciclo de 3 vs 5 sessões/semana real e imprevistos | sequência flexível, sem castigo por agenda |
| P6-AC02 | Revisão semanal/quinzenal solicitada | modo consultivo, sem agenda fixa |
| P6-AC03 | Diferença M3 planejado × F21 realizado | descrição de lacunas, sem alegação causal |
| P6-AC04 | Opção “considerar alteração” | draft E2 com diff e publicação manual F22 |
| P6-AC05 | Objetivo indefinido ou versão divergente | opções/limitação, sem proposta numérica |
| G4-AC01 | Todos os cenários | zero writes, zero persistência nova, zero E5 real |

**Fase atual G4:** somente documento, matriz de decisão e exemplos sintéticos. **Portão posterior indispensável:** contrato técnico de integração, segurança da leitura e estado local das preferências, revisão por especialista da ciência/UX, CI e autorização de implementação; merge/deploy técnico e G5 exigem decisão própria da Camada Mestre. A aprovação F24 de escopo **não autoriza** IA conectada a dados de atleta nem início de coleta E5.

## 11. Continuidade
P0/P1 engenharia na PR #1025, P2/P4 na #1027, P3 somente contrato/protótipo na #1028, documento base F24 V0.2 na PR #1022: **nenhuma dessas PRs é integrada por este documento**. Histórico Issue #966 aberto. Não alterar mapas FROZEN nem usar construtor visual Lovable.


## 12. Refinamento U05/P5 — contrato de experiência e decisão V0.2 (24/11/2026)
Autoridade: Mapa Soberano Unificado V6.0 FROZEN, PR #1040 integrada. G4 permanece exclusivamente especificação; não autoriza código de IA, execução de motor novo ou conexão com atletas. G1/G2 já integradas; U01/U02/U04 têm checkpoints próprios na #966. Contraprovas ficam nas últimas sequências possíveis, sem remover portões.

### 12.1 Sequência determinística de avaliação conceitual (não executável)
| Ordem | Condição | Resposta esperada |
|---|---|---|
| 1 | Escopo de atleta/sessão/versão inválido, fonte não autorizada ou identidade indeterminada | Suprimir orientação contextual; não mostrar dado do contexto anterior. |
| 2 | Treino ativo em série, pausa de sessão, erro, estado desconhecido ou transição ainda pendente | Não interromper; aguardar estado pronto/descanso confirmado. |
| 3 | Silenciado, mesma dica recusada ou já exibida no mesmo momento | Não emitir novamente. |
| 4 | Sinal adverso autorizado ou contraditório | Se atleta solicitar revisão ou momento adequado, apresentar opção de revisão, sem intensificação; não substituir avaliação profissional. |
| 5 | Proveniência incompleta, histórico truncado ou máquina não comprovada | Apenas explicação geral rotulada; não sugerir números novos. |
| 6 | Objetivo não escolhido | Oferecer opções somente sob demanda, sem definir objetivo. |
| 7 | Contexto elegível, fonte válida e objetivo explícito | Escolher no máximo uma orientação relevante do patrimônio E2/E3/F21, priorizando clareza e necessidade; sem modificar M3/M4. |
| 8 | Nenhuma orientação acrescenta valor | Nenhum card; silêncio é resultado válido. |

Prioridade de apresentação: segurança/revisão > esclarecer limitação material > referência factual útil > alternativa por objetivo > técnica geral. Nenhum ranking implica melhor exercício universal ou resultado individual. Controles essenciais F19 e escolhas D2 têm prioridade visual; dica nunca substitui a decisão de série extra.

### 12.2 Estados e escolhas humanas — wireflow documental
Estado inicial: sem card. Estado pronto/descanso elegível: card compacto opcional, título, uma frase curta e ação "Por quê?". Expandir revela origem, data quando disponível, qualidade, limitações e alternativas. "Ignorar" descarta a dica do contexto atual; "Ver depois" fecha e mantém apenas possibilidade de consulta voluntária no mesmo contexto; "Silenciar dicas" impede novas ofertas enquanto a preferência local estiver ativa. Não reabrir automaticamente após recusa. Retomar dicas exige ação humana. Não gravar preferências nem sinais sensíveis nesta fase. A troca de atleta/sessão/versão/exercício invalida conteúdo, referências e ações pendentes; silenciamento não pode ser automaticamente desfeito por troca de exercício. Nenhum estado local de recusa é evidência clínica. Cooldown futuro é controle de UX, não regra fisiológica; duração ainda não definida.

### 12.3 Catálogo editorial inicial — cenários inteiramente fictícios
| ID | Momento / objetivo | Texto curto candidato | Por quê / limite |
|---|---|---|---|
| U05-C01 | Descanso / força | Descanse o suficiente para preservar a qualidade da próxima série. | Referência geral ACSM e revisão de descanso da seção 9; não alterar timer, nem fixar segundos. |
| U05-C02 | Pronto / hipertrofia, dados limitados | Mantenha a faixa planejada como referência; ajustes podem ser revisados depois. | Não deduzir dose ótima por quantidade de séries; sem novo RIR, reps ou kg. |
| U05-C03 | Descanso / equipamento divergente | A carga anterior não é diretamente comparável neste aparelho. | F21/V8; rótulo não prova identidade física. |
| U05-C04 | Pronto / avançado, histórico escasso | Seu nível permanece avançado. Faltam dados comparáveis para uma proposta individual. | Separar experiência de confiança F22. |
| U05-C05 | Descanso / recuperação incerta | Antes de intensificar, considere revisar como está se recuperando. | Não inferir fadiga nem coletar E5. |
| U05-C06 | Pronto / técnica, mídia ausente | Consulte a orientação geral do movimento; a ausência de vídeo não impede o treino. | M2/P3, sem diagnóstico biomecânico ou instrução específica não revisada. |
| U05-C07 | Meta de séries atingida | Sem dica automática: manter duas escolhas equivalentes do F19. | Evitar duplicação ou indução à série extra. |
| U05-C08 | Objetivo indefinido, pedido explícito | Você pode revisar alternativas de força, hipertrofia ou manutenção antes de escolher. | Não inferir objetivo de peso/fotos. |
| U05-C09 | Dados de outro atleta ou versão | Nenhum texto contextual. | Falha fechada; não revelar dado cruzado. |

### 12.4 Critérios adicionais para contraprova futura
- U05-AC09: resposta tardia de contexto A após seleção B não aparece nem habilita ação; troca de versão invalida proposta.
- U05-AC10: recusar, adiar e silenciar são distintos; não insistir nem reativar dicas em troca de exercício.
- U05-AC11: nenhuma sugestão útil resulta em ausência de card, sem placeholder de IA.
- U05-AC12: referência factual não vira prescrição; qualquer consideração de alteração remete à revisão E2/M3 existente, sem write durante M4.
- U05-AC13: foco, timer, campos e ações D2 continuam operáveis sem card; contraste, teclado e leitores de tela avaliados quando houver implementação autorizada.
- U05-AC14: corpus editorial exige revisão de ciência, aplicabilidade, linguagem e origem antes de publicação; referências herdadas da seção 9 não foram reavaliadas nesta revisão documental.

### 12.5 Handoff para U06/P6
Usar E3 existente e U02 para continuidade: revisão por objetivo/estímulo/exposição válida, comparação planejado-realizado com lacunas, escolha de horizonte informativo, opções alternativas e draft E2 revisável. Não criar novo calendário, motor ou coleta. Próximo refinamento independente: especificar sequência de revisão flexível e critérios para manter/consolidar/rever/considerar ajuste, preservando portão G4. Nenhum dos cenários acima foi executado como teste ou homologado; a decisão de adiar contraprovas não autoriza ativação.


## 13. U06/P6 — contrato de periodização individualizada V0.3 (24/11/2026)
Autoridade: V6.0 FROZEN, U06/P6/G4. E3 consultiva existente em `src/modules/health/cch/periodizationFlexibleE3.ts`; reutilizar `assessFlexiblePeriodizationE3`, `E3Result`, leitura E3 e editor E2/M3/F22. Este adendo é exclusivamente especificação, sem código executável, novos dados, calendário, motor ou fila.

### 13.1 Jornada de revisão
1. Atleta solicita revisão ou ocorre checkpoint E3 contextual. Não encerrar ciclo, criar sessão ou alterar objetivo por passagem de dias.
2. Identificar atleta, programa, versão publicada, origem da auditoria e, se existir, versão proposta. Separar plano vigente de rascunho. Se origem divergir ou leitura falhar, mostrar estado indeterminado e oferecer recarga; nenhuma proposta específica.
3. Exibir sequência de estímulos previstos, observados, ainda não identificados e não previstos, usando `coverage.stimulusSequence`. Exibir sessões válidas e comparáveis separadamente. A razão de cobertura mede códigos distintos, não cumprimento de frequência semanal nem séries realizadas. Dados ausentes não são zero; não chamar estímulo não identificado de treino perdido.
4. Atleta confirma objetivo atual e disponibilidade percebida. Semana, quinzena ou próximas exposições são horizontes opcionais de visualização; sem número compulsório de sessões. Não gerar datas fictícias nem transformar indisponibilidade em débito de treino.
5. Mostrar opções E3 com motivo, origem e limitações; oferecer revisão humana, não prescrição em execução. O objetivo escolhido orienta a interpretação sem rebaixar experiência por confiança baixa.
6. Se o atleta desejar alteração, encaminhar ao fluxo existente U02/E2/M3, com criação explícita de rascunho pelos contratos autorizados, diff, revisão e publicação manual F22. Sem proposta existente, E3 atual não declara elegibilidade para progressão; não usar ausência de draft como permissão para criar um automaticamente. Mostrar “revisar possibilidades” como caminho informativo, não como autorização de intensificação.
7. Retomar plano vigente enquanto não houver publicação válida; preservar históricos, sessões ativas, prioridades e recuperação. Registrar decisão somente pelo mecanismo existente quando autorizado.

### 13.2 Tradução fiel do contrato E3 atual
| Campo/estado real | Apresentação proposta | Limite |
|---|---|---|
| review_recovery | Revisar recuperação e desempenho antes de intensificar | Ausência de informação também pode produzir esse estado; não afirmar fadiga/dor presente |
| review_evidence | Evidências ainda insuficientes para revisão específica | Mostrar motivos e lacunas, sem reduzir nível ou prescrição automaticamente |
| eligible_for_manual_review | Alternativa disponível para revisão humana | Não significa progressão recomendada, publicação ou eficácia comprovada |
| readiness insufficient/conditional | Insuficiente/condicional | Nunca traduzir como diagnóstico ou aptidão física |
| completedSessions/comparableSessions | Sessões observadas válidas/comparáveis | Contagem da versão de origem, não meta universal |
| observedWorkingSets | Séries observadas quando íntegro | null = não consolidável; não usar 0 como substituto |
| observedSpanDays/actualDaysWithSessions | Janela observada/dias com sessão | Não converter em frequência prescrita ou obrigação |
| checkpoint.type/criteria | Rever agora ou na próxima exposição comparável/mudança contextual | calendarDeadline e mandatorySessionCount permanecem null |
| alternatives | Consolidar, rever recuperação, considerar progressão seletiva quando elegível | automaticChange=false; draftOnly=true; generatesQueue=false |

A interface deve preservar status original, explicações de E3 e limites de leitura. Não adicionar algoritmo de periodização concorrente. Não confundir rótulo confirmado com identidade física de aparelho.

### 13.3 Opções por objetivo e revisão
| Objetivo ou contexto | Pergunta útil ao atleta | Alternativas consultivas |
|---|---|---|
| Força | Qual padrão ou desempenho deseja desenvolver? | Manter especificidade, consolidar técnica/esforço, considerar ajuste seletivo via E2 se elegível |
| Hipertrofia | Quais estímulos e grupos deseja desenvolver? | Manter distribuição, revisar cobertura/volume observado, considerar ajuste de prioridade em draft |
| Manutenção | Quais estímulos deseja preservar na disponibilidade atual? | Consolidar e revisar continuidade sem reduzir automaticamente a dose |
| Técnica | Qual movimento merece atenção? | Revisar execução e alternativas M2, sem diagnosticar ou alterar carga |
| Recuperação | Há contexto autorizado que justifique revisão? | Rever sinais, adiar intensificação, manter alternativas abertas; não coletar E5 |
| Objetivo indefinido | Qual objetivo deseja escolher? | Explicação de opções; não inferir por peso/aparência |

Esses rótulos são editoriais, não novos valores do enum Goal, nem novas estratégias persistidas. Mapear aos objetivos existentes somente após integração autorizada; técnica/recuperação podem ser contexto de revisão, não obrigatoriamente novo goal. Nenhum novo kg, RIR, faixa de reps ou volume é calculado por este contrato.

### 13.4 Cenários fictícios para aceite final
| ID | Cenário | Esperado |
|---|---|---|
| U06-C01 | Mesma sequência A1/B1/C1/D1/E1, atleta realiza três estímulos em uma janela e cinco em outra | Exibir observações por versão; não penalizar três dias, não inferir dose ótima |
| U06-C02 | Pausa de disponibilidade entre B1 e C1 | Preservar continuidade; não criar reposição compulsória ou reset |
| U06-C03 | A1 executado duas vezes e B1 uma | Contar três sessões distintas e dois códigos observados; não confundir cobertura com frequência |
| U06-C04 | Sessões de versão anterior, anuladas ou ativas | Não inflar cobertura da versão avaliada |
| U06-C05 | Histórico truncado ou data inválida ou identidade conflitante | Limitação explícita, nenhuma elegibilidade específica baseada em fonte incompleta |
| U06-C06 | Atleta avançado com baixa confiança | Nível preservado; alternativas gerais de consolidação/revisão |
| U06-C07 | Recuperação desconhecida ou sinais desfavoráveis | Revisar contexto sem afirmar doença/fadiga ou aumentar automaticamente |
| U06-C08 | Mudança de objetivo ou disponibilidade | Novo checkpoint consultivo, sem alterar programa publicado |
| U06-C09 | Atleta deseja considerar ajuste, origem alinhada e draft existente | Encaminhar E2/M3 com diff; publicação somente F22 humana |
| U06-C10 | Atleta solicita planejamento quinzenal sem dados suficientes | Horizonte informativo, lacunas explícitas, sem calendário rígido nem proposta numérica |
| U06-C11 | Troca de atleta/versão durante leitura | Suprimir snapshot antigo, invalidar decisão pendente |
| U06-C12 | Atleta opta por manter programa | Nenhuma mutação, nova fila ou publicação |

### 13.5 Aceite de produto e passagem U07
Na contraprova final, verificar se o atleta entende o que realizou, o que ainda não está identificado, por que existem alternativas e como retomar/decidir sem perder contexto. Reutilizar P6-AC01–05 e G4-AC01; cenários U06-C01–12 são extensão documental, não resultados executados. Exigir comparação com E3 real, não fabricar evidência. Referências científicas permanecem as da seção 9, não reavaliadas nesta etapa. U07/E5 seguinte: recuperar contratos #994/#995/#996/#998/#999 e lacunas de consentimento, proveniência e recuperação; apenas preparação autorizada, sem consentimento inferido, novos registros reais ou ativação. Não avançar U08 produtivamente sem reconciliar mapas adjacentes. Nenhuma alteração do V6.0 FROZEN.


## 14. Continuidade U05/U06 — fronteira de integração V0.4 (24/11/2026)
A autorização de merge sem aguardar comprovação do proprietário não amplia G4. Este refinamento prepara a futura integração de experiência, sem implementar ou ativar IA, ler dados reais, criar persistência ou alterar F19/M3/M4. Reutilizar E2/E3/F21/F22.

### 14.1 Contrato de passagem contextual (conceitual)
| Estado da interface | Comportamento permitido | Transição |
|---|---|---|
| sem atleta, escopo desconhecido, loading/erro | nenhuma dica e nenhuma ação contextual | nova leitura válida |
| sessão/versão/exercício trocado | invalidar dica e ação antiga, descartar resposta tardia | identificar novo contexto |
| série ativa, pausa ou resultado ainda não consolidado | nenhuma interrupção | descanso/pronto confirmado |
| descanso/pronto, escolha D2 pendente | priorizar escolha do atleta; nenhuma dica que induza extras | decisão explícita do atleta |
| descanso/pronto elegível, sem dica relevante | não reservar espaço visual | reavaliar somente em novo contexto |
| dica elegível | uma frase, Por quê?, ignorar/adiar/silenciar | escolha humana |
| adiada | acesso voluntário enquanto contexto for válido | consulta explícita ou invalidação |
| silenciada | nenhuma nova oferta | reativação explícita; não por exercício ou reload automático |
| consideração de alteração | direcionar revisão E2/M3 existente, sem gravação no treino | confirmação separada e F22 |

Identidade conceitual da oferta: atleta + sessão + versão publicada + exercício + momento inequívoco + código editorial. Não usar horário isolado, índice da lista, texto do exercício ou rótulo de aparelho como identidade. A permissão de mostrar uma dica é diferente da permissão de consultar fonte, criar draft ou publicar. Preferência de silêncio local nesta fase; não prometer persistência entre dispositivos/reloads. Estado deve ser separado de evidência de saúde e não virar telemetria E5.

### 14.2 Passagem U05 → U06, sem motor paralelo
Quando uma orientação indicar revisão de objetivo, recuperação ou estratégia, oferecer navegação voluntária à revisão já existente. Não transportar proposta quantitativa de contexto expirado. Revalidar atleta, versão, auditoria, objetivo e permissões ao entrar no planejamento. E3 continua autoridade consultiva para cobertura, checkpoints e alternativas; E2 para prescrição por exercício; M3/F22 para revisão/publicação. Sem nova fila, calendário obrigatório, cálculo de dose ou ação automática.
- Exemplo fictício: histórico de aparelho diferente → aviso contextual curto → atleta decide revisar → E3 mostra limitações de cobertura → E2 somente se evidência aplicável → revisão humana. Se atleta ignorar, seguir treino normalmente.
- Exemplo fictício: recuperação não documentada → não afirmar fadiga → opção de revisar contexto sob demanda → não intensificar automaticamente.
- Exemplo fictício: objetivo alterado durante leitura → invalidar antiga sugestão e não habilitar revisão com contexto obsoleto.

### 14.3 Critérios de prontidão da futura integração
Separar três aceites: (A) contrato editorial e estados; (B) engenharia autorizada com isolamento e fontes reais permitidas; (C) homologação de uso real. A integração documental não comprova B ou C. Antes de B, exigir decisão expressa sobre montagem F19, comportamento local de preferências, escopo de fontes, revisão científica/editorial e acessibilidade. Não introduzir código produtivo por interpretação de autorização de merge. Contraprovas posteriores incluem troca de atleta/versão, retorno assíncrono fora de ordem, pausa, D2, silêncio, navegação e retorno, contexto obsoleto, falha de fonte e ausência de escrita automática. Não repetir testes já aprovados sem delta. V6.0 FROZEN preservado.
