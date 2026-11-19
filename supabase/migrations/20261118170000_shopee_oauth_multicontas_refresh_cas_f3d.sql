-- F3-D: atomic compare-and-swap for per-account Shopee OAuth refresh.
-- No grants, jobs, schedules or refresh attempts are created by this migration.
create or replace function public.refresh_shopee_oauth_connection_if_current(
  p_channel_account_id uuid,
  p_partner_id bigint,
  p_shop_id bigint,
  p_expected_refresh_ciphertext text,
  p_access_ciphertext text,
  p_refresh_ciphertext text,
  p_access_expires_at timestamptz,
  p_refresh_expires_at timestamptz,
  p_refreshed_at timestamptz
) returns boolean language plpgsql security invoker set search_path = ''
as $$
declare v_id uuid;
begin
  if p_partner_id <> 2047685 or p_shop_id <= 0
    or p_expected_refresh_ciphertext is null or p_expected_refresh_ciphertext = ''
    or p_access_ciphertext is null or p_access_ciphertext = ''
    or p_refresh_ciphertext is null or p_refresh_ciphertext = ''
    or p_access_expires_at <= now() or p_refresh_expires_at <= now()
  then return false; end if;

  update public.shopee_oauth_connections c
  set access_token_ciphertext = p_access_ciphertext,
      refresh_token_ciphertext = p_refresh_ciphertext,
      access_token_expires_at = p_access_expires_at,
      refresh_token_expires_at = p_refresh_expires_at,
      last_refreshed_at = p_refreshed_at,
      updated_at = now()
  from public.shopee_oauth_shop_authorizations a
  join public.channel_accounts ch on ch.id = a.channel_account_id
  join public.digital_platforms dp on dp.id = ch.platform_id
  where c.channel_account_id = p_channel_account_id
    and c.environment = 'live'
    and c.partner_id = p_partner_id
    and c.shop_id = p_shop_id
    and c.refresh_token_ciphertext = p_expected_refresh_ciphertext
    and a.channel_account_id = c.channel_account_id
    and a.environment = 'live' and a.is_enabled = true
    and a.partner_id = c.partner_id and a.shop_id = c.shop_id
    and ch.is_active = true and dp.is_active = true
    and dp.group_type = 'marketplace' and dp.parent_id is null
    and lower(dp.name) like 'shopee%'
  returning c.id into v_id;

  return v_id is not null;
end;
$$;
revoke all on function public.refresh_shopee_oauth_connection_if_current(
  uuid,bigint,bigint,text,text,text,timestamptz,timestamptz,timestamptz
) from public,anon,authenticated;
grant execute on function public.refresh_shopee_oauth_connection_if_current(
  uuid,bigint,bigint,text,text,text,timestamptz,timestamptz,timestamptz
) to service_role;
