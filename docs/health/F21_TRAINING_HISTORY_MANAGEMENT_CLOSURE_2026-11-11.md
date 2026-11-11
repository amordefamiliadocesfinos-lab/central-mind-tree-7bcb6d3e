# F21 — GESTÃO DO HISTÓRICO DE TREINOS — CLOSURE

**Data:** 11/11/2026
**Status:** OPERACIONAL
**Base:** `main@b3099a957cdbbd453d118e0142016b9c46a279ea`

## Entregas

### Musculação
- editar sessão concluída;
- corrigir início, duração e observações;
- editar séries históricas;
- corrigir carga, unidade, reps, RIR e descanso;
- excluir do histórico ativo por invalidação auditável.

### Atividades F20
- editar modalidade;
- editar título;
- editar início e duração;
- editar distância, calorias, FC, RPE, cadência, elevação, passos e observações;
- recalcular pace e velocidade;
- excluir do histórico ativo por invalidação auditável.

## Exclusão

Não existe hard delete pelo cliente.

A ação "Excluir do histórico":
- exige motivo;
- marca `record_status=voided`;
- preserva o registro tecnicamente;
- grava evento de auditoria;
- remove o registro das leituras ativas;
- não retrocede automaticamente a fila CCH.

## Analytics e visualizações

Registros voided deixam de aparecer em:
- Histórico ativo;
- Sessões de hoje;
- Analytics de treino.

Treinos de musculação voided deixam de ser considerados completed, preservando também a leitura longitudinal F13.

## Banco

Migration:
`20261111171704_health_f21_training_history_management.sql`

Postcheck:
- record_status em workout/activity: OK;
- cinco RPCs F21: OK;
- DELETE físico para authenticated: bloqueado;
- anon sem EXECUTE nos RPCs de void;
- migration history alinhado;
- 8 registros de treino existentes preservados como ativos na ativação.

## Frontend

Rota:
`/saude/treino/historico`

Acesso pelas telas:
- Treino;
- Atividades.

## Regra futura

Reabrir/retroceder uma sessão da fila CCH após exclusão é uma operação diferente e não faz parte da F21.
