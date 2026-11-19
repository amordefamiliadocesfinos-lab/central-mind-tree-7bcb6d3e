# SHOPEE-OAUTH-MULTICONTAS-01 — F1 INVENTÁRIO DE CONTRATOS REAIS

**Projeto:** PAINEL CENTRAL — AMOR DE FAMÍLIA  
**Data:** 2026-11-18  
**Status:** F1 concluída para contratos implementados no código inspecionado; dependências de esquema/migrações e identidade do operador permanecem a validar na F2.  
**Escopo superior:** `SHOPEE_OAUTH_MULTICONTAS_UNIVERSAL_ESCOPO_CONGELADO_2026-11-18.md`.  
**Base da leitura:** commit `73b264c9a2f0ccbc087379b59c530078651eb712` na PR #911 (código ainda não mergeado); o Core do repositório foi inspecionado nessa referência, não é uma auditoria da configuração efetivamente aplicada em produção.

## 1. Resultado executivo

**A arquitetura já é parcialmente multicontas no armazenamento, mas ainda nominativa no início, roteamento e refresh.** O Core aceita `channel_account_id` nas ações de state e conexão. O Hub, porém, conhece as três lojas por constantes e faz seleção por caminho, flag de ambiente e prefixo legível do state. O serviço de refresh isolado usa `SHOPEE_LIVE_CHANNEL_ACCOUNT_ID`, não uma resolução dinâmica. Portanto, alterar apenas o start OAuth não atinge o objetivo da frente.

Não há motivo demonstrado para substituir o aplicativo Shopee ou o motor de troca/validação de tokens.

## 2. Inventário verificável — componente | contrato atual | dependência nominativa | risco

| Componente | Contrato encontrado | Dependência atual | Risco se não evoluir |
|---|---|---|---|
| `services/integration-hub/src/shopee-live-oauth.mjs` | GET `/shopee/live/oauth/start`, `/adao/start`, `/celivio/start`, GET `/callback` | `VIVIANE`, `ADAO`, `CELIVIO_ACCOUNT_ID`, rotas e flags individuais | Nova conta depende de alteração de código, variáveis e deploy |
| Início de autorização | Grava `state_hash`, `channel_account_id`, `expires_at` no Core; cookie `__Host-pc_shopee_live_state`; HTTP 302 com URL assinada | `target` resolvido pelas rotas fixas; `adao.`/`celivio.` no state | Generalização superficial pode quebrar callback e sessão existente |
| Callback | Lê `code`, `shop_id`/`main_account_id` e cookie; consome state uma vez; compara conta persistida e loja, troca token e chama `get_shop_info` | Recupera destino do prefixo de state e compara shop com constantes/ambiente | Risco de associação cruzada se a resolução dinâmica não for equivalente |
| `services/integration-hub/src/core-bridge.mjs` | Ações `shopee.oauth_state.create/consume`, `shopee.oauth_connection.read/refresh/upsert`, `shopee.raw_shop_snapshot.upsert` | A ponte em si recebe dados por `channel_account_id` | Boa base reutilizável, requer novo contrato seguro para resolução do destino |
| `supabase/functions/integration-core-bridge/handler.mjs` | Validação exata das chaves das ações; UUID de conta, SHA-256 do estado, prazo limitado, payload de tokens cifrados | Não há ação de onboarding dinâmico no conjunto examinado | Nova ação precisa seguir validação estrita e assinatura |
| `supabase/functions/integration-core-bridge/index.ts` | `shopee_oauth_states` grava `channel_account_id`; consumo condicionado a `used_at IS NULL` e `expires_at > agora` | Não há prefixo por vendedor na camada de persistência | Estado já permite binding universal; preservar consumo único |
| Core — conexões | `shopee_oauth_connections` com `channel_account_id`, `environment`, `partner_id`, `shop_id`, tokens cifrados e expiração; upsert por `channel_account_id,environment` | Nenhuma restrição nominativa visível nesse handler | Verificar constraint de unicidade real e invariantes de `shop_id` na migration antes de evoluir |
| Core — identidade ativa | `activeChannelAccount()` consulta `channel_accounts(id,is_active)` | Checa ativo, mas não prova, sozinho, autorização do operador nem categoria Shopee | Não usar simplesmente `channel_account_id` informado pelo navegador |
| Core — categorização de Shopee | `canonicalShopeeChannelAccount()` valida `channel_accounts` + `digital_platforms` ativa, marketplace, pai nulo e nome começando por “shopee” | Função usada no intake, não no início OAuth atualmente | Pode ser base de validação do tipo de canal, porém não substitui controle de acesso |
| `services/integration-hub/src/shopee-oauth-refresh-once.mjs` | Read, decrypt, Shopee refresh, encrypt, persist, reread | Busca somente `SHOPEE_LIVE_CHANNEL_ACCOUNT_ID` | Outras contas não entram nesse caminho apenas por serem cadastradas |
| `services/integration-hub/src/app.mjs` e `server.mjs` | Middleware OAuth chamado primeiro; adaptador HTTP encaminha path/query/headers | Integração das rotas nomeadas no handler | Compatibilidade de encaminhamento e headers do Gateway necessária |
| Frontend / iniciação autenticada | Não identificado mecanismo de autorização do operador na leitura realizada | Ainda não verificado | Bloquear mudança até conhecer mecanismo existente de sessão/permissões |

## 3. Contratos e invariantes que devem continuar válidos

1. **Partner único já existente** `2047685` para as contas atuais, sem novo aplicativo.
2. **State** emitido no início, hash SHA-256 no Core com conta, TTL máximo de 10 minutos, consumo atômico uma vez (ou recusa).
3. **Cookie de sessão** `__Host-pc_shopee_live_state`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`; callback sem sessão ou sem campos necessários falha fechado.
4. **Sem seleção pública no callback:** parâmetros `channel_account_id`, `account`, `target` e `partner_id` são rejeitados.
5. **Shop binding:** identidade prevista no registro governado precisa coincidir com retorno do OAuth e com leitura autenticada `get_shop_info`; nunca inferir autorização a partir de `shop_id` vindo do navegador.
6. **Persistência segregada** `channel_account_id` + ambiente, com cifragem de access/refresh tokens no Hub.
7. **Retrocompatibilidade** de URLs de Adão/Viviane/Celivio e estados já existentes, inclusive durante rollback; não remover prefixos até haver migração e provas.
8. **Sem projeção comercial** durante OAuth.

## 4. Dependências e dúvidas concretas para F2 (não inventar resolução)

- **Autorização do solicitante:** Qual endpoint/contexto autenticado do Painel comprova que o operador pode iniciar a conexão da loja selecionada? `activeChannelAccount` por si só não basta.
- **Cadastro confiável do shop esperado:** Verificar campos de `channel_accounts` e esquema das relações antes de escolher onde guardar `shop_id` pré-autorização. Para novos vendedores, não confiar cegamente em `shop_id` informado no retorno.
- **Migrações e unicidade:** Confirmar na DDL real índices/constraints de `shopee_oauth_states` e `shopee_oauth_connections`; o código mostra `onConflict`, não prova a migração.
- **Compatibilidade multi-state em um navegador:** cookie único suporta uma autorização em curso por host; definir se concorrência deve ser proibida, enfileirada ou gerida por transações seguras. Não enfraquecer state para contornar esse fato.
- **Refresh universal:** Definir se o serviço existente será chamado com contexto de conta confiável, ou se haverá executor que percorre conexões elegíveis; nenhuma rotina automática deve ser ativada nesta fase.
- **Mapeamento/credenciais do partner:** confirmar se futuras lojas continuarão sob o mesmo partner e qual política de habilitação da conta será usada.
- **Produção:** a revisão candidata de Celivio com 0% de tráfego e a homologação real pendente são frente operacional separada.

## 5. Plano objetivo de F2

1. Abrir as migrations relacionadas a `channel_accounts`, `shopee_oauth_states` e `shopee_oauth_connections` e confirmar índices, chaves, RLS e políticas de associação.
2. Localizar o atual contexto de autenticação/permissão da interface Painel Central e o contrato de iniciação backend.
3. Desenhar **uma resolução de conta server-side** (cadastro ativo Shopee + operador autorizado + política de partner), sem conta por query pública.
4. Definir modelo de state opaco + lookup confiável com migração das rotas existentes e testes de concorrência.
5. Delimitar desenho do refresh por conta sem habilitar cron nem outras ações comerciais.
6. Só após esses achados definir mudança de código da F3 e testes de não regressão.

## 6. Governança

F1 documental apenas: **sem merge, sem deploy, sem nova autorização Shopee, sem mudança em Scheduler, Gateway, credenciais ou operações comerciais.**

**Conclusão:** seguir para F2 com o desenho dos contratos de entrada autenticada, destino de loja e refresh. A implementação universal não está pronta, e Celivio ainda exige homologação real independente.
