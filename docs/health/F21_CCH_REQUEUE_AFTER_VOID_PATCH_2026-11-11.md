# F21 — PATCH DE REENTRADA NA FILA CCH APÓS EXCLUSÃO

**Data:** 11/11/2026
**Status:** CORREÇÃO OPERACIONAL

## Problema observado

Um treino da fila CCH podia ser iniciado e encerrado apenas para teste.
Ao excluir esse treino no Histórico F21, o registro era corretamente invalidado,
mas o item da fila permanecia `completed`. O próximo treino passava a ser o
subsequente, embora o treino excluído não devesse contar como executado.

Caso real observado:
- A2 · posição 6;
- sessão de teste invalidada;
- C2 · posição 7 passou incorretamente a ser o próximo treino.

## Nova regra

Ao invalidar um treino vinculado à fila CCH:

1. o registro continua sendo marcado como `voided`;
2. ele deixa de contar no histórico ativo e analytics;
3. se **não existir treino posterior válido** já iniciado/concluído na fila:
   - o mesmo queue entry volta para `queued`;
   - marcadores de WORKOUT_STARTED/WORKOUT_COMPLETED/WORKOUT_COMPLETED_PARTIAL são removidos;
   - é adicionado `WORKOUT_VOIDED_REQUEUED`;
   - o treino excluído volta a ser o próximo da sequência;
4. se existir treino posterior válido:
   - a fila não é retrocedida silenciosamente;
   - a invalidação continua válida somente no histórico.

## Segurança de progressão

A regra evita dois erros:
- pular um treino que foi apenas teste;
- retroceder automaticamente uma sequência depois que treinos posteriores reais já foram executados.

## Caso Deividi — 11/11/2026

O A2 foi restaurado manualmente para:
- posição 6;
- estado `queued`;
- razão `WORKOUT_VOIDED_REQUEUED`.

C2 permanece posição 7 e volta a ser subsequente.
