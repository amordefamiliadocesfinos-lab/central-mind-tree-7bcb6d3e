# M0 — Estado de implementação

## M0A — Auditoria
- [x] Fonte Git confirmada
- [x] SHA base registrada
- [x] Stack frontend confirmada
- [x] Auth/app_users inspecionados
- [x] Calendar adapter inspecionado
- [x] Drizzle inspecionado
- [ ] Supabase soberano acessível ao conector
- [ ] Migrations cloud auditadas
- [ ] RLS/grants cloud auditados
- [ ] Storage cloud auditado

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
BLOQUEADA até acesso ao Supabase oficial e fechamento do pipeline de migrations.


## Validação local nesta sessão
- [ ] `npm ci` / `npm run build`: não executados porque o ambiente de execução desta conversa não resolve `github.com`.
- [x] Diff GitHub verificado contra `main`.
- [x] `src/App.tsx` reinspecionado após correção de quebras de linha.
- [ ] Build/lint devem rodar em ambiente de desenvolvimento/CI com acesso de rede antes de merge.
