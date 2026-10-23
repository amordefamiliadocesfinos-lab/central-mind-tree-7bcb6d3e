# ET1 — Embalagem para Trufa, P100 (lacrado) / EA (avulso)
Status: implementação parcial na PR #355, NÃO aplicar migration enquanto os acoplamentos não estiverem incluídos.

## Patrimônio verificado
- Mestre: `af7fe3c4-863c-4d1f-9fcd-b4ecb92e5322`, 30 variantes ativas em unidades.
- 30 apresentações comerciais e 30 apresentações de compra com fator 100, todas vinculadas a sabor.
- 81 BOMs `product_components`: 27 Trufa 30g, 28 Trufa 40g, 26 Doce Essência 30g, 1 embalagem por unidade.
- 37 fatos de produção já descontaram embalagens; 10 movimentos pela conclusão de OP.
- Duas variantes sem BOM: Bala de Goma e Variados; não deduzir consumo.
- Saldos históricos em `inventory` exprimem unidades, mas não provam P100 lacrado.
- Tabela `product_batch_recipe_items` NÃO é a BOM de embalagens; nunca reescrever histórico por esse engano.

## Contrato físico (por flavor variant + localização)
`100 * P100 + EA` é conservado nas conversões.
- Reclassificação de legado: só após contagem, -100 EA +1 P100.
- Abertura: -1 P100 +100 EA em UMA transação, lock por variante/local.
- Compra futura: apresentação P100 +1 P100 e NÃO +100 EA.
- Venda P100: -1 P100 por pacote, nunca -100 EA substituindo pacote original.
- Consumo produtivo: primeiro EA; quando faltar, abrir apenas o mínimo de pacotes inteiros automaticamente na mesma transação do fato produtivo.
- Consumo/expedição de EA não pode converter estoque P100 sem mecanismo transacional único.
- Não deduzir pacotes do número histórico de unidades.
- Sem apresentação comercial composta fictícia para unidades já físicas.

## Pontos técnicos a integrar antes de ativação
1. `confirm_purchase_receipt_unguarded_01b`: no ramo de `purchase_presentations` do Mestre e variante física; creditar P100 por `received_purchase_qty` inteiro; conferir `operational_received_qty=100*received_purchase_qty`; agregar checagem de `trufa_pack_sealed_events` na chave idempotente.
2. `register_production_fact`: após inserir o fato e antes de consumir BOM, garantir EA com liberação mínima de P100 para o mesmo sabor/localização; processar apenas componentes de embalagem de trufa, mantendo demais consumos.
3. `reconcile_production_fact_materials`: repetir verificação transacional sobre quantidade pendente, sem dupla abertura/reconciliação.
4. `complete_production_order_legacy`: antes de avaliar falta de embalagem, considerar EA+100*P100; garantir autoabertura só após todas as outras faltas serem verificadas, para não realizar eventos parciais.
5. `apply_order_stock_event`: diferenciação inequívoca pelo `commercial_presentation_id` e snapshot: pedido de P100 consome P100; pedidos avulsos consomem EA; proteger evento `shipped/external_shipped` único.
6. Novo Pedido / CRM e Separação: informar P100 e EA sem inflar saldo; não bloquear indevidamente a venda de embalagens avulsas nem permitir pacote fechado sem pacote real.
7. Todos os writes e ledger necessitam identidade e contexto transacional; não disponibilizar `GRANT EXECUTE` de função interna sem contexto seguro.

## Testes obrigatórios
- Recebimento de 2 pacotes: P100 +2 / EA +0; reenvio sem duplicação.
- Produção consome 125 EA com 25 EA e 2 P100: abre 1, EA final 0, P100 final 1; segunda chamada mesma `event_key` não altera saldo.
- OP legada e reconciliação não duplicam abertura ou movimentos.
- Vender 1 P100 com saldo P100=0, EA=500 falha para saco/pacote original; jamais interpretar 500 EA como 5 P100.
- Concorrência: dois fatos não conseguem gastar o mesmo pacote.
- Reclassificação administrativa sem conferência falha; com conferência e 100 EA reclassifica exatamente 1 P100.
- Venda das 100 EA segue seu caminho físico sem consumir pacote fechado.
- Execução repetida da migration em transação de teste e execução das funções em `BEGIN ... ROLLBACK`; comparar saldos, movimentos e pedidos antes/depois.
- CI TypeScript/build/commercial-order/CRM/production.
- Teste visual autenticado antes de qualquer publicação, e operação real após inventário.

## Governança
Não usar `main` como bancada, não aplicar migration parcial em produção, não converter saldo legado automaticamente, não mexer Shopee/mappings/preços, não homologar por PR aberta.
