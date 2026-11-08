# F11 — MOTOR INTEGRADO CCH — ARQUITETURA v1

**Data:** 08/11/2026  
**Status:** ARQUITETURA DOCUMENTAL — IMPLEMENTAÇÃO NÃO INICIADA  
**Mapa soberano:** CCH_MAPA_SOBERANO_E_METODO_DE_TRABALHO_v3_1_FROZEN.md  
**Base:** main@91014d563f84c2321ca8ded73f617be68fc41ce6

---

## 1. Missão

A F11 introduz um motor determinístico de coordenação entre estados especialistas já homologados.

O Motor Integrado CCH existe para responder:

- há dados suficientes para uma decisão integrada?
- qual decisão especialista deve ter prioridade?
- existe contexto corporal e de recuperação suficiente para tornar uma revisão de plano elegível?
- qual evidência sustentou a decisão?
- por que uma decisão foi pausada?
- qual algoritmo e conjunto de parâmetros produziram o resultado?

A F11 **não executa ações**.

Ela produz decisões auditáveis que podem:
- permanecer pausadas;
- solicitar revisão humana;
- registrar ausência de ação integrada.

---

## 2. Princípio central

**Integração não significa somar tudo.**

A F11 v1 não cria:
- score geral de saúde;
- score composto de prontidão;
- score clínico;
- média entre domínios;
- diagnóstico;
- prescrição;
- alteração automática de treino;
- alteração automática de dieta;
- alteração automática de medicamentos.

Cada decisão possui seu próprio contrato de suficiência.

---

## 3. Relação entre as camadas

Fluxo soberano:

fatos → estados especialistas → decisões especialistas → decisão integrada → ação humana/futura

Exemplos:

- M5 = fatos nutricionais;
- M6 = estado nutricional;
- M7 = decisão nutricional especialista;
- M8 = estado corporal;
- M9A = estado de sono/recuperação;
- F11 = coordenação entre esses resultados;
- ação = fora da F11 v1.

F10 é somente read-model/UI e nunca é fonte de verdade da F11.

---

## 4. Escopo decisório v1

A v1 ativa somente duas capacidades:

### C1 — Revisão de execução nutricional

Fonte decisória:
M7.

A F11 pode promover uma decisão M7 de execução para revisão integrada, preservando:
- decision code original;
- reason codes;
- confidence;
- algorithm version M7;
- evidence snapshot original.

Não recalcula aderência nutricional.

### C2 — Elegibilidade para revisão de plano nutricional

Capacidade realmente integrada.

Requer simultaneamente:
- decisão M7 atual e pronta;
- ausência de problema de execução prioritário;
- resposta corporal M8 observável;
- contexto de recuperação M9A suficiente.

Resultado possível:
**review_nutrition_plan_candidate**

Isso significa:
“há dados suficientes para uma revisão humana do plano”.

Não significa:
- aumentar calorias;
- reduzir calorias;
- mudar macros;
- trocar treino;
- afirmar que o plano está errado.

---

## 5. Capacidades explicitamente desabilitadas na v1

### Treino

M3/M4 podem fornecer contexto operacional, mas não existe ainda um estado longitudinal de performance/recuperação de treino com contrato suficiente para permitir ajuste integrado automático.

Portanto:
- F11 não muda sessão;
- F11 não muda fila;
- F11 não recomenda carga;
- F11 não reduz volume;
- F11 não troca exercício.

### Exames/Biomarcadores

M9B é **excluído das regras decisórias da F11 v1**.

Biomarcadores:
- não geram decisão integrada;
- não geram risco;
- não geram diagnóstico;
- não bloqueiam plano automaticamente;
- não alteram dieta/treino.

Dados clínicos continuam no domínio M9B e sob revisão humana.

---

## 6. Contrato de execução

Entrada mínima:

- athlete_id;
- as_of_date;
- window_days: 7, 14 ou 28.

Saída:
- um evaluation run;
- zero ou mais decisões filhas por escopo habilitado.

A avaliação deve ser determinística para:
- mesmo conjunto de entradas;
- mesma algorithm_version;
- mesmo parameter_set.

---

## 7. Status do run

Valores:

- complete: motor conseguiu avaliar todas as capacidades habilitadas;
- partial: uma capacidade foi avaliada e outra ficou pausada por dados;
- paused: nenhuma capacidade habilitada pôde ser avaliada;
- failed: erro técnico; não é decisão.

Erro técnico nunca é convertido em DECISION_PAUSED.

---

## 8. Status de decisão

Valores:

- ready;
- paused.

Representação conceitual de DECISION_PAUSED:
- decision_status = paused;
- decision_code = decision_paused ou review_data_quality;
- reason_codes obrigatórios.

Nunca usar null como substituto de decisão pausada quando a avaliação foi executada.

---

## 9. Prioridade decisória v1

Ordem soberana:

1. integridade/autorização;
2. suficiência;
3. decisão especialista M7 de execução;
4. elegibilidade de revisão de plano;
5. nenhuma ação integrada.

Regra:
**problema de execução vem antes de revisão de plano.**

Se M7 indicar baixa execução:
- F11 não promove revisão do plano;
- primeiro registra review_nutrition_execution.

Isso evita alterar estratégia quando o problema pode ser aderência/execução.

---

## 10. No integrated action

Se:
- M7 está ready;
- não há decisão de execução;
- dados M8/M9A ainda não satisfazem revisão de plano;

o motor pode registrar a capacidade de revisão de plano como paused.

Não deve inventar “maintain plan”.

Ausência de elegibilidade para mudança != evidência de que o plano deve ser mantido.

---

## 11. Time windows

A F11 usa janelas:
- 7;
- 14;
- 28 dias.

A decisão integrada deve referenciar estados da mesma janela quando a fonte possuir janela equivalente.

Fallback entre janelas não é automático.

Exemplo:
uma avaliação de 14 dias não pode usar silenciosamente estado corporal de 7 dias.

---

## 12. Staleness

A v1 exige:
- as_of_date da decisão M7 = as_of_date da avaliação;
- as_of_date M8 = as_of_date da avaliação;
- as_of_date M9A = as_of_date da avaliação.

Se o estado da data não existir:
- não usar histórico silenciosamente;
- registrar reason code de ausência/staleness;
- pausar a capacidade dependente.

F10 pode mostrar histórico; F11 não o trata automaticamente como estado atual.

---

## 13. Explicabilidade

Toda decisão F11 deve guardar:

- source IDs;
- source algorithm versions;
- source confidence;
- source coverage;
- source reason codes;
- input timestamps;
- parameter_set;
- input fingerprint;
- algorithm_version F11;
- decision code;
- target domain;
- reason codes F11.

A explicação deve poder ser reconstruída sem consultar memória de chat.

---

## 14. IA

IA não participa da decisão determinística F11 v1.

Pode futuramente:
- traduzir reason codes;
- explicar uma decisão já produzida;
- resumir evidência.

IA não pode:
- escolher decision_code;
- sobrescrever status;
- completar dado ausente;
- criar diagnóstico;
- disparar ação.

---

## 15. Relação com F12

F12 só pode abrir após F11:
- arquitetura aprovada;
- implementação;
- TESTES MT;
- Gate A;
- Gate B quando aplicável;
- Gate C;
- homologação real.

A autorização especial que abriu F11 documentalmente não se propaga a F12.

---

## 16. Resultado arquitetural

A F11 v1 é um **motor de coordenação e elegibilidade**, não um motor autônomo de prescrição.

Primeiro objetivo:
tomar decisões integradas com menos autoridade do que os dados permitem — nunca mais.
