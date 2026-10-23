# F6-Q.4B.1 — leitura manual Adão

Executor independente: `src/read-adao-orders.mjs`. Não é importado pelo servidor,
não cria rota nem agenda. Reutiliza a factory existente sem modificar o leitor de Viviane.

## Testes offline

Na raiz do repositório:

```sh
node --test services/integration-hub/tests/read-adao-orders.test.mjs
```

Todos os transportes dos testes são fixtures. Não precisam de credenciais nem de rede.

## Futura execução Live (não realizada nesta entrega)

Somente após autorização específica da leitura, em processo manual separado e confiável,
com Node >=22 e acesso ao Core bridge. Carregar pelo mecanismo seguro já autorizado,
apenas no ambiente desse processo:

- `SHOPEE_LIVE_PARTNER_KEY`
- `SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY`
- `CORE_BRIDGE_HMAC_SECRET`

Não colocar valores em argumentos, arquivos versionados, histórico de comandos ou logs.
Não usar tracing HTTP, `set -x` ou depuração de fetch. Não alterar ambiente do serviço,
gates OAuth ou Scheduler. O endereço do Core e a identidade são fixos no executor:
conta `b4027369-5abf-4ac1-ab24-862334fae892`, Partner `2047685`, Shop `1156446003`.
Variáveis ambientes de conta/Partner/URL do ciclo de Viviane não são utilizadas.

Na raiz do repositório, executar uma única vez:

```sh
node services/integration-hub/src/read-adao-orders.mjs --live
```

Sem `--live`, apenas mostra uso e termina. O comando retorna JSON sanitizado e exit code
0 no sucesso, 1 na falha, 2 para argumentos inválidos. Importar o módulo não faz I/O.

O processo faz um POST de **leitura** da conexão Adão ao Core, depois no máximo um GET
de lista e um GET de detalhes na Shopee. Consulta as últimas 24 horas em `create_time`,
cinco pedidos, sem filtro de status, cursor ou campos opcionais. Não segue paginação;
uma página vazia é sucesso com contagens zero. Respostas acima de cinco pedidos ou
com identidades inválidas são rejeitadas antes de solicitar detalhes.

Não renova tokens. Token vencido, ausente ou a até 60 segundos do vencimento bloqueia
a leitura. Se isso acontecer, parar e tratar a renovação em outra frente autorizada;
não repetir OAuth nem ativar o ciclo para contornar o bloqueio.

Callbacks de snapshots somente confirmam em memória e descartam os argumentos. Nenhum
snapshot, cursor, pedido ou projeção é escrito. A camada de transporte aceita apenas
a leitura da conexão fixa e os dois GETs fixos, uma vez cada, sem redirects ou retries.
Timeout de 15 segundos por chamada. Nunca serializa exceções, mensagens externas,
tokens, URLs assinadas, pedidos individuais, payloads ou dados pessoais.

Relatório: identidade fixa, janela Unix em segundos UTC, contagens, resultado e request
IDs oficiais em formato hexadecimal/UUID quando disponíveis. Conferir o relatório e
encerrar o processo; não encadear importação, etiquetas, estoque, financeiro ou CRM.

## F6-Q.5A — modo de persistência bruta (separadamente autorizado)

O comando `--live` continua **somente leitura**. Uma execução de persistência exige
duas opções exatas, e **não deve ser iniciada antes de aprovação da PR e autorização
específica para gravação real**:

```sh
node services/integration-hub/src/read-adao-orders.mjs --persist-raw --confirm=CONFIRM_ADAO_RAW_SNAPSHOTS
```

Usar exclusivamente no processo manual isolado com os mesmos três secrets já
descritos. A confirmação é uma proteção contra disparos acidentais, não substitui
a autorização humana para executar a gravação na produção.

O modo bruto usa uma página de até cinco pedidos, sem paginação, sem renovação,
sem alterar cursor e sem criar pedidos internos. Reutiliza as operações existentes
`shopee.raw_order_list_snapshot.upsert` e `shopee.raw_order_snapshot.upsert`
do Core Bridge, fixadas exclusivamente à conta Adão.

A lista e **todos os detalhes** precisam passar pelas validações existentes.
Os registros ficam apenas em memória até a validação completa. Antes da primeira
gravação, todos os bodies são pré-validados contra o limite de 64 KiB por ação.
Só então a aplicação grava uma lista e, no máximo, cinco registros de detalhes,
em sequência. Cada registro confirmado usa a chave idempotente canônica do Core
(conta, entidade, endpoint e hash do payload).

Caso um POST retorne falha ou a resposta se perca após persistência, o executor
**para sem repetir**. O relatório informa `raw.confirmed`, `raw.attempted` e
`raw.expected`, em que `confirmed` significa resposta de sucesso observada,
não prova de que uma tentativa sem resposta tenha sido revertida. Consultar o Core
antes de qualquer reexecução. Nenhum escritor de pedido operacional, separação,
estoque, financeiro, etiqueta ou ciclo recorrente é acionado.

Não mostrar payloads brutos, dados pessoais, tokens, URLs assinadas ou dump de
ambiente. Não executar sob `set -x`. A integração Viviane fica totalmente fora
desse processo. Não foi criado endpoint público, migration ou Scheduler.

## F6-Q.5B — manutenção isolada do access token Adão

Este comando é **exclusivo para execução manual autorizada no ambiente seguro GCP**,
se o token de acesso de Adão estiver vencido. O código verifica metadados primeiro:
se o token ainda estiver válido por mais de 60 segundos, não faz renovação nem escrita.
A conexão armazenada deve ter Partner 2047685 e Shop 1156446003. Não usa as variáveis
de conta e Partner da Viviane.

```sh
node services/integration-hub/src/refresh-adao-token-once.mjs --refresh-once --confirm=REFRESH_ADAO_TOKEN_ONCE
```

Reutiliza os três secrets protegidos do processo isolado já documentado. Em caso de
expiração do refresh token, divergência de identidade ou resposta incerta do Core,
**não repetir**: comunicar o resultado para avaliação. Em sucesso, retorna somente
identidade, código de resultado e novo horário de expiração; jamais tokens.
Não cria rota, Scheduler ou ciclo automático. Depois da renovação confirmada,
a execução de `--persist-raw` deve continuar separada, uma única vez,
sem importar pedidos ou movimentar estoque.


## F6-Q.6A — pedido com itens comerciais (Adão, experimental)

O executor original `--live` e `--persist-raw` continuam **inalterados**:
sem campos opcionais; nenhum resultado antigo é reescrito ou transformado em
pedido operacional.

Os dois novos modos pedem **somente** `response_optional_fields` =
`item_list,total_amount,payment_method` em um `get_order_detail`, após a
lista de até cinco pedidos numa janela de 24 horas. A consulta não inclui endereço
nem dados de contato como campos opcionais.

**Prévia sem gravação** (autorização específica para consulta Shopee Live):
```sh
node services/integration-hub/src/read-adao-orders.mjs --preview-items
```

**Persistência bruta complementar** (execução real requer autorização específica):
```sh
node services/integration-hub/src/read-adao-orders.mjs --persist-items --confirm=CONFIRM_ADAO_ORDER_ITEMS
```

A persistência conserva o modelo anterior: **somente Raw Snapshots de lista e
detalhes**, por Core Bridge, com limite de 64 KiB por request, até cinco pedidos,
sem paginação, sem refresh e sem retry. O hash de payload distingue o snapshot
enriquecido do snapshot anterior, sem apagar o original. Toda resposta
`PROCESSED` ou `READY_TO_SHIP` deve ter `item_list` não vazia, `item_id`
positivo e `model_quantity_purchased` inteiro positivo; caso contrário,
falha **antes de qualquer write**. Pedidos `CANCELLED` e demais estados não
elegíveis continuam apenas como evidência bruta, mesmo sem itens.

Retorno sanitizado: contagem de pedidos elegíveis, linhas comerciais válidas,
detalhes com itens ausentes/inválidos, tentativas de snapshot e confirmações.
Não imprime pedido, SKU, produto, preço, destinatário, payload ou token.

**Fora do escopo:** vincular automaticamente anúncios, alterar mappings, criar
`orders`, `order_items`, `order_separation`, estoque, financeiro, CRM,
Scheduler, Cloud Run ou Viviane. Após persistir, comparar apenas os itens dos
snapshots com os mappings existentes e realizar *preview* da projeção antes
de qualquer importação operacional.
