# MAPA SOBERANO DO CCH / SAÚDE NO PAINEL CENTRAL

**Versão:** v5.2 — FROZEN
**Data:** 11/11/2026
**Status:** VIGENTE · FROZEN
**Substitui:** v5.1 FROZEN

## Estado

- M0→M9: fundação;
- F10→F21: implementados;
- F21 operacional com reentrada segura na fila CCH após invalidação.

## Exclusão de treino da fila CCH

Excluir no histórico continua significando **invalidar**, nunca hard delete.

### Sem treino posterior válido

Se a sessão invalidada pertence à fila CCH e nenhum treino posterior válido
foi iniciado ou concluído:

- o queue entry volta para `queued`;
- o treino invalidado volta a ser o próximo treino;
- a sequência CCH não avança por causa de sessão de teste.

### Com treino posterior válido

Se já existe treino posterior válido:

- o registro é invalidado no histórico;
- a fila não retrocede automaticamente;
- qualquer correção de sequência precisa ser operação explícita.

## Regra de auditoria

O evento `session_voided` registra:
- queue_entry_id;
- queue_position;
- queue_rewound true/false.

## F22

F22 não está aberta.
