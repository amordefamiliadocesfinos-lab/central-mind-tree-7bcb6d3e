# F13 — TEST PLAN AND ACCEPTANCE CRITERIA v1

**Status:** DOCUMENTAL

---

## 1. Comparação

### C1 — Dois períodos completos
Esperado:
- domains available conforme fontes;
- diferenças calculadas;
- sem score.

### C2 — Current missing
Esperado:
- domínio unavailable;
- reason code current missing.

### C3 — Prior missing
Esperado:
- domínio unavailable;
- reason code prior missing.

### C4 — Training zero sessions
Esperado:
- available;
- completed_session_count=0.

Zero factual != unknown.

### C5 — Query error
Esperado:
- error técnico;
- não converter em zero/missing.

### C6 — Null metric
Esperado:
- delta null;
- não inventar 0.

---

## 2. Run

### R1 — Nenhum domínio comparável
- run paused;
- NO_COMPARABLE_DOMAINS.

### R2 — Um domínio comparável
- run available;
- PARTIAL_LONGITUDINAL_COVERAGE.

### R3 — Replay
Mesmos inputs:
- mesmo run/idempotente.

### R4 — Fonte mudou
- novo fingerprint;
- anterior superseded;
- novo current.

---

## 3. Outcome

### O1
Human registra continue_observation:
- outcome current;
- sem mutation especialista.

### O2
Human registra review_training:
- target training;
- programa não é alterado.

### O3
Novo outcome no mesmo run:
- anterior superseded;
- histórico preservado.

### O4
Cross-athlete:
- bloqueado.

### O5
Outcome inválido:
- falha;
- nenhuma linha parcial.

---

## 4. Segurança

- RLS on;
- anon no read;
- authenticated sem vínculo no read;
- no direct DML;
- RPC search_path vazio;
- PUBLIC/anon no execute;
- authenticated execute;
- cross-athlete não-vazio;
- FKs indexadas.

---

## 5. Regressões

Obrigatório:
- F12;
- F11;
- F10;
- M9.

---

## 6. Critérios semânticos

PASS somente se:
- não existir score global;
- não existir auto-replanning;
- não existir causalidade automática;
- M9B não comandar outcome;
- F12 não virar source of truth;
- outcome exigir ação humana;
- comparação guardar datas explícitas;
- unknown != zero;
- error != absent.

---

## 7. Gate A

Após:
- migrations em branch;
- CI descartável;
- testes;
- regressões;
- diff reconciliado.

TESTES MT não bloqueia Gate A conforme v3.4.

---

## 8. Gate B

Obrigatório para DDL F13.

Exige:
- migrations em main;
- TESTES MT PASS real;
- ausência em histórico produção;
- autorização explícita.

---

## 9. Gate C

Somente após Gate B quando schema F13 for necessário à UI publicada.

---

## 10. Homologação real

Exige histórico real suficiente para comparar períodos.

Fixture não prova evolução contínua real.

Homologação deve demonstrar:
- current/prior reais;
- run;
- outcome humano;
- histórico preservado;
- nenhum autoajuste.
