# F11 — TEST PLAN AND ACCEPTANCE CRITERIA v1

**Status:** DOCUMENTAL

---

## 1. Casos mínimos determinísticos

### T1 — Nenhuma fonte

Esperado:
- run paused;
- capacidades paused;
- reason codes de fontes ausentes;
- nenhum zero inventado.

### T2 — M7 paused

M8/M9 presentes.

Esperado:
- nutrition_plan_review paused;
- M8/M9 não sobrepõem M7.

### T3 — M7 execution ready

Esperado:
- nutrition_execution ready;
- nutrition_plan_review paused;
- prioridade execution.

### T4 — M7 non-execution + Body ausente

Esperado:
- nutrition_plan_review paused;
- BODY_STATE_MISSING.

### T5 — M7 non-execution + Body sem resposta comparável

Esperado:
- paused;
- BODY_RESPONSE_INSUFFICIENT.

### T6 — M7 non-execution + Body suficiente + Recovery ausente

Esperado:
- paused;
- RECOVERY_STATE_MISSING.

### T7 — M7 non-execution + Body suficiente + Recovery suficiente

Esperado:
- review_nutrition_plan_candidate ready;
- action_status none.

### T8 — window mismatch

Esperado:
- capacidade paused;
- SOURCE_WINDOW_MISMATCH;
- sem fallback silencioso.

### T9 — date mismatch

Esperado:
- paused;
- SOURCE_DATE_MISMATCH.

### T10 — replay

Mesmos inputs.

Esperado:
- sem duplicação;
- idempotência.

### T11 — input alterado

Novo estado fonte.

Esperado:
- novo fingerprint;
- run anterior superseded;
- novo current.

### T12 — erro técnico

Esperado:
- failed/rollback;
- não converter para data_quality.

---

## 2. Segurança

TESTES MT deve provar:

- anon não lê;
- anon não executa;
- authenticated sem vínculo não lê;
- cross-athlete read bloqueado;
- cross-athlete evaluate bloqueado;
- frontend não possui DML direto;
- RPC fixa search_path.

---

## 3. Regressão

Obrigatório:

- M7 continua funcionando sem F11;
- M8 continua funcionando;
- M9A continua funcionando;
- F10 continua read-only;
- F11 não executa RPC M6/M7/M8/M9 de refresh/record.

---

## 4. Banco descartável

CI deve:
- instalar foundation mínima;
- aplicar migrations F11;
- executar contratos;
- validar RLS;
- validar idempotência;
- validar supersession;
- validar reason codes;
- validar constraints.

---

## 5. Acceptance documental

Arquitetura passa quando:

- fontes soberanas definidas;
- capacidades v1 definidas;
- suficiência definida;
- prioridade definida;
- reason codes definidos;
- ledger definido;
- idempotência definida;
- segurança definida;
- TESTES MT definidos;
- F11 não contém ação automática;
- M9B está explicitamente excluído de decisão v1;
- training adjustment está explicitamente desabilitado.

---

## 6. Acceptance de implementação futura

Somente PASS se:

- migrations geradas por CLI;
- TESTES MT real PASS;
- disposable CI PASS;
- lint/build PASS;
- PR diff restrito;
- Gate A;
- Gate B;
- pós-check produção;
- Gate C;
- homologação real.

---

## 7. Homologação futura

Deve provar pelo menos:

- decisão paused por falta de dados;
- decisão execution ready quando M7 exige revisão;
- plan review candidate ready somente com M7 + M8 + M9A suficientes;
- nenhuma ação automática;
- explicação e reason codes visíveis;
- sem diagnóstico;
- sem score global.

---

## 8. Bloqueios

FAIL automático se:

- F11 altera plano;
- F11 altera treino;
- biomarcador decide regra;
- histórico vira dado atual;
- null vira zero;
- erro técnico vira DECISION_PAUSED;
- algoritmo depende de IA;
- source state é recalculado dentro da RPC F11.
