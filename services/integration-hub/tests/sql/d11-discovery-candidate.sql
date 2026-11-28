-- Candidate only. Reuse the existing lease, Raw and cursor; no new queue.
CREATE FUNCTION public.read_shopee_d11_discovery_scope(p_account uuid,p_lease uuid,p_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v public.shopee_cycle_state%ROWTYPE; p jsonb;
BEGIN
 IF p_account IS NULL OR p_account IN ('8a8ad166-0317-4597-8be6-e43fb46b4d1b','b4027369-5abf-4ac1-ab24-862334fae892')
   OR NOT public.check_shopee_cycle_policy_lease(p_account,p_lease,p_revision,'discover') THEN RETURN NULL; END IF;
 SELECT * INTO v FROM public.shopee_cycle_state WHERE channel_account_id=p_account;
 IF NOT FOUND OR v.halted_code IS NOT NULL OR v.lease_id IS DISTINCT FROM p_lease
   OR v.lease_policy_revision IS DISTINCT FROM p_revision OR v.time_from<1 OR v.time_to<=v.time_from
   OR v.time_to-v.time_from>604800 OR v.time_to>floor(extract(epoch FROM clock_timestamp()))
 THEN RETURN NULL; END IF;
 p:=public.admit_shopee_cycle_policy(p_account,'discover');
 IF p IS NULL OR (p->>'revision')::integer IS DISTINCT FROM p_revision THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('channel_account_id',p_account,'lease_id',p_lease,'revision',p_revision,
   'shop_id',p->'shop_id','partner_id',p->'partner_id','history_cutoff',p->'history_cutoff',
   'page_size',p->'page_size','work_budget_ms',p->'work_budget_ms','time_from',v.time_from,'time_to',v.time_to,
   'cursor',v.cursor,'candidate_order_sn',v.candidate_order_sn,'lease_started_at',v.updated_at,
   'expires_at',least(v.lease_expires_at,(p->>'expires_at')::timestamptz));
END $$;

-- Trusted Hub supplies hashes from the one acknowledged official page.
-- Validate every listed detail, derive eligible queue members in Core.
-- A checkpoint is the sole operation that advances the cursor and releases.
CREATE FUNCTION public.finish_shopee_d11_discovery(p_account uuid,p_lease uuid,p_revision integer,
 p_list_hash text,p_detail_hashes jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v public.shopee_cycle_state%ROWTYPE; s jsonb; r public.marketplace_raw_snapshots%ROWTYPE;
 d public.marketplace_raw_snapshots%ROWTYPE; list jsonb; entry jsonb; o jsonb; sn text; window_id text;
 seen text[]:=ARRAY[]::text[]; eligible text[]:=ARRAY[]::text[]; next_cursor text; x jsonb;
BEGIN
 IF coalesce(p_list_hash,'') !~ '^[0-9a-f]{64}$' OR jsonb_typeof(p_detail_hashes) IS DISTINCT FROM 'object'
 THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
 SELECT * INTO v FROM public.shopee_cycle_state WHERE channel_account_id=p_account FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','stale_lease'); END IF;
 s:=public.read_shopee_d11_discovery_scope(p_account,p_lease,p_revision);
 IF s IS NULL THEN RETURN jsonb_build_object('status','discovery_scope_refused'); END IF;
 IF v.candidate_order_sn IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.shopee_cycle_orders
    WHERE channel_account_id=p_account AND order_sn=v.candidate_order_sn AND state='pending')
 THEN RETURN jsonb_build_object('status','discovery_candidate_refused'); END IF;
 window_id:='update_time:'||v.time_from||'-'||v.time_to||':cursor:'||coalesce(v.cursor,'root');
 SELECT * INTO r FROM public.marketplace_raw_snapshots WHERE channel_account_id=p_account
   AND source='shopee_open_platform' AND environment='live' AND external_entity_type='order_list'
   AND endpoint='/api/v2/order/get_order_list' AND external_entity_id=window_id AND payload_hash=p_list_hash;
 IF NOT FOUND OR r.observed_at IS NULL OR r.observed_at<v.updated_at OR r.observed_at>clock_timestamp()
   OR coalesce(r.payload->>'error','')<>'' OR jsonb_typeof(r.payload#>'{response,more}') IS DISTINCT FROM 'boolean'
   OR jsonb_typeof(r.payload#>'{response,order_list}') IS DISTINCT FROM 'array'
 THEN RETURN jsonb_build_object('status','discovery_list_refused'); END IF;
 list:=r.payload#>'{response,order_list}';
 IF jsonb_array_length(list)>(s->>'page_size')::integer THEN RETURN jsonb_build_object('status','discovery_list_refused'); END IF;
 IF (r.payload#>>'{response,more}')::boolean THEN
   next_cursor:=r.payload#>>'{response,next_cursor}';
   IF jsonb_typeof(r.payload#>'{response,next_cursor}') IS DISTINCT FROM 'string'
     OR coalesce(length(next_cursor),0) NOT BETWEEN 1 AND 2048 OR next_cursor IS NOT DISTINCT FROM v.cursor
   THEN RETURN jsonb_build_object('status','discovery_list_refused'); END IF;
 END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(list) LOOP
   sn:=entry->>'order_sn';
   IF coalesce(sn,'') !~ '^[A-Za-z0-9]{8,100}$' OR sn=ANY(seen)
     OR coalesce(p_detail_hashes->>sn,'') !~ '^[0-9a-f]{64}$'
   THEN RETURN jsonb_build_object('status','discovery_detail_refused'); END IF;
   seen:=array_append(seen,sn);
   SELECT * INTO d FROM public.marketplace_raw_snapshots WHERE channel_account_id=p_account
    AND source='shopee_open_platform' AND environment='live' AND external_entity_type='order'
    AND endpoint='/api/v2/order/get_order_detail' AND external_entity_id=sn AND payload_hash=p_detail_hashes->>sn;
   IF NOT FOUND OR d.observed_at IS NULL OR d.observed_at<v.updated_at OR d.observed_at>clock_timestamp()
     OR coalesce(d.payload->>'error','')<>'' OR jsonb_typeof(d.payload#>'{response,order_list}') IS DISTINCT FROM 'array'
   THEN RETURN jsonb_build_object('status','discovery_detail_refused'); END IF;
   IF jsonb_array_length(d.payload#>'{response,order_list}')<>1 THEN RETURN jsonb_build_object('status','discovery_detail_refused'); END IF;
   o:=d.payload#>'{response,order_list,0}';
   IF o->>'order_sn' IS DISTINCT FROM sn OR jsonb_typeof(o->'create_time') IS DISTINCT FROM 'number'
     OR coalesce(o->>'create_time','') !~ '^[0-9]{1,12}$' OR coalesce(o->>'order_status','')=''
     OR (o->>'create_time')::bigint>floor(extract(epoch FROM clock_timestamp()))
   THEN RETURN jsonb_build_object('status','discovery_detail_refused'); END IF;
   IF (o->>'create_time')::bigint>(s->>'history_cutoff')::bigint AND o->>'order_status' IN ('READY_TO_SHIP','PROCESSED')
   THEN eligible:=array_append(eligible,sn); END IF;
 END LOOP;
 IF (SELECT count(*) FROM jsonb_object_keys(p_detail_hashes))<>cardinality(seen)
   OR NOT public.check_shopee_cycle_policy_lease(p_account,p_lease,p_revision,'discover')
 THEN RETURN jsonb_build_object('status','discovery_scope_refused'); END IF;
 x:=public.finish_shopee_cycle(p_account,p_lease,jsonb_build_object('order_sns',to_jsonb(eligible),'next_cursor',next_cursor),
   v.candidate_order_sn,'pending','d11_discovery_checkpointed');
 IF x->>'status' IS DISTINCT FROM 'finished' THEN RETURN x; END IF;
 UPDATE public.shopee_cycle_state SET d11_next_discovery=false WHERE channel_account_id=p_account;
 RETURN jsonb_build_object('status','finished','listed',cardinality(seen),'eligible',cardinality(eligible));
END $$;
REVOKE ALL ON FUNCTION public.read_shopee_d11_discovery_scope(uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_shopee_d11_discovery(uuid,uuid,integer,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_shopee_d11_discovery_scope(uuid,uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_shopee_d11_discovery(uuid,uuid,integer,text,jsonb) TO service_role;
