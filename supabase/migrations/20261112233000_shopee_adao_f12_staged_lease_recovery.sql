-- F12.3: recover an expired staged lease WITHOUT discarding orders or
-- bypassing the canonical per-order gate in ack_shopee_adao_f12_discovery.
-- The result is available only to the authenticated service_role through
-- the existing HMAC protected Core Bridge. No shipping/order writers.
CREATE OR REPLACE FUNCTION public.resume_shopee_adao_f12_staged(
  p_channel_account_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE v public.shopee_adao_f12_discovery_state%ROWTYPE;
BEGIN
  IF p_channel_account_id IS DISTINCT FROM 'b4027369-5abf-4ac1-ab24-862334fae892'::uuid
    OR coalesce(auth.jwt()->>'role','') IS DISTINCT FROM 'service_role' THEN
    RETURN jsonb_build_object('status','account_refused');
  END IF;
  SELECT * INTO v FROM public.shopee_adao_f12_discovery_state
    WHERE channel_account_id=p_channel_account_id FOR UPDATE;
  IF NOT FOUND OR v.phase IS DISTINCT FROM 'staged' THEN
    RETURN jsonb_build_object('status','nothing_staged');
  END IF;
  IF v.staged_pages IS NULL OR jsonb_typeof(v.staged_pages) IS DISTINCT FROM 'array'
    OR jsonb_array_length(v.staged_pages) NOT BETWEEN 1 AND 2 THEN
    RETURN jsonb_build_object('status','staged_pages_invalid');
  END IF;
  IF v.lease_expires_at > clock_timestamp() THEN
    RETURN jsonb_build_object('status','busy');
  END IF;
  UPDATE public.shopee_adao_f12_discovery_state
    SET generation=generation+1,lease_id=gen_random_uuid(),
      lease_expires_at=clock_timestamp()+interval '3 minutes',
      updated_at=clock_timestamp()
    WHERE channel_account_id=p_channel_account_id RETURNING * INTO v;
  RETURN jsonb_build_object('status','resumed','lease_id',v.lease_id,
    'generation',v.generation,'checkpoint',v.checkpoint,
    'staged_pages',v.staged_pages,'completed',v.staged_complete);
END $$;

REVOKE ALL ON FUNCTION public.resume_shopee_adao_f12_staged(uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resume_shopee_adao_f12_staged(uuid) TO service_role;
