-- Foundation only. Do not apply until enterprise RLS inventory / bootstrap admin identity is approved.
-- Permission catalog is independent from app_users.role. No grants for anon or public.
create table if not exists public.app_module_access (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  module_key text not null check (module_key in (
    'saude','planejamento','calendario','rotina','foco','metas',
    'minha-area','assistente','nucleo','captura','operacoes',
    'financeiro','crm','digital','producao','academia','dashboard'
  )),
  granted_by uuid not null references auth.users(id),
  granted_at timestamptz not null default now(),
  primary key (auth_user_id, module_key)
);
alter table public.app_module_access enable row level security;
revoke all on public.app_module_access from anon, authenticated;
-- Only the backend service role may manage grants. A normal client cannot forge them.
comment on table public.app_module_access is
  'Backend-managed authorization intent; not a substitute for per-domain RLS. No implicit access for missing grants.';
