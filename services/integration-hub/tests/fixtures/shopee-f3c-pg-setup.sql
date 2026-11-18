-- Additional minimal Core tables to exercise F3-C in disposable PG17 only.
create table public.shopee_oauth_states (
 id uuid primary key default gen_random_uuid(),
 state_hash text not null unique,
 channel_account_id uuid not null references public.channel_accounts(id),
 environment text not null check (environment in ('live','sandbox')),
 expires_at timestamptz not null,
 used_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.shopee_oauth_states enable row level security;
grant select,insert,update on public.shopee_oauth_states to service_role;
