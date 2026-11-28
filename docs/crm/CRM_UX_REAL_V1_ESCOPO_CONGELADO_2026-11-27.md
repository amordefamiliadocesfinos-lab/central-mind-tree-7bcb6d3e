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
**U1 — Lançamento comercial compartilhado (alta):** diminuir passos para vários sabores/itens em CRM e Novo Pedido em Operações; duplicação segura por família, sem herdar variante física incompatível; manter quantidade comercial somente quando a apresentação for compatível, e reiniciar para 1 quando a apresentação do sabor anterior precisar ser removida; preservar composição válida; usar preços oficiais em lote apenas quando fontes e canal elegíveis, sob comando explícito; preservar expansão física, desconto, frete, totais, regra de estoque e contrato de pedido. Verificar os dois pontos de entrada e regressões de composição/variante/preço.
**U2 — Registrar Resultado com contexto (alta):** mostrar evidência e consequência de encerrar/perder antes da confirmação, sem Resultado presumido por IA, sem duplicar tarefa nem alterar automação canônica. Preservar liberdade do operador e classificação correta.
**U3 — Gravação e documentos (média):** melhorar estados de progresso, prevenção de duplo envio, avisos não bloqueantes de vencimento e feedback de anexo/frete; preservar idempotência e reconhecer venda já confirmada em caso de erro secundário.
**U4 — Inbox e navegação (média):** hierarquia visual e avisos de sucesso por atendimento, proteção de edições pendentes, preservação de filtros, opt-out e ações essenciais.

## Sequência
1. PR U1-A: helper reutilizável dos itens CRM+Operações, atalho de duplicação e preços elegíveis CRM, testes unitários e inspeção de delta.
2. U1-B: conferir UX desktop/intermediário/mobile nas duas telas e reduzir cliques adicionais com achados reais; sem invadir writer central.
3. U2, U3, U4: PRs mínimos independentes, testes proporcionais e prova de uso quando autorizada.

## Exclusões/portões
Sem novo Pedido, tabela, RPC, migration, RLS, writer financeiro ou preço oficial; sem mudanças produtivas, envio de mensagens, clientes de teste, homologação de runtime ou promoção documental por mera CI. F2 precificação é de Operações; cross-domain exige preservação de contratos e owner competente.

## Contraprova real de 27/11/2026 — CRM e Operações
- Capturas CRM: duplicar sabor mantém a família, exige nova variante e a versão publicada mostra preço de tabela antes da escolha da variante.
- Gravação Operações (30,5 s): Novo Pedido tem rolagem horizontal, cortando preço e ações do item.
- As evidências foram captadas na versão publicada **anterior** à PR #1176; não são homologação da interface da branch.
- Ajuste de engenharia U1-A: selecionar variante numa linha direta duplicada preserva quantidade informada; quando apresentação vinculada é removida, reinicia quantidade com aviso; preço da nova variante sempre vem da referência canônica. Não mostrar referência/preço oficial antes de variante necessária.
- Portão pendente: contraprova da PR realmente servida em CRM e Operações, sem criar Pedido de teste na produção.

## Contraprova complementar — 27/11/2026, Operações / Novo Pedido
- Captura fornecida pelo proprietário mostra modal Novo Pedido com scrollbar horizontal interno, parte esquerda do formulário deslocada e campos de preço/botões parcialmente fora da área útil.
- Na versão publicada observada, a grade de item tentava renderizar seis controles lado a lado; a PR ainda é draft e não está publicada, portanto esta captura caracteriza o problema em produção, não UAT da branch.
- Delta aplicado nesta PR: grade responsiva de uma coluna em largura pequena e duas em telas maiores; os preços não impõem largura mínima, os selects podem encolher, e a região rolável da janela fica limitada à rolagem vertical. Mesmas regras para CRM e Operações.
- Regressão estática de grade e overflow: `tests/crm-ux-real-responsive-layout.test.mjs`, executada na CI. Ela não substitui teste visual interativo em janela estreita, desktop e mobile.
- Critério de aceite pendente: em ambas as telas nenhum controle fica inacessível por deslocamento/scroll horizontal, e o pedido real não é criado em teste produtivo.

## Refinamento para fila — U4-B: Assistente CRM, extração de dados da conversa (27/11/2026)
**Origem:** solicitação expressa do proprietário, acompanhada de captura da Inbox e ficha do contato. **Estado:** requisito de produto aprovado para planejamento; engenharia, permissões, escrita operacional e homologação NÃO autorizadas por este registro. Não altera a sequência U1 → U2 → U3 → U4 nem reabre U1-A.
**Encaixe:** depois do núcleo U4 (Inbox, ficha e navegação), como **U4-B**, porque depende da ficha e usa as proteções de gravação U3; preparação técnica somente por diferença.

### Resultado pretendido
O Assistente CRM deve ler o histórico de conversa acessível e permitido do contato atual e identificar todas as informações cadastrais úteis explicitamente disponíveis, propondo completar os campos existentes da ficha sem digitação repetida. Abranger quando existirem: nome/nome fantasia, contatos, endereço/CEP/cidade/UF, documento fiscal, informações comerciais, preferências e observações. Campos fiscais/sensíveis e dados ambíguos requerem validação e confirmação. Não presumir que dados escritos por terceiros ou citados correspondem ao titular; distinguir residência, entrega e cobrança.

### Jornada UX proposta
1. **Extrair:** oferecer na ficha a ação contextual “Preencher dados da conversa”, com sugestões discretas enquanto o atendimento ocorre. Ler apenas mensagens e anexos permitidos que o aplicativo efetivamente suporte.
2. **Confrontar:** normalizar por campo e classificar vazio, igual, divergente, ambíguo ou não comprovado; mostrar mensagem de origem, autor e data. Preservar os valores cadastrados, sem sobrescrita por inferência.
3. **Confirmar e salvar:** pré-visualizar os campos sugeridos e diferenças. Após confirmação explícita do operador, preencher campos vazios pelo writer canônico da ficha, com proteção de edições pendentes, idempotência, auditoria e confirmação do resultado. Aplicar controle de acesso, minimização e base legal/consentimento pertinente. Sem escritor paralelo.
4. **Comprovar:** reler os valores persistidos e mostrar preenchidos, ignorados, pendentes e erros, sem inferir ausência de informação não extraída. Não disparar mensagens nem modificar Resultado, Próxima Ação, Pedido, Financeiro ou opt-out.

### Aceite e testes para autorização futura da U4-B
- Extrair múltiplos campos de mensagens dispersas, tratar correções, conflitos, documentos inesperados e finalidades distintas de endereço, com proveniência por campo.
- Não preencher cadastro errado nem tratar instruções presentes na conversa como comandos ao sistema.
- Não sobrescrever informação confirmada; conflito, documento fiscal e baixa confiança exigem revisão.
- Reutilizar infraestrutura de assistente, ficha, writers e histórico existente; garantir idempotência e recuperação de falha parcial.
- Comprovar responsividade, acessibilidade e resultados de persistência em fixtures sem dados pessoais reais.
- Sem alterar RLS, criar writer concorrente, promover deploy ou modificar clientes nesta etapa documental.

**Ordem após inclusão:** U1 fechamento → U2 → U3 → U4 (navegação e ficha) → U4-B (preenchimento assistido), mantendo um único mapa e checkpoints por diferença.
