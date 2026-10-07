# Integration Hub — Fundação V0.1

Serviço isolado do Painel Central para executar integrações externas que exigem infraestrutura especializada.

## Escopo desta F1

Esta pasta contém somente o esqueleto mínimo do Hub:

- processo HTTP independente;
- `GET /health` sem acesso a banco, secrets ou plataformas externas;
- contrato mínimo e agnóstico de capacidades de conectores;
- testes unitários sem dependências externas.

## Fronteira congelada

O Hub executa integrações. O Core continua soberano sobre o negócio.

O Hub não cria nem passa a ser fonte canônica de Produto, Variante, Pedido, Estoque, Financeiro, Cliente, CRM ou qualquer outra entidade de negócio do Painel Central.

Nesta etapa o Hub também não recebe `service_role`, não acessa o Supabase diretamente, não implementa OAuth Shopee, não cria Raw Snapshot, não cria fila e não contém secrets.

## Próximas frentes autorizadas

- F2: Cloud Run + rede + NAT + IPv4 estático + Secret Manager + health de infraestrutura.
- F3: Core Bridge mínimo e autenticação Hub ↔ Core.
- F4 em diante: reutilização controlada das primitivas Shopee existentes e primeiro conector Live.

A F1 Sandbox Shopee existente permanece intacta e fora deste serviço.
