# F6-K.1 — POLÍTICA OPERACIONAL DE COMMIT SHOPEE

**Data:** 2026-10-14  
**Status:** proposta implementada em código, aguardando integração na main

## Objetivo

Transformar a prova de commit real da F6-K em uma política operacional segura para a futura execução recorrente da F6-L.

## Política congelada

- lote automático máximo por rodada: **5 pedidos**;
- concorrência de writer: **1 por vez**;
- uma tentativa de writer por pedido em cada rodada;
- falha retryable é reavaliada na **próxima rodada controlada**;
- isolamento de conta obrigatório;
- mapping exato obrigatório;
- projeção precisa estar `ready`;
- falha de leitura do batch interrompe a rodada;
- exceção de infraestrutura no writer interrompe a rodada;
- blocker de negócio segura somente aquele pedido;
- writer rejeitado não transforma o pedido em sucesso;
- idempotência: `channel_account_id + order_number`;
- `already_registered` é sucesso idempotente e não conta como nova escrita.

## Escritas permitidas

- `orders`
- `order_items`
- `order_separation`

## Escritas proibidas

- `inventory`
- `inventory_movements`
- `financial_entries`
- `financial_movements`
- `contacts`
- `contact_history`
- `service_conversations`
- `production_orders`

## Tratamento por resultado

| Resultado | Ação |
| --- | --- |
| `written` | concluído |
| `already_registered` | concluído por idempotência |
| `blocked` | segurar até correção do blocker |
| `write_failed` | retry na próxima rodada controlada |
| desconhecido | segurar e exigir investigação |

## Auditoria mínima de cada rodada

A camada de execução deve registrar ao menos:

- quantidade selecionada;
- quantidade ready;
- quantidade bloqueada;
- quantidade escrita;
- sucessos;
- retries pendentes;
- estados por pedido;
- conta;
- início/fim da rodada;
- identificador da rodada.

A persistência durável desse registro será implementada junto da F6-L/R, sem misturar com o writer de negócio.

## Próxima frente

**F6-L — Scheduler / execução recorrente**

A F6-L deve consumir esta política, manter o serviço privado e automatizar o nascimento de pedidos elegíveis sem comando manual.
