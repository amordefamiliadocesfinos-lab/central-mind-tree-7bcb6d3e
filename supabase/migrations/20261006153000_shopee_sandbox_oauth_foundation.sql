-- F1 Shopee Sandbox OAuth foundation
-- Stores OAuth state, encrypted test tokens and raw read-only snapshots.
-- No operational projection is performed by this migration.

create table if not exists public.shopee_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  channel_account_id uuid not null references public.channel_accounts(id) on delete restrict,
  environment text not null check (environment in ('sandbox','live')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists shopee_oauth_states_expires_at_idx
  on public.shopee_oauth_states (expires_at);

create table if not exists public.shopee_oauth_connections (
  id uuid primary key default gen_random_uuid(),
  channel_account_id uuid not null references public.channel_accounts(id) on delete restrict,
  environment text not null check (environment in ('sandbox','live')),
  partner_id bigint not null,
  shop_id bigint,
  main_account_id bigint,
  merchant_id bigint,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  authorization_expires_at timestamptz,
  shop_name text,
  region text,
  shop_status text,
  last_authenticated_at timestamptz not null default now(),
  last_refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_account_id, environment)
);

create unique index if not exists shopee_oauth_connections_shop_env_uidx
  on public.shopee_oauth_connections (environment, shop_id)
  where shop_id is not null;

create table if not exists public.marketplace_raw_snapshots (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  environment text not null,
  channel_account_id uuid references public.channel_accounts(id) on delete restrict,
  external_entity_type text not null,
  external_entity_id text not null,
  endpoint text not null,
  request_id text,
  observed_at timestamptz not null default now(),
  payload jsonb not null,
  payload_hash text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists marketplace_raw_snapshots_idempotency_uidx
  on public.marketplace_raw_snapshots (
    source,
    environment,
    channel_account_id,
    external_entity_type,
    external_entity_id,
    endpoint,
    payload_hash
  );

alter table public.shopee_oauth_states enable row level security;
alter table public.shopee_oauth_connections enable row level security;
alter table public.marketplace_raw_snapshots enable row level security;

revoke all on table public.shopee_oauth_states from anon, authenticated;
revoke all on table public.shopee_oauth_connections from anon, authenticated;
revoke all on table public.marketplace_raw_snapshots from anon, authenticated;

comment on table public.shopee_oauth_states is
  'Ephemeral anti-CSRF state for Shopee OAuth. Backend/service-role only.';

comment on table public.shopee_oauth_connections is
  'Shopee OAuth connection metadata and encrypted tokens. Backend/service-role only; never exposed to clients.';

comment on table public.marketplace_raw_snapshots is
  'Read-only raw marketplace evidence. Does not project operational state.';
