# CRM UX Real V1 — Escopo congelado para desenvolvimento incremental
Data: 27/11/2026. Autoridade: determinação do proprietário nesta conversa.
Natureza: **escopo funcional aprovado**, NÃO homologação técnica, deploy, autorização de mutation no Core ou novo mapa soberano.

## Regra principal — Pedido canônico e superfícies consumidoras
- CRM `InboxSaleDialog` → `createUnifiedSale` → RPC `create_unified_sale`.
- Operações `Operacoes.tsx` → `useOrders.createOrder` → **a mesma** `createUnifiedSale` → **a mesma RPC**.
- `src/lib/orders/commercialOrderItem.ts` rege quantidade, apresentação, composição e item físico. Financeiro, estoque, separação, logística, produção, histórico e interfaces consumidoras do Pedido preservam o contrato existente.
- Shopee/importação, criação de ordens de produção e edição/cancelamento de pedidos existentes seguem contratos próprios. Não reinterpretar essas jornadas como novo cadastro comercial, nem substituir seus writers.
- Preço oficial permanece na fonte de Operações; aplicar preço na UX exige ação explícita. Preço negociado não é reescrito automaticamente.

## Frentes e aceites proporcionais
**U1 — Lançamento comercial compartilhado (alta):** diminuir passos para vários sabores/itens em CRM e Novo Pedido em Operações; duplicação segura por família, sem herdar variante física incompatível, preservando quantidade comercial e composição válida; usar preços oficiais em lote apenas quando fontes e canal elegíveis, sob comando explícito; preservar expansão física, desconto, frete, totais, regra de estoque e contrato de pedido. Verificar os dois pontos de entrada e regressões de composição/variante/preço.
**U2 — Registrar Resultado com contexto (alta):** mostrar evidência e consequência de encerrar/perder antes da confirmação, sem Resultado presumido por IA, sem duplicar tarefa nem alterar automação canônica. Preservar liberdade do operador e classificação correta.
**U3 — Gravação e documentos (média):** melhorar estados de progresso, prevenção de duplo envio, avisos não bloqueantes de vencimento e feedback de anexo/frete; preservar idempotência e reconhecer venda já confirmada em caso de erro secundário.
**U4 — Inbox e navegação (média):** hierarquia visual e avisos de sucesso por atendimento, proteção de edições pendentes, preservação de filtros, opt-out e ações essenciais.

## Sequência
1. PR U1-A: helper reutilizável dos itens CRM+Operações, atalho de duplicação e preços elegíveis CRM, testes unitários e inspeção de delta.
2. U1-B: conferir UX desktop/intermediário/mobile nas duas telas e reduzir cliques adicionais com achados reais; sem invadir writer central.
3. U2, U3, U4: PRs mínimos independentes, testes proporcionais e prova de uso quando autorizada.

## Exclusões/portões
Sem novo Pedido, tabela, RPC, migration, RLS, writer financeiro ou preço oficial; sem mudanças produtivas, envio de mensagens, clientes de teste, homologação de runtime ou promoção documental por mera CI. F2 precificação é de Operações; cross-domain exige preservação de contratos e owner competente.
