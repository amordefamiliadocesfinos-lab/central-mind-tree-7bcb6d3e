# F12 — ACCEPTANCE CRITERIA v1

**Status:** DOCUMENTAL

---

## 1. Critérios arquiteturais

### F12-AC-01 — Sem nova fonte de verdade
PASS se não houver tabela/ledger F12 próprio na v1.

### F12-AC-02 — Mesma superfície integrada
PASS se a jornada evoluir `/saude/hoje` e não criar rota concorrente.

### F12-AC-03 — Fontes soberanas preservadas
PASS se J1→J7 consumirem somente M1/M3/M4/M6/M7/M8/M9A/F11.

### F12-AC-04 — M9B opcional
PASS se exames não bloquearem a jornada v1.

### F12-AC-05 — Sem score
PASS se não existir percentual/nota/semáforo geral de saúde.

### F12-AC-06 — unknown != zero
PASS se ausência e erro permanecerem distintos.

### F12-AC-07 — erro técnico != ausência factual
PASS se query/RPC indisponível gerar erro técnico próprio.

### F12-AC-08 — histórico explícito
PASS se evidência histórica nunca for promovida silenciosamente a estado atual.

### F12-AC-09 — próximo passo operacional
PASS se next action for navegação/processo, não recomendação de saúde.

### F12-AC-10 — F11 explícito
PASS se `health_f11_evaluate_integrated_decision` só executar por ação explícita.

### F12-AC-11 — Atualizar read-only
PASS se o botão Atualizar não executar RPC mutável.

### F12-AC-12 — DECISION_PAUSED válido
PASS se F11 paused for exibido como resultado explicável.

### F12-AC-13 — sem ação automática
PASS se F12 não alterar dieta, treino, fila, plano ou dado clínico.

---

## 2. Critérios de modelo

### J1
- perfil + meta primária ativa → complete;
- atleta sem perfil/meta → actionable;
- query error → error.

### J2
- programa ativo + versão publicada + fila → complete;
- sem programa → actionable;
- programa draft → in_progress/actionable, não complete.

### J3
- sessão completed existe → complete;
- sessão aberta → in_progress;
- fila existe sem sessão → actionable;
- sem fila → blocked por J2, não “descanso”.

### J4
- rolling 7d atual + M7 current → complete/evaluated;
- M7 paused continua resultado válido;
- rolling histórico não satisfaz estado atual.

### J5
- body state 7d atual partial|complete + observação >0 → complete;
- state unobserved/sparse → waiting_data.

### J6
- recovery state atual + dimensão partial|complete e agregado → complete;
- sem dimensão suficiente → waiting_data.

### J7
- run F11 current + decisões → complete/evaluated;
- run paused → evaluated_paused;
- backend F11 ausente → blocked/backend_unavailable;
- run histórico apenas → actionable para nova avaliação, com histórico explícito.

---

## 3. Casos de next action

### N1
Perfil/meta faltando:
`complete_profile`.

### N2
Perfil completo, sem programa:
`publish_program`.

### N3
Programa pronto, sem execução:
`execute_workout`.

### N4
Execução existe, nutrição atual ausente:
`record_nutrition`.

### N5
Nutrição atual existe, Body insuficiente:
`record_body`.

### N6
Body suficiente, Recovery insuficiente:
`record_recovery`.

### N7
Fontes prontas, F11 sem run atual:
`evaluate_integration`.

### N8
F11 current:
`review_integrated_decision`.

### N9
Erro técnico em etapa necessária:
next_action=null.

---

## 4. Testes futuros obrigatórios

Pure model:
- cada estágio;
- precedência;
- erro isolado;
- histórico;
- paused;
- backend F11 indisponível;
- exames não bloqueadores.

Frontend:
- reload SELECT-only;
- evaluate action explícita;
- double-click protegido;
- reason-code routing;
- mobile 320–430;
- sem overflow;
- acessibilidade básica.

Regressões:
- F10;
- F11;
- M9.

---

## 5. Banco

F12 v1 proposta:
**Gate B não aplicável**, pois não há DDL próprio.

Isso não elimina Gate B pendente da F11.

---

## 6. Deploy

Gate C F12 só pode ser considerado quando:
- código F12 em main;
- backend F11 necessário estiver operacional no ambiente alvo;
- ausência de incompatibilidade de schema estiver provada;
- autorização explícita.

---

## 7. Homologação real

Necessário provar em sessão autenticada real:
- perfil/meta;
- programa;
- execução de treino;
- alimentação/estado;
- Body;
- Recovery;
- avaliação F11;
- reason codes;
- próximo passo;
- mobile e desktop.

Fixture não fecha homologação real.
