-- Preserve existing operational users while allowing explicit scoped identities.
-- Do not apply until API/RLS isolation is validated.
alter table public.app_users
  add column access_model text not null default 'legacy'
  check (access_model in ('legacy','scoped'));

-- Access grants belong to authenticated identities, never to display roles.
-- This table is foundational: grants are NOT yet proof of effective per-domain isolation.
-- Prevent an authenticated client from promoting a scoped identity to legacy
-- or attaching a new authenticated identity to a legacy collaborator record.
create or replace function public.guard_app_users_access_model()
returns trigger language plpgsql security invoker set search_path = ''
as $guard$
begin
  if current_user = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.auth_user_id is not null then
      raise exception 'Auth linkage requires privileged provisioning';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.access_model is distinct from old.access_model then
      raise exception 'Access model cannot be changed by client';
    end if;
    if new.auth_user_id is distinct from old.auth_user_id then
      raise exception 'Auth linkage requires privileged provisioning';
    end if;
  end if;
  return new;
end;
$guard$;
revoke all on function public.guard_app_users_access_model() from public,anon,authenticated;
create trigger guard_app_users_access_model_trigger
before insert or update on public.app_users
for each row execute function public.guard_app_users_access_model();

create table public.app_user_module_grants (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  module_key text not null check (module_key in (
    'saude','planejamento','calendario','rotina','foco','metas','minha-area',
    'assistente','nucleo','captura','operacoes','financeiro','crm','digital',
    'producao','academia','dashboard','reunioes','rotas','oportunidades','planilhas'
  )),
  granted_by_auth_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (auth_user_id,module_key)
);
alter table public.app_user_module_grants enable row level security;
revoke all on public.app_user_module_grants from public,anon,authenticated;
grant select on public.app_user_module_grants to authenticated;
create policy app_user_module_grants_read_self on public.app_user_module_grants
  for select to authenticated using (auth_user_id = (select auth.uid()));

create table public.app_user_module_grant_audit (
  id bigint generated always as identity primary key,
  target_auth_user_id uuid not null references auth.users(id) on delete cascade,
  actor_auth_user_id uuid not null references auth.users(id),
  old_module_keys text[] not null,
  new_module_keys text[] not null,
  changed_at timestamptz not null default now()
);
alter table public.app_user_module_grant_audit enable row level security;
revoke all on public.app_user_module_grant_audit from public,anon,authenticated;

-- A single transaction replaces the complete grant set and writes an audit entry.
-- Called ONLY from a server function after capability authentication.
create or replace function public.admin_replace_user_module_grants(
  p_target_auth_user_id uuid,
  p_module_keys text[],
  p_actor_auth_user_id uuid
) returns text[]
language plpgsql security invoker set search_path = ''
as $$
declare
  v_old text[];
  v_new text[];
  v_allowed text[] := array[
    'saude','planejamento','calendario','rotina','foco','metas','minha-area',
    'assistente','nucleo','captura','operacoes','financeiro','crm','digital',
    'producao','academia','dashboard','reunioes','rotas','oportunidades','planilhas'
  ];
begin
  if p_target_auth_user_id is null or p_actor_auth_user_id is null or p_module_keys is null then
    raise exception 'Invalid grant request';
  end if;
  if not exists (select 1 from auth.users where id = p_target_auth_user_id)
    or not exists (select 1 from auth.users where id = p_actor_auth_user_id) then
    raise exception 'Unknown identity';
  end if;
  select coalesce(array_agg(distinct k order by k), array[]::text[]) into v_new
  from unnest(p_module_keys) k;
  if exists (select 1 from unnest(v_new) k where k is null or k <> all(v_allowed)) then
    raise exception 'Unknown module';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_target_auth_user_id::text, 0));
  select coalesce(array_agg(module_key order by module_key), array[]::text[])
    into v_old from public.app_user_module_grants
    where auth_user_id = p_target_auth_user_id;
  delete from public.app_user_module_grants where auth_user_id = p_target_auth_user_id;
  insert into public.app_user_module_grants(auth_user_id,module_key,granted_by_auth_user_id)
    select p_target_auth_user_id,k,p_actor_auth_user_id from unnest(v_new) k;
  insert into public.app_user_module_grant_audit(
    target_auth_user_id,actor_auth_user_id,old_module_keys,new_module_keys
  ) values (p_target_auth_user_id,p_actor_auth_user_id,v_old,v_new);
  return v_new;
end;
$$;
revoke all on function public.admin_replace_user_module_grants(uuid,text[],uuid) from public,anon,authenticated;
grant execute on function public.admin_replace_user_module_grants(uuid,text[],uuid) to service_role;
comment on table public.app_user_module_grants is
  'Administrative grant registry only; must be enforced by routes, server endpoints, RLS and storage before scoped accounts are enabled.';
