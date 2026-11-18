-- F3-A — Registro explícito de autorização de vinculação OAuth Shopee.
-- Somente estrutura: nenhum grant inicial, nenhum OAuth/automação ativado.
-- Execução de migration requer gate separado de implantação.
create table if not exists public.shopee_oauth_account_grants (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  channel_account_id uuid not null references public.channel_accounts(id) on delete restrict,
  granted_by_auth_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (auth_user_id, channel_account_id)
);

create index if not exists shopee_oauth_account_grants_account_idx
  on public.shopee_oauth_account_grants (channel_account_id);

alter table public.shopee_oauth_account_grants enable row level security;
revoke all on table public.shopee_oauth_account_grants from public, anon, authenticated;
grant select, insert, delete on table public.shopee_oauth_account_grants to service_role;
-- Sem políticas para authenticated: somente backend com service_role,
-- e somente após validação de identidade e autorização administrativa separada.
comment on table public.shopee_oauth_account_grants is
  'Permissão explícita por usuário autenticado e conta Shopee para iniciar onboarding OAuth. Ausência de linha = negado. Nenhuma concessão automática.';
