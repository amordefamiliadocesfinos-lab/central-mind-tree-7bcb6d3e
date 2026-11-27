-- Fixture helper only; simulate a new exact official observation of persisted Raw.
-- Does not simulate Shopee transport and must never enter a generated migration.
CREATE FUNCTION public.d11_fixture_observe(p_account uuid,p_request text) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v public.shopee_cycle_state%ROWTYPE; r public.marketplace_raw_snapshots%ROWTYPE;
 p jsonb; x jsonb; started timestamptz;
BEGIN
 SELECT * INTO STRICT v FROM public.shopee_cycle_state WHERE channel_account_id=p_account;
 p:=public.admit_shopee_cycle_policy(p_account,'intake');
 SELECT * INTO STRICT r FROM public.marketplace_raw_snapshots
   WHERE channel_account_id=p_account AND external_entity_id=v.candidate_order_sn
    AND source='shopee_open_platform' AND environment='live' AND external_entity_type='order'
    AND endpoint='/api/v2/order/get_order_detail'
   ORDER BY observed_at DESC LIMIT 1;
 started:=clock_timestamp();
 x:=public.record_shopee_cycle_observation(p_account,v.lease_id,v.lease_policy_revision,
   (p->>'shop_id')::bigint,v.candidate_order_sn,r.payload_hash,r.payload,p_request,started,clock_timestamp());
 IF x->>'status' IS DISTINCT FROM 'observation_recorded' THEN
   RAISE EXCEPTION 'fixture observation refused: %',x;
 END IF;
 RETURN (x->>'observation_id')::uuid;
END $$;
REVOKE ALL ON FUNCTION public.d11_fixture_observe(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.d11_fixture_observe(uuid,text) TO service_role;
