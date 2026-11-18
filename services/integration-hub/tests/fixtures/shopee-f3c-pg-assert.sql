-- F3-C isolated DB verification; never execute on production.
insert into public.shopee_oauth_shop_authorizations
 (channel_account_id,partner_id,shop_id,authorized_by_auth_user_id,is_enabled)
values
 ('22222222-2222-4222-8222-222222222222',2047685,1357031949,
 '11111111-1111-4111-8111-111111111111',true);
-- Existing F3B test left grant for the approved account active.
insert into public.shopee_oauth_handoffs
 (ticket_hash,auth_user_id,channel_account_id,partner_id,expires_at)
values
 (repeat('e',64),'11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222',2047685,now()+interval '60 seconds');
set role service_role;
do $$
declare v_id uuid; v_shop bigint; v_actor uuid; n int; ok boolean;
begin
  select count(*),max(channel_account_id::text)::uuid,max(shop_id),max(auth_user_id::text)::uuid
  into n,v_id,v_shop,v_actor
  from public.consume_shopee_oauth_handoff(repeat('e',64));
  if n <> 1 or v_shop <> 1357031949 or v_id <> '22222222-2222-4222-8222-222222222222'::uuid
    or v_actor <> '11111111-1111-4111-8111-111111111111'::uuid then
    raise exception 'approved handoff did not resolve approved shop';
  end if;
  select count(*) into n from public.consume_shopee_oauth_handoff(repeat('e',64));
  if n <> 0 then raise exception 'handoff replay accepted'; end if;
  select public.create_shopee_universal_oauth_state(
    repeat('1',64),v_actor,v_id,2047685,1357031949,now()+interval '8 minutes'
  ) into ok;
  if ok is distinct from true then raise exception 'state creation rejected approved context'; end if;
  select count(*) into n from public.resolve_shopee_universal_oauth_state(repeat('1',64));
  if n <> 0 then raise exception 'unconsumed state resolved'; end if;
  update public.shopee_oauth_states set used_at=now() where state_hash=repeat('1',64);
  select count(*) into n from public.resolve_shopee_universal_oauth_state(repeat('1',64))
  where channel_account_id=v_id and shop_id=v_shop and auth_user_id=v_actor;
  if n <> 1 then raise exception 'consumed bound state not resolved'; end if;
  select public.create_shopee_universal_oauth_state(
    repeat('2',64),v_actor,v_id,2047685,987654321,now()+interval '8 minutes'
  ) into ok;
  if ok is distinct from false then raise exception 'unapproved shop accepted'; end if;
end $$;
reset role;
-- Disabling approval after starting must invalidate its callback.
update public.shopee_oauth_shop_authorizations set is_enabled=false
where shop_id=1357031949;
set role service_role;
do $$
declare n int;
begin
  select count(*) into n from public.resolve_shopee_universal_oauth_state(repeat('1',64));
  if n <> 0 then raise exception 'revoked shop approval still resolved'; end if;
end $$;
reset role;
select 'F3C_DISPOSABLE_PG_PASS' as result;
