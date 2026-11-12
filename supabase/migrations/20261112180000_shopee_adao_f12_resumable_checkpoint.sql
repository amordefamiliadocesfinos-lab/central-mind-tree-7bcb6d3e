-- F12.3 ADÃO ONLY. Staging contract; no production runner enabled.
-- Uses verified PostgREST JWT role via auth.jwt(), and REVOKE/GRANT RPC allowlist.
-- Do not replace this with session_user/current_user inside SECURITY DEFINER.
-- Isolated read-only discovery staging; no order, shipping, label or stock writes.
CREATE TABLE IF NOT EXISTS public.shopee_adao_f12_discovery_state (
  channel_account_id uuid PRIMARY KEY
    CHECK (channel_account_id = 'b4027369-5abf-4ac1-ab24-862334fae892'::uuid),
  shop_id bigint NOT NULL DEFAULT 1156446003 CHECK (shop_id = 1156446003),
  generation bigint NOT NULL DEFAULT 0 CHECK (generation >= 0),
  lease_id uuid,
  lease_expires_at timestamptz,
  phase text NOT NULL DEFAULT 'idle' CHECK (phase IN ('idle','reading','staged')),
  checkpoint jsonb,
  staged_pages jsonb,
  staged_complete boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT f12_staging_consistent CHECK (
    (phase='staged' AND staged_pages IS NOT NULL AND jsonb_typeof(staged_pages)='array')
    OR (phase<>'staged' AND staged_pages IS NULL AND NOT staged_complete)
  )
);
ALTER TABLE public.shopee_adao_f12_discovery_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shopee_adao_f12_discovery_state FROM PUBLIC, anon, authenticated;
-- All changes must go through the fenced RPC contract (including service_role).
REVOKE ALL ON public.shopee_adao_f12_discovery_state FROM service_role;

-- Acquire a lease under row lock. Staged work NEVER automatically expires into
-- another worker: manual reconciliation is required before any later phase.
CREATE OR REPLACE FUNCTION public.acquire_shopee_adao_f12_discovery(p_channel_account_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE v public.shopee_adao_f12_discovery_state%ROWTYPE;
BEGIN
  IF p_channel_account_id IS DISTINCT FROM 'b4027369-5abf-4ac1-ab24-862334fae892'::uuid
     OR coalesce(auth.jwt()->>'role', '') IS DISTINCT FROM 'service_role' THEN
    RETURN jsonb_build_object('status','account_refused');
  END IF;
  INSERT INTO public.shopee_adao_f12_discovery_state(channel_account_id)
    VALUES(p_channel_account_id) ON CONFLICT DO NOTHING;
  SELECT * INTO v FROM public.shopee_adao_f12_discovery_state
    WHERE channel_account_id=p_channel_account_id FOR UPDATE;
  IF v.phase='staged' THEN RETURN jsonb_build_object('status','staged_requires_ack'); END IF;
  IF v.lease_expires_at > clock_timestamp() THEN
    RETURN jsonb_build_object('status','busy');
  END IF;
  UPDATE public.shopee_adao_f12_discovery_state
    SET generation=generation+1,lease_id=gen_random_uuid(),
      lease_expires_at=clock_timestamp()+interval '3 minutes',
      phase='reading',updated_at=clock_timestamp()
    WHERE channel_account_id=p_channel_account_id RETURNING * INTO v;
  RETURN jsonb_build_object('status','acquired','lease_id',v.lease_id,
    'generation',v.generation,'checkpoint',v.checkpoint);
END $$;

-- Stage the exact read-only slice BEFORE any future order writer can consume it.
-- No automatic resume after stage, not even on lease expiry.
CREATE OR REPLACE FUNCTION public.stage_shopee_adao_f12_discovery(
  p_channel_account_id uuid,p_lease_id uuid,p_generation bigint,
  p_checkpoint jsonb,p_pages jsonb,p_completed boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE v public.shopee_adao_f12_discovery_state%ROWTYPE;
        page_item jsonb; sn text; total_count integer:=0;
        distinct_count integer:=0;
BEGIN
  IF p_channel_account_id IS DISTINCT FROM 'b4027369-5abf-4ac1-ab24-862334fae892'::uuid
     OR coalesce(auth.jwt()->>'role', '') IS DISTINCT FROM 'service_role' THEN
    RETURN jsonb_build_object('status','account_refused');
  END IF;
  SELECT * INTO v FROM public.shopee_adao_f12_discovery_state
    WHERE channel_account_id=p_channel_account_id FOR UPDATE;
  IF NOT FOUND OR v.phase<>'reading' OR v.lease_id IS DISTINCT FROM p_lease_id
    OR v.generation IS DISTINCT FROM p_generation OR v.lease_expires_at<=clock_timestamp()
    THEN RETURN jsonb_build_object('status','stale_lease'); END IF;
  -- Checkpoint must be the monotonic successor of the last ACKed state.
  -- Fail closed on SQL NULL / missing JSON keys and forged metadata.
  IF p_completed IS NULL OR (p_completed AND p_checkpoint IS NOT NULL)
    OR (NOT p_completed AND (
      p_checkpoint IS NULL
      OR jsonb_typeof(p_checkpoint) IS DISTINCT FROM 'object'
      OR (p_checkpoint->>'account') IS DISTINCT FROM p_channel_account_id::text
      OR (p_checkpoint->>'shop') IS DISTINCT FROM '1156446003'
      OR (p_checkpoint->>'version') IS DISTINCT FROM '1'
      OR COALESCE((p_checkpoint->>'timeFrom') ~ '^[0-9]{1,12}$',false)=false
      OR COALESCE((p_checkpoint->>'timeTo') ~ '^[0-9]{1,12}$',false)=false
      OR COALESCE((p_checkpoint->>'pages') ~ '^[0-9]{1,2}$',false)=false
      OR COALESCE((p_checkpoint->>'orders') ~ '^[0-9]{1,3}$',false)=false
      OR COALESCE((p_checkpoint->>'pages')::integer BETWEEN 1 AND 9,false)=false
      OR COALESCE((p_checkpoint->>'orders')::integer BETWEEN 0 AND 100,false)=false
      OR jsonb_typeof(p_checkpoint->'visited') IS DISTINCT FROM 'array'
      OR jsonb_typeof(p_checkpoint->'cursor') IS DISTINCT FROM 'string'
      OR COALESCE(length(p_checkpoint->>'cursor') BETWEEN 1 AND 2048,false)=false
      OR CASE WHEN jsonb_typeof(p_checkpoint->'visited')='array' THEN
        jsonb_array_length(p_checkpoint->'visited') IS DISTINCT FROM (p_checkpoint->>'pages')::integer
        ELSE true END
      OR (p_checkpoint->'visited'->>-1) IS DISTINCT FROM p_checkpoint->>'cursor'
      OR CASE WHEN jsonb_typeof(p_checkpoint->'visited')='array' THEN
        (SELECT count(*) FROM jsonb_array_elements_text(p_checkpoint->'visited')) IS DISTINCT FROM
        (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(p_checkpoint->'visited') AS v(value))
        ELSE true END
    )) THEN RETURN jsonb_build_object('status','invalid_checkpoint'); END IF;
  IF p_pages IS NULL OR jsonb_typeof(p_pages) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_pages) NOT BETWEEN 1 AND 2 THEN
    RETURN jsonb_build_object('status','invalid_pages'); END IF;
  FOR page_item IN SELECT value FROM jsonb_array_elements(p_pages) LOOP
    IF jsonb_typeof(page_item) IS DISTINCT FROM 'array'
       OR jsonb_array_length(page_item)>10 THEN
      RETURN jsonb_build_object('status','invalid_pages'); END IF;
    FOR sn IN SELECT value FROM jsonb_array_elements_text(page_item) LOOP
      IF coalesce(sn,'') !~ '^[A-Za-z0-9]{8,100}$' THEN
        RETURN jsonb_build_object('status','invalid_pages'); END IF;
      total_count:=total_count+1;
    END LOOP;
  END LOOP;
  SELECT count(DISTINCT item.value) INTO distinct_count
  FROM jsonb_array_elements(p_pages) AS page(value)
       CROSS JOIN LATERAL jsonb_array_elements_text(page.value) AS item(value);
  IF distinct_count IS DISTINCT FROM total_count THEN
    RETURN jsonb_build_object('status','invalid_pages'); END IF;
  IF p_completed=false AND (
    (v.checkpoint IS NULL AND (
      (p_checkpoint->>'pages')::integer IS DISTINCT FROM jsonb_array_length(p_pages)
      OR (p_checkpoint->>'orders')::integer IS DISTINCT FROM total_count))
    OR (v.checkpoint IS NOT NULL AND (
      (p_checkpoint->>'timeFrom') IS DISTINCT FROM v.checkpoint->>'timeFrom'
      OR (p_checkpoint->>'timeTo') IS DISTINCT FROM v.checkpoint->>'timeTo'
      OR (p_checkpoint->>'pages')::integer IS DISTINCT FROM
        (v.checkpoint->>'pages')::integer+jsonb_array_length(p_pages)
      OR (p_checkpoint->>'orders')::integer IS DISTINCT FROM
        (v.checkpoint->>'orders')::integer+total_count
      OR (p_checkpoint->'visited'->0) IS DISTINCT FROM (v.checkpoint->'visited'->0)
      OR (p_checkpoint->'visited') @> (v.checkpoint->'visited') IS NOT TRUE))
    ) THEN RETURN jsonb_build_object('status','checkpoint_not_monotonic'); END IF;
  IF p_completed=false AND (
    (p_checkpoint->>'timeTo')::bigint-(p_checkpoint->>'timeFrom')::bigint
       IS DISTINCT FROM 172800
    OR (p_checkpoint->>'timeTo')::bigint >
       floor(extract(epoch from clock_timestamp()))::bigint
    ) THEN RETURN jsonb_build_object('status','invalid_checkpoint'); END IF;
  UPDATE public.shopee_adao_f12_discovery_state
    SET phase='staged',checkpoint=p_checkpoint,staged_pages=p_pages,
      staged_complete=p_completed,updated_at=clock_timestamp()
    WHERE channel_account_id=p_channel_account_id;
  RETURN jsonb_build_object('status','staged','pages',jsonb_array_length(p_pages),
    'orders',total_count,'generation',v.generation);
END $$;

-- ACK MUST be called only AFTER future writer has fully reconciled and
-- durably committed the staged pages. Nothing here performs a writer.
CREATE OR REPLACE FUNCTION public.ack_shopee_adao_f12_discovery(
 p_channel_account_id uuid,p_lease_id uuid,p_generation bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE v public.shopee_adao_f12_discovery_state%ROWTYPE;
BEGIN
 IF p_channel_account_id IS DISTINCT FROM 'b4027369-5abf-4ac1-ab24-862334fae892'::uuid
   OR coalesce(auth.jwt()->>'role', '') IS DISTINCT FROM 'service_role' THEN
  RETURN jsonb_build_object('status','account_refused'); END IF;
 SELECT * INTO v FROM public.shopee_adao_f12_discovery_state
   WHERE channel_account_id=p_channel_account_id FOR UPDATE;
 IF NOT FOUND OR v.phase<>'staged' OR v.lease_id IS DISTINCT FROM p_lease_id
   OR v.generation IS DISTINCT FROM p_generation OR v.lease_expires_at<=clock_timestamp()
   THEN RETURN jsonb_build_object('status','stale_or_staged_requires_reconciliation'); END IF;
 UPDATE public.shopee_adao_f12_discovery_state SET
   phase='idle',lease_id=NULL,lease_expires_at=NULL,
   staged_pages=NULL,staged_complete=false,updated_at=clock_timestamp()
   WHERE channel_account_id=p_channel_account_id;
 RETURN jsonb_build_object('status','acknowledged','completed',v.staged_complete);
END $$;

REVOKE ALL ON FUNCTION public.acquire_shopee_adao_f12_discovery(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.stage_shopee_adao_f12_discovery(uuid,uuid,bigint,jsonb,jsonb,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ack_shopee_adao_f12_discovery(uuid,uuid,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_shopee_adao_f12_discovery(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.stage_shopee_adao_f12_discovery(uuid,uuid,bigint,jsonb,jsonb,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.ack_shopee_adao_f12_discovery(uuid,uuid,bigint) TO service_role;
