# M1 — Estado de implementação

## Banco
- [x] Migration criada pelo Supabase CLI: `20261107151317_health_m1_profile_goals.sql`
- [x] Dry-run transacional
- [x] Migration aplicada via Lovable Cloud
- [x] Ledger Supabase reconciliado
- [x] Rollback manual versionado
- [x] RLS em todas as tabelas M1
- [x] Grants mínimos
- [x] Constraints de integridade atleta + meta/local
- [x] Testes transacionais de integridade
- [x] Zero dados sintéticos persistidos

## Frontend
- [x] Tipos Supabase M1
- [x] Hook `useHealthProfileM1`
- [x] Página funcional `/saude/perfil`
- [x] Perfil básico
- [x] Objetivo principal
- [x] Fase atual
- [x] Local principal
- [x] Equipamentos declarados
- [x] Preferências
- [x] Consentimentos append-only

## Validação
- [x] npm ci
- [x] ESLint M1
- [x] Build
- [ ] Visual mobile 320–430px
- [ ] M1 Acceptance Report

## Persistência de teste

Após testes transacionais:
- health_athletes = 0
- health_athlete_profiles = 0
- health_goals = 0
- health_goal_phases = 0
- health_training_locations = 0
- health_declared_equipment = 0
- health_athlete_preferences = 0
- health_consents = 0
