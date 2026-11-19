-- Disposable-only test: run after F3B/F3C setup and migrations.
create table public.shopee_oauth_connections (
 id uuid primary key default gen_random_uuid(),
 channel_account_id uuid not null references public.channel_accounts(id),
 environment text not null,
 partner_id bigint not null,shop_id bigint not null,
 access_token_ciphertext text not null, refresh_token_ciphertext text not null,
 access_token_expires_at timestamptz, refresh_token_expires_at timestamptz,
 last_refreshed_at timestamptz,updated_at timestamptz
);
alter table public.shopee_oauth_connections enable row level security;
grant select,insert,update on public.shopee_oauth_connections to service_role;
insert into public.shopee_oauth_account_grants(auth_user_id,channel_account_id,granted_by_auth_user_id)
values('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111');
insert into public.shopee_oauth_shop_authorizations
(channel_account_id,partner_id,shop_id,authorized_by_auth_user_id,is_enabled)
values ('22222222-2222-4222-8222-222222222222',2047685,1357031949,
'11111111-1111-4111-8111-111111111111',true);
insert into public.shopee_oauth_connections
(channel_account_id,environment,partner_id,shop_id,access_token_ciphertext,refresh_token_ciphertext,
 access_token_expires_at,refresh_token_expires_at)
values ('22222222-2222-4222-8222-222222222222','live',2047685,1357031949,'old-access','old-refresh',
now()+interval '2 hours',now()+interval '20 days');
set role service_role;
do $$
declare ok boolean; current_refresh text;
begin
 select public.refresh_shopee_oauth_connection_if_current(
 '22222222-2222-4222-8222-222222222222',2047685,1357031949,
 'old-refresh','new-access','new-refresh',now()+interval '4 hours',
 now()+interval '29 days',now()) into ok;
 if ok is distinct from true then raise exception 'valid CAS rejected'; end if;
 select public.refresh_shopee_oauth_connection_if_current(
 '22222222-2222-4222-8222-222222222222',2047685,1357031949,
 'old-refresh','stale-access','stale-refresh',now()+interval '4 hours',
 now()+interval '29 days',now()) into ok;
 if ok is distinct from false then raise exception 'stale CAS accepted'; end if;
 select refresh_token_ciphertext into current_refresh from public.shopee_oauth_connections
 where channel_account_id='22222222-2222-4222-8222-222222222222';
 if current_refresh <> 'new-refresh' then raise exception 'new refresh overwritten'; end if;
 select public.refresh_shopee_oauth_connection_if_current(
 '22222222-2222-4222-8222-222222222222',2047685,531736366,
 'new-refresh','wrong-access','wrong-refresh',now()+interval '4 hours',
 now()+interval '29 days',now()) into ok;
 if ok is distinct from false then raise exception 'wrong shop accepted'; end if;
end $$;
reset role;
update public.shopee_oauth_shop_authorizations set is_enabled=false
where shop_id=1357031949;
set role service_role;
do $$
declare ok boolean;
begin
 select public.refresh_shopee_oauth_connection_if_current(
 '22222222-2222-4222-8222-222222222222',2047685,1357031949,
 'new-refresh','revoked-access','revoked-refresh',now()+interval '4 hours',
 now()+interval '29 days',now()) into ok;
 if ok is distinct from false then raise exception 'revoked shop accepted'; end if;
end $$;
reset role;
select 'F3D_DISPOSABLE_PG_PASS' as result;
