-- F10 — Perfil exclusivo de Operador de Produção
-- Mantém administradores/lideranças com acesso normal e restringe usuários com role PRODUÇÃO
-- ao próprio cadastro e aos próprios apontamentos de processo.

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select au.id
  from public.app_users au
  where au.auth_user_id = auth.uid()
    and au.is_active = true
  limit 1;
$$;

create or replace function public.current_app_user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select au.role
  from public.app_users au
  where au.auth_user_id = auth.uid()
    and au.is_active = true
  limit 1;
$$;

revoke all on function public.current_app_user_id() from public;
revoke all on function public.current_app_user_role() from public;
grant execute on function public.current_app_user_id() to authenticated, service_role;
grant execute on function public.current_app_user_role() to authenticated, service_role;

-- Operador PRODUÇÃO enxerga somente o próprio app_user.
drop policy if exists "Production operator sees only self" on public.app_users;
create policy "Production operator sees only self"
on public.app_users
as restrictive
for select
to authenticated
using (
  upper(coalesce(public.current_app_user_role(), '')) <> 'PRODUÇÃO'
  or auth_user_id = auth.uid()
);

-- Operador PRODUÇÃO enxerga somente os próprios apontamentos de processo.
drop policy if exists "Production operator sees only own process entries" on public.production_fact_process_entries;
create policy "Production operator sees only own process entries"
on public.production_fact_process_entries
as restrictive
for select
to authenticated
using (
  upper(coalesce(public.current_app_user_role(), '')) <> 'PRODUÇÃO'
  or operator_user_id = public.current_app_user_id()
);

comment on function public.current_app_user_role() is
'Perfil operacional canônico do usuário autenticado via app_users; usado por guards de acesso do Painel Central.';
