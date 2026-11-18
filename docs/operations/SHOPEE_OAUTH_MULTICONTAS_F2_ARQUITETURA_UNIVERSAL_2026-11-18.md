# SHOPEE-OAUTH-MULTICONTAS-01 — F2 ARQUITETURA UNIVERSAL, CONTRATOS E GATES

**Data:** 2026-11-18  
**Projeto:** PAINEL CENTRAL — AMOR DE FAMÍLIA  
**Natureza:** desenho técnico baseado em código e migrações versionados; **não** implantação nem homologação de segurança em produção.  
**Autoridade:** escopo congelado `SHOPEE_OAUTH_MULTICONTAS_UNIVERSAL_ESCOPO_CONGELADO_2026-11-18.md`.  
**Referências:** implementação PR #911 no commit `73b264c9a2f0ccbc087379b59c530078651eb712`; migrações de `main` citadas abaixo.

## 1. Conclusão arquitetural

Adotar **um aplicativo Shopee / N lojas / N credenciais segregadas por `channel_account_id`**, mantendo o mesmo Integration Hub e o mesmo Core Bridge. A universalização deve abranger **início autenticado, destino confiável, callback e refresh por conta**; mudar só a rota de início não resolve.

**Decisão fechada de projeto:** não usar `channel_account_id` ou `shop_id` de uma query pública como prova de permissão. Resolver conta e autorização em backend autenticado, produzir autorização transitória de uso único e transferir para o Gateway com um handoff controlado, ou integrar autenticação ao mesmo host por componente confiável equivalente. A escolha entre transporte de handoff e BFF de mesma origem será fixada após verificar infraestrutura/contratos do frontend e Gateway; ambos devem satisfazer os invariantes abaixo.

## 2. Evidências nas fontes (DDL e interface)

- `supabase/migrations/20260826190000_channel_accounts_foundation.sql`: `channel_accounts(id,platform_id,name,external_identifier,is_active,metadata)`, unicidade por plataforma+nome; RLS habilitada com política `Allow all on channel_accounts` (`FOR ALL USING(true) WITH CHECK(true)`). **RLS habilitada não equivale a restrição de acesso.** Não presumir que esse cadastro, em sua forma atual, autoriza mudanças OAuth.
- `supabase/migrations/20260826200000_shopee_channel_account_reference.sql`: contratos legados de pedidos/mappings também usam `channel_account_id`, e há validação de plataforma Shopee e conta ativa em importação. Essa verificação não é controle de autorização do operador OAuth.
- `supabase/migrations/20261006153000_shopee_sandbox_oauth_foundation.sql`: `shopee_oauth_states` tem `state_hash UNIQUE`, FK conta, `environment`, `expires_at`, `used_at`. `shopee_oauth_connections` tem unicidade `(channel_account_id,environment)` e índice parcial único `(environment,shop_id)` para loja não nula. RLS ativa e `revoke all` de `anon,authenticated` nas três tabelas sensíveis. O estado e a conexão já são modelados para várias lojas.
- `supabase/functions/integration-core-bridge/index.ts`: `shopee.oauth_state.create` checa `activeChannelAccount`, grava hash e FK; `consume` faz `UPDATE` condicional `used_at IS NULL` e prazo; `read/refresh/upsert` trabalham com `channel_account_id`. `canonicalShopeeChannelAccount` já verifica plataforma de marketplace Shopee, mas não é chamado para autorização do state. É uma lacuna de contrato a resolver, não permissão implícita.
- `supabase/functions/integration-core-bridge/handler.mjs`: validações de payload por chaves exatas, UUIDs, hash, expiração e ciphertext. A ação nova precisará manter a validação estrita e assinatura do Core Bridge.
- `src/contexts/AuthContext.tsx`: sessão Supabase Auth, `app_users` ativo associado a `auth_user_id`; perfil é informação de interface, não autorização confiável de backend.
- `src/hooks/useChannelAccounts.ts`: frontend atualmente consegue criar, renomear e ativar contas usando acesso Supabase do cliente. Não reutilizar automaticamente esse botão como autorização de credenciais Shopee.
- `supabase/migrations/20261108190000_panel_admin_user_module_grants.sql`: `app_user_module_grants` registra permissões por módulo mas a própria migração reconhece que os grants não garantem isolamento até enforcement das rotas/endpoints/RLS. Não existe `shopee_oauth_connect` nessa lista. Não conceder OAuth por mera presença de acesso ao módulo `operacoes` ou `digital`.
- `services/integration-hub/src/shopee-live-oauth.mjs`: callback e state hoje dependem de prefixos `adao.`, `celivio.`, `VIVIANE`; consentimento assinado e persistência cifrada são comuns.
- `services/integration-hub/src/shopee-oauth-refresh-once.mjs`: refresh usa uma conta fixa `SHOPEE_LIVE_CHANNEL_ACCOUNT_ID`, precisa se tornar operação por conta com acionador autorizado separado.

**Limite da evidência:** código/migrações versionados foram inspecionados; políticas efetivamente aplicadas, grants atuais, infraestrutura de sessão no Gateway e proprietário autorizado das lojas **não** foram consultados em produção.

## 3. Contratos propostos para F3 — fronteiras de confiança

### A. Identificação e permissão de iniciar

1. Painel oferece `Conectar loja Shopee` a usuário **autenticado**.
2. Endpoint de backend verifica JWT no servidor, `app_users` ativo, competência explícita de administrar conexão Shopee e autorização para a **conta específica**, usando política de concessão server-side auditável. A UI não decide essa permissão.
3. Backend resolve `channel_account_id` canônico, status ativo, `digital_platforms` Shopee ativa, partner autorizado e política de vinculação da loja. `metadata` e `external_identifier` não são por si prova de posse da loja.
4. Somente após validação o backend emite handoff transitório opaco, de uso único, com hash/TTL/actor/conta/partner, ou BFF autenticado equivalente; origem e destino validados. Evitar expor identidade por query diretamente no Hub.
5. Hub consome handoff apenas uma vez, persiste state de uso único (10 minutos) com `channel_account_id`, emite cookie `__Host-` e devolve **302 com `auth_partner` assinado**.

**Gate de implementação:** antes de introduzir handoff em URL, decidir com evidência real qual é a origem e o fluxo de navegação; se ticket for usado, minimizar TTL, impedir logging/referrer, não tratar sua posse isolada como autenticação prolongada, proteger contra uso cruzado de sessão e ataques de troca de conta. Sempre redirecionar com `Referrer-Policy: no-referrer` e `Cache-Control: no-store`. O ticket não deve carregar segredos nem ser reutilizável.

### B. Callback seguro e sem conta nominativa

1. Preservar callback oficial e validações existentes de `code`, identificador de loja, cookie, hash, prazo e consumo único.
2. **Resolver o destino através do registro de state consumido no Core**, não de prefixo de nome nem de parâmetro de callback; manter parser/compatibilidade dos states antigos na transição e durante rollback.
3. Conferir que estado, sessão, account, partner, loja permitida e `get_shop_info` autenticado concordam. Reject fail-closed, sem persistir associação cruzada.
4. Para novas lojas ainda sem Shop ID homologado, criar uma etapa **controlada de vínculo/expectativa de loja** que não confunda o valor retornado pela Shopee com prova de autorização da conta Core. Política de primeira vinculação precisa da autorização administrativa e da confirmação autenticada do Shop ID; a unicidade `(environment,shop_id)` é proteção adicional, não a única.
5. Persistir tokens cifrados unicamente na conexão canônica e snapshots pela conta. Respostas e logs sem dados sigilosos.

### C. Refresh universal sem automação comercial

1. Serviço `refreshOne(accountId)` aceita somente identidade fornecida por **job interno/ação autorizada**, não rota pública livre. Carrega conexão elegível pela conta.
2. Verifica conta/plataforma/partner/status, shop imutável na operação, refresh token válido e bloqueio de execução concorrente.
3. Chama API, cifra e persiste o novo par exclusivamente no mesmo `channel_account_id`/environment; após persistência, confirma a leitura.
4. Renovação agendada em massa, se desejada futuramente, dependerá de uma frente operacional própria. **Não ativar Scheduler, intake, etiquetas ou outros writers** na F3.

### D. Retrocompatibilidade e migração

- Preservar `/shopee/live/oauth/start`, `/adao/start`, `/celivio/start` como aliases protegidos enquanto existentes e preservar comportamento para estados legados.
- Não desabilitar flags antigas nem mover conexões/tokens automaticamente.
- Introduzir componentes novos em regime opt-in/default-off com testes; rollout/rollback separado de PR #911 e da homologação operacional Celivio.
- Isolar mudança de RLS de `channel_accounts` em migração especificamente auditada para não quebrar páginas legadas. **Não modificar a política permissiva sem mapear consumidores e impacto.**

## 4. Regras de segurança congeladas

- Contas inativas, não Shopee, sem autorização específica ou sem partner permitido: **rejeição**.
- Cookie ausente, state expirado, reuso, loja incorreta, código ausente, token de outra loja, consentimento fora da sessão: **rejeição**.
- Tentativa de usar uma conta autenticada para vincular shop de outra: **rejeição**.
- Shop já vinculado a outra conta no ambiente: **rejeição** (índice único + retorno tratado).
- Falha de Core, assinatura, leitura Shopee ou cifragem: **fail closed**.
- Proibido copiar tokens/códigos OAuth para logs, navegador, chat ou documentação.

## 5. Estratégia de implementação F3 (não executada)

**F3-A — Contrato de autorização:** inventário do endpoint autenticado usado pelo Painel e decisão de permissão explícita por conta; implementar serviço backend mínimo com testes de permissões, sem tocar no OAuth de produção.

**F3-B — Resolução dinâmica:** adicionar rota de entrada confiável, emitir/consumir handoff ou BFF equivalente, registrar estado e consentimento assinado. Manter aliases e flags legados.

**F3-C — Callback genérico:** resolver por state persistido e identidade autenticada, manter compatibilidade com antigos `adao.`/`celivio.`; proibir colisão de loja/conta.

**F3-D — Refresh por conta:** refatorar biblioteca `refreshOne`, preservar invocação atual de Viviane, não ativar cron.

**F3-E — Testes:** 3 contas existentes + quarta hipotética, acesso indevido, estado expirado/replay, duas tentativas simultâneas, shop trocado, falha do Core, rollback, refresh de loja errada, idempotência e efeitos comerciais zero.

## 6. Gates de liberação

1. **G0:** arquitetura aprovada e contratos de sessão/rotas/DDL confirmados em ambiente alvo.
2. **G1:** testes unitários, regressivos e de integração; sem false positives baseados só em HTTP 302.
3. **G2:** revisão isolada com 0% de tráfego e comparação de envs/secrets/flags, mantendo produção.
4. **G3:** autorização explícita para janela produtiva, homologação com conta real e prova de token/loja no Core.
5. **G4:** promoção/rollback controlados; Scheduler Adão permanece PAUSED até autorização independente.

## 7. Estado

**F2: desenho técnico concluído; não implementado, não homologado.** Deixar a PR #911 e a revisão candidata de Celivio intocadas. **Próximo passo:** F3-A, começando por verificar o atual endpoint autenticado e implementar política de autorização de vínculo sem depender da RLS ampla de `channel_accounts`. Não presumir que grants de módulo equivalem à permissão de conexão OAuth.
