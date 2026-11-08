# F14 — REPLANEJAMENTO ASSISTIDO — ARQUITETURA V1

## 1. Princípio

F14 é uma camada de coordenação humana.

Ela responde:

> “Depois que a F13 indicou que algo merece revisão, como registrar de forma auditável o que será mantido, revisado, adiado ou considerado não aplicável?”

Ela não responde:

> “Qual treino/dieta/meta deve ser aplicada automaticamente?”

## 2. Modelo de dados

### health_replanning_cases

Representa um caso de revisão derivado da F13.

Campos conceituais:

- id;
- athlete_id;
- source_review_run_id;
- source_review_outcome_id;
- source_outcome_code;
- source_target_domains;
- source_snapshot;
- case_status;
- reason_codes;
- opened_by_auth_user_id;
- opened_at;
- completed_at;
- voided_at;
- void_reason;
- record_status;
- supersedes_case_id;
- created_at;
- updated_at.

### health_replanning_items

Um item por domínio em revisão.

Campos:

- id;
- athlete_id;
- case_id;
- domain;
- item_status;
- decision_code;
- decision_notes;
- evidence_snapshot;
- decided_by_auth_user_id;
- decided_at;
- created_at;
- updated_at.

## 3. Abertura do caso

RPC:
`health_f14_open_replanning_case(p_review_run_id uuid)`

Regras:

1. usuário autenticado;
2. autorizado a escrever para o atleta;
3. review run F13 existe;
4. outcome atual existe;
5. outcome deve indicar revisão ou dados insuficientes;
6. snapshot F13 é congelado no caso;
7. domínios são derivados do outcome humano;
8. caso aberto é idempotente para a mesma combinação de review/outcome atual;
9. itens são criados apenas para os domínios explicitamente selecionados;
10. nenhuma tabela especialista é modificada.

## 4. Decisão de item

RPC:
`health_f14_record_replanning_item_decision(...)`

Decisões v1:

- `keep_current`
- `revise`
- `defer`
- `not_applicable`

A decisão registra intenção humana.

Ela não executa a intenção.

## 5. Encerramento

RPC:
`health_f14_complete_replanning_case(p_case_id uuid)`

Condição:

- todos os itens precisam ter decisão diferente de `pending`.

Conclusão não prova que a mudança especialista foi efetivamente aplicada.

A UI deve dizer isso explicitamente.

## 6. Void

RPC:
`health_f14_void_replanning_case(p_case_id uuid, p_reason text)`

Void preserva histórico.

## 7. Idempotência

Abrir o mesmo caso com a mesma revisão/outcome atual retorna o caso corrente já existente.

Nova outcome F13 pode abrir novo caso.

Não reescrever caso concluído.

## 8. RLS

SELECT:
- somente quem pode ler o atleta.

Escrita:
- somente por RPCs;
- authenticated não recebe INSERT/UPDATE/DELETE direto.

Anon:
- nenhum acesso.

## 9. Segurança de funções

RPCs privilegiadas devem:

- validar `auth.uid()`;
- validar `health_can_write_athlete`;
- usar `SECURITY DEFINER` somente quando necessário;
- fixar `search_path=''`;
- revogar EXECUTE de PUBLIC/anon;
- conceder EXECUTE somente a authenticated.

## 10. UI

Nova rota:

`/saude/replanejamento`

A tela mostra:

- origem da revisão F13;
- período;
- outcome humano;
- lista de domínios;
- decisão por domínio;
- notas;
- links para especialista;
- histórico de casos;
- aviso de que F14 não aplica mudanças.

## 11. Links especialistas

- goal → /saude/perfil
- training → /saude/treino/programa
- nutrition → /saude/alimentacao
- body → /saude/evolucao
- recovery → /saude/recuperacao

## 12. Sem backend

Se schema F14 não existir no ambiente:

- tela permanece acessível;
- informa “Replanejamento ainda não disponível neste ambiente”;
- não tenta simular persistência local;
- não cria falso estado de conclusão.

## 13. Dependências

F14 depende de F13 para abertura de caso.

F14 não depende de F15/F16.
