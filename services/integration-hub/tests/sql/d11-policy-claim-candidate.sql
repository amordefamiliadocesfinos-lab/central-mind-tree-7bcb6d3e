-- D11 disposable candidate; no production migration, route or external POST.
-- Serialize policy-bound claims on the EXISTING account state row. The future
-- authenticated policy writer must append revisions while holding this same lock.
-- Existing durable ledgers still arbitrate uniqueness and uncertain outcomes.
CREATE FUNCTION public.claim_shopee_cycle_effect(
  p_channel_account_id uuid,p_lease_id uuid,p_revision integer,p_action text,
  p_shop_id bigint,p_order_sn text,p_package_number text,p_request_hash text,p_observation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE
  v public.shopee_cycle_state%ROWTYPE;
  p jsonb; r jsonb; o jsonb; pkg jsonb; e jsonb;
  n bigint; valid_count bigint;
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('ship','label')
    OR p_channel_account_id IS NULL OR p_lease_id IS NULL OR p_revision IS NULL OR p_revision<1
    OR p_observation_id IS NULL OR p_shop_id IS NULL OR p_shop_id<=0
    OR coalesce(p_order_sn,'') !~ '^[A-Za-z0-9]{8,100}$'
    OR coalesce(p_package_number,'') !~ '^[A-Za-z0-9_-]{1,100}$'
    OR coalesce(p_request_hash,'') !~ '^[0-9a-f]{64}$'
  THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
  -- Do not change the established legacy Adão/Viviane paths or inherit a
  -- historical recovery exception. Their future migration is separate.
  IF p_channel_account_id IN ('8a8ad166-0317-4597-8be6-e43fb46b4d1b'::uuid,
    'b4027369-5abf-4ac1-ab24-862334fae892'::uuid)
  THEN RETURN jsonb_build_object('status','policy_legacy_scope_refused'); END IF;
  SELECT * INTO v FROM public.shopee_cycle_state WHERE channel_account_id=p_channel_account_id FOR UPDATE;
  IF NOT FOUND OR v.lease_id IS DISTINCT FROM p_lease_id
    OR v.lease_policy_revision IS DISTINCT FROM p_revision
    OR v.lease_expires_at IS NULL OR v.lease_expires_at<=clock_timestamp()
    OR v.halted_code IS NOT NULL OR v.candidate_order_sn IS DISTINCT FROM p_order_sn
  THEN RETURN jsonb_build_object('status','policy_lease_refused'); END IF;
  p:=public.admit_shopee_cycle_policy(p_channel_account_id,p_action);
  IF p IS NULL OR (p->>'revision')::integer IS DISTINCT FROM p_revision
    OR (p->>'shop_id')::bigint IS DISTINCT FROM p_shop_id
  THEN RETURN jsonb_build_object('status','policy_admission_refused'); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.shopee_cycle_orders
    WHERE channel_account_id=p_channel_account_id AND order_sn=p_order_sn AND state='pending')
  THEN RETURN jsonb_build_object('status','policy_candidate_refused'); END IF;
  -- Do not confuse canonical absence with deletion, duplicates or finalized work.
  SELECT count(*),count(*) FILTER(WHERE sale_origin='shopee_open_platform'
    AND deleted_at IS NULL AND status NOT IN ('cancelado','finalizado')
    AND operational_status IN ('todo','preparing')) INTO n,valid_count
  FROM public.orders WHERE channel_account_id=p_channel_account_id AND channel='shopee' AND order_number=p_order_sn;
  IF n<>1 OR valid_count<>1 THEN RETURN jsonb_build_object('status','policy_canonical_order_refused'); END IF;
  -- Current receipt is mandatory and must match the exact evidence selected
  -- by the worker. No fallback to the Raw's original timestamp.
  e:=public.read_shopee_cycle_observation(p_channel_account_id,p_lease_id,p_revision,p_action);
  IF e IS NULL OR e->>'observation_id' IS DISTINCT FROM p_observation_id::text
    OR e->>'channel_account_id' IS DISTINCT FROM p_channel_account_id::text
    OR e->>'shop_id' IS DISTINCT FROM p_shop_id::text
    OR e->>'order_sn' IS DISTINCT FROM p_order_sn
  THEN RETURN jsonb_build_object('status','policy_observation_refused'); END IF;
  r:=e->'payload';
  IF jsonb_typeof(r#>'{response,order_list}') IS DISTINCT FROM 'array'
  THEN RETURN jsonb_build_object('status','policy_raw_identity_refused'); END IF;
  IF jsonb_array_length(r#>'{response,order_list}')<>1
  THEN RETURN jsonb_build_object('status','policy_raw_identity_refused'); END IF;
  o:=r#>'{response,order_list,0}';
  IF o->>'order_sn' IS DISTINCT FROM p_order_sn
     OR jsonb_typeof(o->'create_time') IS DISTINCT FROM 'number'
     OR coalesce(o->>'create_time','') !~ '^[0-9]{1,12}$'
     OR jsonb_typeof(o->'package_list') IS DISTINCT FROM 'array'
     OR jsonb_typeof(o->'split_up') IS DISTINCT FROM 'boolean'
  THEN RETURN jsonb_build_object('status','policy_raw_identity_refused'); END IF;
  IF (o->>'create_time')::bigint <= (p->>'history_cutoff')::bigint
    OR (o->>'create_time')::bigint > floor(extract(epoch FROM clock_timestamp()))
    OR jsonb_array_length(o->'package_list')<>1
  THEN RETURN jsonb_build_object('status','policy_history_or_package_refused'); END IF;
  pkg:=o->'package_list'->0;
  IF pkg->>'package_number' IS DISTINCT FROM p_package_number
  THEN RETURN jsonb_build_object('status','policy_history_or_package_refused'); END IF;
  IF p_action='ship' AND (o->>'order_status' IS DISTINCT FROM 'READY_TO_SHIP'
       OR pkg->>'logistics_status' IS DISTINCT FROM 'LOGISTICS_READY')
  THEN RETURN jsonb_build_object('status','policy_external_state_refused'); END IF;
  IF p_action='label' AND (o->>'order_status' IS DISTINCT FROM 'PROCESSED'
       OR pkg->>'logistics_status' IS DISTINCT FROM 'LOGISTICS_REQUEST_CREATED')
  THEN RETURN jsonb_build_object('status','policy_external_state_refused'); END IF;
  -- A changed package cannot silently bypass a previous durable attempt.
  IF EXISTS(SELECT 1 FROM public.shopee_shipping_arrangement_attempts
      WHERE channel_account_id=p_channel_account_id AND order_sn=p_order_sn
        AND (package_number<>p_package_number OR shop_id<>p_shop_id))
    OR EXISTS(SELECT 1 FROM public.shopee_shipping_document_attempts
      WHERE channel_account_id=p_channel_account_id AND order_sn=p_order_sn
        AND (package_number<>p_package_number OR shop_id<>p_shop_id))
  THEN RETURN jsonb_build_object('status','policy_prior_scope_requires_reconciliation'); END IF;
  -- Recheck immediately before claim under the same state-row lock. A committed
  -- claim authorizes one in-flight attempt, not immunity to later revocation.
  IF NOT public.check_shopee_cycle_policy_lease(p_channel_account_id,p_lease_id,p_revision,p_action)
  THEN RETURN jsonb_build_object('status','policy_lease_refused'); END IF;
  e:=public.read_shopee_cycle_observation(p_channel_account_id,p_lease_id,p_revision,p_action);
  IF e IS NULL OR e->>'observation_id' IS DISTINCT FROM p_observation_id::text
  THEN RETURN jsonb_build_object('status','policy_observation_refused'); END IF;
  IF p_action='ship' THEN
    RETURN public.claim_shopee_shipping_arrangement(p_channel_account_id,p_shop_id,p_order_sn,p_package_number,p_request_hash);
  END IF;
  RETURN public.claim_shopee_shipping_document(p_channel_account_id,p_shop_id,p_order_sn,p_package_number,'NORMAL_AIR_WAYBILL',p_request_hash);
END $$;
REVOKE ALL ON FUNCTION public.claim_shopee_cycle_effect(uuid,uuid,integer,text,bigint,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_shopee_cycle_effect(uuid,uuid,integer,text,bigint,text,text,text,uuid) TO service_role;
