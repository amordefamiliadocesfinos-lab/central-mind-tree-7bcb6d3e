# M3 — Estado de implementação

## Banco
- [x] Migration `20261107155747_health_m3_program_cch.sql`
- [x] Migration `20261107160110_health_m3_program_rpcs.sql`
- [x] Dry-run migration principal
- [x] Dry-run RPCs
- [x] Aplicação via Lovable Cloud
- [x] Ledgers reconciliados
- [x] Rollbacks versionados
- [x] 6 tabelas M3 com RLS
- [x] FKs atleta/programa/versão
- [x] trigger de current_version publicada
- [x] RPCs SECURITY INVOKER
- [x] testes transacionais de integridade
- [x] zero dados pessoais persistidos

## Frontend
- [x] tipos Supabase M3
- [x] `useHealthProgramM3`
- [x] `/saude/treino` funcional
- [x] criação de programa/versão
- [x] prioridades musculares
- [x] templates de sessão
- [x] prescrição de exercícios
- [x] publicação atômica
- [x] fila CCH estrutural

## Validação
- [x] npm ci
- [x] ESLint M3
- [x] Build
- [x] Visual mobile 320–430px
- [x] Smoke rascunho → publicação → fila
- [x] M3 Acceptance Report

## Resultado
- [x] M3 HEALTH: PASS
- [ ] Merge (ação separada, dependente de M0/M1/M2)
