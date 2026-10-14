# F6-O.1 — MATRIZ REAL FISCAL + LOGÍSTICA SHOPEE

**Data:** 2026-10-14  
**Status:** investigação + fundação read-only

## Objetivo operacional

Levar a operação Shopee para a **Central de Separação**, de forma que o operador encontre o pedido já com o estado fiscal/logístico conhecido e, quando permitido, com a etiqueta pronta para imprimir.

Fluxo-alvo:

**Pedido Shopee → estado fiscal → organizar envio → gerar etiqueta → etiqueta pronta no Painel → imprimir → separar → finalizar → expedir**

## Achados confirmados

### Fiscal — Brasil

A Shopee expõe capacidade para:

- consultar pedidos aguardando NF-e via status `INVOICE_PENDING`;
- informar NF-e via `v2.order.add_invoice_data`;
- consultar NF-e no `v2.order.get_order_detail` usando `response_optional_fields=invoice_data`;
- desde 29/07/2026, `invoice_data` informa ao menos `status` e `pending_reason` em cenários aplicáveis;
- nos casos em que a NF-e é exigida, ela precisa estar válida antes de `v2.logistics.ship_order`.

### Organização de envio

Fluxo oficial identificado:

1. `v2.logistics.get_shipping_parameter`
2. identificar `pickup`, `dropoff` ou método aplicável;
3. `v2.logistics.ship_order`

`get_shipping_parameter` define os parâmetros obrigatórios para a chamada de organização de envio.

### Etiqueta / documento de postagem

Fluxo oficial identificado:

1. `v2.logistics.get_shipping_document_parameter`
2. `v2.logistics.create_shipping_document`
3. `v2.logistics.get_shipping_document_result`
4. quando status = `READY`, `v2.logistics.download_shipping_document`

O parâmetro de documento informa tipos selecionáveis e tipo sugerido, incluindo modalidades como `NORMAL_AIR_WAYBILL` e `THERMAL_AIR_WAYBILL`, conforme o canal.

## Decisão de arquitetura

A Shopee permanece fonte primária do fiscal/logístico.

O Painel Central não deve recriar o emissor fiscal da Shopee. Deve:

- observar o estado fiscal;
- acionar a organização de envio quando seguro;
- gerar/obter o documento logístico pela API;
- armazenar/referenciar o documento de modo privado;
- apresentar a etiqueta diretamente na Central de Separação.

## Sequência de implantação F6-O

### F6-O.1 — capacidade read-only
- consultar `invoice_data`;
- consultar `get_shipping_parameter`;
- consultar `get_shipping_document_parameter`;
- nenhuma chamada que organize envio ou gere documento.

### F6-O.2 — contrato de estado fiscal/logístico
Normalizar estados externos em campos operacionais do Painel:
- fiscal_pending
- fiscal_valid
- fiscal_error
- shipping_not_arranged
- shipping_ready_to_arrange
- shipping_arranged
- label_not_requested
- label_generating
- label_ready
- label_error

### F6-O.3 — organizar envio controlado
Implementar `ship_order` apenas depois de provar parâmetros e regras da conta piloto.

### F6-O.4 — gerar documento controlado
Implementar `create_shipping_document` + polling do resultado.

### F6-O.5 — download e armazenamento privado da etiqueta
Baixar documento, persistir em storage privado e vincular ao Pedido/Separação.

### F6-O.6 — Central de Separação
Exibir:
- NF-e;
- estado do envio;
- etiqueta;
- botão de imprimir;
- erros e bloqueios.

## Regra de segurança

Nesta F6-O.1, nenhuma chamada de mutação Shopee é autorizada:

- não `add_invoice_data`;
- não `ship_order`;
- não `create_shipping_document`;
- não alterar pedido;
- não alterar logística;
- não baixar estoque.

Somente leitura e inspeção real.
