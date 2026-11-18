# SHOPEE-OAUTH-MULTICONTAS-01 — ESCOPO CONGELADO

**Projeto:** PAINEL CENTRAL — AMOR DE FAMÍLIA  
**Data:** 2026-11-18  
**Natureza:** arquitetura evolutiva; documento de escopo, **não** homologação técnica ou autorização de deploy.  
**Método:** GitHub direto. Não utilizar construtor Lovable.  
**Referência atual:** PR #911 (rascunho), commit `73b264c9a2f0ccbc087379b59c530078651eb712`. A homologação real de Celivio continua pendente.

## Objetivo soberano

Evoluir o OAuth Shopee já existente no Integration Hub para que novas contas sejam conectadas por cadastro/identidade validada no Core, sem novos `if`, rotas nominativas, variáveis de ambiente por vendedor ou alterações manuais de código para cada loja. Não construir um novo motor OAuth ou aplicativo Shopee.

## Escopo fechado

1. **Motor único.** Reaproveitar assinatura, consentimento, callback, troca/renovação, leitura autenticada e cifragem atuais.
2. **Destino dinâmico confiável.** Resolver o destino a partir de identidade cadastrada/autorizada no Core; jamais aceitar um ID público do callback como autorização da conta.
3. **Isolamento.** Vincular início, estado de consumo único, loja confirmada e tokens ao mesmo `channel_account_id`, preservando separação entre vendedores.
4. **Segurança.** Preservar tempo de validade, cookie seguro, proteção de replay, verificação de `shop_id`, validação por `get_shop_info`, criptografia e tratamento de erro sem segredos.
5. **Retrocompatibilidade.** Não quebrar Adão, Viviane, Celivio nem o Gateway/callback existente. Mudança de rota apenas com migração explícita e testes.
6. **Operação.** Prever habilitar/desabilitar conexão por conta, situação do vínculo e procedimento de autorização rastreável.
7. **Governança de entrega.** Diagnóstico → desenho mínimo → implementação isolada → testes regressivos → homologação real → promoção autorizada.

## Fora de escopo

Mappings comerciais, inventário, pedidos, logística, etiquetas, alterações em ofertas, criação de novo aplicativo/Partner ID, reinício do Scheduler Adão, migração ou revogação não autorizada de tokens existentes, deploy automático, merge automático da PR #911.

## Evidência do código atual (PR #911, `shopee-live-oauth.mjs`)

- Contas `VIVIANE`, `ADAO` e `CELIVIO_ACCOUNT_ID` declaradas no código (linhas 25–31).
- Rotas nominativas e checagem explícita de caminho (linhas 194, 212).
- Flags e `shop_id` próprios de Adão/Celivio (linhas 203–209).
- `target` e prefixos de state escolhidos por nome da conta (linhas 220–226, 264–267).
- Motor compartilhado já possui `createState`, `consumeState`, troca de token e leitura autenticada da loja (linhas 229, 285 e seguintes).
- O caso `?via=console` ainda tem tratamento nominativo de Adão (linha 244).

Esses pontos são **alvos de investigação e refatoração**, não autorização para removê-los antes de existir substituição segura e compatível.

## Etapas de trabalho

**F1 — Inventário de contratos.** Mapear schema Core, criação/consumo de state, configuração atual, callback, refresh e consumidores de credenciais. Entrega: matriz `componente | contrato atual | dependência por conta | risco`.

**F2 — Contrato universal.** Definir resolução confiável de destino, autorização para iniciar, estado, vinculação de shop, migração de rotas e tratamento de contas sem vínculo. Não implementar antes de verificar os contratos reais.

**F3 — Implementação compatível.** Substituir exceções nominativas com camadas dinâmicas, preservando rotas de legado quando necessário. Alterações pequenas e reversíveis.

**F4 — Testes e homologação.** Cobrir 3 contas atuais, quarta conta hipotética, troca cruzada de contas, replay, estado expirado, cookie ausente, loja errada, refresh e rollback. Testes sintéticos não substituem homologação real.

## Estado e próximos passos

**Escopo congelado; arquitetura universal ainda NÃO implementada.** Iniciar F1 por investigação do código e contratos reais, sem mexer na produção. Em paralelo, manter a homologação de Celivio como missão operacional independente, respeitando a revisão candidata com 0% de tráfego e a produção preservada.
