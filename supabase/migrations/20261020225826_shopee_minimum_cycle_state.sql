-- Prepared only: apply in a separately authorized rollout. No operational rows,
-- Scheduler configuration, account activation or existing ledger are changed.
CREATE TABLE public.shopee_cycle_state (
  channel_account_id uuid PRIMARY KEY REFERENCES public.channel_accounts(id),
  time_from bigint NOT NULL,
  time_to bigint NOT NULL CHECK (time_to > time_from),
  halted_code text,
  cursor text CHECK (length(cursor) <= 2048),
  lease_id uuid,
  lease_expires_at timestamptz,
  candidate_order_sn text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.shopee_cycle_orders (
  channel_account_id uuid NOT NULL REFERENCES public.channel_accounts(id),
  order_sn text NOT NULL CHECK (order_sn ~ '^[A-Za-z0-9]{8,100}$'),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','complete','blocked')),
  last_checked_at timestamptz,
  last_code text NOT NULL DEFAULT 'discovered' CHECK (last_code ~ '^[a-z0-9_]{1,100}$'),
  PRIMARY KEY (channel_account_id, order_sn)
);
CREATE INDEX shopee_cycle_pending ON public.shopee_cycle_orders
  (channel_account_id, last_checked_at NULLS FIRST, order_sn) WHERE state = 'pending';
ALTER TABLE public.shopee_cycle_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopee_cycle_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shopee_cycle_state, public.shopee_cycle_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.shopee_cycle_state, public.shopee_cycle_orders TO service_role;

CREATE FUNCTION public.acquire_shopee_cycle(p_channel_account_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v public.shopee_cycle_state%ROWTYPE;
  v_candidate text;
  v_now bigint := floor(extract(epoch FROM clock_timestamp()))::bigint;
BEGIN
  -- Account-specific activation policy, independent from the multi-account keys.
  IF p_channel_account_id IS DISTINCT FROM '8a8ad166-0317-4597-8be6-e43fb46b4d1b'::uuid
    OR NOT EXISTS (
      SELECT 1 FROM public.channel_accounts ca
      JOIN public.digital_platforms dp ON dp.id=ca.platform_id
      JOIN public.shopee_oauth_connections oc ON oc.channel_account_id=ca.id
      WHERE ca.id=p_channel_account_id AND ca.is_active AND ca.name='SHOPEE VIVIANE'
        AND dp.is_active AND dp.group_type='marketplace' AND dp.parent_id IS NULL
        AND lower(dp.name) LIKE 'shopee%' AND oc.environment='live'
        AND oc.shop_id=531736366 AND oc.partner_id=2047685
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
END $$;

CREATE FUNCTION public.finish_shopee_cycle(
  p_channel_account_id uuid,p_lease_id uuid,p_page jsonb,
  p_candidate_order_sn text,p_outcome text,p_code text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v public.shopee_cycle_state%ROWTYPE;
  v_sn text;
BEGIN
  SELECT * INTO v FROM public.shopee_cycle_state WHERE channel_account_id=p_channel_account_id FOR UPDATE;
  IF NOT FOUND OR v.lease_id IS DISTINCT FROM p_lease_id OR v.lease_expires_at <= clock_timestamp()
    OR p_candidate_order_sn IS DISTINCT FROM v.candidate_order_sn THEN
    RETURN jsonb_build_object('status','stale_lease');
  END IF;
  IF p_outcome IS NULL OR p_outcome NOT IN ('pending','complete','blocked')
    OR coalesce(p_code,'') !~ '^[a-z0-9_]{1,100}$' THEN
    RETURN jsonb_build_object('status','invalid_request');
  END IF;
  IF p_page IS NOT NULL AND p_page <> 'null'::jsonb THEN
    IF jsonb_typeof(p_page->'order_sns') IS DISTINCT FROM 'array'
      OR jsonb_array_length(p_page->'order_sns')>5
      OR length(p_page->>'next_cursor')>2048 THEN RETURN jsonb_build_object('status','invalid_page'); END IF;
    -- Validate ALL entries before changing cursor/queue. Only persisted exact
    -- single-order snapshots from this account may enter the recurring queue.
    FOR v_sn IN SELECT jsonb_array_elements_text(p_page->'order_sns') LOOP
      IF coalesce(v_sn,'') !~ '^[A-Za-z0-9]{8,100}$' OR NOT EXISTS (
        SELECT 1 FROM public.marketplace_raw_snapshots r
        WHERE r.channel_account_id=p_channel_account_id AND r.source='shopee_open_platform'
          AND r.environment='live' AND r.external_entity_type='order'
          AND r.endpoint='/api/v2/order/get_order_detail' AND r.external_entity_id=v_sn
          AND jsonb_typeof(r.payload#>'{response,order_list}')='array'
          AND jsonb_array_length(r.payload#>'{response,order_list}')=1
          AND r.payload#>>'{response,order_list,0,order_sn}'=v_sn
      ) THEN RETURN jsonb_build_object('status','snapshot_missing_or_mismatched'); END IF;
    END LOOP;
    INSERT INTO public.shopee_cycle_orders(channel_account_id,order_sn)
      SELECT p_channel_account_id,sn FROM jsonb_array_elements_text(p_page->'order_sns') AS t(sn)
      ON CONFLICT DO NOTHING; -- never reset complete/blocked, including uncertain
    IF p_page->>'next_cursor' IS NOT NULL THEN
      IF p_page->>'next_cursor'='' OR p_page->>'next_cursor' IS NOT DISTINCT FROM v.cursor THEN
        RAISE EXCEPTION 'cycle cursor did not advance';
      END IF;
      UPDATE public.shopee_cycle_state SET cursor=p_page->>'next_cursor' WHERE channel_account_id=p_channel_account_id;
    ELSE
      -- Overlap accommodates eventually visible updates. Fixed windows are
      -- paginated to exhaustion; long outages catch up in <=7-day windows.
      UPDATE public.shopee_cycle_state SET cursor=NULL,time_from=v.time_to-300,
        time_to=greatest(v.time_to+1,least(floor(extract(epoch FROM clock_timestamp()))::bigint-30,v.time_to+7*86400-300))
        WHERE channel_account_id=p_channel_account_id;
    END IF;
  END IF;
  UPDATE public.shopee_cycle_orders SET state=p_outcome,last_code=p_code,last_checked_at=clock_timestamp()
    WHERE channel_account_id=p_channel_account_id AND order_sn=p_candidate_order_sn;
  IF p_code IN ('token_refresh_persistence_failed','token_refresh_incomplete','token_refresh_rejected',
    'refresh_token_expired','cycle_refresh_or_discovery_uncertain') THEN
    UPDATE public.shopee_cycle_state SET halted_code=p_code WHERE channel_account_id=p_channel_account_id;
  END IF;
  UPDATE public.shopee_cycle_state SET lease_id=NULL,lease_expires_at=NULL,candidate_order_sn=NULL,updated_at=clock_timestamp()
    WHERE channel_account_id=p_channel_account_id;
  RETURN jsonb_build_object('status','finished');
END $$;
REVOKE ALL ON FUNCTION public.acquire_shopee_cycle(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_shopee_cycle(uuid,uuid,jsonb,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_shopee_cycle(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_shopee_cycle(uuid,uuid,jsonb,text,text,text) TO service_role;
