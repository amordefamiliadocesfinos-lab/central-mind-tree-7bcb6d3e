# F6-O.2e.3 — preparação controlada da etiqueta oficial

Implementação preparada para validação. Nenhum deploy, migration produtiva ou
chamada Live é parte desta PR. A prova real exige autorização separada.

## Contrato oficial consultado em 16/10/2026

- [create_shipping_document](https://open.shopee.com/documents/v2/v2.logistics.create_shipping_document?module=95&type=1):
  POST assinado com `order_list`, `order_sn`, `package_number`, `tracking_number`
  e `shipping_document_type`. Exige rastreio, salvo canais com impressão antes
  do envio. O piloto exige rastreio em todos os casos, sem inferir a exceção.
- [get_tracking_number](https://open.shopee.com/documents/v2/v2.logistics.get_tracking_number?module=95&type=1):
  GET assinado existente, para o pedido e pacote exatos.
- [get_shipping_document_result](https://open.shopee.com/documents/v2/v2.logistics.get_shipping_document_result?module=95&type=1):
  POST de consulta, estados `PROCESSING`, `READY`, `FAILED`; download somente READY.
  `logistics.shipping_document_should_print_first` pode vir no envelope ou no item.

## Escopo e ativação futura

Rota privada IAM: `POST /internal/shopee/live/logistics/label/prepare-once`.
Sem query ou body. Nenhuma rota do API Gateway foi adicionada.

Ambos os gates precisam estar explicitamente `true`:
`SHOPEE_LIVE_LABEL_CREATE_ENABLED` e `SHOPEE_LIVE_LABEL_SYNC_ENABLED`.
Ausência equivale a desligado. Não há Scheduler ou refresh neste fluxo.

Identidade congelada no primeiro piloto:

- Channel Account: `8a8ad166-0317-4597-8be6-e43fb46b4d1b`.
- Shop ID: `531736366`; Partner ID: `2047685`.
- Pedido: `261016Q0YF8VVT`; pacote: `OFG245791336122517`.
- Tipo: `NORMAL_AIR_WAYBILL`.

Configuração deve concordar exatamente com esses valores em
`SHOPEE_LIVE_CHANNEL_ACCOUNT_ID`, `SHOPEE_LIVE_PARTNER_ID`,
`SHOPEE_LIVE_LABEL_ORDER_SN`, `SHOPEE_LIVE_LABEL_PACKAGE_NUMBER`,
`SHOPEE_LIVE_LABEL_SHOP_ID`. Exige janela UTC em
`SHOPEE_LIVE_LABEL_CREATE_WINDOW_EXPIRES_AT`, futura e até 30 minutos.
Exige pedido `PROCESSED`, NF-e `valid` e pacote `LOGISTICS_REQUEST_CREATED`.

## Sequência e recuperação

1. Ler conexão OAuth, conferir identidade/validade, sem refresh.
2. Ler detalhe, opções de documento e rastreio oficiais.
3. Consultar tarefa existente: READY reutiliza sync; PROCESSING/FAILED não recriam.
4. Somente `shipping_document_should_print_first` permite tentar claim durável.
5. Core valida conta ativa, vínculo Shop, pedido canônico e documento existente.
6. UNIQUE por conta/pedido/pacote/tipo/operação arbitra concorrência.
7. Somente claim `fresh=true` permite um POST. Não existem retries desse POST.
8. Confirmar resultado no Core. Timeout, resposta ambígua/erro ou perda de
   confirmação retêm a reserva permanentemente. Não há expiração ou reset automático.
9. Após confirmação, até quatro consultas de resultado, intervalo de 2 segundos,
   transporte limitado a 5 segundos e orçamento de 45 segundos para preparação.
   Esses limites são política conservadora local, não um SLA da Shopee.
10. READY reutiliza o sincronizador F6-O.2b, com suas validações de identidade,
    PDF limitado, upload privado imutável e attachment idempotente.

Um claim confirmado anterior permite somente retomar consultas/sync. Claims
incertos não permitem repetir criação; exigem reconciliação read-only e decisão
humana separada. Se o processamento ultrapassar a janela HTTP, retorna
`document_processing`; não roda em background nem cria outra tarefa.
Sincronização pode precisar de chamada posterior autorizada se exceder o timeout
do serviço; a reserva e o Storage imutável impedem uma nova tarefa/arquivo duplicado.

## Banco e produção

Migration e ações Core novas estão apenas versionadas nesta PR. Devem ser
validadas/aplicadas/publicadas em missão separada antes da ativação do Hub.
Ledger permite RPCs somente a `service_role`, via HMAC v1 existente do Hub.
Não há escrita em pedidos, separação, estoque, financeiro, CRM ou NF-e.
O sincronizador escreve apenas o PDF privado e `order_documents`.
Desarmar ambos os gates após a futura janela, inclusive em falha.

Rollback de implantação: gates desligados e revisão anterior. Não apagar o
ledger: ele é a evidência necessária para impedir repetição de criação incerta.

## Validação desta PR

- Node 22: 372/372 PASS, incluindo 31 testes novos.
- Dockerfile canônico com contexto raiz: PASS; suíte contra os fontes realmente
  empacotados, sem rede, 372/372 PASS. Rota empacotada ausente de gates: HTTP 503.
- Deno 2.5.4 check da Edge Function: PASS, sem deploy.
- PostgreSQL 17 descartável, sem rede/portas, apenas fixtures sintéticas: PASS.
  40 sessões concorrentes: uma reserva nova, 39 bloqueadas; permissões de browser
  negadas; estados terminais, fingerprint e documentos existentes validados.
  Container removido ao final.

Reproduzir a prova SQL, a partir da raiz, com Docker/Python locais:

```sh
python3 supabase/tests/shopee_shipping_document_local.py .
```

O harness cria um banco isolado temporário com nome aleatório, aplica a migration
somente nesse banco e executa o teste SQL em transação com ROLLBACK. Não recebe
URL de banco externo, secrets ou credenciais do ambiente produtivo.
