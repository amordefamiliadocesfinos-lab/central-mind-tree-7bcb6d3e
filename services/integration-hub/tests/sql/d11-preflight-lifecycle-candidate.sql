-- D11 disposable preflight lifecycle. Reuse existing durable lease/queue.
-- No production migration, discovery cursor advance, order creation or effects.
CREATE FUNCTION public.acquire_shopee_d11_preflight(p_account uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE p jsonb; x jsonb; l uuid; rev integer; sn text;
BEGIN
 IF p_account IS NULL OR p_account IN ('8a8ad166-0317-4597-8be6-e43fb46b4d1b','b4027369-5abf-4ac1-ab24-862334fae892') THEN
   RETURN jsonb_build_object('status','account_refused'); END IF;
 p:=public.admit_shopee_cycle_policy(p_account,'intake');
 IF p IS NULL THEN RETURN jsonb_build_object('status','account_refused'); END IF;
 x:=public.acquire_shopee_cycle(p_account);
 IF x->>'status' IS DISTINCT FROM 'acquired' THEN RETURN x; END IF;
 l:=(x->>'lease_id')::uuid; rev:=(x->>'policy_revision')::integer; sn:=x->>'candidate_order_sn';
 -- The underlying acquire holds the same account lock until transaction end.
 p:=public.admit_shopee_cycle_policy(p_account,'intake');
 IF p IS NULL OR rev IS DISTINCT FROM (p->>'revision')::integer
   OR NOT public.check_shopee_cycle_policy_lease(p_account,l,rev,'intake') THEN
   IF public.finish_shopee_cycle(p_account,l,NULL,sn,'pending','d11_preflight_scope_refused')->>'status' IS DISTINCT FROM 'finished' THEN
     RAISE EXCEPTION 'preflight lease release failed'; END IF;
   RETURN jsonb_build_object('status','account_refused');
 END IF;
 RETURN jsonb_build_object('status','acquired','channel_account_id',p_account,
   'lease_id',l,'policy_revision',rev,'candidate_order_sn',sn,'expires_at',x->>'expires_at',
   'work_budget_ms',(p->>'work_budget_ms')::integer);
END $$;

CREATE FUNCTION public.finish_shopee_d11_preflight(p_account uuid,p_lease uuid,p_revision integer,p_candidate text,p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v public.shopee_cycle_state%ROWTYPE; e jsonb; o uuid; pkg text; key text; n bigint;
BEGIN
 IF p_account IS NULL OR p_lease IS NULL OR p_revision IS NULL OR p_revision<1
   OR p_account IN ('8a8ad166-0317-4597-8be6-e43fb46b4d1b','b4027369-5abf-4ac1-ab24-862334fae892')
   OR p_code IS NULL OR p_code NOT IN ('d11_preflight_verified_existing','d11_preflight_no_candidate',
     'd11_preflight_scope_refused','d11_preflight_budget_exhausted','d11_preflight_observation_refused',
     'd11_preflight_reconciliation_refused','d11_preflight_unavailable','d11_intake_written',
     'd11_effect_pending','d11_effect_requires_review','d11_label_available')
   OR ((p_candidate IS NULL) IS DISTINCT FROM (p_code='d11_preflight_no_candidate'))
 THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
 SELECT * INTO v FROM public.shopee_cycle_state WHERE channel_account_id=p_account FOR UPDATE;
 IF NOT FOUND OR v.lease_id IS DISTINCT FROM p_lease OR v.lease_policy_revision IS DISTINCT FROM p_revision
   OR v.lease_expires_at IS NULL OR v.lease_expires_at<=clock_timestamp()
   OR v.candidate_order_sn IS DISTINCT FROM p_candidate
 THEN RETURN jsonb_build_object('status','stale_lease'); END IF;
 IF p_code='d11_intake_written' AND NOT EXISTS(SELECT 1 FROM public.orders WHERE channel_account_id=p_account AND channel='shopee'
  AND order_number=p_candidate AND sale_origin='shopee_open_platform' AND deleted_at IS NULL)
 THEN RETURN jsonb_build_object('status','candidate_refused'); END IF;
 -- Release remains possible after policy pause. Cannot reset blocked/complete work.
 IF p_candidate IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.shopee_cycle_orders
   WHERE channel_account_id=p_account AND order_sn=p_candidate AND state='pending')
 THEN RETURN jsonb_build_object('status','candidate_refused'); END IF;
 -- Complete only the integration queue, never the physical separation.
 IF p_code='d11_label_available' THEN
  e:=public.read_shopee_cycle_observation(p_account,p_lease,p_revision,'label');
  IF e IS NULL OR e->>'order_sn' IS DISTINCT FROM p_candidate
   OR e#>>'{payload,response,order_list,0,order_status}' IS DISTINCT FROM 'PROCESSED'
   OR e#>>'{payload,response,order_list,0,package_list,0,logistics_status}' IS DISTINCT FROM 'LOGISTICS_REQUEST_CREATED'
  THEN RETURN jsonb_build_object('status','candidate_refused'); END IF;
  pkg:=e#>>'{payload,response,order_list,0,package_list,0,package_number}';
  IF coalesce(pkg,'') !~ '^[A-Za-z0-9_-]{1,100}$' THEN RETURN jsonb_build_object('status','candidate_refused'); END IF;
  SELECT count(*) INTO n FROM public.orders WHERE channel_account_id=p_account AND channel='shopee' AND order_number=p_candidate;
  IF n<>1 THEN RETURN jsonb_build_object('status','candidate_refused'); END IF;
  SELECT id INTO o FROM public.orders WHERE channel_account_id=p_account AND channel='shopee' AND order_number=p_candidate
   AND sale_origin='shopee_open_platform' AND deleted_at IS NULL AND status NOT IN ('cancelado','finalizado')
   AND operational_status IN ('todo','preparing') FOR SHARE;
  IF o IS NULL THEN RETURN jsonb_build_object('status','candidate_refused'); END IF;
  key:=encode(sha256(convert_to(p_account::text||':'||(e->>'shop_id')||':'||p_candidate||':'||pkg,'UTF8')),'hex');
  SELECT count(*) INTO n FROM public.order_documents WHERE order_id=o AND document_type='shipping_label'
   AND source='shopee_open_platform' AND storage_bucket='shopee-labels'
   AND storage_path=o::text||'/shopee-'||key||'.pdf' AND mime_type='application/pdf'
   AND file_size BETWEEN 16 AND 4194304;
  IF n<>1 THEN RETURN jsonb_build_object('status','candidate_refused'); END IF;
  RETURN public.finish_shopee_cycle(p_account,p_lease,NULL,p_candidate,'complete',p_code);
 END IF;
 IF p_code='d11_effect_requires_review' THEN
  RETURN public.finish_shopee_cycle(p_account,p_lease,NULL,p_candidate,'blocked',p_code);
 END IF;
 RETURN public.finish_shopee_cycle(p_account,p_lease,NULL,p_candidate,'pending',p_code);
END $$;
REVOKE ALL ON FUNCTION public.acquire_shopee_d11_preflight(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_shopee_d11_preflight(uuid,uuid,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_shopee_d11_preflight(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_shopee_d11_preflight(uuid,uuid,integer,text,text) TO service_role;
