# Núcleo 2.0 F1/F2 — G2 | Portão de atestado e recibo transacional

**Data:** 23/11/2026 · **Autoridade:** continuidade técnica autorizada, somente laboratório descartável, PR #1004 em draft.

## Escopo do delta

Arquivo `scripts/nucleo-f1-f2-g2-atomic-attestation-receipt.test.sql`, executado após as provas G1/G2 e a corrida com duas sessões:
- Ativa políticas restritas aos leitores de fixture `g2_competences` e `g2_decision_attestations`, sem conceder a `authenticated` acesso a elas.
- Instala um **trigger de laboratório** que exige atestado de competência existente, não revogado, vigente e com identidade de aprovador separada do executor **para decisões da família de teste** `synthetic://g2/atomic/`.
- Introduz tabela de recibo com `request_id` único, `decision_id` único, `grant_id` único, marca de parâmetros e executor; a política de inserção exige coerência com o grant persistido.
- Executa concessão + evento (trigger) + recibo dentro de **uma só transação SQL**, rejeitando execução sem atestado e repetição conflitante.
- Não altera schema candidato em produção, fonte de autorização real nem o núcleo existente.

## Escopo que a CI não comprova

1. **Não existe autenticação humana da Camada Mestre**: a competência e o atestado são semeados pelo administrador sintético do laboratório; JWT de usuário fictício no GoTrue local foi verificado em suíte anterior.
2. **Não existe canal oficial de criação de decisões**, delegação real emitida por autoridade competente, assinatura de origem nem serviço executor autenticado hospedado.
3. **Não existe API HTTP de idempotência**; recibo persistido apenas modela o contrato SQL. Retorno após timeout, hash canônico, retry HTTP e recuperação distribuída são futuros.
4. O trigger G2 é deliberadamente **versionado/limitado** às decisões de laboratório desta família e não protege todos os caminhos de aprovação existentes; não deve ser confundido com uma política pronta para produção.
5. O teste de concorrência entre duas sessões foi provado na suíte anterior pela unicidade de `decision_ref`; o novo teste focaliza cadeia de atestado + grant + recibo.
6. Implementação produtiva precisará: identidade do aprovador não controlável pelo cliente, competência/delegação validada em fonte soberana, operação autenticada de aprovação, writer com privilégios mínimos, consumo realmente atômico e auditoria independente, proteção anti-replay e prova Auth/RLS em staging fiel.

## Critérios para avançar após a CI

PASS com negativa sem atestado, positiva com atestado válido e competência vigente, uma concessão, um evento, um recibo durável e rejeição de requisição conflitante. Se falhar, corrigir apenas a branch e manter G2 aberto.

**Restrições:** PR draft/sem merge; nenhum DDL/grant, login, migration, deploy ou consumo no Core oficial; AC-01/AC-02/FM/M3-M5/F6/F7 e Entrega B preservados.
