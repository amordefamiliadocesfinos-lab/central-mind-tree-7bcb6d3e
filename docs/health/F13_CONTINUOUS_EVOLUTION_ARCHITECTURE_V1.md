# F13 — EVOLUÇÃO CONTÍNUA POR DADOS REAIS — ARQUITETURA v1

**Data:** 08/11/2026  
**Status:** ARQUITETURA DOCUMENTAL — IMPLEMENTAÇÃO NÃO INICIADA  
**Mapa soberano:** CCH_MAPA_SOBERANO_E_METODO_DE_TRABALHO_v3_4_FROZEN.md  
**Base:** main@b9a1609d6044e6e4e3ec84ffef7cf24fccd23ad4

---

## 1. Missão

A F13 introduz a camada longitudinal do CCH.

Ela existe para:
- comparar períodos reais;
- mostrar tendências por domínio sem criar score global;
- tornar revisão humana elegível;
- registrar o resultado de revisões;
- preservar histórico de replanejamento;
- permitir aprendizado operacional futuro a partir de decisões humanas reais.

A F13 v1 não executa replanejamento automático.

---

## 2. Separação obrigatória

A F13 possui duas camadas.

### Camada A — comparação longitudinal

Determinística e descritiva.

Responde:
- quais períodos são comparáveis;
- quais domínios possuem dados suficientes;
- quais diferenças observáveis existem;
- quais domínios não podem ser comparados.

### Camada B — resultado de revisão humana

Registra:
- qual revisão foi feita;
- quais domínios devem ser revistos;
- se não haverá mudança por enquanto;
- notas humanas;
- quem registrou;
- qual snapshot sustentou a revisão.

Camada A nunca escolhe automaticamente o resultado da Camada B.

---

## 3. Superfície

Nova rota:

`/saude/revisao`

Nome na navegação:
**Revisão**

Motivo:
- F10/F12 já concentram `/saude/hoje`;
- F13 exige espaço longitudinal próprio;
- comparação de períodos e histórico de revisões não devem sobrecarregar o Dashboard.

`/saude/hoje` pode receber um CTA para `/saude/revisao`, sem duplicar a análise.

---

## 4. Períodos v1

Janela padrão:
**28 dias**.

Período atual:
- start = as_of_date - 27 dias;
- end = as_of_date.

Período anterior:
- start = as_of_date - 55 dias;
- end = as_of_date - 28 dias.

Não existe fallback silencioso.

Para fontes rolling:
- current deve existir exatamente em `as_of_date`;
- prior deve existir exatamente em `as_of_date - 28`.

Se uma fonte não existir na data exata:
- domain comparison = unavailable;
- reason code explícito.

---

## 5. Domínios longitudinais v1

### L1 — Meta e fase

Fontes:
- health_goals;
- health_goal_phases.

Contexto:
- meta primária ativa;
- fase ativa;
- datas;
- status;
- target_date.

Não calcula “progresso da meta” sem métrica-alvo formal.

### L2 — Treino

Fonte factual:
- health_workout_sessions;
- health_workout_sets.

Comparáveis por período:
- sessões concluídas;
- sets concluídos;
- exposição de exercícios distintos.

Não usar:
- soma de carga entre exercícios;
- “volume total” misturando unidades;
- progressão de força global;
- equivalência entre máquinas/exercícios.

Comparações de performance por exercício ficam fora da v1.

### L3 — Alimentação

Fonte:
- health_nutrition_rolling_states 28d.

Comparáveis:
- observed_day_count;
- sufficient_day_count;
- observation_coverage_ratio;
- sufficient_coverage_ratio;
- avg_energy_kcal;
- avg_protein_g;
- avg_carbohydrate_g;
- avg_fat_g;
- avg_fiber_g;
- energy_target_adherence_ratio quando presente;
- protein_target_adherence_ratio quando presente.

Comparação é descritiva.

Não dizer “melhor/pior” apenas por aumento/redução.

### L4 — Evolução corporal

Fonte:
- health_body_rolling_states 28d.

Comparáveis:
- peso latest;
- mudança de peso no período;
- tendência semanal;
- cintura latest;
- mudança de cintura;
- gordura corporal latest/change quando observada;
- cobertura/confiança.

Não inferir composição corporal além da fonte.

### L5 — Sono/recuperação

Fonte:
- health_sleep_recovery_rolling_states 28d.

Comparáveis:
- sono médio;
- variabilidade de duração;
- qualidade média;
- recuperação média;
- fadiga média;
- readiness média;
- coberturas/confiança.

Não produzir readiness global próprio.

### L6 — Decisão integrada

Fonte:
- health_integrated_decision_runs;
- health_integrated_decisions.

Uso:
contexto de decisão, não motor de comparação causal.

Pode mostrar:
- última decisão integrada do período;
- paused/ready;
- reason codes;
- target domain.

Não usar F11 para “provar” que uma tendência causou outra.

---

## 6. Exames/biomarcadores

M9B permanece fora da comparação longitudinal automática v1.

Razões:
- periodicidade irregular;
- comparabilidade semântica/unidade/método específica por marcador;
- risco de transformar diferença laboratorial em interpretação clínica automática.

F13 pode mostrar:
“há contexto clínico disponível”.

Não usa valores clínicos para replanejamento automático.

---

## 7. Comparabilidade

Cada domínio retorna:

- available;
- unavailable;
- error.

Se available:
- current period source;
- prior period source;
- métricas;
- diferenças;
- confidence da fonte;
- datas explícitas.

Não existe score de comparabilidade.

---

## 8. Direção de diferença

Para métricas numéricas semanticamente comparáveis:

- higher;
- lower;
- stable;
- unavailable.

Stable usa tolerância apenas quando definida no contrato da métrica.

Na v1:
preferência por diferença numérica explícita em vez de classificar “stable” arbitrariamente.

Nenhuma direção implica valor clínico.

---

## 9. Review readiness

A F13 não cria um score global de suficiência.

Uma revisão longitudinal pode ser criada mesmo se apenas parte dos domínios estiver comparável.

Run status:
- available: ao menos um domínio comparável;
- paused: nenhum domínio comparável;
- failed: erro técnico transacional.

Domínios ausentes ficam explícitos.

---

## 10. Resultado humano

Depois de um run longitudinal, o usuário autorizado pode registrar um outcome.

Outcome codes v1:
- continue_observation;
- review_goal;
- review_training;
- review_nutrition;
- review_recovery;
- review_multiple;
- insufficient_data.

Target domains:
- goal;
- training;
- nutrition;
- body;
- recovery.

`body` pode ser alvo de revisão descritiva, mas a v1 não cria editor de plano corporal.

---

## 11. Significado de outcome

`review_training` significa:
“revisar o planejamento de treino”.

Não significa:
“trocar treino”.

`review_nutrition` significa:
“revisar o planejamento nutricional”.

Não significa:
“alterar calorias/macros”.

`review_goal` significa:
“revisar objetivo/fase”.

Não altera a meta automaticamente.

---

## 12. Replanejamento

Mudanças reais continuam nos módulos especialistas:

- meta/fase → M1;
- programa de treino → M3;
- alimentação/plano → módulo nutricional correspondente;
- recuperação → registro/revisão humana, não prescrição automática.

F13 apenas registra que uma revisão foi indicada/decidida por humano.

---

## 13. Aprendizado operacional

A v1 armazena evidência para permitir aprendizado futuro:

- snapshot longitudinal;
- outcome humano;
- target domains;
- notas;
- data;
- autor;
- versão do algoritmo.

Ela não aprende pesos/regras automaticamente.

Qualquer aprendizado automatizado futuro exige nova arquitetura/versionamento.

---

## 14. IA

IA pode futuramente:
- resumir diferenças;
- explicar métricas;
- organizar notas.

IA não pode:
- escolher outcome;
- alterar target domains;
- produzir causalidade;
- mudar treino/dieta/meta;
- preencher dados ausentes.

---

## 15. F14

Não existe F14 no Mapa vigente.

A F13 é a última frente macro aprovada.

Qualquer nova frente macro exige nova versão soberana do Mapa.
