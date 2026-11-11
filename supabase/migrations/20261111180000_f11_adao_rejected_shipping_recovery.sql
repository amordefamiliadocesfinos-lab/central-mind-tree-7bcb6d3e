-- F11: narrowly bounded recovery of two observed Shopee API rejections.
-- Structural preparation only: authorizations start DISABLED and cannot ship.
-- Preserve the two original uncertain attempts, hashes, timestamps, evidence.
-- Any later enabling requires verifying current Shopee READY_TO_SHIP and
-- specifically choosing the two approved original attempts.
ALTER TABLE public.shopee_shipping_arrangement_attempts
  ADD COLUMN attempt_sequence smallint NOT NULL DEFAULT 1
    CHECK (attempt_sequence BETWEEN 1 AND 2);

ALTER TABLE public.shopee_shipping_arrangement_attempts
  DROP CONSTRAINT shopee_ship_attempt_scope_unique;

ALTER TABLE public.shopee_shipping_arrangement_attempts
  ADD CONSTRAINT shopee_ship_attempt_scope_sequence_unique
  UNIQUE(channel_account_id,order_sn,package_number,operation,attempt_sequence);

CREATE TABLE public.shopee_shipping_arrangement_recovery_approvals (
  original_attempt_id uuid PRIMARY KEY REFERENCES public.shopee_shipping_arrangement_attempts(id),
  api_error_code text NOT NULL CHECK (api_error_code = 'logistics.ship_order_not_need_pacakge_number'),
  enabled boolean NOT NULL DEFAULT false,
  consumed boolean NOT NULL DEFAULT false,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recovery_consumption_consistent CHECK ((NOT consumed AND consumed_at IS NULL)
    OR (consumed AND consumed_at IS NOT NULL))
);
ALTER TABLE public.shopee_shipping_arrangement_recovery_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shopee_shipping_arrangement_recovery_approvals FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE ON public.shopee_shipping_arrangement_recovery_approvals TO service_role;

-- Two known API rejections evidenced by independently captured structured
-- Cloud Run body_read logs and current READY_TO_SHIP Seller screenshots.
INSERT INTO public.shopee_shipping_arrangement_recovery_approvals (original_attempt_id,api_error_code)
SELECT id, 'logistics.ship_order_not_need_pacakge_number'
FROM public.shopee_shipping_arrangement_attempts
WHERE id IN ('56bda5e6-e72b-49b7-902d-2ffc0997a17a'::uuid,
             '5a62107c-c500-4406-abe5-19c4c88baa25'::uuid)
  AND channel_account_id='b4027369-5abf-4ac1-ab24-862334fae892'::uuid
  AND state='uncertain' AND outcome_source='transport_uncertain';

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
  v_approved boolean;
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
    (channel_account_id,order_id,shop_id,order_sn,package_number,request_hash,attempt_sequence)
  VALUES (p_channel_account_id,v_order_ids[1],p_shop_id,p_order_sn,p_package_number,p_request_hash,1)
  ON CONFLICT (channel_account_id,order_sn,package_number,operation,attempt_sequence) DO NOTHING
  RETURNING id INTO v_created_id;

  IF v_created_id IS NOT NULL THEN
    RETURN jsonb_build_object('status','claimed','attempt_id',v_created_id,'fresh',true);
  END IF;

  SELECT * INTO v_existing FROM public.shopee_shipping_arrangement_attempts
  WHERE channel_account_id=p_channel_account_id
    AND order_sn=p_order_sn AND package_number=p_package_number AND operation='ship_order'
  ORDER BY attempt_sequence DESC
  LIMIT 1
  FOR UPDATE;

  IF v_existing.id IS NULL THEN
    RETURN jsonb_build_object('status','claim_state_unavailable');
  END IF;
  IF v_existing.order_id <> v_order_ids[1] OR v_existing.shop_id <> p_shop_id THEN
    RETURN jsonb_build_object('status','claim_fingerprint_mismatch');
  END IF;

  -- Exactly one follow-up may be claimed after a confirmed Shopee API
  -- rejection and a separately enabled, order-specific recovery approval.
  -- Old row is never deleted/reset; its request hash must differ.
  -- RLS/roles and unique index make this atomic across all schedulers.
  IF v_existing.attempt_sequence=1 AND v_existing.state='uncertain'
     AND p_channel_account_id='b4027369-5abf-4ac1-ab24-862334fae892'::uuid
     AND v_existing.request_hash <> p_request_hash THEN
    SELECT ar.enabled AND NOT ar.consumed INTO v_approved
    FROM public.shopee_shipping_arrangement_recovery_approvals ar
    WHERE ar.original_attempt_id=v_existing.id
      AND ar.api_error_code='logistics.ship_order_not_need_pacakge_number'
    FOR UPDATE;
    IF COALESCE(v_approved,false) THEN
      INSERT INTO public.shopee_shipping_arrangement_attempts
        (channel_account_id,order_id,shop_id,order_sn,package_number,request_hash,attempt_sequence)
      VALUES (p_channel_account_id,v_order_ids[1],p_shop_id,p_order_sn,p_package_number,p_request_hash,2)
      ON CONFLICT (channel_account_id,order_sn,package_number,operation,attempt_sequence) DO NOTHING
      RETURNING id INTO v_created_id;
      IF v_created_id IS NOT NULL THEN
        UPDATE public.shopee_shipping_arrangement_recovery_approvals
        SET consumed=true, consumed_at=now()
        WHERE original_attempt_id=v_existing.id;
        RETURN jsonb_build_object('status','claimed','attempt_id',v_created_id,'fresh',true);
      END IF;
    END IF;
  END IF;

  IF v_existing.request_hash <> p_request_hash THEN
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
$function$;
-- Default function execute permissions from original migration remain revoked.
REVOKE ALL ON FUNCTION public.claim_shopee_shipping_arrangement(uuid,bigint,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_shopee_shipping_arrangement(uuid,bigint,text,text,text) TO service_role;
