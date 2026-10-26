# F1/F2 — Piloto Porto Gel 2 kg / Viviane (evidência oficial, sem ativação)

Data: 2026-10-26. Estado: pronto para homologação operacional; **NÃO ATIVADO**.

## Evidência oficial (consultada em leitura no Lovable Cloud)
- Conta interna: SHOPEE VIVIANE / channel_account_id `8a8ad166-0317-4597-8be6-e43fb46b4d1b`.
- Conexão Shopee OAuth: Shop ID `531736366`, shop_name `Amor de familia doces finos`, status NORMAL.
- Snapshot Open Platform: `marketplace_raw_snapshots`, endpoint `/api/v2/order/get_order_detail`, pedido `261026KKYE4XF0`, capturado em 2026-10-26 00:50:10 UTC.
- Shopee: Item ID `23399466897`; Model ID `209190015957`; nome da variação `2 KG`; quantidade de compra `1`; título contém `SH-002-011` (código legado, não identidade oficial).
- **O pedido da amostra estava UNPAID no snapshot**. Não usar para criação/expedição real.

## Tradução física no Painel Central
- Apresentação ativa: `908ee0d8-c603-4e71-afb2-133994e89e7a`, Porto Gel — Composição 2kg (2×1kg).
- Componente em `commercial_presentation_components`: produto `6e757550-a9b6-4644-8164-8c802760e373`, variante `ae7c8013-de6c-4806-9450-abcab2202aa9`, quantidade `2`, variante ativa (embalagem 1kg).
- Simulação read-only: 1 oferta 2kg => 2 embalagens 1kg. Não cria pedido nem movimenta estoque.
- O teste da PR #367 `F2 Viviane Porto Gel 2kg Open Platform evidence resolves to existing physical presentation` representa esta relação com mapping em memória.

## Condições para ativação
1. Confirmação operacional de Operações 9 da composição física no fluxo real de separação (não apenas cadastro ativo).
2. Revisar e integrar PR #367, incluindo a leitura dos identificadores oficiais no bridge; executar testes na versão de merge e verificar deploy efetivo do serviço.
3. Migração F1.2 já aplicada diretamente ao Lovable Cloud: colunas `external_item_id`, `external_model_id`, restrição e índice presentes; **30 mappings legados preservados e zero vínculos oficiais gravados** no momento da consulta.
4. Registrar mapping exato para conta + Item ID + Model ID, com composição 2× variante 1kg e vínculo documental desta evidência. Não fabricar Seller SKU.
5. Para teste ponta a ponta usar pedido elegível, não cancelado/não pago, e confirmar idempotência, separação e regra de estoque (pedido ≠ OP; criar pedido ≠ baixar estoque).

Este arquivo é documentação de evidência do piloto, não comando de gravação nem autorização de estoque/anúncio.
