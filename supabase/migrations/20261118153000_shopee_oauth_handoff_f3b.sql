-- F3-B foundation: single-use handoff from an authenticated operator to Integration Hub.
-- This migration grants no users, enables no OAuth endpoint and does not alter existing tokens.
create table public.shopee_oauth_handoffs (
  ticket_hash text primary key check (ticket_hash ~ '^[a-f0-9]{64}$'),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  channel_account_id uuid not null references public.channel_accounts(id) on delete restrict,
  partner_id bigint not null check (partner_id > 0),
  environment text not null default 'live' check (environment = 'live'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  check (expires_at > created_at and expires_at <= created_at + interval '90 seconds')
);

create index shopee_oauth_handoffs_expiry_idx on public.shopee_oauth_handoffs (expires_at);
alter table public.shopee_oauth_handoffs enable row level security;
revoke all on public.shopee_oauth_handoffs from public, anon, authenticated;
grant select, insert, update on public.shopee_oauth_handoffs to service_role;

-- Atomically consume a valid handoff. Recheck operator grant and canonical Shopee status
-- at consumption time: revoked permission must invalidate a previously issued ticket.
create or replace function public.consume_shopee_oauth_handoff(p_ticket_hash text)
returns table(channel_account_id uuid, partner_id bigint)
language sql security invoker set search_path = ''
as $$
  update public.shopee_oauth_handoffs h
  set consumed_at = now()
  from public.channel_accounts a
  join public.digital_platforms p on p.id = a.platform_id
  join public.shopee_oauth_account_grants g on g.channel_account_id = a.id
  join public.app_users u on u.auth_user_id = g.auth_user_id
  where h.ticket_hash = p_ticket_hash
    and h.channel_account_id = a.id
    and h.auth_user_id = g.auth_user_id
    and h.auth_user_id = u.auth_user_id
    and h.environment = 'live'
    and h.consumed_at is null
    and h.expires_at > now()
    and a.is_active = true
    and p.is_active = true
    and p.group_type = 'marketplace'
    and p.parent_id is null
    and lower(p.name) like 'shopee%'
    and u.is_active = true
  returning h.channel_account_id, h.partner_id;
$$;
revoke all on function public.consume_shopee_oauth_handoff(text) from public, anon, authenticated;
grant execute on function public.consume_shopee_oauth_handoff(text) to service_role;
comment on function public.consume_shopee_oauth_handoff(text) is
  'F3-B: internal-only, single-use ticket consumption with revalidation of grant, operator and Shopee account. Not exposed to browser.';
