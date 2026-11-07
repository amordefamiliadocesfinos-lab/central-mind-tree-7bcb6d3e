# M0C — Validação da fundação de dados Health

Data: 07/11/2026
Migration: `20261107144000_health_m0_foundation`
Canal de aplicação: Lovable Cloud / PostgreSQL (Supabase)

## Aplicado

- `public.health_athletes`
- `public.health_athlete_access`
- RLS em ambas as tabelas
- helpers:
  - `health_can_read_athlete(uuid)`
  - `health_can_write_athlete(uuid)`
  - `health_can_manage_athlete_access(uuid)`
- bucket privado `health-private`
- policies de Storage por athlete_id no primeiro segmento do path

## Segurança validada

- helpers SECURITY DEFINER não são executáveis por `anon` nem `PUBLIC`;
- `authenticated` possui somente os privilégios necessários;
- athlete subject e owner são fontes de autorização;
- atletas supervisionados sem login são suportados via `owner_auth_user_id`;
- histórico de delegação permite revogação e nova concessão;
- segundo usuário do teste transacional recebeu:
  - read = false
  - write = false
  - manage = false
- dados sintéticos do teste foram executados dentro de transação e revertidos.

## Storage

Bucket: `health-private`
- public = false
- limite: 50 MiB
- MIME permitidos:
  - image/jpeg
  - image/png
  - image/webp
  - video/mp4
  - video/quicktime
  - application/pdf

Path esperado:
`<athlete_uuid>/<category>/<object_name>`

## Migration ledger

A execução SQL via Lovable Cloud foi reconciliada em:
`supabase_migrations.schema_migrations`

Versão:
`20261107144000`

Nome:
`health_m0_foundation`

O ledger contém 1 statement e 1 rollback documentado.

## Persistência após testes

- health_athletes: 0 registros
- health_athlete_access: 0 registros

Nenhum dado pessoal real foi criado nesta etapa.

## Próximo gate

Antes de tornar Saúde visível globalmente:
1. implementar onboarding/claim do atleta;
2. criar guard de autorização no frontend;
3. executar build/lint;
4. validar fluxo mobile-first;
5. somente então inserir item Saúde no footer global.
