drop policy if exists "Production operator sees only self" on public.app_users;

create policy "Production operator reads active collaborators"
on public.app_users
as restrictive
for select
to authenticated
using (
  upper(coalesce(public.current_app_user_role(), '')) <> 'PRODUÇÃO'
  or is_active = true
);
