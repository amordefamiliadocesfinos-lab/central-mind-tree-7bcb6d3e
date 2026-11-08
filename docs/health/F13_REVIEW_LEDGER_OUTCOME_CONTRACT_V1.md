# F13 — REVIEW LEDGER AND OUTCOME CONTRACT v1

**Status:** DOCUMENTAL

---

## 1. Entidades propostas

### health_longitudinal_review_runs

Representa snapshot comparativo versionado.

Campos conceituais:
- id uuid;
- athlete_id uuid;
- as_of_date date;
- window_days integer CHECK =28;
- current_start_date date;
- current_end_date date;
- prior_start_date date;
- prior_end_date date;
- run_status available|paused;
- available_domains text[];
- unavailable_domains text[];
- reason_codes text[];
- algorithm_version text;
- parameter_set jsonb;
- evidence_snapshot jsonb;
- input_fingerprint text;
- record_status current|superseded;
- supersedes_run_id uuid;
- created_by_auth_user_id uuid;
- created_at timestamptz.

### health_longitudinal_review_outcomes

Resultado humano imutável.

Campos conceituais:
- id uuid;
- athlete_id uuid;
- review_run_id uuid;
- outcome_code text;
- target_domains text[];
- notes text nullable;
- supersedes_outcome_id uuid nullable;
- record_status current|superseded;
- reviewed_by_auth_user_id uuid;
- reviewed_at timestamptz;
- created_at timestamptz.

---

## 2. Run idempotency

Mesmo:
- athlete_id;
- as_of_date;
- window_days=28;
- algorithm_version;
- input_fingerprint

deve retornar o mesmo run.

Mudança de fonte:
- novo fingerprint;
- run atual anterior superseded;
- novo current.

---

## 3. Run status

### available

Ao menos um domínio possui current+prior comparáveis.

### paused

Nenhum domínio possui comparação válida.

Paused é resultado válido.

### failed

Falha técnica não é persistida como review paused se a transação falhar.

---

## 4. Available domains

Valores v1:
- training;
- nutrition;
- body;
- recovery.

Goal é contexto.

F11 é contexto.

---

## 5. Outcome codes

- continue_observation;
- review_goal;
- review_training;
- review_nutrition;
- review_recovery;
- review_multiple;
- insufficient_data.

---

## 6. Target domains

Controlados:
- goal;
- training;
- nutrition;
- body;
- recovery.

Regras:
- continue_observation → target_domains pode ser vazio;
- review_goal → inclui goal;
- review_training → inclui training;
- review_nutrition → inclui nutrition;
- review_recovery → inclui recovery;
- review_multiple → mínimo 2;
- insufficient_data → pode apontar domínios com falta de dados.

---

## 7. Human authority

Outcome só é criado por ação explícita de usuário autorizado.

O motor F13 não escolhe outcome automaticamente.

---

## 8. Imutabilidade

Outcome registrado não é editado semanticamente.

Mudança:
- cria novo outcome;
- supersede anterior;
- preserva histórico.

---

## 9. Relação com mudanças reais

Outcome não muta:
- health_goals;
- health_goal_phases;
- health_programs;
- health_program_versions;
- nutrition plans;
- queue;
- F11 decisions.

A UI direciona o humano aos módulos responsáveis.

---

## 10. Aprendizado futuro

O par:
- longitudinal run;
- human outcome

forma a unidade mínima de aprendizado operacional.

A F13 v1 não treina modelo nem ajusta regras com isso.

---

## 11. Notes

Notas são humanas.

Não são transformadas automaticamente em reason codes.

Não devem conter dados clínicos desnecessários.

---

## 12. Versionamento

Algorithm:
`F13_LONGITUDINAL_REVIEW_V1`

Parameter set:
`F13_PARAMETERS_V1`

Mudança semântica exige nova versão.
