# F13 — SECURITY AND TECHNICAL DESIGN v1

**Status:** DESENHO DOCUMENTAL — SEM MIGRATION

---

## 1. RPCs propostas

### health_f13_generate_longitudinal_review

Args:
- p_athlete_id uuid;
- p_as_of_date date;
- p_window_days integer default 28.

Responsabilidades:
- validar health_can_write_athlete;
- ler fontes canônicas;
- calcular comparações determinísticas;
- gerar snapshot;
- calcular fingerprint;
- persistir run;
- superseder current quando necessário;
- retornar run_id.

Não escreve nos domínios especialistas.

### health_f13_record_review_outcome

Args:
- p_review_run_id uuid;
- p_outcome_code text;
- p_target_domains text[];
- p_notes text nullable.

Responsabilidades:
- validar atleta e autorização;
- validar taxonomia;
- criar outcome imutável;
- superseder outcome current anterior, se existir.

Não executa replanejamento.

---

## 2. Segurança

Tabelas:
RLS obrigatório.

Authenticated:
- SELECT autorizado;
- sem INSERT/UPDATE/DELETE direto.

Writes:
RPC apenas.

RPC:
- SECURITY DEFINER;
- SET search_path='';
- revoke PUBLIC;
- revoke anon;
- grant authenticated;
- validar health_can_write_athlete.

---

## 3. Cross-athlete

Testes obrigatórios:
- usuário A não lê run B;
- usuário A não lê outcome B;
- usuário A não gera review B;
- usuário A não registra outcome em run B.

---

## 4. Atomicidade

Generate:
- supersession + novo run na mesma transação.

Outcome:
- supersession + novo outcome na mesma transação.

---

## 5. Fingerprint

Incluir:
- IDs/versões de current/prior sources;
- métricas usadas;
- F13 algorithm version;
- parameter set version;
- period dates.

Não incluir:
- timestamp de execução.

---

## 6. Índices propostos

Runs:
- current único por athlete/as_of/window/algorithm;
- athlete/as_of desc;
- fingerprint;
- supersedes.

Outcomes:
- review_run_id;
- athlete/reviewed_at desc;
- current único por review_run;
- supersedes.

Todas FKs com índice líder.

---

## 7. Gate B

F13 v1 introduzirá DDL se este desenho for implementado.

Portanto:
Gate B F13 será obrigatório antes de produção.

Conforme Mapa v3.4:
- implementação e Gate A podem ocorrer antes do TESTES MT;
- Gate B não pode.

---

## 8. Dependências

F13 depende estruturalmente de M1/M3/M4/M6/M8/M9A.

F11 é contexto opcional no snapshot v1.

F12 não é fonte de verdade.

---

## 9. Frontend

Rota:
`/saude/revisao`.

Leitura:
SELECT dos runs/outcomes e/ou preview calculado.

Ações:
- Gerar revisão;
- Registrar resultado.

Nenhuma ação automática no mount.

---

## 10. IA

Nenhuma RPC F13 chama IA.

Algoritmo determinístico.

IA explicativa futura somente após run/outcome.
