# F11 — LEDGER, SECURITY AND TECHNICAL DESIGN v1

**Status:** DESENHO DOCUMENTAL — SEM MIGRATION APLICADA

---

## 1. Modelo proposto

Duas entidades.

### health_integrated_decision_runs

Representa uma execução do motor.

Campos conceituais:
- id uuid;
- athlete_id uuid;
- as_of_date date;
- window_days integer;
- run_status complete|partial|paused|failed;
- algorithm_version text;
- parameter_set jsonb;
- evidence_snapshot jsonb;
- input_fingerprint text;
- record_status current|superseded;
- supersedes_run_id uuid nullable;
- created_by_auth_user_id uuid;
- created_at timestamptz.

### health_integrated_decisions

Filhos imutáveis por capacidade.

Campos conceituais:
- id uuid;
- athlete_id uuid;
- run_id uuid;
- decision_scope text;
- decision_status ready|paused;
- decision_class text;
- decision_code text;
- target_domain text;
- confidence low|moderate|high;
- reason_codes text[];
- source_reason_codes jsonb;
- action_status none;
- evidence_snapshot jsonb;
- created_at timestamptz.

---

## 2. Decision scopes v1

- nutrition_execution
- nutrition_plan_review

Nenhum outro scope habilitado.

---

## 3. Imutabilidade

Runs e decisões concluídas não são atualizados semanticamente.

Nova avaliação com inputs diferentes:
- supersede run current anterior;
- cria novo run;
- cria novas decisões filhas.

Filhos anteriores permanecem históricos.

---

## 4. Idempotência

Mesmo:
- athlete_id;
- as_of_date;
- window_days;
- algorithm_version;
- input_fingerprint

deve retornar o mesmo run ou produzir replay semanticamente idempotente.

Não duplicar decisões por retry.

---

## 5. Input fingerprint

Deve representar IDs/versões relevantes:

- M7 decision id;
- M7 algorithm_version;
- M8 rolling state id;
- M9A rolling state id;
- F11 algorithm_version;
- parameter_set version.

Não incluir timestamp de execução no fingerprint.

---

## 6. RPC proposta

health_f11_evaluate_integrated_decision(
  p_athlete_id uuid,
  p_as_of_date date,
  p_window_days integer default 7
) returns uuid

Responsabilidades:
- validar autorização;
- carregar somente fontes canônicas;
- não executar refresh de outro módulo;
- calcular fingerprint;
- aplicar regras determinísticas;
- persistir run + decisions atomicamente;
- superseder current anterior quando necessário;
- retornar run_id.

---

## 7. Leitura

Frontend poderá ler:
- run current;
- decisões filhas;
- evidência resumida.

Frontend não escreve diretamente.

---

## 8. Segurança

Obrigatório:

- RLS nas duas tabelas;
- SELECT via health_can_read_athlete;
- sem INSERT/UPDATE/DELETE direto para authenticated;
- writes somente RPC;
- RPC SECURITY DEFINER;
- SET search_path = '';
- revoke EXECUTE de PUBLIC;
- revoke EXECUTE de anon;
- grant EXECUTE apenas authenticated;
- RPC valida health_can_write_athlete.

---

## 9. Cross-athlete

Teste obrigatório não-vazio:

- usuário A não lê run B;
- usuário A não lê decisão B;
- usuário A não avalia atleta B.

---

## 10. Evidence snapshot

Deve conter:
- IDs;
- estados;
- coberturas;
- confidence;
- reason codes de fonte;
- policy markers.

Não conter:
- fotos;
- PDFs;
- textos clínicos integrais;
- payload bruto de wearable;
- dados desnecessários.

---

## 11. Atomicidade

Run e decisões devem ser persistidos na mesma transação.

Não permitir:
- run sem filhos quando deveria haver decisão;
- filho órfão;
- current duplicado por athlete/date/window/algorithm.

---

## 12. Índices propostos

- current run único por athlete_id/as_of_date/window_days/algorithm_version;
- athlete/date desc;
- run_id nas decisões;
- decision_scope;
- supersedes_run_id;
- created_by_auth_user_id.

FKs devem possuir índice líder quando necessário.

---

## 13. Migrations futuras

Implementação deverá gerar migrations via Supabase CLI.

Não inventar timestamp manualmente.

Sequência provável:
1. foundation;
2. evaluator RPC;
3. security;
4. integrity/indexes.

Essa lista é desenho, não autorização.

---

## 14. Gate B

F11 exigirá banco.

Logo Gate B será obrigatório após:
- arquitetura em main;
- implementação/migrations em main;
- TESTES MT PASS;
- histórico de produção conferido;
- autorização explícita.

---

## 15. UI futura

F11 pode ser exibida em /saude/hoje como card read-only:

“Decisão integrada”

Mostrar:
- status;
- escopo;
- explicação;
- confidence;
- data;
- CTA para evidência.

Não criar novo item de navegação na v1 sem revisão.
