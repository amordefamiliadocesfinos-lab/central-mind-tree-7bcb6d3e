-- Execute after fixture + grants/handoff migrations, in disposable PostgreSQL only.
insert into public.shopee_oauth_account_grants(auth_user_id,channel_account_id,granted_by_auth_user_id)
values ('11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111');
insert into public.shopee_oauth_handoffs(ticket_hash,auth_user_id,channel_account_id,partner_id,expires_at)
values (repeat('a',64),'11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222',2047685,now()+interval '60 seconds');
set role service_role;
do $$
declare v_id uuid; n int;
begin
 select count(*), max(channel_account_id) into n,v_id from public.consume_shopee_oauth_handoff(repeat('a',64));
 if n <> 1 or v_id <> '22222222-2222-4222-8222-222222222222'::uuid then raise exception 'valid ticket did not consume'; end if;
 select count(*) into n from public.consume_shopee_oauth_handoff(repeat('a',64));
 if n <> 0 then raise exception 'replay accepted'; end if;
end $$;
reset role;

-- Revoked grant before consumption: must reject.
insert into public.shopee_oauth_handoffs(ticket_hash,auth_user_id,channel_account_id,partner_id,expires_at)
values (repeat('b',64),'11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222',2047685,now()+interval '60 seconds');
delete from public.shopee_oauth_account_grants where channel_account_id='22222222-2222-4222-8222-222222222222';
set role service_role;
do $$
declare n int;
begin
 select count(*) into n from public.consume_shopee_oauth_handoff(repeat('b',64));
 if n <> 0 then raise exception 'revoked grant accepted'; end if;
end $$;
reset role;

-- Non-Shopee account: even with explicit grant it cannot consume.
insert into public.shopee_oauth_account_grants(auth_user_id,channel_account_id,granted_by_auth_user_id)
values ('11111111-1111-4111-8111-111111111111',
 '55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111');
insert into public.shopee_oauth_handoffs(ticket_hash,auth_user_id,channel_account_id,partner_id,expires_at)
values (repeat('c',64),'11111111-1111-4111-8111-111111111111',
 '55555555-5555-4555-8555-555555555555',2047685,now()+interval '60 seconds');
set role service_role;
do $$
declare n int;
begin
 select count(*) into n from public.consume_shopee_oauth_handoff(repeat('c',64));
 if n <> 0 then raise exception 'non-Shopee account accepted'; end if;
end $$;
reset role;

-- Expired ticket stays unconsumed and cannot be accepted.
insert into public.shopee_oauth_account_grants(auth_user_id,channel_account_id,granted_by_auth_user_id)
values ('11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111');
insert into public.shopee_oauth_handoffs(ticket_hash,auth_user_id,channel_account_id,partner_id,created_at,expires_at)
values (repeat('d',64),'11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222',2047685,now()-interval '120 seconds',now()-interval '60 seconds');
set role service_role;
do $$
declare n int;
begin
 select count(*) into n from public.consume_shopee_oauth_handoff(repeat('d',64));
 if n <> 0 then raise exception 'expired ticket accepted'; end if;
end $$;
reset role;
select 'F3B_DISPOSABLE_PG_PASS' as result;
