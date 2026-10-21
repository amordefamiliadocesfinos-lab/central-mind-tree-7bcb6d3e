# F6 — ciclo mínimo recorrente Shopee (preparado, não habilitado)

Continuação do Mapa Mestre F1–F10. Esta entrega não aplica migration, publica
Hub/Core, modifica IAM ou Scheduler, habilita gates nem executa Shopee Live.

## Comportamento implementado

`POST /internal/shopee/live/cycle/run`, sem corpo/query e protegido pelo IAM
privado do Cloud Run, executa uma rodada serial da **SHOPEE VIVIANE**:

1. Adquire lease de conta no Core (5 minutos). Outra instância não executa a
   mesma rodada. A conta, shop e partner são conferidos no Hub e no Core.
2. Busca uma página de até 5 pedidos por `update_time`, conserva o registro bruto
   existente e só confirma o cursor depois de todos os detalhes serem persistidos.
3. Processa um pedido pendente da fila durável, por ordem de última verificação.
   O intake existente normaliza, utiliza os mappings canônicos e projeta o pedido,
   itens e registro inicial de separação. Não cria mappings nem fatos físicos.
4. Para um pedido já existente, compara identidade, produto/variação, quantidade
   física e valor dos itens com a projeção atual. Divergência bloqueia aquele pedido;
   não corrige unidades, cadastro comercial ou observações históricas.
5. Reutiliza o preparador e sincronizador: reconsulta identidade oficial, exige um
   único pacote, `PROCESSED`, nota `valid`, `LOGISTICS_REQUEST_CREATED`, tracking
   oficial e tipo `NORMAL_AIR_WAYBILL`. Não organiza envio nem emite NF-e.
6. `READY` sincroniza somente; `PROCESSING` agenda nova consulta de leitura.
   Somente `shipping_document_should_print_first` permite o claim permanente
   existente e **no máximo um POST** `create_shipping_document` por escopo.
7. O PDF original é validado, armazenado no bucket privado `shopee-labels` e
   registrado como `shipping_label` pelo Core existente. Não modifica separação,
   impressão, Financeiro ou estoque. O operador continua soberano em Operações.
8. Persiste o resultado e a próxima página/fila, liberando o lease. Pedidos com
   etiqueta oficial já anexada ou estado externo terminal não são preparados outra vez.

Os identificadores do pedido/pacote vêm do Core e do registro bruto da conta,
nunca do request nem de uma lista de Order SNs no código. Os pilotos antigos
permanecem restritos nas rotas manuais; não precisam ser ampliados para a recorrência.

## Cursor, fila e falhas

- Primeira janela: últimos 7 dias, encerrada 30 segundos antes do relógio do Core.
  O histórico anterior exige uma decisão de backfill separada; não é importado
  silenciosamente. Cada janela é paginada até o fim antes da próxima.
- Sobreposição de 5 minutos entre janelas; deduplicação de raw, fila e writer
  existentes impede duplicação. Interrupção antes do checkpoint repete apenas
  leitura/registro idempotente, sem avançar ou perder a página.
- A fila revisita pendências de NF-e, pacote ou mapping em rodadas futuras,
  sem impedir os demais pedidos. Capacidade inicial: uma página e um pedido
  por rodada; monitorar crescimento da fila antes de ampliar limites.
- Resultado incerto, claim não disponível, divergência canônica ou perda do
  worker selecionado bloqueia o pedido para revisão. A expiração do lease do
  worker **não expira o claim do documento**. Redescoberta não reabre bloqueios.
- Falha no checkpoint retorna HTTP 503, nunca sucesso. Não repetir uma criação
  manualmente em resposta a esse erro. Consultar ledger/estado oficial primeiro.
- Refresh OAuth usa a implementação existente, somente se seu gate separado
  estiver habilitado. A rotação é serializada pelo lease de conta. Resposta
  ambígua/incompleta, rejeição ou falha de persistência marca `halted_code` na
  conta; novas rodadas param antes de I/O externo. Sem gate de refresh, token
  expirado bloqueia a leitura, sem renovação implícita.
- `shopee_cycle_orders.last_code/state`, `shopee_cycle_state.halted_code` e os
  logs `shopee_minimum_cycle` são as evidências de atenção. Revisão humana deve
  resolver a causa antes de qualquer liberação de bloqueio em janela autorizada.
- A fila não é UI operacional e não muda as frentes de impressão, unidade ou
  cadastro. Não há novo scheduler, mapping, emissor fiscal ou writer de estoque.

## Habilitação futura — exige autorização separada

1. Revisar/mesclar esta PR e validar/aplicar a migration
   `20261020225826_shopee_minimum_cycle_state.sql` no Core oficial.
2. Publicar as ações `shopee.cycle.acquire/finish`, a extensão exata de intake e
   a verificação de integridade do Core; depois publicar a mesma versão do Hub.
   Durante essa sequência, manter os gates desligados.
3. Validar a conta ativa/OAuth: channel account
   `8a8ad166-0317-4597-8be6-e43fb46b4d1b`, shop `531736366`, partner `2047685`.
   Configurar timeout do Cloud Run em 300 segundos; o processamento é limitado
   pela janela do lease, com transportes limitados e sem retry automático.
4. Confirmar IAM privado, egress existente, secrets e bucket privado. Nenhuma
   permissão pública é necessária. As novas tabelas têm RLS e acesso apenas
   `service_role`; RPCs são `SECURITY INVOKER` e não acessíveis pelo navegador.
5. Autorizar os gates `SHOPEE_LIVE_CYCLE_ENABLED`,
   `SHOPEE_LIVE_AUTO_COMMIT_ENABLED`, `SHOPEE_LIVE_LABEL_CREATE_ENABLED` e
   `SHOPEE_LIVE_LABEL_SYNC_ENABLED`. Para continuidade além da validade do token,
   autorizar separadamente `SHOPEE_LIVE_OAUTH_REFRESH_ENABLED`.
   Preservar os dois gates de `ship_order` desligados; o ciclo recusa executá-los
   mesmo quando indevidamente habilitados. Não habilitar outras lojas.
6. Reutilizar **o Scheduler existente** `shopee-live-intake-v1`, apontando para
   `/internal/shopee/live/cycle/run`, POST sem corpo, OIDC/audience do serviço
   privado, frequência inicial de 5 minutos, sem retries automáticos do Scheduler
   e deadline de 300 segundos. Alteração e ativação não fazem parte desta entrega.
7. Observar raw → fila → projeção → etiqueta e bloqueios antes de expandir o lote.
   Rollback operacional: pausar Scheduler e desligar os gates; preservar cursores,
   fila, raw, documentos e ledgers. Nenhum reset automático de claims é permitido.

## Validação e limites desta entrega

Testes Node usam somente fixtures/adapters sintéticos. A CI usa Node 22, build
Docker canônico e suíte no container sem rede; executa também a migration em
PostgreSQL 16 descartável, valida RLS/privilégios, cursor, lease, fila, bloqueios,
claim permanente e concorrência de sessões independentes. Não usa credenciais
de produção. O entrypoint Core também recebe `deno check`.

**PED-00281:** etiqueta já gerada e armazenada; coleta física informada pelo
operador em 21/10/2026. Esta informação não é uma nova confirmação de fato físico
no banco. Nenhuma criação de etiqueta, organização de envio, impressão,
finalização, separação ou baixa de estoque desse pedido foi executada nesta PR.
