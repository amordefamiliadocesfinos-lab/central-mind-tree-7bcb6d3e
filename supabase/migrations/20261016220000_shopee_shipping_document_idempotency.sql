-- F6-O.2e.3 — prepared only. Apply to official Lovable Cloud in a separate approved window.
-- Durable claim for ONE Shopee document task per account/order/package/type.
-- Never infer an unsuccessful task creation from a timeout. Claims never expire.
CREATE TABLE public.shopee_shipping_document_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_account_id uuid NOT NULL REFERENCES public.channel_accounts(id),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  shop_id bigint NOT NULL CHECK (shop_id > 0),
  order_sn text NOT NULL CHECK (order_sn ~ '^[A-Za-z0-9]{8,100}$'),
  package_number text NOT NULL CHECK (package_number ~ '^[A-Za-z0-9_-]{1,100}$'),
  operation text NOT NULL DEFAULT 'create_shipping_document' CHECK (operation = 'create_shipping_document'),
  document_type text NOT NULL CHECK (document_type = 'NORMAL_AIR_WAYBILL'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  state text NOT NULL DEFAULT 'claimed'
    CHECK (state IN ('claimed','succeeded','uncertain')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  outcome_source text CHECK (outcome_source IS NULL OR outcome_source IN ('api_success','transport_uncertain')),
  CONSTRAINT shopee_document_attempt_scope_unique UNIQUE (channel_account_id,order_sn,package_number,document_type,operation),
  CONSTRAINT shopee_document_attempt_resolution CHECK (
    (state = 'claimed' AND resolved_at IS NULL AND outcome_source IS NULL)
    OR (state = 'succeeded' AND resolved_at IS NOT NULL AND outcome_source = 'api_success')
    OR (state = 'uncertain' AND resolved_at IS NOT NULL AND outcome_source = 'transport_uncertain')
  )
);

-- No browser access, even if future default grants are permissive.
ALTER TABLE public.shopee_shipping_document_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shopee_shipping_document_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE ON public.shopee_shipping_document_attempts TO service_role;

CREATE FUNCTION public.claim_shopee_shipping_document(
  p_channel_account_id uuid, p_shop_id bigint,
  p_order_sn text, p_package_number text, p_document_type text, p_request_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_ids uuid[];
  v_existing public.shopee_shipping_document_attempts%ROWTYPE;
  v_created_id uuid;
  v_document_ids uuid[];
BEGIN
  IF p_document_type IS NULL OR p_document_type <> 'NORMAL_AIR_WAYBILL' OR p_channel_account_id IS NULL OR p_shop_id IS NULL OR p_shop_id <= 0
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
    LIMIT 2
  ) valid;
  IF coalesce(array_length(v_order_ids,1),0) <> 1 THEN
    RETURN jsonb_build_object('status','order_not_unique_or_missing');
  END IF;

  SELECT array_agg(id) INTO v_document_ids FROM public.order_documents
  WHERE order_id=v_order_ids[1] AND document_type='shipping_label';
  IF coalesce(array_length(v_document_ids,1),0) = 1 THEN
    -- Do not declare an arbitrary attachment to be the requested official PDF.
    -- Existing READY tasks reuse the synchronizer's strict Storage locator.
    RETURN jsonb_build_object('status','existing_document_requires_reconciliation');
  ELSIF coalesce(array_length(v_document_ids,1),0) > 1 THEN
    RETURN jsonb_build_object('status','duplicate_documents_require_reconciliation');
  END IF;

  -- PostgreSQL UNIQUE index arbitrates concurrent transactions atomically.
  INSERT INTO public.shopee_shipping_document_attempts
    (channel_account_id,order_id,shop_id,order_sn,package_number,document_type,request_hash)
  VALUES (p_channel_account_id,v_order_ids[1],p_shop_id,p_order_sn,p_package_number,p_document_type,p_request_hash)
  ON CONFLICT (channel_account_id,order_sn,package_number,document_type,operation) DO NOTHING
  RETURNING id INTO v_created_id;

  IF v_created_id IS NOT NULL THEN
    RETURN jsonb_build_object('status','claimed','attempt_id',v_created_id,'fresh',true);
  END IF;

  SELECT * INTO v_existing FROM public.shopee_shipping_document_attempts
  WHERE channel_account_id=p_channel_account_id
    AND order_sn=p_order_sn AND package_number=p_package_number AND document_type=p_document_type AND operation='create_shipping_document';

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
$$;

CREATE FUNCTION public.resolve_shopee_shipping_document(
  p_attempt_id uuid, p_request_hash text, p_outcome text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.shopee_shipping_document_attempts%ROWTYPE;
  v_target text;
  v_source text;
BEGIN
  IF p_attempt_id IS NULL OR coalesce(p_request_hash,'') !~ '^[0-9a-f]{64}$'
     OR p_outcome IS NULL OR p_outcome NOT IN ('succeeded','uncertain') THEN
    RETURN jsonb_build_object('status','invalid_request');
  END IF;
  v_target := p_outcome;
  v_source := CASE v_target WHEN 'succeeded' THEN 'api_success' ELSE 'transport_uncertain' END;

  SELECT * INTO v_existing FROM public.shopee_shipping_document_attempts
  WHERE id=p_attempt_id FOR UPDATE;
  IF v_existing.id IS NULL THEN
    RETURN jsonb_build_object('status','attempt_missing');
  END IF;
  IF v_existing.request_hash <> p_request_hash THEN
    RETURN jsonb_build_object('status','claim_fingerprint_mismatch');
  END IF;
  IF v_existing.state = v_target THEN
    RETURN jsonb_build_object('status','already_resolved','state',v_existing.state);
  END IF;
  IF v_existing.state <> 'claimed' THEN
    RETURN jsonb_build_object('status','transition_forbidden','state',v_existing.state);
  END IF;
  UPDATE public.shopee_shipping_document_attempts
  SET state=v_target, resolved_at=now(), outcome_source=v_source
  WHERE id=p_attempt_id;
  RETURN jsonb_build_object('status','resolved','state',v_target);
END;
$$;

-- SECURITY DEFINER does not mean callable by browsers: revoke default PUBLIC execute.
REVOKE ALL ON FUNCTION public.claim_shopee_shipping_document(uuid,bigint,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_shopee_shipping_document(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_shopee_shipping_document(uuid,bigint,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_shopee_shipping_document(uuid,text,text) TO service_role;
