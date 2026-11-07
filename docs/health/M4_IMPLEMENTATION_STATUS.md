# M4 — Estado de implementação

## Banco
- [x] Migration `20261107161317_health_m4_live_workout.sql`
- [x] Dry-run
- [x] Aplicação via Lovable Cloud
- [x] Ledger reconciliado
- [x] Rollback versionado
- [x] `health_workout_sessions`
- [x] `health_workout_exercises`
- [x] `health_workout_sets`
- [x] `health_workout_events`
- [x] RLS/grants
- [x] eventos append-only
- [x] 7 RPCs SECURITY INVOKER
- [x] invariantes transacionais
- [x] zero dados sintéticos persistidos

## Frontend
- [x] tipos Supabase M4
- [x] `useHealthWorkoutM4`
- [x] `/saude/treino` ao vivo
- [x] `/saude/treino/programa` preserva M3
- [x] iniciar sessão
- [x] registrar série
- [x] adicionar exercício
- [x] pular exercício
- [x] substituir exercício
- [x] concluir treino

## Validação
- [x] npm ci
- [x] ESLint M4
- [x] Build
- [ ] Visual mobile 320–430px
- [ ] M4 Acceptance Report
