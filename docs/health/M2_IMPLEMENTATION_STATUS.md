# M2 — Estado de implementação

## Banco
- [x] Migration `20261107153621_health_m2_catalogs.sql`
- [x] Migration `20261107153848_health_m2_declared_equipment_catalog_fk.sql`
- [x] Dry-run da migration principal
- [x] Dry-run da FK M1→M2
- [x] Aplicação via Lovable Cloud
- [x] Ledgers reconciliados
- [x] Rollbacks versionados
- [x] RLS em 8 tabelas de catálogo
- [x] authenticated somente SELECT
- [x] anon sem grants
- [x] FK de declared equipment validada

## Seeds
- [x] 16 grupos musculares
- [x] 17 equipamentos
- [x] 18 exercícios
- [x] 32 relações exercício×músculo
- [x] 23 relações exercício×equipamento
- [x] 6 equivalências provisórias
- [x] 2 fontes nutricionais
- [x] 0 alimentos/macros inventados
- [x] 0 pesos numéricos de contribuição muscular

## Frontend
- [x] tipos Supabase M2
- [x] `useHealthCatalogs`
- [x] `/saude/biblioteca` funcional
- [x] modo Treino
- [x] busca de catálogo
- [x] cards de exercícios
- [x] modo Nutrição
- [x] fontes nutricionais
- [x] estado de importação pendente

## Validação
- [x] npm ci
- [x] ESLint M2
- [x] Build
- [x] Visual mobile 320–430px
- [x] M2 Acceptance Report


## Resultado
- [x] M2 HEALTH: PASS
- [x] PR #476 em Draft
- [ ] Merge (ação separada, dependente de M0/M1)
