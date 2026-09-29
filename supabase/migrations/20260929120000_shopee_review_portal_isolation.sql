-- F1.5: controle isolado do portal demonstrativo da Shopee.
-- Não contém credenciais e inicia desativado. Aplicar somente após revisão de segurança.
create table if not exists public.shopee_review_portal_control (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  expires_at timestamptz,
  session_version integer not null default 1 check (session_version > 0),
  updated_at timestamptz not null default now()
);

insert into public.shopee_review_portal_control (id) values (true)
on conflict (id) do nothing;

create table if not exists public.shopee_review_login_attempts (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  attempt_key text not null,
  outcome text not null default 'pending' check (outcome in ('pending', 'success', 'failure', 'rate_limited'))
);

create table if not exists public.shopee_review_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  session_version integer not null check (session_version > 0)
);

create index if not exists shopee_review_login_attempts_window_idx
  on public.shopee_review_login_attempts (attempt_key, occurred_at desc);

alter table public.shopee_review_portal_control enable row level security;
alter table public.shopee_review_portal_control force row level security;
alter table public.shopee_review_login_attempts enable row level security;
alter table public.shopee_review_login_attempts force row level security;
alter table public.shopee_review_sessions enable row level security;
alter table public.shopee_review_sessions force row level security;

revoke all on public.shopee_review_portal_control from public, anon, authenticated;
revoke all on public.shopee_review_login_attempts from public, anon, authenticated;
revoke all on public.shopee_review_sessions from public, anon, authenticated;

create or replace function public.consume_shopee_review_login_attempt(
  p_attempt_key text,
  p_max_attempts integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
  v_attempt_id uuid;
begin
  select count(*) into v_count
  from public.shopee_review_login_attempts
  where attempt_key = p_attempt_key
    and occurred_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max_attempts then
    insert into public.shopee_review_login_attempts (attempt_key, outcome)
    values (p_attempt_key, 'rate_limited');
    return jsonb_build_object('allowed', false);
  end if;

  insert into public.shopee_review_login_attempts (attempt_key)
  values (p_attempt_key)
  returning id into v_attempt_id;
  return jsonb_build_object('allowed', true, 'attempt_id', v_attempt_id);
end;
$$;

create or replace function public.complete_shopee_review_login_attempt(p_attempt_id uuid, p_outcome text)
returns void
language sql
set search_path = public
as $$
  update public.shopee_review_login_attempts
  set outcome = p_outcome
  where id = p_attempt_id and outcome = 'pending';
$$;

revoke all on function public.consume_shopee_review_login_attempt(text, integer, integer) from public, anon, authenticated;
revoke all on function public.complete_shopee_review_login_attempt(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_shopee_review_login_attempt(text, integer, integer) to service_role;
grant execute on function public.complete_shopee_review_login_attempt(uuid, text) to service_role;
