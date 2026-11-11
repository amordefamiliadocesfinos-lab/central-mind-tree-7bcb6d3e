-- F11 / Adão: a brand-new order may be imported before becoming READY_TO_SHIP.
-- The scheduler may reconcile a later Shopee state transition, but only if
-- the canonical Core order is still operationally open. No per-order manual
-- approval list, no historical reactivation and no duplicate ship_order POST.
-- Preserve existing function signature, owner, privileges and claims ledger.
CREATE OR REPLACE FUNCTION public.claim_shopee_shipping_arrangement(p_channel_account_id uuid, p_shop_id bigint, p_order_sn text, p_package_number text, p_request_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order_ids uuid[];
  v_existing public.shopee_shipping_arrangement_attempts%ROWTYPE;
  v_created_id uuid;
BEGIN
  IF p_channel_account_id IS NULL OR p_shop_id IS NULL OR p_shop_id <= 0
     OR COALESCE(p_order_sn,'') !~ '^[A-Za-z0-9]{8,100}$'
     OR COALESCE(p_package_number,'') !~ '^[A-Za-z0-9_-]{1,100}$'
     OR COALESCE(p_request_hash,'') !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('status','invalid_request');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.channel_accounts ca
    JOIN public.digital_platforms dp ON dp.id=ca.platform_id
    WHERE ca.id=p_channel_account_id AND ca.is_active=true
      AND dp.is_active=true AND dp.group_type='marketplace'
      AND dp.parent_id IS NULL AND lower(dp.name) LIKE 'shopee%'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.shopee_oauth_connections s
    WHERE s.channel_account_id=p_channel_account_id
      AND s.shop_id=p_shop_id AND s.environment='live'
  ) THEN
    RETURN jsonb_build_object('status','account_or_shop_mismatch');
  END IF;

  SELECT array_agg(id) INTO v_order_ids FROM (
    SELECT id FROM public.orders
    WHERE channel_account_id=p_channel_account_id
      AND order_number=p_order_sn AND channel='shopee'
      AND sale_origin='shopee_open_platform' AND deleted_at IS NULL
      -- F11: for the automatically scheduled Adão writer, never claim a
      -- finalized or cancelled Core order even when the upstream Shopee
      -- snapshot still says READY_TO_SHIP. Preserve legacy other accounts.
      AND (p_channel_account_id <> 'b4027369-5abf-4ac1-ab24-862334fae892'::uuid
        OR (operational_status IN ('todo','preparing') AND status <> 'cancelado'))
    LIMIT 2
  ) valid;
  IF coalesce(array_length(v_order_ids,1),0) <> 1 THEN
    RETURN jsonb_build_object('status','order_not_unique_or_missing');
  END IF;

  -- PostgreSQL UNIQUE index arbitrates concurrent transactions atomically.
  INSERT INTO public.shopee_shipping_arrangement_attempts
    (channel_account_id,order_id,shop_id,order_sn,package_number,request_hash)
  VALUES (p_channel_account_id,v_order_ids[1],p_shop_id,p_order_sn,p_package_number,p_request_hash)
  ON CONFLICT (channel_account_id,order_sn,package_number,operation) DO NOTHING
  RETURNING id INTO v_created_id;

  IF v_created_id IS NOT NULL THEN
    RETURN jsonb_build_object('status','claimed','attempt_id',v_created_id,'fresh',true);
  END IF;

  SELECT * INTO v_existing FROM public.shopee_shipping_arrangement_attempts
  WHERE channel_account_id=p_channel_account_id
    AND order_sn=p_order_sn AND package_number=p_package_number AND operation='ship_order';

  IF v_existing.id IS NULL THEN
    RETURN jsonb_build_object('status','claim_state_unavailable');
  END IF;
  IF v_existing.order_id <> v_order_ids[1] OR v_existing.shop_id <> p_shop_id
     OR v_existing.request_hash <> p_request_hash THEN
    RETURN jsonb_build_object('status','claim_fingerprint_mismatch');
  END IF;
  -- Do not issue another request even if the previous claim never resolved.
  RETURN jsonb_build_object('status',
    CASE v_existing.state
      WHEN 'claimed' THEN 'already_claimed'
      WHEN 'succeeded' THEN 'already_succeeded'
      ELSE 'uncertain_requires_reconciliation'
    END, 'attempt_id',v_existing.id,'fresh',false);
END;
$function$

