-- F12.3: enforce durable Core reconciliation BEFORE ACK.
-- Fail closed. A canonical imported order proves only discovery persistence;
-- it does NOT prove shipment, label, stock decrement, OP or delivery.
-- Orders deliberately omitted because cancelled / terminal remain blocked
-- pending a separately reviewed reconciliation policy.
CREATE OR REPLACE FUNCTION public.ack_shopee_adao_f12_discovery(
 p_channel_account_id uuid,p_lease_id uuid,p_generation bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
 v public.shopee_adao_f12_discovery_state%ROWTYPE;
 v_staged_count integer;
 v_reconciled_count integer;
 v_distinct_count integer;
BEGIN
 IF p_channel_account_id IS DISTINCT FROM 'b4027369-5abf-4ac1-ab24-862334fae892'::uuid
   OR coalesce(auth.jwt()->>'role','') IS DISTINCT FROM 'service_role' THEN
  RETURN jsonb_build_object('status','account_refused');
 END IF;
 SELECT * INTO v FROM public.shopee_adao_f12_discovery_state
   WHERE channel_account_id=p_channel_account_id FOR UPDATE;
 IF NOT FOUND OR v.phase<>'staged' OR v.lease_id IS DISTINCT FROM p_lease_id
   OR v.generation IS DISTINCT FROM p_generation
   OR v.lease_expires_at <= clock_timestamp() THEN
  RETURN jsonb_build_object('status','stale_or_staged_requires_reconciliation');
 END IF;
 IF v.staged_pages IS NULL OR jsonb_typeof(v.staged_pages) IS DISTINCT FROM 'array' THEN
  RETURN jsonb_build_object('status','staged_pages_invalid');
 END IF;
 -- All staged IDs must be canonical orders, with exact Adão identity and
 -- non-tombstoned Shopee Open Platform provenance. A raw listing alone
 -- is not durable canonical reconciliation.
 WITH staged AS (
   SELECT id.value AS sn
     FROM jsonb_array_elements(v.staged_pages) AS pg(page)
     CROSS JOIN LATERAL jsonb_array_elements_text(pg.page) AS id(value)
 ), counts AS (
   SELECT
     count(*) AS staged_count,
     count(DISTINCT sn) AS distinct_count,
     count(*) FILTER (WHERE
       (SELECT count(*) FROM public.orders o
         WHERE o.channel_account_id=p_channel_account_id
           AND o.channel='shopee'
           AND o.order_number=staged.sn
           AND o.sale_origin='shopee_open_platform'
           AND o.deleted_at IS NULL) = 1) AS reconciled_count
   FROM staged
 )
 SELECT staged_count,distinct_count,reconciled_count
 INTO v_staged_count,v_distinct_count,v_reconciled_count FROM counts;
 IF v_staged_count IS NULL OR v_staged_count > 20
   OR v_staged_count IS DISTINCT FROM v_distinct_count
   OR v_reconciled_count IS DISTINCT FROM v_staged_count THEN
   RETURN jsonb_build_object('status','reconciliation_required',
     'expected',coalesce(v_staged_count,0),
     'confirmed',coalesce(v_reconciled_count,0));
 END IF;
 UPDATE public.shopee_adao_f12_discovery_state
 SET phase='idle',lease_id=NULL,lease_expires_at=NULL,
     staged_pages=NULL,staged_complete=false,updated_at=clock_timestamp()
 WHERE channel_account_id=p_channel_account_id;
 RETURN jsonb_build_object('status','acknowledged','completed',v.staged_complete,
   'reconciled',v_reconciled_count);
END $$;
REVOKE ALL ON FUNCTION public.ack_shopee_adao_f12_discovery(uuid,uuid,bigint)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ack_shopee_adao_f12_discovery(uuid,uuid,bigint)
 TO service_role;
