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
