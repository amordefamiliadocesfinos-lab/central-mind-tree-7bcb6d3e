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
