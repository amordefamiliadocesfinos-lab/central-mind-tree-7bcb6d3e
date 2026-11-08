# F12 — JORNADA REAL COMPLETA — ARQUITETURA v1

**Data:** 08/11/2026  
**Status:** ARQUITETURA DOCUMENTAL — IMPLEMENTAÇÃO NÃO INICIADA  
**Mapa soberano:** CCH_MAPA_SOBERANO_E_METODO_DE_TRABALHO_v3_3_FROZEN.md  
**Base:** main@fb06a696cdac8cae391c27a044139660cfb8cb24

---

## 1. Missão

A F12 transforma os módulos já existentes em uma jornada operacional coerente e verificável:

perfil → planejamento → execução → observação longitudinal → decisão especialista → decisão integrada explicável.

A F12 não cria um novo domínio de saúde.

Ela coordena:
- M1 perfil/objetivo;
- M3 planejamento;
- M4 execução real;
- M6/M7 alimentação/decisão nutricional;
- M8 evolução corporal;
- M9A sono/recuperação;
- F11 decisão integrada.

M9B exames/biomarcadores permanece contexto opcional e não bloqueador da jornada v1.

---

## 2. Princípio central

**Jornada != score.**

A F12 v1 não cria:
- percentual de saúde;
- percentual de evolução física;
- score geral;
- readiness global;
- diagnóstico;
- recomendação clínica;
- nova prescrição;
- alteração automática de dieta;
- alteração automática de treino.

O que a F12 pode dizer é:
- qual evidência operacional já existe;
- qual etapa ainda não possui a evidência mínima definida;
- qual rota existente permite registrar essa evidência;
- qual decisão F11 foi materializada;
- por que uma decisão está pausada.

---

## 3. Superfície

A F12 v1 evolui:

`/saude/hoje`

Não criar rota paralela `/saude/jornada`.

Motivo:
- F10 já definiu `/saude/hoje` como ponto integrado;
- F12 adiciona orientação de jornada ao mesmo ponto;
- evita duas superfícies concorrentes de integração.

A navegação Health existente permanece.

---

## 4. Persistência

Preferência arquitetural v1:

**nenhuma tabela F12 própria.**

A jornada é uma projeção calculada em leitura a partir das fontes canônicas.

Não criar:
- `health_journey_*`;
- snapshot duplicado;
- ledger F12;
- tabela de progresso;
- tabela de score.

A persistência continua pertencendo aos módulos especialistas e à F11.

---

## 5. Estágios core v1

### J1 — Perfil e objetivo

Fontes:
- `health_athlete_profiles`;
- `health_goals`;
- `health_goal_phases`.

Evidência mínima de conclusão operacional:
- perfil existente;
- uma meta primária ativa.

Fase ativa enriquece a etapa, mas sua ausência não deve inventar estado.

CTA:
`/saude/perfil`

### J2 — Planejamento de treino

Fontes:
- `health_programs`;
- `health_program_versions`;
- `health_cch_queue_entries`.

Evidência mínima:
- programa ativo;
- current_version publicada;
- ao menos uma entrada de fila utilizável.

CTA:
`/saude/treino/programa`

### J3 — Execução real

Fonte:
- `health_workout_sessions`.

Estados factuais relevantes:
- sessão aberta/in_progress;
- sessão completed;
- última sessão concluída.

A primeira sessão completed prova execução real da jornada.

Uma sessão em andamento é `in_progress`, não `complete`.

CTA:
`/saude/treino`

### J4 — Alimentação observada

Fontes:
- `health_nutrition_rolling_states`;
- `health_nutrition_decisions`.

Janela operacional F12 v1:
7 dias.

Evidência:
- rolling state atual na data;
- decisão M7 current na mesma data/janela.

Uma decisão M7 pausada continua sendo resultado válido e deve ser exibida como pausada, não como falha técnica.

CTA:
`/saude/alimentacao`

### J5 — Evolução corporal observada

Fonte:
- `health_body_rolling_states`.

Evidência mínima:
- estado 7d atual;
- cobertura `partial|complete`;
- ao menos uma observação corporal real.

Estado materializado com cobertura `unobserved|sparse` não prova observação suficiente da etapa.

CTA:
`/saude/evolucao`

### J6 — Recuperação observada

Fonte:
- `health_sleep_recovery_rolling_states`.

Evidência mínima:
- estado 7d atual;
- ao menos uma dimensão entre recovery/fatigue/readiness com cobertura `partial|complete` e agregado não nulo.

Não criar score composto.

CTA:
`/saude/recuperacao`

### J7 — Decisão integrada explicável

Fontes:
- `health_integrated_decision_runs`;
- `health_integrated_decisions`.

Evidência:
- run current F11 na data/janela;
- decisões filhas carregáveis;
- reason codes visíveis.

Run `paused` pode concluir a etapa de avaliação, desde que a causa esteja explícita.

CTA primário:
se não houver run atual, ação explícita de avaliação F11.

CTA de revisão:
permanece na própria `/saude/hoje`.

---

## 6. M9B — exames

Exames aparecem como contexto separado.

Não fazem parte dos requisitos J1→J7.

A F12 pode mostrar:
- “contexto clínico disponível”;
- “sem contexto clínico registrado”.

Não pode:
- bloquear jornada;
- classificar risco;
- usar flag laboratorial para escolher próximo passo;
- alterar decisão integrada v1.

Rota:
`/saude/exames`.

---

## 7. Estado de etapa

Cada etapa deve expor dois eixos separados.

### evidence_state

- present
- absent
- unknown
- error

### journey_state

- complete
- actionable
- in_progress
- waiting_data
- evaluated_paused
- blocked
- error
- optional

`unknown` nunca é convertido em zero.

`error` técnico nunca é convertido em ausência factual.

---

## 8. Próximo passo operacional

A F12 pode produzir **um próximo passo operacional**.

Isso não é recomendação de saúde.

É apenas navegação baseada na primeira lacuna da sequência de onboarding/jornada.

Prioridade v1:

1. completar perfil/meta;
2. publicar programa;
3. executar treino;
4. registrar/observar alimentação;
5. registrar evolução corporal;
6. registrar recuperação;
7. executar avaliação F11 explícita;
8. revisar decisão integrada.

A prioridade não significa que um domínio seja clinicamente mais importante que outro.

Usuário continua livre para entrar em qualquer rota.

---

## 9. Ação explícita F11

F12 pode introduzir um botão:

**Avaliar integração**

Esse botão chama explicitamente:
`health_f11_evaluate_integrated_decision`.

Regras:
- nunca chamar no mount;
- nunca chamar no `Atualizar` do Dashboard;
- nunca chamar em background;
- nunca chamar ao navegar;
- ação precisa ser perceptível ao usuário;
- após sucesso, recarregar somente a projeção F11/F12;
- resultado pode ser `paused`.

Essa RPC escreve apenas no ledger F11, conforme arquitetura F11.

---

## 10. Data atual vs histórico

F12 preserva a diferença:

- estado atual;
- evidência histórica.

Histórico pode provar que uma atividade já ocorreu (ex.: treino completed alguma vez).

Histórico não pode substituir silenciosamente:
- estado nutricional atual;
- Body atual;
- Recovery atual;
- decisão F11 atual.

Nenhum stale threshold arbitrário é introduzido na F12 v1.

---

## 11. Falha parcial

Falha de um domínio não derruba toda a jornada.

Cada etapa:
- carrega independentemente;
- expõe erro próprio;
- não converte erro em “pendente”.

O próximo passo não deve ser calculado através de uma etapa com erro técnico que torne a precedência ambígua.

Nesse caso:
- next_action = null;
- mensagem operacional = “Não foi possível determinar o próximo passo agora.”

---

## 12. Homologação real

Fixture prova algoritmo.

Não prova jornada real.

F12 só será homologada ponta a ponta quando houver evidência real/autenticada de:
- perfil;
- planejamento;
- execução;
- estados longitudinais;
- avaliação F11;
- UI integrada.

A exceção v3.3 permite desenvolver antes disso, não antecipar o status de homologação.

---

## 13. Relação com F13

F13 continua bloqueada.

F12 não cria:
- replanejamento automático;
- aprendizado adaptativo;
- otimização longitudinal automática.

Esses temas pertencem a F13 e exigem contrato próprio.
