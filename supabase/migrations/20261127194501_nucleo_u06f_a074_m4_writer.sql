-- U06-F A07.4: escritor M4 privado de observações, nunca certificação de progresso.
ALTER TABLE public.nucleo_development_evidence
 ADD COLUMN registration_origin text NOT NULL DEFAULT 'legado_nao_classificado',
 ADD COLUMN registration_reference text,
 ADD COLUMN registration_request_id uuid;
ALTER TABLE public.nucleo_development_evidence ADD CONSTRAINT nucleo_m4_registration_origin_check CHECK (
 (registration_origin='legado_nao_classificado' AND registration_reference IS NULL AND registration_request_id IS NULL)
 OR (registration_origin='auth_app' AND recorded_by_auth_uid IS NOT NULL AND registration_reference IS NULL AND registration_request_id IS NULL)
 OR (registration_origin='administrativo_lovable' AND recorded_by_auth_uid IS NULL AND registration_reference IS NOT NULL AND registration_request_id IS NOT NULL
 AND observed_state='observado' AND checked_at IS NULL AND snapshot='{}'::jsonb)
);
CREATE UNIQUE INDEX nucleo_u06f_m4_request_once ON public.nucleo_development_evidence(registration_request_id) WHERE registration_request_id IS NOT NULL;
CREATE FUNCTION nucleo_u06f_private.valid_m4_observation(r public.nucleo_development_evidence)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(r.workstream_id IS NOT NULL AND r.registration_origin='administrativo_lovable'
 AND r.registration_request_id IS NOT NULL AND r.recorded_by_auth_uid IS NULL AND r.observed_state='observado'
 AND r.checked_at IS NULL AND r.snapshot='{}'::jsonb
 AND char_length(btrim(r.title)) BETWEEN 3 AND 260
 AND char_length(btrim(r.evidence_note)) BETWEEN 10 AND 4000
 AND r.registration_reference ~ '^https://github[.]com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/issues/[1-9][0-9]*#issuecomment-[1-9][0-9]*$'
 AND ((r.source='github' AND r.repository='amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e' AND
   ((r.kind='pull_request' AND r.external_key ~ '^[1-9][0-9]*$' AND r.reference_url='https://github.com/'||r.repository||'/pull/'||r.external_key)
    OR (r.kind='workflow_run' AND r.external_key ~ '^[1-9][0-9]*$' AND r.reference_url='https://github.com/'||r.repository||'/actions/runs/'||r.external_key)
    OR (r.kind='commit' AND r.external_key ~ '^[0-9a-f]{40}$' AND r.reference_url='https://github.com/'||r.repository||'/commit/'||r.external_key)))
 OR (r.source='supabase' AND r.kind='migration' AND r.repository IS NULL AND r.reference_url IS NULL AND r.external_key ~ '^[0-9]{14}$')),false);
$$;
REVOKE ALL ON FUNCTION nucleo_u06f_private.valid_m4_observation(public.nucleo_development_evidence) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.nucleo_m4_evidence_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $audit$
BEGIN
 IF current_user IN ('authenticated','service_role') AND NEW.observed_state<>'observado' THEN
 RAISE EXCEPTION 'M4 client may only record unverified observations'; END IF;
 IF NEW.registration_origin='administrativo_lovable' THEN
 IF current_user<>'postgres' OR session_user<>'postgres' OR auth.uid() IS NOT NULL OR NOT nucleo_u06f_private.valid_m4_observation(NEW)
 THEN RAISE EXCEPTION 'U06-F M4 origem ou observacao invalida' USING ERRCODE='42501'; END IF;
 ELSE
 IF NEW.registration_origin NOT IN ('legado_nao_classificado','auth_app') OR NEW.registration_reference IS NOT NULL OR NEW.registration_request_id IS NOT NULL
 THEN RAISE EXCEPTION 'U06-F M4 origem invalida' USING ERRCODE='42501'; END IF;
 NEW.registration_origin:=CASE WHEN auth.uid() IS NULL THEN 'legado_nao_classificado' ELSE 'auth_app' END;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('m4:'||NEW.workstream_id::text||':'||NEW.source||':'||NEW.kind||':'||NEW.external_key,0));
 IF NEW.registration_origin='administrativo_lovable' AND EXISTS(SELECT 1 FROM public.nucleo_development_evidence e WHERE e.workstream_id=NEW.workstream_id AND e.source=NEW.source AND e.kind=NEW.kind AND e.external_key=NEW.external_key)
 THEN RAISE EXCEPTION 'U06-F M4 referencia ja existente; reconciliar' USING ERRCODE='23505'; END IF;
 NEW.recorded_at=now(); NEW.recorded_by_auth_uid=auth.uid(); RETURN NEW;
END $audit$;
CREATE FUNCTION nucleo_u06f_private.register_m4_observation(p_request uuid,p_workstream uuid,p_source text,p_kind text,p_key text,p_title text,p_note text,p_decision text)
RETURNS TABLE(id uuid,registration_request_id uuid,registration_origin text,observed_state text,result text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.nucleo_development_evidence%ROWTYPE; d public.nucleo_development_evidence%ROWTYPE;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR auth.uid() IS NOT NULL THEN
 RAISE EXCEPTION 'U06-F requer canal administrativo sem UID humano' USING ERRCODE='42501'; END IF;
 d.workstream_id:=p_workstream; d.source:=p_source; d.kind:=p_kind; d.external_key:=p_key;
 d.title:=p_title; d.evidence_note:=p_note; d.observed_state:='observado'; d.snapshot:='{}'::jsonb;
 d.registration_origin:='administrativo_lovable'; d.registration_reference:=p_decision; d.registration_request_id:=p_request;
 IF p_source='github' THEN
 d.repository:='amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e';
 d.reference_url:='https://github.com/'||d.repository||CASE p_kind WHEN 'pull_request' THEN '/pull/' WHEN 'workflow_run' THEN '/actions/runs/' WHEN 'commit' THEN '/commit/' ELSE NULL END||p_key;
 END IF;
 IF NOT nucleo_u06f_private.valid_m4_observation(d) THEN RAISE EXCEPTION 'U06-F M4 payload invalido' USING ERRCODE='22023'; END IF;
 LOCK TABLE public.nucleo_development_evidence IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO r FROM public.nucleo_development_evidence e WHERE e.registration_request_id=p_request;
 IF FOUND THEN
 IF (to_jsonb(r)-ARRAY['id','recorded_at']) IS DISTINCT FROM (to_jsonb(d)-ARRAY['id','recorded_at']) THEN RAISE EXCEPTION 'U06-F M4 request divergente' USING ERRCODE='23505'; END IF;
 RETURN QUERY SELECT r.id,r.registration_request_id,r.registration_origin,r.observed_state,'confirmado_existente'::text; RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.nucleo_development_workstreams w WHERE w.id=p_workstream) THEN RAISE EXCEPTION 'U06-F M4 frente ausente' USING ERRCODE='22023'; END IF;
 IF p_source='supabase' AND NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations m WHERE m.version=p_key) THEN RAISE EXCEPTION 'U06-F M4 migration ausente no ledger' USING ERRCODE='22023'; END IF;
 INSERT INTO public.nucleo_development_evidence(workstream_id,source,kind,repository,external_key,reference_url,title,observed_state,evidence_note,snapshot,registration_origin,registration_reference,registration_request_id)
 VALUES(d.workstream_id,d.source,d.kind,d.repository,d.external_key,d.reference_url,d.title,'observado',d.evidence_note,'{}','administrativo_lovable',d.registration_reference,d.registration_request_id) RETURNING * INTO r;
 IF (to_jsonb(r)-ARRAY['id','recorded_at']) IS DISTINCT FROM (to_jsonb(d)-ARRAY['id','recorded_at']) THEN RAISE EXCEPTION 'U06-F M4 readback divergente'; END IF;
 RETURN QUERY SELECT r.id,r.registration_request_id,r.registration_origin,r.observed_state,'confirmado_por_readback'::text;
END;$$;
REVOKE ALL ON FUNCTION nucleo_u06f_private.register_m4_observation(uuid,uuid,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER nucleo_u06f_m4_no_truncate BEFORE TRUNCATE ON public.nucleo_development_evidence FOR EACH STATEMENT EXECUTE FUNCTION nucleo_u06f_private.reject_history_truncate();
