# M0 — Estado de implementação

## M0A — Auditoria
- [x] Fonte Git confirmada
- [x] SHA base registrada
- [x] Stack frontend confirmada
- [x] Auth/app_users inspecionados
- [x] Calendar adapter inspecionado
- [x] Drizzle inspecionado
- [x] Supabase soberano acessível via Lovable Cloud
- [x] Migrations cloud auditadas em leitura
- [x] RLS/policies cloud auditados em leitura
- [x] Storage cloud auditado em leitura

## M0B — Fundação frontend
- [x] Branch isolada
- [x] Namespace `/saude/*`
- [x] Shell mobile-first
- [x] Rotas internas iniciais
- [x] Contratos base de domínio
- [ ] Gate de autorização Health
- [ ] Item global Saúde no footer
- [ ] Smoke/build/lint executados no branch

## M0C — Dados
PREPARAÇÃO LIBERADA. Acesso de leitura ao banco oficial foi confirmado via Lovable Cloud.
DDL continua bloqueado até fechar a migration M0 revisável/reversível e os testes de RLS/Storage.


## Validação local nesta sessão
- [ ] `npm ci` / `npm run build`: não executados porque o ambiente de execução desta conversa não resolve `github.com`.
- [x] Diff GitHub verificado contra `main`.
- [x] `src/App.tsx` reinspecionado após correção de quebras de linha.
- [ ] Build/lint devem rodar em ambiente de desenvolvimento/CI com acesso de rede antes de merge.
