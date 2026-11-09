-- F5-U2/U3: Extend the EXISTING account-scoped cycle lease to Adão.
-- No scheduler, grants, data backfill or environment activation here.
-- Existing Viviane identity and SQL lease semantics stay unchanged.
CREATE OR REPLACE FUNCTION public.acquire_shopee_cycle(p_channel_account_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v public.shopee_cycle_state%ROWTYPE;
  v_candidate text;
  v_now bigint := floor(extract(epoch FROM clock_timestamp()))::bigint;
BEGIN
  -- Account-specific activation policy, independent from the multi-account keys.
  IF NOT EXISTS (
      SELECT 1 FROM public.channel_accounts ca
      JOIN public.digital_platforms dp ON dp.id=ca.platform_id
      JOIN public.shopee_oauth_connections oc ON oc.channel_account_id=ca.id
      WHERE ca.id=p_channel_account_id AND ca.is_active
        AND dp.id=ca.platform_id AND dp.is_active
        AND dp.group_type='marketplace' AND dp.parent_id IS NULL
        AND lower(dp.name) LIKE 'shopee%'
        AND oc.environment='live' AND oc.partner_id=2047685
        AND (
          (ca.id='8a8ad166-0317-4597-8be6-e43fb46b4d1b'::uuid
           AND ca.name='SHOPEE VIVIANE' AND oc.shop_id=531736366)
          OR
          (ca.id='b4027369-5abf-4ac1-ab24-862334fae892'::uuid
           AND ca.name='SHOPEE ADÃO' AND oc.shop_id=1156446003)
        )
    ) THEN RETURN jsonb_build_object('status','account_refused'); END IF;
  INSERT INTO public.shopee_cycle_state(channel_account_id,time_from,time_to)
    VALUES(p_channel_account_id,v_now-7*86400,v_now-30) ON CONFLICT DO NOTHING;
  SELECT * INTO v FROM public.shopee_cycle_state
    WHERE channel_account_id=p_channel_account_id FOR UPDATE;
  IF v.halted_code IS NOT NULL THEN RETURN jsonb_build_object('status','account_halted'); END IF;
  IF v.lease_expires_at > clock_timestamp() THEN RETURN jsonb_build_object('status','busy'); END IF;
  -- Expiration releases only the worker lease. Document claims NEVER expire.
  -- A dead worker's selected order is quarantined, not retried automatically.
  IF v.candidate_order_sn IS NOT NULL THEN
    UPDATE public.shopee_cycle_orders SET state='blocked',last_code='worker_lost_requires_review'
      WHERE channel_account_id=p_channel_account_id AND order_sn=v.candidate_order_sn;
  END IF;
  SELECT q.order_sn INTO v_candidate FROM public.shopee_cycle_orders q
    WHERE q.channel_account_id=p_channel_account_id AND q.state='pending'
    ORDER BY q.last_checked_at NULLS FIRST,q.order_sn LIMIT 1;
  UPDATE public.shopee_cycle_orders SET last_checked_at=clock_timestamp()
    WHERE channel_account_id=p_channel_account_id AND order_sn=v_candidate;
  UPDATE public.shopee_cycle_state SET lease_id=gen_random_uuid(),
    lease_expires_at=clock_timestamp()+interval '5 minutes',candidate_order_sn=v_candidate,updated_at=clock_timestamp()
    WHERE channel_account_id=p_channel_account_id RETURNING * INTO v;
  RETURN jsonb_build_object('status','acquired','lease_id',v.lease_id,'expires_at',v.lease_expires_at,
    'time_from',v.time_from,'time_to',v.time_to,'cursor',v.cursor,'candidate_order_sn',v_candidate);
END $function$
;
