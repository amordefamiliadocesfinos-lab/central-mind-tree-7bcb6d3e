# SECURITY-P0 — autenticação sem autorização granular

## Achado

O Painel Central protege a navegação interna pela presença de uma sessão Supabase Auth, mas não aplica autorização granular consistente por rota, módulo e identidade de dados.

Evidências no estado auditado em 2026-09-29:

- `src/components/ProtectedRoute.tsx` aceita qualquer sessão válida.
- `src/App.tsx` disponibiliza o shell interno completo após essa única verificação.
- não foi encontrada implementação efetiva de `user_roles`/`has_role` nas migrations disponíveis;
- `public.app_users.role` é dado operacional e não uma autoridade de autorização;
- migrations históricas contêm políticas permissivas, incluindo `USING (true)` e `TO authenticated`, para tabelas como `orders`, `order_items`, `products`, `inventory`, `inventory_movements`, `financial_entries`, `service_conversations`, `service_messages` e `app_users`.

## Impacto

Criar uma conta Supabase Auth comum para revisão poderia expor dados reais e permitir caminhos de escrita. Ocultar menus no frontend não corrige o risco, pois chamadas diretas à Data API e rotas internas continuariam possíveis.

## Contenção adotada na F1.5

O portal `/shopee-review` não usa `AuthProvider`, `signInWithPassword`, o cliente Supabase, tabelas produtivas, RPCs ou componentes internos com consultas. Ele consome somente fixtures sintéticas e usa uma sessão HMAC própria validada pela Edge Function `shopee-review-auth`.

O backend dedicado é inicializado desativado e exige segredo de credencial, segredo de sessão e controle explícito antes de qualquer ativação. A migration de suporte permanece somente versionada na branch até autorização de aplicação.

## Plano posterior obrigatório

Criar uma frente transversal de autorização para:

1. inventariar todas as políticas RLS e funções privilegiadas;
2. introduzir papéis de backend e predicados por função/dado;
3. substituir políticas permissivas sem interromper operadores existentes;
4. restringir rotas e Edge Functions por autorização, não apenas autenticação;
5. testar regressão, revogação e acesso direto à Data API;
6. aplicar por etapas com plano de reversão auditado.

Esta frente não deve ser resolvida por uma conta de revisão ou por uma alteração visual isolada.
