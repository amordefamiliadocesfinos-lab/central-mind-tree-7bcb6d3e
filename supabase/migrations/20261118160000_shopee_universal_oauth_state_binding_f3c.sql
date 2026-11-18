-- F3-C universal OAuth: privileged preapproval for the expected shop.
-- No seed, no new grant and no production side effect before migration deployment.
create table public.shopee_oauth_shop_authorizations (
  channel_account_id uuid primary key references public.channel_accounts(id) on delete restrict,
  environment text not null default 'live' check (environment = 'live'),
  partner_id bigint not null check (partner_id > 0),
  shop_id bigint not null check (shop_id > 0),
  authorized_by_auth_user_id uuid not null references auth.users(id) on delete restrict,
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  unique(environment,shop_id)
);
alter table public.shopee_oauth_shop_authorizations enable row level security;
revoke all on public.shopee_oauth_shop_authorizations from public,anon,authenticated;
grant select,insert,update,delete on public.shopee_oauth_shop_authorizations to service_role;
comment on table public.shopee_oauth_shop_authorizations is
  'Explicit trusted expected shop for OAuth. No record is granted automatically; requires privileged onboarding and approval.';

-- Immutable binding of an opaque universal state to operator, Core account and approved shop.
create table public.shopee_oauth_universal_state_bindings (
  state_hash text primary key references public.shopee_oauth_states(state_hash) on delete restrict,
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  channel_account_id uuid not null references public.channel_accounts(id) on delete restrict,
  partner_id bigint not null check (partner_id > 0),
  shop_id bigint not null check (shop_id > 0),
  created_at timestamptz not null default now()
);
alter table public.shopee_oauth_universal_state_bindings enable row level security;
revoke all on public.shopee_oauth_universal_state_bindings from public,anon,authenticated;
grant select,insert on public.shopee_oauth_universal_state_bindings to service_role;

-- Single transaction creates state+binding, only if the trusted approval still matches.
create or replace function public.create_shopee_universal_oauth_state(
  p_state_hash text, p_auth_user_id uuid, p_channel_account_id uuid,
  p_partner_id bigint, p_shop_id bigint, p_expires_at timestamptz
) returns boolean language plpgsql security invoker set search_path = ''
as $$
begin
  if p_state_hash !~ '^[a-f0-9]{64}$'
     or p_expires_at <= now() or p_expires_at > now() + interval '10 minutes'
     or p_partner_id <> 2047685 or p_shop_id <= 0 then
    return false;
  end if;
  if not exists (
    select 1 from public.shopee_oauth_shop_authorizations a
    join public.channel_accounts c on c.id = a.channel_account_id
    join public.digital_platforms p on p.id = c.platform_id
    join public.shopee_oauth_account_grants g on g.channel_account_id = c.id
    join public.app_users u on u.auth_user_id = g.auth_user_id
    where a.channel_account_id = p_channel_account_id
      and a.environment = 'live' and a.partner_id = p_partner_id and a.shop_id = p_shop_id
      and a.is_enabled = true and g.auth_user_id = p_auth_user_id
      and u.is_active = true and c.is_active = true and p.is_active = true
      and p.group_type = 'marketplace' and p.parent_id is null and lower(p.name) like 'shopee%'
  ) then return false; end if;

  insert into public.shopee_oauth_states
    (state_hash,channel_account_id,environment,expires_at)
  values (p_state_hash,p_channel_account_id,'live',p_expires_at);
  insert into public.shopee_oauth_universal_state_bindings
    (state_hash,auth_user_id,channel_account_id,partner_id,shop_id)
  values (p_state_hash,p_auth_user_id,p_channel_account_id,p_partner_id,p_shop_id);
  return true;
end;
$$;
revoke all on function public.create_shopee_universal_oauth_state(text,uuid,uuid,bigint,bigint,timestamptz)
  from public,anon,authenticated;
grant execute on function public.create_shopee_universal_oauth_state(text,uuid,uuid,bigint,bigint,timestamptz)
  to service_role;

-- Resolve after the existing atomic one-use state consumption.
-- Recheck that the shop approval and grant have not been revoked since start.
create or replace function public.resolve_shopee_universal_oauth_state(p_state_hash text)
returns table(auth_user_id uuid,channel_account_id uuid,partner_id bigint,shop_id bigint)
language sql stable security invoker set search_path = ''
as $$
  select b.auth_user_id,b.channel_account_id,b.partner_id,b.shop_id
  from public.shopee_oauth_universal_state_bindings b
  join public.shopee_oauth_states s on s.state_hash = b.state_hash
  join public.shopee_oauth_shop_authorizations a
    on a.channel_account_id = b.channel_account_id
   and a.partner_id = b.partner_id and a.shop_id = b.shop_id
   and a.environment = 'live' and a.is_enabled = true
  join public.shopee_oauth_account_grants g
    on g.auth_user_id = b.auth_user_id and g.channel_account_id = b.channel_account_id
  join public.app_users u on u.auth_user_id = b.auth_user_id and u.is_active = true
  join public.channel_accounts c on c.id = b.channel_account_id and c.is_active = true
  join public.digital_platforms p on p.id = c.platform_id
  where b.state_hash = p_state_hash
    and s.channel_account_id = b.channel_account_id and s.environment = 'live'
    and s.used_at is not null and s.expires_at > now()
    and p.is_active = true and p.group_type = 'marketplace'
    and p.parent_id is null and lower(p.name) like 'shopee%';
$$;
revoke all on function public.resolve_shopee_universal_oauth_state(text) from public,anon,authenticated;
grant execute on function public.resolve_shopee_universal_oauth_state(text) to service_role;
