# Núcleo 2.0 — Contrato técnico proposto para M1 (não executado)

**Referência:** MAPA MESTRE NÚCLEO 2.0 V1.0 — escopo congelado (11/11/2026).  
**Status:** proposta de implementação; NÃO é migration aplicada nem autorização de migração de documentos.

## Evidência de origem (11/11/2026)

- Lovable Cloud do projeto `1720a410-34cd-4410-995c-8c92c7edf16b`: Supabase habilitado; consultas SELECT funcionam.
- `public.app_users` contém `auth_user_id`, `role`, `access_model`, `is_active`; identificada 1 identidade ativa com `role='Administrador'`, `access_model='legacy'`. Não se registram nomes nem e-mails aqui.
- `public.app_admin_capabilities` possui capacidade `provision_users`; **não presumir** que ela concede acesso ao Núcleo.
- `digital_knowledge_base` é base de perguntas/respostas específica do Digital; **não reutilizar como repositório canônico do Núcleo**.
- Não foram encontradas tabelas `nucleo_*` entre as tabelas publicadas no schema `public` consultado.
- Estado legado: `src/pages/Nucleo.tsx` usa `localStorage['nucleo_painel_central_pages_v3']`; conteúdo real de navegadores dos operadores ainda não inventariado.

## Fronteira e escolha mínima

Núcleo continua em `/nucleo`. Persistência compartilhada administrativa com:
1. `nucleo_documents`: identidade estável, área original, texto canônico local, classificação e origem;
2. `nucleo_document_revisions`: snapshots imutáveis e histórico de alterações, sem substituição silenciosa;
3. `nucleo_import_batches`: controle de cada exportação/importação de navegador com checksum e reconciliação.

**Não criar** tabela de especialistas/frentes nesta M1: pertence à M3. **Não replicar** conteúdo do Drive: em M2 associar IDs/URLs/revisões da fonte original por metadados e status de autoridade, sujeito a sua governança.

## SQL de revisão para futura migration (NÃO APLICAR)

```sql
-- Draft. Exige revisão de convenções do repositório e RLS antes de ser movido
-- a supabase/migrations. Nenhuma instrução deste documento foi executada.
create table if not exists public.nucleo_documents (
  id uuid primary key default gen_random_uuid(),
  legacy_id text,
  area_id text not null check (area_id in (
    'biblioteca','consciencia','arquitetura','principios','atlas',
    'ia-orquestradora','evolucao','estado-atual')),
  title text not null,
  content text not null default '',
  tags text[] not null default '{}',
  origin_kind text not null check (origin_kind in ('local_legacy','nucleo_native','drive_reference')),
  origin_ref text,
  authority_state text not null default 'nao_classificado'
    check (authority_state in ('nao_classificado','historico','provisorio','vigente_comprovado')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  source_checksum text,
  unique (origin_kind, origin_ref)
);
create index if not exists nucleo_documents_area_idx on public.nucleo_documents (area_id,updated_at desc);
create table if not exists public.nucleo_document_revisions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.nucleo_documents(id) on delete restrict,
  revision_number integer not null check (revision_number > 0),
  title text not null,
  content text not null,
  tags text[] not null default '{}',
  label text,
  source_version_id text,
  content_sha256 text not null,
  recorded_at timestamptz not null default now(),
  recorded_by uuid references auth.users(id),
  unique (document_id, revision_number)
);
create table if not exists public.nucleo_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null check (source_kind = 'local_legacy'),
  source_sha256 text not null,
  exported_at timestamptz not null,
  imported_at timestamptz,
  imported_by uuid references auth.users(id),
  page_count integer not null check (page_count >= 0),
  imported_count integer not null default 0 check (imported_count >= 0),
  state text not null default 'staged' check (state in ('staged','reconciled','cancelled')),
  provenance jsonb not null default '{}'::jsonb
);
alter table public.nucleo_documents enable row level security;
alter table public.nucleo_document_revisions enable row level security;
alter table public.nucleo_import_batches enable row level security;

-- Estritamente administrador ativo pelo vínculo auth_user_id da tabela
-- operacional; não confiar em user_metadata, rótulo visual ou JWT role.
-- SELECT na tabela app_users está disponível a authenticated no contrato atual;
-- revalidar em teste com identidades administrativas e restritas.
create policy nucleo_documents_admin_select on public.nucleo_documents
for select to authenticated using (
  exists (select 1 from public.app_users a where a.auth_user_id = (select auth.uid())
    and a.is_active and a.access_model = 'legacy' and upper(trim(a.role)) = 'ADMINISTRADOR'));
create policy nucleo_documents_admin_insert on public.nucleo_documents
for insert to authenticated with check (
  exists (select 1 from public.app_users a where a.auth_user_id = (select auth.uid())
    and a.is_active and a.access_model = 'legacy' and upper(trim(a.role)) = 'ADMINISTRADOR'));
create policy nucleo_documents_admin_update on public.nucleo_documents
for update to authenticated using (
  exists (select 1 from public.app_users a where a.auth_user_id = (select auth.uid())
    and a.is_active and a.access_model = 'legacy' and upper(trim(a.role)) = 'ADMINISTRADOR'))
with check (
  exists (select 1 from public.app_users a where a.auth_user_id = (select auth.uid())
    and a.is_active and a.access_model = 'legacy' and upper(trim(a.role)) = 'ADMINISTRADOR'));
-- Não conceder DELETE: remover conteúdo histórico requer autorização específica.

create policy nucleo_revisions_admin_select on public.nucleo_document_revisions
for select to authenticated using (
  exists (select 1 from public.app_users a where a.auth_user_id = (select auth.uid())
    and a.is_active and a.access_model = 'legacy' and upper(trim(a.role)) = 'ADMINISTRADOR'));
create policy nucleo_revisions_admin_insert on public.nucleo_document_revisions
for insert to authenticated with check (
  exists (select 1 from public.app_users a where a.auth_user_id = (select auth.uid())
    and a.is_active and a.access_model = 'legacy' and upper(trim(a.role)) = 'ADMINISTRADOR'));
-- Sem UPDATE/DELETE para revisions: append-only.

create policy nucleo_batches_admin_select on public.nucleo_import_batches
for select to authenticated using (
  exists (select 1 from public.app_users a where a.auth_user_id = (select auth.uid())
    and a.is_active and a.access_model = 'legacy' and upper(trim(a.role)) = 'ADMINISTRADOR'));
create policy nucleo_batches_admin_insert on public.nucleo_import_batches
for insert to authenticated with check (
  exists (select 1 from public.app_users a where a.auth_user_id = (select auth.uid())
    and a.is_active and a.access_model = 'legacy' and upper(trim(a.role)) = 'ADMINISTRADOR'));
-- Atualizações de estado de batch e escrita de revisões exigem transação
-- controlada e auditoria futura; não conceder permissão ampla por padrão.
```

## Portões obrigatórios ANTES da aplicação

1. Fazer backup real de **cada navegador com conteúdo distinto**, validar checksum e registrar quantidades/títulos/versões. Não considerar a PR do exportador como prova de arquivo baixado.
2. Rever políticas `app_users`, grants efetivos e acesso de identities `legacy` / `scoped`; provar admin positivo e perfis restritos negativos por JWT real. Não alterar RLS transversal.
3. Completar grants de tabelas novas para `authenticated` de forma mínima (SELECT/INSERT/UPDATE somente quando necessário), mantendo RLS habilitado. `service_role` nunca no navegador.
4. Validar colisões de `legacy_id`, título, conteúdo e versões entre navegadores. Título não é identidade; preservar dados divergentes em vez de substituir.
5. Produzir migration rastreável em branch própria; executar em ambiente autorizado/teste e comprovar rollback. Aplicação no Cloud produtivo requer autorização correspondente.
6. Depois da prova de migração, introduzir leituras/escritas centralizadas de forma progressiva e sem excluir `localStorage` legado automaticamente.
7. Versionamento transacional de atualização de documento + snapshot anterior e trilha de autor/auditoria devem ser implementados e testados antes de liberar edição compartilhada.

## Limite

Este contrato não integra Drive, GitHub ou novas frentes, não homologa documentos provisórios e não afirma uso real. Não altera schema, credenciais, privilégios ou conteúdos existentes.