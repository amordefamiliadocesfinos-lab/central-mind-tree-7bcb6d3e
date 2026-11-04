# Diagnóstico read-only — PR #411 nos webhooks WhatsApp

## Resultado: NÃO COMPROVADO

## Evidências coletadas (só leitura)
- O checkout local está em `5f178ac08ea5fa39f5870efd3dbe0f0e1c2846f0` (commit às 16:29:40 UTC de 04/11/2026). Ele muda `whatsapp-meta-webhook`, `whatsapp-zapi-webhook`, `_shared/crm/webhook-event-guard.ts`, `outbound-operational.ts` e `zapi-connector.ts`.
- Os logs acessíveis de `whatsapp-meta-webhook` mostram vários "booted". Os de hoje são às 16:29:12, 16:29:42 e 16:31:19 UTC. Um boot não traz ID de revisão nem hash de código.
- O único aviso que aparece nos logs ("live context incremental update skipped…") já existia antes do PR (`5f178ac0~1`). Por isso ele não distingue a versão.
- O código novo não grava nenhuma mensagem própria no log. As marcas novas (`duplicate_message`, `stale_message`, `conversation_changed_during_webhook`, `reaction_not_a_customer_message`) ficam só no banco ou na resposta HTTP. Para ler essas marcas seria preciso rodar SQL ou mandar uma chamada, e as duas coisas são proibidas aqui.
- `whatsapp-zapi-webhook` não tinha nenhum log disponível.
- As ferramentas disponíveis não mostram ID de deployment, revisão nem hash do código que está rodando nas funções.

## Próximo passo mínimo (precisa de autorização separada)
Escolha uma das opções:
1. Um SELECT read-only nos registros de processamento do webhook depois das 16:29:40 UTC, procurando os novos motivos de `ignored`.
2. Um redeploy isolado e explícito das duas funções a partir desse SHA, com registro de hash do pacote.

Nesta etapa nada foi alterado.
