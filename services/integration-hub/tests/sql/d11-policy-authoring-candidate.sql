-- D11 authoring candidate, disposable CI ONLY. No production migration.
-- Reuse the existing administrative capability registry, with a separate
-- purpose. No owner, operator or service-role grant is seeded here.
ALTER TABLE public.app_admin_capabilities DROP CONSTRAINT app_admin_capabilities_capability_check;
ALTER TABLE public.app_admin_capabilities ADD CONSTRAINT app_admin_capabilities_capability_check
 CHECK(capability IN ('provision_users','nucleo_manage','shopee_manage_cycle_policy'));

ALTER TABLE public.shopee_cycle_policy_revisions
 ADD COLUMN request_id uuid UNIQUE;
-- New authoring records always have a request id; older fixture rows may not.
CREATE ROLE d11_policy_author NOLOGIN NOBYPASSRLS;
CREATE SCHEMA d11_policy_private;
REVOKE ALL ON SCHEMA d11_policy_private FROM PUBLIC;
GRANT USAGE ON SCHEMA d11_policy_private TO authenticated,d11_policy_author;
GRANT USAGE ON SCHEMA public,auth TO d11_policy_author;
GRANT EXECUTE ON FUNCTION auth.uid() TO d11_policy_author;
GRANT SELECT ON public.app_admin_capabilities,public.app_users,
 public.channel_accounts,public.digital_platforms,public.shopee_oauth_connections TO d11_policy_author;
GRANT SELECT,INSERT ON public.shopee_cycle_policy_revisions TO d11_policy_author;
GRANT SELECT,INSERT,UPDATE ON public.shopee_cycle_state TO d11_policy_author;
CREATE POLICY d11_capability_author_read ON public.app_admin_capabilities FOR SELECT TO d11_policy_author
 USING(auth_user_id=(SELECT auth.uid()) AND active AND revoked_at IS NULL);
CREATE POLICY d11_policy_author_read ON public.shopee_cycle_policy_revisions FOR SELECT TO d11_policy_author USING(true);
CREATE POLICY d11_policy_author_append ON public.shopee_cycle_policy_revisions FOR INSERT TO d11_policy_author
 WITH CHECK(authorized_by=(SELECT auth.uid()) AND request_id IS NOT NULL);
CREATE POLICY d11_state_author_read ON public.shopee_cycle_state FOR SELECT TO d11_policy_author USING(true);
CREATE POLICY d11_state_author_initialize ON public.shopee_cycle_state FOR INSERT TO d11_policy_author
 WITH CHECK(lease_id IS NULL AND lease_expires_at IS NULL AND candidate_order_sn IS NULL AND halted_code IS NULL);
-- SELECT FOR UPDATE requires UPDATE privilege; no UPDATE policy is granted.
-- The definer function below never writes existing cycle state.

CREATE FUNCTION d11_policy_private.append_revision(
 p_account uuid,p_expected_revision integer,p_request uuid,p_operation text,p_config jsonb,p_evidence text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 actor uuid:=auth.uid(); old public.shopee_cycle_policy_revisions%ROWTYPE;
 prior public.shopee_cycle_policy_revisions%ROWTYPE;
 v_shop bigint; v_now timestamptz; v_epoch bigint; v_revision integer; v_count bigint;
 v_config jsonb; v_expiry timestamptz; v_id uuid;
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.app_admin_capabilities c
   WHERE c.auth_user_id=actor AND c.capability='shopee_manage_cycle_policy' AND c.active AND c.revoked_at IS NULL)
   OR (SELECT count(*) FROM public.app_users u WHERE u.auth_user_id=actor AND u.is_active)<>1
 THEN RETURN jsonb_build_object('status','author_refused'); END IF;
 IF p_account IS NULL OR p_request IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0
   OR p_operation IS NULL OR p_operation NOT IN ('configure','pause')
   OR p_evidence IS NULL OR length(p_evidence) NOT BETWEEN 1 AND 300
   OR p_evidence !~ '^[a-zA-Z0-9][a-zA-Z0-9_.:/#-]*$'
   OR p_account IN ('8a8ad166-0317-4597-8be6-e43fb46b4d1b'::uuid,'b4027369-5abf-4ac1-ab24-862334fae892'::uuid)
 THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
 IF p_operation='pause' AND p_config IS NOT NULL THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
 IF p_operation='configure' AND (jsonb_typeof(p_config) IS DISTINCT FROM 'object'
   OR NOT (p_config ?& ARRAY['capabilities','page_size','max_actions_per_cycle','work_budget_ms','history_cutoff','expires_at','fiscal_mode','shipping_mode','shipping_evidence_ref','document_type'])
   OR p_config-ARRAY['capabilities','page_size','max_actions_per_cycle','work_budget_ms','history_cutoff','expires_at','fiscal_mode','shipping_mode','shipping_evidence_ref','document_type']<>'{}'::jsonb)
 THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
 -- A revision can be paused even if the connection is now expired.
 -- Configure requires canonical active account and exactly one valid Live OAuth.
 IF NOT EXISTS(SELECT 1 FROM public.channel_accounts ca JOIN public.digital_platforms dp ON dp.id=ca.platform_id
   WHERE ca.id=p_account AND dp.group_type='marketplace' AND dp.parent_id IS NULL AND lower(dp.name) LIKE 'shopee%'
     AND (p_operation='pause' OR (ca.is_active AND dp.is_active)))
 THEN RETURN jsonb_build_object('status','account_refused'); END IF;
 IF p_operation='configure' THEN
   SELECT count(*),min(shop_id) INTO v_count,v_shop FROM public.shopee_oauth_connections
     WHERE channel_account_id=p_account AND environment='live';
   IF v_count<>1 OR v_shop IS NULL OR NOT EXISTS(SELECT 1 FROM public.shopee_oauth_connections
     WHERE channel_account_id=p_account AND environment='live' AND shop_id=v_shop
       AND partner_id=2047685 AND shop_status='NORMAL' AND authorization_expires_at>clock_timestamp())
   THEN RETURN jsonb_build_object('status','connection_refused'); END IF;
 END IF;
 -- Same account row and lock order as acquire and claim. Initialize only for
 -- first configuration. Pause never creates state for an unknown account.
 IF p_operation='configure' THEN
   v_epoch:=floor(extract(epoch FROM clock_timestamp()))::bigint;
   INSERT INTO public.shopee_cycle_state(channel_account_id,time_from,time_to)
     VALUES(p_account,v_epoch-604800,v_epoch-30) ON CONFLICT DO NOTHING;
 END IF;
 PERFORM 1 FROM public.shopee_cycle_state WHERE channel_account_id=p_account FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','account_state_missing'); END IF;
 -- Recheck real actor after waiting for the shared lock.
 IF NOT EXISTS(SELECT 1 FROM public.app_admin_capabilities c
   WHERE c.auth_user_id=actor AND c.capability='shopee_manage_cycle_policy' AND c.active AND c.revoked_at IS NULL)
   OR (SELECT count(*) FROM public.app_users u WHERE u.auth_user_id=actor AND u.is_active)<>1
 THEN RETURN jsonb_build_object('status','author_refused'); END IF;
 SELECT * INTO old FROM public.shopee_cycle_policy_revisions WHERE channel_account_id=p_account ORDER BY revision DESC LIMIT 1;
 v_revision:=coalesce(old.revision,0);
 SELECT * INTO prior FROM public.shopee_cycle_policy_revisions WHERE request_id=p_request;
 IF FOUND THEN
   -- No replay can create another revision; collisions require review.
   IF prior.channel_account_id=p_account AND prior.authorized_by=actor
     AND prior.revision=p_expected_revision+1 AND prior.evidence_ref=p_evidence
     AND ((p_operation='pause' AND prior.paused AND NOT prior.enabled)
       OR (p_operation='configure' AND prior.enabled AND NOT prior.paused AND
       jsonb_build_object('capabilities',prior.capabilities,'page_size',prior.page_size,
       'max_actions_per_cycle',prior.max_actions_per_cycle,'work_budget_ms',prior.work_budget_ms,
       'history_cutoff',prior.history_cutoff,'expires_at',prior.expires_at,'fiscal_mode',prior.fiscal_mode,
       'shipping_mode',prior.shipping_mode,'shipping_evidence_ref',prior.shipping_evidence_ref,'document_type',prior.document_type)
       =jsonb_set(p_config,'{expires_at}',to_jsonb((p_config->>'expires_at')::timestamptz))))
   THEN RETURN jsonb_build_object('status','already_recorded','revision',prior.revision,'current_revision',v_revision); END IF;
   RETURN jsonb_build_object('status','request_collision');
 END IF;
 IF v_revision<>p_expected_revision THEN RETURN jsonb_build_object('status','revision_conflict','current_revision',v_revision); END IF;
 v_now:=clock_timestamp();
 IF p_operation='pause' THEN
   IF old.revision IS NULL THEN RETURN jsonb_build_object('status','policy_missing'); END IF;
   INSERT INTO public.shopee_cycle_policy_revisions(channel_account_id,revision,environment,shop_id,partner_id,
     history_cutoff,authorized_by,authorized_at,evidence_ref,request_id)
   VALUES(p_account,v_revision+1,'live',old.shop_id,old.partner_id,old.history_cutoff,actor,v_now,p_evidence,p_request);
 ELSE
   -- Read canonical identity again under the account lock. No caller shop,
   -- actor, revision timestamp, or partner value enters the inserted record.
   SELECT count(*),min(shop_id) INTO v_count,v_shop FROM public.shopee_oauth_connections
     WHERE channel_account_id=p_account AND environment='live';
   IF v_count<>1 OR v_shop IS NULL OR NOT EXISTS(SELECT 1 FROM public.shopee_oauth_connections
     WHERE channel_account_id=p_account AND environment='live' AND shop_id=v_shop
       AND partner_id=2047685 AND shop_status='NORMAL' AND authorization_expires_at>v_now)
   THEN RETURN jsonb_build_object('status','connection_refused'); END IF;
   IF old.revision IS NOT NULL AND old.shop_id<>v_shop THEN RETURN jsonb_build_object('status','shop_change_requires_review'); END IF;
   IF jsonb_typeof(p_config->'expires_at') IS DISTINCT FROM 'string'
     OR jsonb_typeof(p_config->'history_cutoff') IS DISTINCT FROM 'number'
     OR jsonb_typeof(p_config->'page_size') IS DISTINCT FROM 'number'
     OR jsonb_typeof(p_config->'max_actions_per_cycle') IS DISTINCT FROM 'number'
     OR jsonb_typeof(p_config->'work_budget_ms') IS DISTINCT FROM 'number'
   THEN RETURN jsonb_build_object('status','invalid_config'); END IF;
   v_expiry:=(p_config->>'expires_at')::timestamptz;
   IF v_expiry IS NULL OR v_expiry<=v_now OR v_expiry>v_now+interval '30 days'
     OR (p_config->>'history_cutoff')::bigint>floor(extract(epoch FROM v_now))
     OR (old.revision IS NOT NULL AND (p_config->>'history_cutoff')::bigint<old.history_cutoff)
     OR (p_config->'capabilities'->>'ship'='true' AND
       coalesce(p_config->>'shipping_evidence_ref','') !~ '^[a-zA-Z0-9][a-zA-Z0-9_.:/#-]*$')
   THEN RETURN jsonb_build_object('status','invalid_config'); END IF;
   INSERT INTO public.shopee_cycle_policy_revisions(channel_account_id,revision,environment,shop_id,partner_id,
     enabled,paused,capabilities,page_size,max_actions_per_cycle,work_budget_ms,history_cutoff,
     authorized_by,authorized_at,expires_at,evidence_ref,fiscal_mode,shipping_mode,shipping_evidence_ref,document_type,request_id)
   VALUES(p_account,v_revision+1,'live',v_shop,2047685,true,false,p_config->'capabilities',
     (p_config->>'page_size')::integer,(p_config->>'max_actions_per_cycle')::integer,(p_config->>'work_budget_ms')::integer,
     (p_config->>'history_cutoff')::bigint,actor,v_now,v_expiry,p_evidence,p_config->>'fiscal_mode',
     p_config->>'shipping_mode',p_config->>'shipping_evidence_ref',p_config->>'document_type',p_request);
 END IF;
 RETURN jsonb_build_object('status','recorded','revision',v_revision+1);
EXCEPTION WHEN check_violation OR invalid_text_representation OR numeric_value_out_of_range OR datetime_field_overflow OR invalid_datetime_format OR not_null_violation
 THEN RETURN jsonb_build_object('status','invalid_config');
 WHEN unique_violation THEN RETURN jsonb_build_object('status','request_collision');
END $$;
ALTER FUNCTION d11_policy_private.append_revision(uuid,integer,uuid,text,jsonb,text) OWNER TO d11_policy_author;
REVOKE ALL ON FUNCTION d11_policy_private.append_revision(uuid,integer,uuid,text,jsonb,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION d11_policy_private.append_revision(uuid,integer,uuid,text,jsonb,text) TO authenticated;
-- A public INVOKER façade is the only candidate API. No actor argument.
CREATE FUNCTION public.append_shopee_cycle_policy_revision(uuid,integer,uuid,text,jsonb,text)
 RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT d11_policy_private.append_revision($1,$2,$3,$4,$5,$6);
$$;
REVOKE ALL ON FUNCTION public.append_shopee_cycle_policy_revision(uuid,integer,uuid,text,jsonb,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.append_shopee_cycle_policy_revision(uuid,integer,uuid,text,jsonb,text) TO authenticated;
