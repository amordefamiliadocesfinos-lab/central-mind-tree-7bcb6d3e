-- Candidate protected reader and lease fencing. DISPOSABLE ONLY.
-- No new queue or lease. The eventual authenticated policy writer must take
-- the same per-account lock and append a revision; no such writer exists here.
ALTER TABLE public.shopee_cycle_state ADD COLUMN lease_policy_revision integer
  CHECK (lease_policy_revision IS NULL OR lease_policy_revision>0),
 ADD COLUMN d11_next_discovery boolean NOT NULL DEFAULT true;

CREATE FUNCTION public.read_shopee_cycle_policy(p_channel_account_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE
  p public.shopee_cycle_policy_revisions%ROWTYPE;
  c jsonb;
  o jsonb;
BEGIN
  SELECT * INTO p FROM public.shopee_cycle_policy_revisions
    WHERE channel_account_id=p_channel_account_id ORDER BY revision DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT jsonb_build_object('id',ca.id,'is_active',ca.is_active,'marketplace','shopee') INTO c
    FROM public.channel_accounts ca JOIN public.digital_platforms dp ON dp.id=ca.platform_id
    WHERE ca.id=p_channel_account_id AND ca.is_active AND dp.is_active
      AND dp.group_type='marketplace' AND dp.parent_id IS NULL AND lower(dp.name) LIKE 'shopee%';
  IF c IS NULL THEN RETURN NULL; END IF;
  -- Reject duplicate live connections rather than picking one arbitrarily.
  IF (SELECT count(*) FROM public.shopee_oauth_connections
       WHERE channel_account_id=p_channel_account_id AND environment='live')<>1 THEN RETURN NULL; END IF;
  SELECT jsonb_build_object('channel_account_id',oc.channel_account_id,
    'environment',oc.environment,'shop_id',oc.shop_id,'partner_id',oc.partner_id,
    'shop_status',oc.shop_status,'authorization_expires_at',oc.authorization_expires_at) INTO o
    FROM public.shopee_oauth_connections oc
    WHERE oc.channel_account_id=p_channel_account_id AND oc.environment='live';
  RETURN jsonb_build_object('policy',to_jsonb(p),'channel',c,'connection',o);
END $$;
REVOKE ALL ON FUNCTION public.read_shopee_cycle_policy(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_shopee_cycle_policy(uuid) TO service_role;

-- All structural constraints remain those of the verified storage candidate.
-- This SQL admission additionally rechecks canonical identity, authority,
-- time and capability using the current revision (no fallback to old revision).
CREATE FUNCTION public.admit_shopee_cycle_policy(p_channel_account_id uuid,p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE r jsonb; p jsonb; o jsonb; t timestamptz:=clock_timestamp();
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('discover','intake','ship','label','refresh') THEN RETURN NULL; END IF;
  r:=public.read_shopee_cycle_policy(p_channel_account_id);
  p:=r->'policy'; o:=r->'connection';
  IF NOT coalesce(
      (p->>'enabled')::boolean AND NOT (p->>'paused')::boolean
      AND (p->'capabilities'->>p_action)::boolean
      AND p->>'channel_account_id'=p_channel_account_id::text
      AND r->'channel'->>'id'=p_channel_account_id::text
      AND o->>'channel_account_id'=p_channel_account_id::text
      AND p->>'environment'='live' AND o->>'environment'='live'
      AND p->>'shop_id'=o->>'shop_id' AND p->>'partner_id'=o->>'partner_id'
      AND p->>'partner_id'='2047685' AND o->>'shop_status'='NORMAL'
      AND (o->>'authorization_expires_at')::timestamptz>t
      AND (p->>'authorized_at')::timestamptz<=t AND (p->>'expires_at')::timestamptz>t
      AND length(p->>'evidence_ref') BETWEEN 1 AND 300
      AND p->>'evidence_ref' ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:/#-]*$'
      AND ((p->'capabilities'->>'ship')::boolean=false OR
        (length(p->>'shipping_evidence_ref') BETWEEN 1 AND 300
        AND p->>'shipping_evidence_ref' ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:/#-]*$'))
      AND (p->>'history_cutoff')::bigint<=floor(extract(epoch FROM t))
    ,false) THEN RETURN NULL; END IF;
  RETURN p;
END $$;
REVOKE ALL ON FUNCTION public.admit_shopee_cycle_policy(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admit_shopee_cycle_policy(uuid,text) TO service_role;

-- A fence read is NOT an atomic writer claim. Future effects must enforce
-- this revision + lease at their irreversible boundary; never use this alone.
CREATE FUNCTION public.check_shopee_cycle_policy_lease(
  p_channel_account_id uuid,p_lease_id uuid,p_revision integer,p_action text
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v public.shopee_cycle_state%ROWTYPE; p jsonb;
BEGIN
  SELECT * INTO v FROM public.shopee_cycle_state WHERE channel_account_id=p_channel_account_id;
  IF NOT FOUND OR p_lease_id IS NULL OR p_revision IS NULL
    OR v.lease_id IS DISTINCT FROM p_lease_id
    OR v.lease_policy_revision IS DISTINCT FROM p_revision
    OR v.lease_expires_at IS NULL OR v.lease_expires_at<=clock_timestamp()
  THEN RETURN false; END IF;
  p:=public.admit_shopee_cycle_policy(p_channel_account_id,p_action);
  RETURN coalesce((p->>'revision')::integer=p_revision,false);
END $$;
REVOKE ALL ON FUNCTION public.check_shopee_cycle_policy_lease(uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.check_shopee_cycle_policy_lease(uuid,uuid,integer,text) TO service_role;
