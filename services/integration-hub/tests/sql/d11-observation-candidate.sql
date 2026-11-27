-- D11 disposable candidate. No migration or live route.
-- Immutable observation receipt, not a second Raw, queue, claim or lease.
CREATE TABLE public.shopee_cycle_observations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 channel_account_id uuid NOT NULL REFERENCES public.channel_accounts(id),
 lease_id uuid NOT NULL,
 policy_revision integer NOT NULL CHECK(policy_revision>0),
 shop_id bigint NOT NULL CHECK(shop_id>0),
 order_sn text NOT NULL CHECK(order_sn ~ '^[A-Za-z0-9]{8,100}$'),
 raw_id uuid NOT NULL REFERENCES public.marketplace_raw_snapshots(id),
 payload_hash text NOT NULL CHECK(payload_hash ~ '^[0-9a-f]{64}
 official_request_id text NOT NULL CHECK(official_request_id ~ '^[A-Za-z0-9_.:-]{1,160}$'),
 request_started_at timestamptz NOT NULL,
 response_received_at timestamptz NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(channel_account_id,shop_id,official_request_id),
 CHECK(request_started_at<=response_received_at AND response_received_at<=recorded_at)
);
CREATE INDEX shopee_cycle_observation_lease_idx ON public.shopee_cycle_observations
 (channel_account_id,lease_id,policy_revision,recorded_at DESC);
ALTER TABLE public.shopee_cycle_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shopee_cycle_observations FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.shopee_cycle_observations TO service_role;

-- Only a future trusted Hub adapter may call this after an authenticated
-- successful official detail read and exact Raw persistence. The RPC does
-- not independently authenticate Shopee or trust a client-provided timestamp.
CREATE FUNCTION public.record_shopee_cycle_observation(
 p_account uuid,p_lease uuid,p_revision integer,p_shop bigint,
 p_order text,p_hash text,p_payload jsonb,p_request text,p_started timestamptz,p_received timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v public.shopee_cycle_state%ROWTYPE; p jsonb; r public.marketplace_raw_snapshots%ROWTYPE;
 o jsonb; pkg jsonb; t timestamptz; obs uuid; n bigint;
BEGIN
 IF p_account IS NULL OR p_lease IS NULL OR p_revision IS NULL OR p_revision<1
   OR p_shop IS NULL OR p_shop<=0 OR coalesce(p_order,'') !~ '^[A-Za-z0-9]{8,100}$'
   OR coalesce(p_hash,'') !~ '^[0-9a-f]{64}$'
   OR coalesce(p_request,'') !~ '^[A-Za-z0-9_.:-]{1,160}$'
   OR p_payload IS NULL OR p_started IS NULL OR p_received IS NULL
 THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
 SELECT * INTO v FROM public.shopee_cycle_state WHERE channel_account_id=p_account FOR UPDATE;
 IF NOT FOUND OR v.halted_code IS NOT NULL OR v.candidate_order_sn IS DISTINCT FROM p_order
   OR NOT public.check_shopee_cycle_policy_lease(p_account,p_lease,p_revision,'intake')
 THEN RETURN jsonb_build_object('status','observation_lease_refused'); END IF;
 p:=public.admit_shopee_cycle_policy(p_account,'intake');
 IF p IS NULL OR (p->>'revision')::integer IS DISTINCT FROM p_revision
    OR (p->>'shop_id')::bigint IS DISTINCT FROM p_shop
 THEN RETURN jsonb_build_object('status','observation_policy_refused'); END IF;
 t:=clock_timestamp();
 IF p_started<v.updated_at OR p_received<p_started OR p_received>t
   OR t-p_received>interval '30 seconds'
   OR p_received-p_started>interval '48 seconds'
 THEN RETURN jsonb_build_object('status','observation_time_refused'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.shopee_cycle_orders
    WHERE channel_account_id=p_account AND order_sn=p_order AND state='pending')
 THEN RETURN jsonb_build_object('status','observation_candidate_refused'); END IF;
 IF jsonb_typeof(p_payload#>'{response,order_list}') IS DISTINCT FROM 'array'
 THEN RETURN jsonb_build_object('status','observation_raw_refused'); END IF;
 IF jsonb_array_length(p_payload#>'{response,order_list}')<>1
 THEN RETURN jsonb_build_object('status','observation_raw_refused'); END IF;
 o:=p_payload#>'{response,order_list,0}';
 IF o->>'order_sn' IS DISTINCT FROM p_order
   OR jsonb_typeof(o->'create_time') IS DISTINCT FROM 'number'
   OR coalesce(o->>'create_time','') !~ '^[0-9]{1,12}$'
   OR jsonb_typeof(o->'split_up') IS DISTINCT FROM 'boolean'
   OR jsonb_typeof(o->'package_list') IS DISTINCT FROM 'array'
 THEN RETURN jsonb_build_object('status','observation_raw_refused'); END IF;
 IF (o->>'create_time')::bigint <= (p->>'history_cutoff')::bigint
   OR (o->>'create_time')::bigint > floor(extract(epoch FROM t))
   OR jsonb_array_length(o->'package_list')<>1
 THEN RETURN jsonb_build_object('status','observation_raw_refused'); END IF;
 pkg:=o->'package_list'->0;
 IF coalesce(pkg->>'package_number','') !~ '^[A-Za-z0-9_-]{1,100}$'
   OR NOT coalesce((o->>'order_status'='READY_TO_SHIP' AND pkg->>'logistics_status'='LOGISTICS_READY')
       OR (o->>'order_status'='PROCESSED' AND pkg->>'logistics_status'='LOGISTICS_REQUEST_CREATED'),false)
 THEN RETURN jsonb_build_object('status','observation_raw_refused'); END IF;
 SELECT count(*) INTO n FROM public.marketplace_raw_snapshots WHERE
   channel_account_id=p_account AND source='shopee_open_platform' AND environment='live'
   AND external_entity_type='order' AND endpoint='/api/v2/order/get_order_detail'
   AND external_entity_id=p_order AND payload_hash=p_hash;
 IF n<>1 THEN RETURN jsonb_build_object('status','observation_raw_refused'); END IF;
 SELECT * INTO r FROM public.marketplace_raw_snapshots WHERE
   channel_account_id=p_account AND source='shopee_open_platform' AND environment='live'
   AND external_entity_type='order' AND endpoint='/api/v2/order/get_order_detail'
   AND external_entity_id=p_order AND payload_hash=p_hash;
 IF r.payload IS DISTINCT FROM p_payload OR r.observed_at>p_received
 THEN RETURN jsonb_build_object('status','observation_raw_refused'); END IF;
 -- Never overwrite or renew an earlier receipt; out-of-order responses
 -- cannot replace more recently received evidence in the same lease.
 IF EXISTS(SELECT 1 FROM public.shopee_cycle_observations
   WHERE channel_account_id=p_account AND lease_id=p_lease AND response_received_at>=p_received)
 THEN RETURN jsonb_build_object('status','observation_replay_or_out_of_order'); END IF;
 INSERT INTO public.shopee_cycle_observations(channel_account_id,lease_id,policy_revision,shop_id,order_sn,
    raw_id,payload_hash,content_digest,official_request_id,request_started_at,response_received_at,recorded_at)
 VALUES(p_account,p_lease,p_revision,p_shop,p_order,r.id,p_hash,encode(sha256(convert_to(r.payload::text,'UTF8')),'hex'),p_request,p_started,p_received,t)
 ON CONFLICT(channel_account_id,shop_id,official_request_id) DO NOTHING RETURNING id INTO obs;
 IF obs IS NULL THEN RETURN jsonb_build_object('status','observation_replay_or_out_of_order'); END IF;
 RETURN jsonb_build_object('status','observation_recorded','observation_id',obs,'raw_id',r.id);
END $$;
REVOKE ALL ON FUNCTION public.record_shopee_cycle_observation(uuid,uuid,integer,bigint,text,text,jsonb,text,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_shopee_cycle_observation(uuid,uuid,integer,bigint,text,text,jsonb,text,timestamptz,timestamptz) TO service_role;

-- Candidate read for the future reconciliation and claim boundaries.
-- Freshness derives from the receipt, never a rewritten historical Raw.
CREATE FUNCTION public.read_shopee_cycle_observation(p_account uuid,p_lease uuid,p_revision integer,p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v public.shopee_cycle_state%ROWTYPE; p jsonb; e public.shopee_cycle_observations%ROWTYPE;
 r public.marketplace_raw_snapshots%ROWTYPE;
BEGIN
 IF p_action IS NULL OR p_action NOT IN ('intake','ship','label')
   OR NOT public.check_shopee_cycle_policy_lease(p_account,p_lease,p_revision,p_action)
 THEN RETURN NULL; END IF;
 SELECT * INTO v FROM public.shopee_cycle_state WHERE channel_account_id=p_account;
 p:=public.admit_shopee_cycle_policy(p_account,p_action);
 IF NOT FOUND OR v.halted_code IS NOT NULL OR v.lease_id IS DISTINCT FROM p_lease
   OR v.lease_policy_revision IS DISTINCT FROM p_revision OR p IS NULL
   OR (p->>'revision')::integer IS DISTINCT FROM p_revision
 THEN RETURN NULL; END IF;
 SELECT * INTO e FROM public.shopee_cycle_observations
   WHERE channel_account_id=p_account AND lease_id=p_lease AND policy_revision=p_revision
   ORDER BY recorded_at DESC LIMIT 1;
 IF NOT FOUND OR e.order_sn IS DISTINCT FROM v.candidate_order_sn
   OR e.shop_id IS DISTINCT FROM (p->>'shop_id')::bigint
   OR e.request_started_at<v.updated_at OR e.response_received_at>clock_timestamp()
   OR clock_timestamp()-e.response_received_at>interval '30 seconds'
   OR NOT EXISTS(SELECT 1 FROM public.shopee_cycle_orders WHERE channel_account_id=p_account AND order_sn=e.order_sn AND state='pending')
 THEN RETURN NULL; END IF;
 SELECT * INTO r FROM public.marketplace_raw_snapshots WHERE id=e.raw_id AND channel_account_id=p_account
   AND source='shopee_open_platform' AND environment='live' AND external_entity_type='order'
   AND endpoint='/api/v2/order/get_order_detail' AND external_entity_id=e.order_sn AND payload_hash=e.payload_hash;
 IF NOT FOUND OR encode(sha256(convert_to(r.payload::text,'UTF8')),'hex') IS DISTINCT FROM e.content_digest
   OR EXISTS(SELECT 1 FROM public.marketplace_raw_snapshots WHERE channel_account_id=p_account
   AND source='shopee_open_platform' AND environment='live' AND external_entity_type='order'
   AND endpoint='/api/v2/order/get_order_detail' AND external_entity_id=e.order_sn
   AND id<>e.raw_id AND observed_at>=e.response_received_at)
 THEN RETURN NULL; END IF;
 IF NOT public.check_shopee_cycle_policy_lease(p_account,p_lease,p_revision,p_action) THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('observation_id',e.id,'raw_id',r.id,'channel_account_id',p_account,
   'shop_id',e.shop_id,'order_sn',e.order_sn,'payload_hash',e.payload_hash,
   'response_received_at',e.response_received_at,'recorded_at',e.recorded_at,
   'original_observed_at',r.observed_at,'created_at',r.created_at,'payload',r.payload);
END $$;
REVOKE ALL ON FUNCTION public.read_shopee_cycle_observation(uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_shopee_cycle_observation(uuid,uuid,integer,text) TO service_role;
),
 content_digest text NOT NULL CHECK(content_digest ~ '^[0-9a-f]{64}
 official_request_id text NOT NULL CHECK(official_request_id ~ '^[A-Za-z0-9_.:-]{1,160}$'),
 request_started_at timestamptz NOT NULL,
 response_received_at timestamptz NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(channel_account_id,shop_id,official_request_id),
 CHECK(request_started_at<=response_received_at AND response_received_at<=recorded_at)
);
CREATE INDEX shopee_cycle_observation_lease_idx ON public.shopee_cycle_observations
 (channel_account_id,lease_id,policy_revision,recorded_at DESC);
ALTER TABLE public.shopee_cycle_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shopee_cycle_observations FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.shopee_cycle_observations TO service_role;

-- Only a future trusted Hub adapter may call this after an authenticated
-- successful official detail read and exact Raw persistence. The RPC does
-- not independently authenticate Shopee or trust a client-provided timestamp.
CREATE FUNCTION public.record_shopee_cycle_observation(
 p_account uuid,p_lease uuid,p_revision integer,p_shop bigint,
 p_order text,p_hash text,p_payload jsonb,p_request text,p_started timestamptz,p_received timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v public.shopee_cycle_state%ROWTYPE; p jsonb; r public.marketplace_raw_snapshots%ROWTYPE;
 o jsonb; pkg jsonb; t timestamptz; obs uuid; n bigint;
BEGIN
 IF p_account IS NULL OR p_lease IS NULL OR p_revision IS NULL OR p_revision<1
   OR p_shop IS NULL OR p_shop<=0 OR coalesce(p_order,'') !~ '^[A-Za-z0-9]{8,100}$'
   OR coalesce(p_hash,'') !~ '^[0-9a-f]{64}$'
   OR coalesce(p_request,'') !~ '^[A-Za-z0-9_.:-]{1,160}$'
   OR p_payload IS NULL OR p_started IS NULL OR p_received IS NULL
 THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
 SELECT * INTO v FROM public.shopee_cycle_state WHERE channel_account_id=p_account FOR UPDATE;
 IF NOT FOUND OR v.halted_code IS NOT NULL OR v.candidate_order_sn IS DISTINCT FROM p_order
   OR NOT public.check_shopee_cycle_policy_lease(p_account,p_lease,p_revision,'intake')
 THEN RETURN jsonb_build_object('status','observation_lease_refused'); END IF;
 p:=public.admit_shopee_cycle_policy(p_account,'intake');
 IF p IS NULL OR (p->>'revision')::integer IS DISTINCT FROM p_revision
    OR (p->>'shop_id')::bigint IS DISTINCT FROM p_shop
 THEN RETURN jsonb_build_object('status','observation_policy_refused'); END IF;
 t:=clock_timestamp();
 IF p_started<v.updated_at OR p_received<p_started OR p_received>t
   OR t-p_received>interval '30 seconds'
   OR p_received-p_started>interval '48 seconds'
 THEN RETURN jsonb_build_object('status','observation_time_refused'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.shopee_cycle_orders
    WHERE channel_account_id=p_account AND order_sn=p_order AND state='pending')
 THEN RETURN jsonb_build_object('status','observation_candidate_refused'); END IF;
 IF jsonb_typeof(p_payload#>'{response,order_list}') IS DISTINCT FROM 'array'
 THEN RETURN jsonb_build_object('status','observation_raw_refused'); END IF;
 IF jsonb_array_length(p_payload#>'{response,order_list}')<>1
 THEN RETURN jsonb_build_object('status','observation_raw_refused'); END IF;
 o:=p_payload#>'{response,order_list,0}';
 IF o->>'order_sn' IS DISTINCT FROM p_order
   OR jsonb_typeof(o->'create_time') IS DISTINCT FROM 'number'
   OR coalesce(o->>'create_time','') !~ '^[0-9]{1,12}$'
   OR jsonb_typeof(o->'split_up') IS DISTINCT FROM 'boolean'
   OR jsonb_typeof(o->'package_list') IS DISTINCT FROM 'array'
 THEN RETURN jsonb_build_object('status','observation_raw_refused'); END IF;
 IF (o->>'create_time')::bigint <= (p->>'history_cutoff')::bigint
   OR (o->>'create_time')::bigint > floor(extract(epoch FROM t))
   OR jsonb_array_length(o->'package_list')<>1
 THEN RETURN jsonb_build_object('status','observation_raw_refused'); END IF;
 pkg:=o->'package_list'->0;
 IF coalesce(pkg->>'package_number','') !~ '^[A-Za-z0-9_-]{1,100}$'
   OR NOT coalesce((o->>'order_status'='READY_TO_SHIP' AND pkg->>'logistics_status'='LOGISTICS_READY')
       OR (o->>'order_status'='PROCESSED' AND pkg->>'logistics_status'='LOGISTICS_REQUEST_CREATED'),false)
 THEN RETURN jsonb_build_object('status','observation_raw_refused'); END IF;
 SELECT count(*) INTO n FROM public.marketplace_raw_snapshots WHERE
   channel_account_id=p_account AND source='shopee_open_platform' AND environment='live'
   AND external_entity_type='order' AND endpoint='/api/v2/order/get_order_detail'
   AND external_entity_id=p_order AND payload_hash=p_hash;
 IF n<>1 THEN RETURN jsonb_build_object('status','observation_raw_refused'); END IF;
 SELECT * INTO r FROM public.marketplace_raw_snapshots WHERE
   channel_account_id=p_account AND source='shopee_open_platform' AND environment='live'
   AND external_entity_type='order' AND endpoint='/api/v2/order/get_order_detail'
   AND external_entity_id=p_order AND payload_hash=p_hash;
 IF r.payload IS DISTINCT FROM p_payload OR r.observed_at>p_received
 THEN RETURN jsonb_build_object('status','observation_raw_refused'); END IF;
 -- Never overwrite or renew an earlier receipt; out-of-order responses
 -- cannot replace more recently received evidence in the same lease.
 IF EXISTS(SELECT 1 FROM public.shopee_cycle_observations
   WHERE channel_account_id=p_account AND lease_id=p_lease AND response_received_at>=p_received)
 THEN RETURN jsonb_build_object('status','observation_replay_or_out_of_order'); END IF;
 INSERT INTO public.shopee_cycle_observations(channel_account_id,lease_id,policy_revision,shop_id,order_sn,
    raw_id,payload_hash,official_request_id,request_started_at,response_received_at,recorded_at)
 VALUES(p_account,p_lease,p_revision,p_shop,p_order,r.id,p_hash,p_request,p_started,p_received,t)
 ON CONFLICT(channel_account_id,shop_id,official_request_id) DO NOTHING RETURNING id INTO obs;
 IF obs IS NULL THEN RETURN jsonb_build_object('status','observation_replay_or_out_of_order'); END IF;
 RETURN jsonb_build_object('status','observation_recorded','observation_id',obs,'raw_id',r.id);
END $$;
REVOKE ALL ON FUNCTION public.record_shopee_cycle_observation(uuid,uuid,integer,bigint,text,text,jsonb,text,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_shopee_cycle_observation(uuid,uuid,integer,bigint,text,text,jsonb,text,timestamptz,timestamptz) TO service_role;

-- Candidate read for the future reconciliation and claim boundaries.
-- Freshness derives from the receipt, never a rewritten historical Raw.
CREATE FUNCTION public.read_shopee_cycle_observation(p_account uuid,p_lease uuid,p_revision integer,p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v public.shopee_cycle_state%ROWTYPE; p jsonb; e public.shopee_cycle_observations%ROWTYPE;
 r public.marketplace_raw_snapshots%ROWTYPE;
BEGIN
 IF p_action IS NULL OR p_action NOT IN ('intake','ship','label')
   OR NOT public.check_shopee_cycle_policy_lease(p_account,p_lease,p_revision,p_action)
 THEN RETURN NULL; END IF;
 SELECT * INTO v FROM public.shopee_cycle_state WHERE channel_account_id=p_account;
 p:=public.admit_shopee_cycle_policy(p_account,p_action);
 IF NOT FOUND OR v.halted_code IS NOT NULL OR v.lease_id IS DISTINCT FROM p_lease
   OR v.lease_policy_revision IS DISTINCT FROM p_revision OR p IS NULL
   OR (p->>'revision')::integer IS DISTINCT FROM p_revision
 THEN RETURN NULL; END IF;
 SELECT * INTO e FROM public.shopee_cycle_observations
   WHERE channel_account_id=p_account AND lease_id=p_lease AND policy_revision=p_revision
   ORDER BY recorded_at DESC LIMIT 1;
 IF NOT FOUND OR e.order_sn IS DISTINCT FROM v.candidate_order_sn
   OR e.shop_id IS DISTINCT FROM (p->>'shop_id')::bigint
   OR e.request_started_at<v.updated_at OR e.response_received_at>clock_timestamp()
   OR clock_timestamp()-e.response_received_at>interval '30 seconds'
   OR NOT EXISTS(SELECT 1 FROM public.shopee_cycle_orders WHERE channel_account_id=p_account AND order_sn=e.order_sn AND state='pending')
 THEN RETURN NULL; END IF;
 SELECT * INTO r FROM public.marketplace_raw_snapshots WHERE id=e.raw_id AND channel_account_id=p_account
   AND source='shopee_open_platform' AND environment='live' AND external_entity_type='order'
   AND endpoint='/api/v2/order/get_order_detail' AND external_entity_id=e.order_sn AND payload_hash=e.payload_hash;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM public.marketplace_raw_snapshots WHERE channel_account_id=p_account
   AND source='shopee_open_platform' AND environment='live' AND external_entity_type='order'
   AND endpoint='/api/v2/order/get_order_detail' AND external_entity_id=e.order_sn
   AND id<>e.raw_id AND observed_at>=e.response_received_at)
 THEN RETURN NULL; END IF;
 IF NOT public.check_shopee_cycle_policy_lease(p_account,p_lease,p_revision,p_action) THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('observation_id',e.id,'raw_id',r.id,'channel_account_id',p_account,
   'shop_id',e.shop_id,'order_sn',e.order_sn,'payload_hash',e.payload_hash,
   'response_received_at',e.response_received_at,'recorded_at',e.recorded_at,
   'original_observed_at',r.observed_at,'created_at',r.created_at,'payload',r.payload);
END $$;
REVOKE ALL ON FUNCTION public.read_shopee_cycle_observation(uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_shopee_cycle_observation(uuid,uuid,integer,text) TO service_role;
),
 official_request_id text NOT NULL CHECK(official_request_id ~ '^[A-Za-z0-9_.:-]{1,160}$'),
 request_started_at timestamptz NOT NULL,
 response_received_at timestamptz NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(channel_account_id,shop_id,official_request_id),
 CHECK(request_started_at<=response_received_at AND response_received_at<=recorded_at)
);
CREATE INDEX shopee_cycle_observation_lease_idx ON public.shopee_cycle_observations
 (channel_account_id,lease_id,policy_revision,recorded_at DESC);
ALTER TABLE public.shopee_cycle_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shopee_cycle_observations FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.shopee_cycle_observations TO service_role;

-- Only a future trusted Hub adapter may call this after an authenticated
-- successful official detail read and exact Raw persistence. The RPC does
-- not independently authenticate Shopee or trust a client-provided timestamp.
CREATE FUNCTION public.record_shopee_cycle_observation(
 p_account uuid,p_lease uuid,p_revision integer,p_shop bigint,
 p_order text,p_hash text,p_payload jsonb,p_request text,p_started timestamptz,p_received timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v public.shopee_cycle_state%ROWTYPE; p jsonb; r public.marketplace_raw_snapshots%ROWTYPE;
 o jsonb; pkg jsonb; t timestamptz; obs uuid; n bigint;
BEGIN
 IF p_account IS NULL OR p_lease IS NULL OR p_revision IS NULL OR p_revision<1
   OR p_shop IS NULL OR p_shop<=0 OR coalesce(p_order,'') !~ '^[A-Za-z0-9]{8,100}$'
   OR coalesce(p_hash,'') !~ '^[0-9a-f]{64}$'
   OR coalesce(p_request,'') !~ '^[A-Za-z0-9_.:-]{1,160}$'
   OR p_payload IS NULL OR p_started IS NULL OR p_received IS NULL
 THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
 SELECT * INTO v FROM public.shopee_cycle_state WHERE channel_account_id=p_account FOR UPDATE;
 IF NOT FOUND OR v.halted_code IS NOT NULL OR v.candidate_order_sn IS DISTINCT FROM p_order
   OR NOT public.check_shopee_cycle_policy_lease(p_account,p_lease,p_revision,'intake')
 THEN RETURN jsonb_build_object('status','observation_lease_refused'); END IF;
 p:=public.admit_shopee_cycle_policy(p_account,'intake');
 IF p IS NULL OR (p->>'revision')::integer IS DISTINCT FROM p_revision
    OR (p->>'shop_id')::bigint IS DISTINCT FROM p_shop
 THEN RETURN jsonb_build_object('status','observation_policy_refused'); END IF;
 t:=clock_timestamp();
 IF p_started<v.updated_at OR p_received<p_started OR p_received>t
   OR t-p_received>interval '30 seconds'
   OR p_received-p_started>interval '48 seconds'
 THEN RETURN jsonb_build_object('status','observation_time_refused'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.shopee_cycle_orders
    WHERE channel_account_id=p_account AND order_sn=p_order AND state='pending')
 THEN RETURN jsonb_build_object('status','observation_candidate_refused'); END IF;
 IF jsonb_typeof(p_payload#>'{response,order_list}') IS DISTINCT FROM 'array'
 THEN RETURN jsonb_build_object('status','observation_raw_refused'); END IF;
 IF jsonb_array_length(p_payload#>'{response,order_list}')<>1
 THEN RETURN jsonb_build_object('status','observation_raw_refused'); END IF;
 o:=p_payload#>'{response,order_list,0}';
 IF o->>'order_sn' IS DISTINCT FROM p_order
   OR jsonb_typeof(o->'create_time') IS DISTINCT FROM 'number'
   OR coalesce(o->>'create_time','') !~ '^[0-9]{1,12}$'
   OR jsonb_typeof(o->'split_up') IS DISTINCT FROM 'boolean'
   OR jsonb_typeof(o->'package_list') IS DISTINCT FROM 'array'
 THEN RETURN jsonb_build_object('status','observation_raw_refused'); END IF;
 IF (o->>'create_time')::bigint <= (p->>'history_cutoff')::bigint
   OR (o->>'create_time')::bigint > floor(extract(epoch FROM t))
   OR jsonb_array_length(o->'package_list')<>1
 THEN RETURN jsonb_build_object('status','observation_raw_refused'); END IF;
 pkg:=o->'package_list'->0;
 IF coalesce(pkg->>'package_number','') !~ '^[A-Za-z0-9_-]{1,100}$'
   OR NOT coalesce((o->>'order_status'='READY_TO_SHIP' AND pkg->>'logistics_status'='LOGISTICS_READY')
       OR (o->>'order_status'='PROCESSED' AND pkg->>'logistics_status'='LOGISTICS_REQUEST_CREATED'),false)
 THEN RETURN jsonb_build_object('status','observation_raw_refused'); END IF;
 SELECT count(*) INTO n FROM public.marketplace_raw_snapshots WHERE
   channel_account_id=p_account AND source='shopee_open_platform' AND environment='live'
   AND external_entity_type='order' AND endpoint='/api/v2/order/get_order_detail'
   AND external_entity_id=p_order AND payload_hash=p_hash;
 IF n<>1 THEN RETURN jsonb_build_object('status','observation_raw_refused'); END IF;
 SELECT * INTO r FROM public.marketplace_raw_snapshots WHERE
   channel_account_id=p_account AND source='shopee_open_platform' AND environment='live'
   AND external_entity_type='order' AND endpoint='/api/v2/order/get_order_detail'
   AND external_entity_id=p_order AND payload_hash=p_hash;
 IF r.payload IS DISTINCT FROM p_payload OR r.observed_at>p_received
 THEN RETURN jsonb_build_object('status','observation_raw_refused'); END IF;
 -- Never overwrite or renew an earlier receipt; out-of-order responses
 -- cannot replace more recently received evidence in the same lease.
 IF EXISTS(SELECT 1 FROM public.shopee_cycle_observations
   WHERE channel_account_id=p_account AND lease_id=p_lease AND response_received_at>=p_received)
 THEN RETURN jsonb_build_object('status','observation_replay_or_out_of_order'); END IF;
 INSERT INTO public.shopee_cycle_observations(channel_account_id,lease_id,policy_revision,shop_id,order_sn,
    raw_id,payload_hash,official_request_id,request_started_at,response_received_at,recorded_at)
 VALUES(p_account,p_lease,p_revision,p_shop,p_order,r.id,p_hash,p_request,p_started,p_received,t)
 ON CONFLICT(channel_account_id,shop_id,official_request_id) DO NOTHING RETURNING id INTO obs;
 IF obs IS NULL THEN RETURN jsonb_build_object('status','observation_replay_or_out_of_order'); END IF;
 RETURN jsonb_build_object('status','observation_recorded','observation_id',obs,'raw_id',r.id);
END $$;
REVOKE ALL ON FUNCTION public.record_shopee_cycle_observation(uuid,uuid,integer,bigint,text,text,jsonb,text,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_shopee_cycle_observation(uuid,uuid,integer,bigint,text,text,jsonb,text,timestamptz,timestamptz) TO service_role;

-- Candidate read for the future reconciliation and claim boundaries.
-- Freshness derives from the receipt, never a rewritten historical Raw.
CREATE FUNCTION public.read_shopee_cycle_observation(p_account uuid,p_lease uuid,p_revision integer,p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v public.shopee_cycle_state%ROWTYPE; p jsonb; e public.shopee_cycle_observations%ROWTYPE;
 r public.marketplace_raw_snapshots%ROWTYPE;
BEGIN
 IF p_action IS NULL OR p_action NOT IN ('intake','ship','label')
   OR NOT public.check_shopee_cycle_policy_lease(p_account,p_lease,p_revision,p_action)
 THEN RETURN NULL; END IF;
 SELECT * INTO v FROM public.shopee_cycle_state WHERE channel_account_id=p_account;
 p:=public.admit_shopee_cycle_policy(p_account,p_action);
 IF NOT FOUND OR v.halted_code IS NOT NULL OR v.lease_id IS DISTINCT FROM p_lease
   OR v.lease_policy_revision IS DISTINCT FROM p_revision OR p IS NULL
   OR (p->>'revision')::integer IS DISTINCT FROM p_revision
 THEN RETURN NULL; END IF;
 SELECT * INTO e FROM public.shopee_cycle_observations
   WHERE channel_account_id=p_account AND lease_id=p_lease AND policy_revision=p_revision
   ORDER BY recorded_at DESC LIMIT 1;
 IF NOT FOUND OR e.order_sn IS DISTINCT FROM v.candidate_order_sn
   OR e.shop_id IS DISTINCT FROM (p->>'shop_id')::bigint
   OR e.request_started_at<v.updated_at OR e.response_received_at>clock_timestamp()
   OR clock_timestamp()-e.response_received_at>interval '30 seconds'
   OR NOT EXISTS(SELECT 1 FROM public.shopee_cycle_orders WHERE channel_account_id=p_account AND order_sn=e.order_sn AND state='pending')
 THEN RETURN NULL; END IF;
 SELECT * INTO r FROM public.marketplace_raw_snapshots WHERE id=e.raw_id AND channel_account_id=p_account
   AND source='shopee_open_platform' AND environment='live' AND external_entity_type='order'
   AND endpoint='/api/v2/order/get_order_detail' AND external_entity_id=e.order_sn AND payload_hash=e.payload_hash;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM public.marketplace_raw_snapshots WHERE channel_account_id=p_account
   AND source='shopee_open_platform' AND environment='live' AND external_entity_type='order'
   AND endpoint='/api/v2/order/get_order_detail' AND external_entity_id=e.order_sn
   AND id<>e.raw_id AND observed_at>=e.response_received_at)
 THEN RETURN NULL; END IF;
 IF NOT public.check_shopee_cycle_policy_lease(p_account,p_lease,p_revision,p_action) THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('observation_id',e.id,'raw_id',r.id,'channel_account_id',p_account,
   'shop_id',e.shop_id,'order_sn',e.order_sn,'payload_hash',e.payload_hash,
   'response_received_at',e.response_received_at,'recorded_at',e.recorded_at,
   'original_observed_at',r.observed_at,'created_at',r.created_at,'payload',r.payload);
END $$;
REVOKE ALL ON FUNCTION public.read_shopee_cycle_observation(uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_shopee_cycle_observation(uuid,uuid,integer,text) TO service_role;
