# MAPA SOBERANO DO CCH / SAÚDE NO PAINEL CENTRAL

**Versão:** v5.0 — FROZEN
**Data:** 11/11/2026
**Status:** VIGENTE · FROZEN
**Substitui:** v4.9 FROZEN

## Estado

- M0→M9: fundação;
- F10→F20: implementados;
- **F21 — Gestão do Histórico de Treinos: ABERTA**.

## F21 — missão

Permitir corrigir e invalidar sessões já registradas, sem apagar fatos fisicamente.

### Musculação
- editar data/horário/observações da sessão concluída;
- editar séries históricas: carga, unidade, reps, RIR e descanso;
- invalidar treino completo com motivo.

### Atividades F20
- editar modalidade, título, horário, duração e métricas;
- recalcular pace/velocidade quando necessário;
- invalidar atividade completa com motivo.

### Exclusão

"Excluir" na interface significa:
- registro fica `voided`;
- deixa de aparecer no histórico ativo;
- deixa de contar em analytics;
- auditoria permanece no banco;
- a fila CCH não é retrocedida automaticamente.

Não existe hard delete pelo cliente.

## F22

F22 não está aberta.
