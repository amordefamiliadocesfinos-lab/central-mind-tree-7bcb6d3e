-- U06-F A07.2 — migration oficial candidata a CI; somente DDL.
-- Revisões FM administrativas são rascunhos, com fonte imutável e versão esperada.
-- Nenhum grant novo, nenhuma promoção, nenhum backfill de autoria histórica.
ALTER TABLE public.nucleo_module_knowledge_revisions
 ADD COLUMN registration_origin text NOT NULL DEFAULT 'legado_nao_classificado',
 ADD COLUMN registration_reference text,
 ADD COLUMN registration_request_id uuid;
ALTER TABLE public.nucleo_module_knowledge_revisions ADD CONSTRAINT nucleo_fm_registration_origin_check CHECK (
 (registration_origin='legado_nao_classificado' AND registration_reference IS NULL AND registration_request_id IS NULL)
 OR (registration_origin='auth_app' AND recorded_by_auth_uid IS NOT NULL AND registration_reference IS NULL AND registration_request_id IS NULL)
 OR (registration_origin='administrativo_lovable' AND recorded_by_auth_uid IS NULL AND registration_reference IS NOT NULL
 AND registration_request_id IS NOT NULL AND authority_state='rascunho' AND evidence_level='declarado' AND reviewed_by='')
);
CREATE UNIQUE INDEX nucleo_u06f_fm_request_once ON public.nucleo_module_knowledge_revisions(registration_request_id)
 WHERE registration_request_id IS NOT NULL;
CREATE FUNCTION nucleo_u06f_private.valid_fm_draft(r public.nucleo_module_knowledge_revisions)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(r.registration_origin='administrativo_lovable' AND r.registration_request_id IS NOT NULL
 AND r.recorded_by_auth_uid IS NULL AND r.authority_state='rascunho' AND r.evidence_level='declarado' AND r.reviewed_by=''
 AND r.module_id IS NOT NULL AND r.section_code IN ('FM-01','FM-02','FM-03','FM-04','FM-05','FM-06','FM-07','FM-08','FM-09','FM-10')
 AND r.version_no BETWEEN 2 AND 1000000
 AND char_length(btrim(r.title)) BETWEEN 3 AND 180 AND char_length(btrim(r.body)) BETWEEN 10 AND 12000
 AND r.source_reference ~ '^https://github[.]com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/[0-9a-f]{40}/docs/([A-Za-z0-9_.-]+/)*[A-Za-z0-9_.-]+[.](md|txt|pdf)$'
 AND r.source_reference NOT LIKE '%..%' AND r.source_reference NOT LIKE '%/./%'
 AND r.registration_reference ~ '^https://github[.]com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/issues/[1-9][0-9]*#issuecomment-[1-9][0-9]*$',false);
$$;
REVOKE ALL ON FUNCTION nucleo_u06f_private.valid_fm_draft(public.nucleo_module_knowledge_revisions) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.nucleo_fm_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE module_kind text;
BEGIN
 IF current_user IN ('authenticated','service_role') AND NOT EXISTS (
    SELECT 1 FROM public.app_admin_capabilities c
    WHERE c.auth_user_id=auth.uid() AND c.capability='nucleo_manage'
      AND c.active AND c.revoked_at IS NULL
 ) THEN
    RAISE EXCEPTION 'Ficha Viva authorization required';
 END IF;
 SELECT kind INTO module_kind FROM public.nucleo_development_workstreams WHERE id=NEW.module_id;
 IF module_kind IS DISTINCT FROM 'modulo' THEN
   RAISE EXCEPTION 'Ficha Viva requires an existing module record';
 END IF;
 -- Browser inserts do not assert evidence verification, human approval or authority.
 IF current_user IN ('authenticated','service_role') AND
   (NEW.authority_state <> 'rascunho' OR NEW.evidence_level <> 'declarado'
    OR NEW.reviewed_by <> '') THEN
   RAISE EXCEPTION 'Ficha Viva client may only submit unverified draft revisions';
 END IF;
 IF NEW.registration_origin='administrativo_lovable' THEN
   IF current_user<>'postgres' OR session_user<>'postgres' OR auth.uid() IS NOT NULL
      OR NOT nucleo_u06f_private.valid_fm_draft(NEW) THEN
      RAISE EXCEPTION 'U06-F FM origem ou escopo invalido' USING ERRCODE='42501';
   END IF;
   PERFORM pg_advisory_xact_lock(hashtextextended('fm:'||NEW.module_id::text||':'||NEW.section_code,0));
   IF NEW.version_no IS DISTINCT FROM (SELECT coalesce(max(v.version_no),0)+1 FROM public.nucleo_module_knowledge_revisions v WHERE v.module_id=NEW.module_id AND v.section_code=NEW.section_code)
   OR NEW.version_no<2 THEN RAISE EXCEPTION 'U06-F FM versao anterior divergente' USING ERRCODE='40001'; END IF;
 ELSE
   IF NEW.registration_origin NOT IN ('legado_nao_classificado','auth_app') OR NEW.registration_reference IS NOT NULL OR NEW.registration_request_id IS NOT NULL THEN
     RAISE EXCEPTION 'U06-F FM origem invalida' USING ERRCODE='42501';
   END IF;
   NEW.registration_origin:=CASE WHEN auth.uid() IS NULL THEN 'legado_nao_classificado' ELSE 'auth_app' END;
   PERFORM pg_advisory_xact_lock(hashtextextended('fm:'||NEW.module_id::text||':'||NEW.section_code,0));
 END IF;
 NEW.recorded_at=now();
 NEW.recorded_by_auth_uid=auth.uid();
 RETURN NEW;
END $fn$;
CREATE FUNCTION nucleo_u06f_private.register_fm_revision(p_request uuid,p_module uuid,p_section text,p_expected_version integer,p_title text,p_body text,p_source text,p_decision text)
RETURNS TABLE(id uuid,version_no integer,registration_request_id uuid,registration_origin text,result text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.nucleo_module_knowledge_revisions%ROWTYPE;
 desired public.nucleo_module_knowledge_revisions%ROWTYPE;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR auth.uid() IS NOT NULL THEN
 RAISE EXCEPTION 'U06-F requer canal administrativo sem UID humano' USING ERRCODE='42501'; END IF;
 IF p_expected_version IS NULL OR p_expected_version NOT BETWEEN 1 AND 999999 THEN RAISE EXCEPTION 'FM exige versao anterior existente' USING ERRCODE='22023'; END IF;
 desired.module_id:=p_module; desired.section_code:=p_section; desired.version_no:=p_expected_version+1;
 desired.title:=p_title;desired.body:=p_body;desired.source_reference:=p_source;
 desired.authority_state:='rascunho';desired.evidence_level:='declarado';desired.reviewed_by:='';
 desired.registration_origin:='administrativo_lovable';desired.registration_reference:=p_decision;desired.registration_request_id:=p_request;
 IF NOT nucleo_u06f_private.valid_fm_draft(desired) THEN RAISE EXCEPTION 'U06-F FM payload invalido' USING ERRCODE='22023'; END IF;
 LOCK TABLE public.nucleo_module_knowledge_revisions IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO r FROM public.nucleo_module_knowledge_revisions v WHERE v.registration_request_id=p_request;
 IF FOUND THEN
 IF (to_jsonb(r)-ARRAY['id','recorded_at']) IS DISTINCT FROM (to_jsonb(desired)-ARRAY['id','recorded_at']) THEN RAISE EXCEPTION 'U06-F FM request divergente' USING ERRCODE='23505'; END IF;
 RETURN QUERY SELECT r.id,r.version_no,r.registration_request_id,r.registration_origin,'confirmado_existente'::text; RETURN; END IF;
 IF p_expected_version IS DISTINCT FROM (SELECT max(v.version_no) FROM public.nucleo_module_knowledge_revisions v WHERE v.module_id=p_module AND v.section_code=p_section)
 THEN RAISE EXCEPTION 'U06-F FM versao anterior divergente' USING ERRCODE='40001'; END IF;
 INSERT INTO public.nucleo_module_knowledge_revisions(module_id,section_code,version_no,title,body,source_reference,authority_state,evidence_level,reviewed_by,registration_origin,registration_reference,registration_request_id)
 VALUES(p_module,p_section,p_expected_version+1,p_title,p_body,p_source,'rascunho','declarado','','administrativo_lovable',p_decision,p_request) RETURNING * INTO r;
 IF (to_jsonb(r)-ARRAY['id','recorded_at']) IS DISTINCT FROM (to_jsonb(desired)-ARRAY['id','recorded_at']) THEN RAISE EXCEPTION 'U06-F FM readback divergente'; END IF;
 RETURN QUERY SELECT r.id,r.version_no,r.registration_request_id,r.registration_origin,'confirmado_por_readback'::text;
END;$$;
REVOKE ALL ON FUNCTION nucleo_u06f_private.register_fm_revision(uuid,uuid,text,integer,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
-- Preservar histórico também contra TRUNCATE por papel legado com grant amplo.
CREATE FUNCTION nucleo_u06f_private.reject_history_truncate() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'U06-F historico nao pode ser truncado' USING ERRCODE='42501'; END;$$;
REVOKE ALL ON FUNCTION nucleo_u06f_private.reject_history_truncate() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER nucleo_u06f_fm_no_truncate BEFORE TRUNCATE ON public.nucleo_module_knowledge_revisions FOR EACH STATEMENT EXECUTE FUNCTION nucleo_u06f_private.reject_history_truncate();
