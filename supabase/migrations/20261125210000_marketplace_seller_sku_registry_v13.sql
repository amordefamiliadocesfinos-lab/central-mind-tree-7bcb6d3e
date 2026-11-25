-- Jornada SKU V1.3 / G03: estrutura comercial preparatoria.
-- Nao renomeia SKU fisico, nao altera mappings, pedidos ou integracao.
-- Migracao em PR; uso produtivo depende de autorizacao de deploy/migracao.
CREATE SCHEMA IF NOT EXISTS sku_private;
REVOKE ALL ON SCHEMA sku_private FROM PUBLIC, anon, authenticated;

CREATE TABLE public.marketplace_seller_sku_state (
 mapping_id uuid PRIMARY KEY REFERENCES public.marketplace_product_mappings(id) ON DELETE RESTRICT,
 offer_family text NOT NULL CHECK (length(btrim(offer_family)) BETWEEN 2 AND 32),
 offer_architecture text NOT NULL CHECK (length(btrim(offer_architecture)) BETWEEN 2 AND 32),
 canonical_sku text NOT NULL CHECK (length(btrim(canonical_sku)) BETWEEN 3 AND 128 AND canonical_sku=upper(btrim(canonical_sku))),
 canonical_decision_source text NOT NULL CHECK (length(btrim(canonical_decision_source)) BETWEEN 3 AND 256),
 canonical_decided_at timestamptz,
 observation_kind text NOT NULL DEFAULT 'UNKNOWN' CHECK (observation_kind IN ('UNKNOWN','BLANK','VALUE')),
 observed_sku text, observed_source text, observed_at timestamptz,
 reconciliation_status text NOT NULL DEFAULT 'PLANEJADO' CHECK (reconciliation_status IN
 ('PLANEJADO','PREPARADO_NO_CORE','PRONTO_PARA_PUBLICAR','PUBLICADO_A_CONFERIR',
 'PUBLICADO_CONFERIDO','DIVERGENTE','LEGADO_PRESERVADO','BLOQUEADO_LOCAL')),
 last_evidence_ref text,
 revision bigint NOT NULL DEFAULT 1 CHECK (revision>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT seller_sku_observation_consistency CHECK (
 (observation_kind='UNKNOWN' AND observed_sku IS NULL AND observed_source IS NULL AND observed_at IS NULL)
 OR (observation_kind='BLANK' AND observed_sku IS NULL AND nullif(btrim(observed_source),'') IS NOT NULL AND observed_at IS NOT NULL)
 OR (observation_kind='VALUE' AND nullif(btrim(observed_sku),'') IS NOT NULL AND nullif(btrim(observed_source),'') IS NOT NULL AND observed_at IS NOT NULL)),
 CONSTRAINT seller_sku_verified_consistency CHECK (
 reconciliation_status<>'PUBLICADO_CONFERIDO' OR
 (observation_kind='VALUE' AND observed_sku=canonical_sku AND nullif(btrim(last_evidence_ref),'') IS NOT NULL))
);

CREATE TABLE public.marketplace_seller_sku_events (
 id uuid PRIMARY KEY,
 mapping_id uuid NOT NULL REFERENCES public.marketplace_seller_sku_state(mapping_id) ON DELETE RESTRICT,
 revision bigint NOT NULL CHECK (revision>0),
 event_kind text NOT NULL CHECK (event_kind IN ('DECISAO','OBSERVACAO','PUBLICACAO','RETIFICACAO','BLOQUEIO')),
 request_hash text NOT NULL,
 state_before jsonb, state_after jsonb NOT NULL,
 evidence_ref text, event_note text,
 actor_auth_user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(mapping_id,revision)
);
CREATE INDEX marketplace_seller_sku_state_status_idx ON public.marketplace_seller_sku_state(reconciliation_status);
CREATE INDEX marketplace_seller_sku_events_mapping_created_idx ON public.marketplace_seller_sku_events(mapping_id,created_at);

ALTER TABLE public.marketplace_seller_sku_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_seller_sku_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.marketplace_seller_sku_state FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.marketplace_seller_sku_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.marketplace_seller_sku_state TO authenticated;
GRANT SELECT ON public.marketplace_seller_sku_events TO authenticated;
CREATE POLICY seller_sku_state_admin_read ON public.marketplace_seller_sku_state FOR SELECT TO authenticated
 USING ((SELECT auth.uid()) IS NOT NULL AND upper(coalesce(public.current_app_user_role(),''))='ADMINISTRADOR');
CREATE POLICY seller_sku_events_admin_read ON public.marketplace_seller_sku_events FOR SELECT TO authenticated
 USING ((SELECT auth.uid()) IS NOT NULL AND upper(coalesce(public.current_app_user_role(),''))='ADMINISTRADOR');

-- Trusted, atomic writer: only active administrator, never a generic mapping rewrite.
CREATE FUNCTION sku_private.record_seller_sku_state(
 p_event_id uuid,p_mapping_id uuid,p_expected_revision bigint,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_actor uuid:=auth.uid();
 v_map public.marketplace_product_mappings%ROWTYPE;
 v_before public.marketplace_seller_sku_state%ROWTYPE;
 v_event public.marketplace_seller_sku_events%ROWTYPE;
 v_before_doc jsonb; v_after_doc jsonb;
 v_hash text; v_revision bigint;
 v_kind text:=p_payload->>'observation_kind';
 v_status text:=p_payload->>'reconciliation_status';
 v_sku text:=btrim(p_payload->>'canonical_sku');
 v_observed text:=p_payload->>'observed_sku';
 v_source text:=p_payload->>'observed_source';
 v_at timestamptz;
 v_evidence text:=nullif(btrim(p_payload->>'last_evidence_ref'),'');
 v_family text:=p_payload->>'offer_family';
 v_arch text:=p_payload->>'offer_architecture';
 v_decision text:=p_payload->>'canonical_decision_source';
 v_event_kind text:=p_payload->>'event_kind';
 v_allowed text[]:=ARRAY['offer_family','offer_architecture','canonical_sku','canonical_decision_source',
 'canonical_decided_at','observation_kind','observed_sku','observed_source','observed_at',
 'reconciliation_status','last_evidence_ref','event_kind','event_note'];
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.app_users u WHERE u.auth_user_id=v_actor
 AND u.is_active=true AND upper(btrim(coalesce(u.role,'')))='ADMINISTRADOR') THEN
 RAISE EXCEPTION 'seller_sku_admin_required' USING ERRCODE='42501'; END IF;
 IF p_event_id IS NULL OR p_mapping_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0
 OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object'
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE NOT(k=ANY(v_allowed))) THEN
 RAISE EXCEPTION 'seller_sku_invalid_request'; END IF;
 v_hash:=md5(jsonb_build_object('mapping',p_mapping_id,'expected',p_expected_revision,'payload',p_payload)::text);
 SELECT * INTO v_event FROM public.marketplace_seller_sku_events WHERE id=p_event_id;
 IF FOUND THEN
   IF v_event.mapping_id IS DISTINCT FROM p_mapping_id OR v_event.request_hash IS DISTINCT FROM v_hash THEN
     RAISE EXCEPTION 'seller_sku_idempotency_conflict'; END IF;
   RETURN jsonb_build_object('mapping_id',p_mapping_id,'revision',v_event.revision,'already_applied',true);
 END IF;
 SELECT * INTO v_map FROM public.marketplace_product_mappings WHERE id=p_mapping_id FOR SHARE;
 IF NOT FOUND OR v_map.marketplace<>'shopee' OR v_map.channel_account_id IS NULL
 OR v_map.external_item_id IS NULL OR v_map.external_model_id IS NULL THEN
 RAISE EXCEPTION 'seller_sku_official_identity_required'; END IF;
 -- Family/architecture cannot be spoofed to bypass a known physical exception.
 IF (v_map.external_item_id IN ('23093522370','22798142097','23094148715','23194255040')
     AND v_arch<>'T30-2') OR
    (v_map.external_item_id IN ('21999552311','23293645454','22398650119','22194274841')
     AND v_arch<>'T40-2') THEN
   RAISE EXCEPTION 'seller_sku_architecture_mismatch';
 END IF;
 IF v_sku IS NULL OR length(v_sku) NOT BETWEEN 3 AND 128 OR v_sku<>upper(v_sku)
 OR length(btrim(coalesce(v_family,''))) NOT BETWEEN 2 AND 32
 OR length(btrim(coalesce(v_arch,''))) NOT BETWEEN 2 AND 32
 OR length(btrim(coalesce(v_decision,''))) NOT BETWEEN 3 AND 256 THEN
 RAISE EXCEPTION 'seller_sku_invalid_semantics'; END IF;
 IF coalesce(v_kind,'') NOT IN ('UNKNOWN','BLANK','VALUE')
 OR coalesce(v_status,'') NOT IN ('PLANEJADO','PREPARADO_NO_CORE','PRONTO_PARA_PUBLICAR',
 'PUBLICADO_A_CONFERIR','PUBLICADO_CONFERIDO','DIVERGENTE','LEGADO_PRESERVADO','BLOQUEADO_LOCAL')
 OR coalesce(v_event_kind,'') NOT IN ('DECISAO','OBSERVACAO','PUBLICACAO','RETIFICACAO','BLOQUEIO') THEN
 RAISE EXCEPTION 'seller_sku_invalid_status'; END IF;
 IF p_payload->>'observed_at' IS NOT NULL THEN v_at:=(p_payload->>'observed_at')::timestamptz; END IF;
 IF (v_kind='UNKNOWN' AND (v_observed IS NOT NULL OR v_source IS NOT NULL OR v_at IS NOT NULL))
 OR (v_kind='BLANK' AND (v_observed IS NOT NULL OR nullif(btrim(coalesce(v_source,'')),'') IS NULL OR v_at IS NULL))
 OR (v_kind='VALUE' AND (nullif(btrim(coalesce(v_observed,'')),'') IS NULL OR nullif(btrim(coalesce(v_source,'')),'') IS NULL OR v_at IS NULL)) THEN
 RAISE EXCEPTION 'seller_sku_observation_unverified'; END IF;
 IF v_status='PUBLICADO_CONFERIDO' AND (v_kind<>'VALUE' OR v_observed<>v_sku OR v_evidence IS NULL) THEN
 RAISE EXCEPTION 'seller_sku_publication_unverified'; END IF;
 IF v_status IN ('PRONTO_PARA_PUBLICAR','PUBLICADO_A_CONFERIR') AND v_evidence IS NULL THEN
   RAISE EXCEPTION 'seller_sku_publication_evidence_required'; END IF;
 IF v_status='LEGADO_PRESERVADO' AND (v_kind<>'VALUE' OR v_observed=v_sku) THEN
   RAISE EXCEPTION 'seller_sku_legacy_observation_required'; END IF;
 -- Os 24 casos T30-2/Amendoim com componentes de 40g permanecem bloqueados.
 IF (v_arch='T30-2' AND EXISTS(SELECT 1 FROM public.marketplace_product_mapping_items mi
 JOIN public.products pr ON pr.id=mi.product_id WHERE mi.mapping_id=p_mapping_id AND pr.sku='TRF-ART-040-M'))
 OR (v_arch='T40-2' AND EXISTS(SELECT 1 FROM public.marketplace_product_mapping_items mi
 JOIN public.products pr ON pr.id=mi.product_id WHERE mi.mapping_id=p_mapping_id AND pr.sku='TRF-ART-030-M')) THEN
 IF v_status<>'BLOQUEADO_LOCAL' THEN RAISE EXCEPTION 'seller_sku_physical_exception'; END IF; END IF;
 SELECT * INTO v_before FROM public.marketplace_seller_sku_state WHERE mapping_id=p_mapping_id FOR UPDATE;
 IF FOUND THEN
   IF v_before.revision<>p_expected_revision THEN RAISE EXCEPTION 'seller_sku_revision_conflict'; END IF;
   IF v_before.observation_kind<>'UNKNOWN' AND v_kind='UNKNOWN' THEN RAISE EXCEPTION 'seller_sku_observation_cannot_be_erased'; END IF;
   IF v_before.observed_at IS NOT NULL AND v_at IS NOT NULL AND v_at<v_before.observed_at THEN
     RAISE EXCEPTION 'seller_sku_observation_time_regression'; END IF;
   v_before_doc:=to_jsonb(v_before); v_revision:=v_before.revision+1;
   UPDATE public.marketplace_seller_sku_state SET offer_family=v_family,offer_architecture=v_arch,
   canonical_sku=v_sku,canonical_decision_source=v_decision,canonical_decided_at=(p_payload->>'canonical_decided_at')::timestamptz,
   observation_kind=v_kind,observed_sku=v_observed,observed_source=v_source,observed_at=v_at,
   reconciliation_status=v_status,last_evidence_ref=v_evidence,revision=v_revision,updated_at=now()
   WHERE mapping_id=p_mapping_id RETURNING to_jsonb(marketplace_seller_sku_state) INTO v_after_doc;
 ELSE
   IF p_expected_revision<>0 THEN RAISE EXCEPTION 'seller_sku_revision_conflict'; END IF;
   v_revision:=1;
   INSERT INTO public.marketplace_seller_sku_state(mapping_id,offer_family,offer_architecture,canonical_sku,
   canonical_decision_source,canonical_decided_at,observation_kind,observed_sku,observed_source,observed_at,
   reconciliation_status,last_evidence_ref,revision)
   VALUES(p_mapping_id,v_family,v_arch,v_sku,v_decision,(p_payload->>'canonical_decided_at')::timestamptz,
   v_kind,v_observed,v_source,v_at,v_status,v_evidence,v_revision)
   RETURNING to_jsonb(marketplace_seller_sku_state) INTO v_after_doc;
 END IF;
 INSERT INTO public.marketplace_seller_sku_events(id,mapping_id,revision,event_kind,request_hash,
 state_before,state_after,evidence_ref,event_note,actor_auth_user_id)
 VALUES(p_event_id,p_mapping_id,v_revision,v_event_kind,v_hash,v_before_doc,v_after_doc,v_evidence,
 nullif(btrim(p_payload->>'event_note'),''),v_actor);
 RETURN jsonb_build_object('mapping_id',p_mapping_id,'revision',v_revision,'already_applied',false);
END;
$fn$;
REVOKE ALL ON FUNCTION sku_private.record_seller_sku_state(uuid,uuid,bigint,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA sku_private TO authenticated;
GRANT EXECUTE ON FUNCTION sku_private.record_seller_sku_state(uuid,uuid,bigint,jsonb) TO authenticated;

-- API invoker: a autorizacao efetiva sempre ocorre no escritor privado.
CREATE FUNCTION public.record_marketplace_seller_sku_state(
 p_event_id uuid,p_mapping_id uuid,p_expected_revision bigint,p_payload jsonb
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT sku_private.record_seller_sku_state(p_event_id,p_mapping_id,p_expected_revision,p_payload);
$$;
REVOKE ALL ON FUNCTION public.record_marketplace_seller_sku_state(uuid,uuid,bigint,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_marketplace_seller_sku_state(uuid,uuid,bigint,jsonb) TO authenticated;

CREATE FUNCTION sku_private.deny_event_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'seller_sku_events_append_only'; END; $$;
REVOKE ALL ON FUNCTION sku_private.deny_event_mutation() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER seller_sku_events_immutable BEFORE UPDATE OR DELETE ON public.marketplace_seller_sku_events
 FOR EACH ROW EXECUTE FUNCTION sku_private.deny_event_mutation();


-- E05: consulta consultiva exata, sem exposicao direta da funcao privilegiada.
-- Definer fica no schema privado; public tem somente wrapper INVOKER
-- com EXECUTE exclusivo para service_role (Core Bridge usa HMAC).
CREATE FUNCTION sku_private.read_marketplace_seller_sku_exact(
  p_channel_account_id uuid,
  p_external_item_id text,
  p_external_model_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $consult$
DECLARE
 v jsonb;
BEGIN
 IF p_channel_account_id IS NULL OR
    p_external_item_id IS NULL OR p_external_item_id !~ '^[0-9]{1,30}$' OR
    p_external_model_id IS NULL OR p_external_model_id !~ '^[0-9]{1,30}$' THEN
   RAISE EXCEPTION 'seller_sku_invalid_official_identity' USING ERRCODE='22023';
 END IF;

 SELECT jsonb_build_object(
   'mapping_found', true,
   'registry_found', s.mapping_id IS NOT NULL,
   'mapping_id', m.id,
   'canonical_sku', s.canonical_sku,
   'observed_sku', s.observed_sku,
   'observation_kind', COALESCE(s.observation_kind,'UNKNOWN'),
   'reconciliation_status', COALESCE(s.reconciliation_status,'NAO_PREPARADO'),
   'revision', s.revision,
   'observed_at', s.observed_at,
   'evidence_ref', s.last_evidence_ref
 ) INTO v
 FROM public.marketplace_product_mappings AS m
 LEFT JOIN public.marketplace_seller_sku_state AS s ON s.mapping_id=m.id
 WHERE m.marketplace='shopee' AND m.channel_account_id=p_channel_account_id
   AND m.external_item_id=p_external_item_id
   AND m.external_model_id=p_external_model_id;

 RETURN COALESCE(v,jsonb_build_object('mapping_found',false,'registry_found',false));
END;
$consult$;

REVOKE ALL ON FUNCTION sku_private.read_marketplace_seller_sku_exact(uuid,text,text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA sku_private TO service_role;
GRANT EXECUTE ON FUNCTION sku_private.read_marketplace_seller_sku_exact(uuid,text,text)
  TO service_role;

CREATE FUNCTION public.read_marketplace_seller_sku_consultive(
  p_channel_account_id uuid,
  p_external_item_id text,
  p_external_model_id text
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT sku_private.read_marketplace_seller_sku_exact(
    p_channel_account_id,p_external_item_id,p_external_model_id);
$$;

REVOKE ALL ON FUNCTION public.read_marketplace_seller_sku_consultive(uuid,text,text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.read_marketplace_seller_sku_consultive(uuid,text,text)
  TO service_role;
