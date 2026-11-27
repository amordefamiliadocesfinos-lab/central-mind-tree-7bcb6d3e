-- U06-F A07.3 candidata M3, somente ambiente descartável até gates FM e M3.
-- Origem administrativa explícita no evento existente; sem novo ledger de conhecimento.
ALTER TABLE public.nucleo_development_events
 ADD COLUMN registration_origin text NOT NULL DEFAULT 'legado_nao_classificado',
 ADD COLUMN registration_reference text,
 ADD COLUMN registration_request_id uuid;
ALTER TABLE public.nucleo_development_events ADD CONSTRAINT nucleo_m3_registration_origin_check CHECK (
 (registration_origin='legado_nao_classificado' AND registration_reference IS NULL AND registration_request_id IS NULL)
 OR (registration_origin='auth_app' AND actor_auth_uid IS NOT NULL AND registration_reference IS NULL AND registration_request_id IS NULL)
 OR (registration_origin='administrativo_lovable' AND actor_auth_uid IS NULL AND registration_reference IS NOT NULL AND registration_request_id IS NOT NULL AND event_type='alterado' AND before_state IS NOT NULL)
);
CREATE UNIQUE INDEX nucleo_u06f_m3_request_once ON public.nucleo_development_events(registration_request_id) WHERE registration_request_id IS NOT NULL;

-- Contexto transacional é metadado de auditoria, não credencial de autorização.
-- Nenhuma segurança contra um superusuário deliberadamente malicioso é alegada.
CREATE FUNCTION nucleo_u06f_private.m3_event_origin_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE ctx jsonb;
BEGIN
 IF NEW.registration_origin='administrativo_lovable' THEN
  IF current_user<>'postgres' OR session_user<>'postgres' OR auth.uid() IS NOT NULL OR pg_trigger_depth()<2 THEN
   RAISE EXCEPTION 'U06-F M3 origem indevida' USING ERRCODE='42501'; END IF;
  ctx:=nullif(current_setting('nucleo.u06f_m3_context',true),'')::jsonb;
  IF ctx IS NULL OR NEW.registration_request_id::text IS DISTINCT FROM ctx->>'request'
    OR NEW.workstream_id::text IS DISTINCT FROM ctx->>'workstream'
    OR NEW.registration_reference IS DISTINCT FROM ctx->>'decision'
    OR NEW.actor_auth_uid IS NOT NULL OR NEW.event_type<>'alterado'
    OR NEW.before_state IS NULL
    OR (NEW.before_state-ARRAY['next_action','updated_at','updated_by_auth_uid']) IS DISTINCT FROM
       (NEW.after_state-ARRAY['next_action','updated_at','updated_by_auth_uid'])
    OR NEW.before_state->>'next_action' IS NOT DISTINCT FROM NEW.after_state->>'next_action'
    OR NEW.after_state->>'updated_by_auth_uid' IS NOT NULL
  THEN RAISE EXCEPTION 'U06-F M3 delta ou contexto invalido' USING ERRCODE='42501'; END IF;
 ELSE
  IF NEW.registration_origin NOT IN ('legado_nao_classificado','auth_app') OR NEW.registration_reference IS NOT NULL OR NEW.registration_request_id IS NOT NULL
  THEN RAISE EXCEPTION 'U06-F M3 origem invalida' USING ERRCODE='42501'; END IF;
  NEW.registration_origin:=CASE WHEN auth.uid() IS NOT NULL AND NEW.actor_auth_uid=auth.uid() AND pg_trigger_depth()>=2 THEN 'auth_app' ELSE 'legado_nao_classificado' END;
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION nucleo_u06f_private.m3_event_origin_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER nucleo_u06f_m3_event_origin BEFORE INSERT ON public.nucleo_development_events FOR EACH ROW EXECUTE FUNCTION nucleo_u06f_private.m3_event_origin_guard();

CREATE OR REPLACE FUNCTION public.nucleo_m3_workstream_event()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE ctx jsonb;
BEGIN
 IF current_user='postgres' AND session_user='postgres' AND auth.uid() IS NULL THEN
  ctx:=nullif(current_setting('nucleo.u06f_m3_context',true),'')::jsonb;
 END IF;
 IF ctx IS NOT NULL THEN
  INSERT INTO public.nucleo_development_events(workstream_id,event_type,before_state,after_state,actor_auth_uid,registration_origin,registration_reference,registration_request_id)
  VALUES(NEW.id,CASE WHEN TG_OP='INSERT' THEN 'criado' ELSE 'alterado' END,CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW),auth.uid(),'administrativo_lovable',ctx->>'decision',(ctx->>'request')::uuid);
 ELSE
  INSERT INTO public.nucleo_development_events(workstream_id,event_type,before_state,after_state,actor_auth_uid)
  VALUES(NEW.id,CASE WHEN TG_OP='INSERT' THEN 'criado' ELSE 'alterado' END,CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW),auth.uid());
 END IF;
 RETURN NULL;
END;$$;

CREATE FUNCTION nucleo_u06f_private.register_m3_checkpoint(p_request uuid,p_workstream uuid,p_expected_updated_at timestamptz,p_expected_before text,p_checkpoint text,p_action text,p_decision text)
RETURNS TABLE(event_id uuid,workstream_id uuid,updated_at timestamptz,registration_origin text,result text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE w public.nucleo_development_workstreams%ROWTYPE;
 e public.nucleo_development_events%ROWTYPE;
 new_action text;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR auth.uid() IS NOT NULL THEN
  RAISE EXCEPTION 'U06-F requer canal administrativo sem UID humano' USING ERRCODE='42501'; END IF;
 IF p_request IS NULL OR p_workstream IS NULL OR p_expected_updated_at IS NULL OR p_expected_before IS NULL
 OR p_checkpoint IS NULL OR char_length(btrim(p_checkpoint)) NOT BETWEEN 10 AND 12000
 OR p_action IS NULL OR char_length(btrim(p_action)) NOT BETWEEN 10 AND 12000
 OR p_checkpoint ~* '(Ação vigente:|Próxima ação:)' OR p_action ~* '(Ação vigente:|Próxima ação:)'
 OR p_decision IS NULL OR p_decision !~ '^https://github[.]com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/issues/[1-9][0-9]*#issuecomment-[1-9][0-9]*$'
 THEN RAISE EXCEPTION 'U06-F M3 payload invalido' USING ERRCODE='22023'; END IF;
 IF nullif(current_setting('nucleo.u06f_m3_context',true),'') IS NOT NULL THEN
  RAISE EXCEPTION 'U06-F contexto M3 ja ocupado' USING ERRCODE='42501'; END IF;
 new_action:=regexp_replace(regexp_replace(p_expected_before,'Ação vigente:','Ação então vigente (histórica):','gi'),'Próxima ação:','Próxima ação então vigente (histórica):','gi')||E'\n\n'||p_checkpoint||E'\n\nAção vigente: '||p_action;
 PERFORM pg_advisory_xact_lock(hashtextextended('m3-request:'||p_request::text,0));
 SELECT * INTO e FROM public.nucleo_development_events d WHERE d.registration_request_id=p_request;
 IF FOUND THEN
  IF e.workstream_id IS DISTINCT FROM p_workstream OR e.registration_reference IS DISTINCT FROM p_decision
   OR (e.before_state->>'updated_at')::timestamptz IS DISTINCT FROM p_expected_updated_at
   OR e.before_state->>'next_action' IS DISTINCT FROM p_expected_before
   OR e.after_state->>'next_action' IS DISTINCT FROM new_action
   OR e.registration_origin<>'administrativo_lovable' THEN RAISE EXCEPTION 'U06-F M3 request divergente' USING ERRCODE='23505'; END IF;
  RETURN QUERY SELECT e.id,e.workstream_id,(e.after_state->>'updated_at')::timestamptz,e.registration_origin,'confirmado_existente'::text; RETURN;
 END IF;
 SELECT * INTO w FROM public.nucleo_development_workstreams d WHERE d.id=p_workstream FOR UPDATE;
 IF NOT FOUND OR w.updated_at IS DISTINCT FROM p_expected_updated_at OR w.next_action IS DISTINCT FROM p_expected_before
 THEN RAISE EXCEPTION 'U06-F M3 checkpoint anterior divergente' USING ERRCODE='40001'; END IF;
 PERFORM set_config('nucleo.u06f_m3_context',jsonb_build_object('request',p_request,'workstream',p_workstream,'decision',p_decision)::text,true);
 UPDATE public.nucleo_development_workstreams d SET next_action=new_action WHERE d.id=p_workstream RETURNING * INTO w;
 PERFORM set_config('nucleo.u06f_m3_context','',true);
 SELECT * INTO e FROM public.nucleo_development_events d WHERE d.registration_request_id=p_request;
 IF NOT FOUND OR e.after_state IS DISTINCT FROM to_jsonb(w) OR e.before_state->>'next_action' IS DISTINCT FROM p_expected_before OR (e.before_state->>'updated_at')::timestamptz IS DISTINCT FROM p_expected_updated_at
 THEN RAISE EXCEPTION 'U06-F M3 readback divergente'; END IF;
 RETURN QUERY SELECT e.id,e.workstream_id,w.updated_at,e.registration_origin,'confirmado_por_readback'::text;
END;$$;
REVOKE ALL ON FUNCTION nucleo_u06f_private.register_m3_checkpoint(uuid,uuid,timestamptz,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER nucleo_u06f_m3_no_truncate BEFORE TRUNCATE ON public.nucleo_development_events FOR EACH STATEMENT EXECUTE FUNCTION nucleo_u06f_private.reject_history_truncate();
