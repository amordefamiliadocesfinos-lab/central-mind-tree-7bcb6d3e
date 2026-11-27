-- A07.1 CANDIDATA ISOLADA: não aplicar em produção.
-- Propostas iniciais por referência imutável GitHub; nenhuma decisão/publicação.
-- O postgres já é administrativo; estas guardas não isolam um superusuário malicioso.
CREATE FUNCTION nucleo_u06f_private.valid_ac01_proposal(r public.nucleo_specialist_contributions)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(r.registration_origin='administrativo_lovable'
 AND r.recorded_by_auth_uid IS NULL AND r.request_id IS NOT NULL
 AND r.module_id IS NOT NULL AND r.source_kind='github'
 AND r.source_locator ~ '^https://github[.]com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/[0-9a-f]{40}/docs/[A-Za-z0-9_./-]+[.](md|txt|pdf)$'
 AND r.source_locator NOT LIKE '%..%' AND r.source_locator NOT LIKE '%//docs//%'
 AND r.source_locator NOT LIKE '%/./%' AND r.source_locator NOT LIKE '%/../%'
 AND r.registration_reference ~ '^https://github[.]com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/issues/[1-9][0-9]*#issuecomment-[1-9][0-9]*$'
 AND r.source_reference_id IS NULL AND r.source_checksum_sha256 IS NULL
 AND r.parent_revision_id IS NULL AND r.version_no=1 AND r.authority_state='proposta'
 AND char_length(btrim(r.specialist_role)) BETWEEN 3 AND 180
 AND char_length(btrim(r.title)) BETWEEN 3 AND 180
 AND char_length(r.note) BETWEEN 1 AND 2000
 AND r.contribution_kind IN ('metodo','ecossistema','manual','procedimento','aprendizado','mapa','checkpoint','arquivo','outro'),false);
$$;
REVOKE ALL ON FUNCTION nucleo_u06f_private.valid_ac01_proposal(public.nucleo_specialist_contributions) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.nucleo_specialist_contributions DROP CONSTRAINT nucleo_ac01_registration_identity_check;
ALTER TABLE public.nucleo_specialist_contributions ADD CONSTRAINT nucleo_ac01_registration_identity_check CHECK (
 (registration_origin='auth_app' AND recorded_by_auth_uid IS NOT NULL AND registration_reference IS NULL)
 OR (registration_origin='administrativo_lovable' AND recorded_by_auth_uid IS NULL
 AND registration_reference IS NOT NULL AND parent_revision_id IS NULL AND version_no=1 AND authority_state='proposta')
);
-- A regra fixa do piloto permanece no trigger. Outras propostas passam pela validação estrita.
CREATE OR REPLACE FUNCTION public.nucleo_ac01_before_insert() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE parent public.nucleo_specialist_contributions%ROWTYPE;
BEGIN
 IF NEW.registration_origin='administrativo_lovable' THEN
   IF current_user<>'postgres' OR session_user<>'postgres' OR auth.uid() IS NOT NULL
      OR (CASE WHEN NEW.request_id='87d4757e-9391-4fbd-a111-b3a8cf86aa06'::uuid THEN (NEW.module_id='3d9351f1-75e0-4581-86e1-edb902532ae3'::uuid AND NEW.workstream_id='078fcd0b-3e45-4c76-878d-1a9e14a50b64'::uuid AND NEW.request_id='87d4757e-9391-4fbd-a111-b3a8cf86aa06'::uuid AND NEW.specialist_role='Integração Shopee Multicontas' AND NEW.contribution_kind='metodo' AND NEW.title='Refinamento do Método de Integração Shopee Multicontas V2.0' AND NEW.source_kind='github' AND NEW.source_locator='https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/095adee52910ecae78949595c4eeba65b60e2d46/docs/operations/REFINAMENTO_METODO_INTEGRACAO_SHOPEE_MULTICONTAS_V2_0_2026-11-26.md' AND NEW.note='Refinamento conceitual R01–R05; proposta documental, sem promoção soberana ou autorização produtiva. Origem administrativa, sem identidade humana Auth.' AND NEW.parent_revision_id IS NULL AND NEW.source_reference_id IS NULL AND NEW.source_checksum_sha256 IS NULL AND NEW.registration_origin='administrativo_lovable' AND NEW.registration_reference='https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/issues/1037#issuecomment-7221728368' AND NEW.recorded_by_auth_uid IS NULL AND NEW.version_no=1 AND NEW.authority_state='proposta') ELSE nucleo_u06f_private.valid_ac01_proposal(NEW) END) IS DISTINCT FROM true THEN
     RAISE EXCEPTION 'U06-F origem ou escopo administrativo inválido' USING ERRCODE='42501';
   END IF;
 ELSE
   IF NEW.registration_origin IS DISTINCT FROM 'auth_app' OR NEW.registration_reference IS NOT NULL
      OR auth.uid() IS NULL THEN RAISE EXCEPTION 'AC-01 requer sessão autenticada'; END IF;
   NEW.recorded_by_auth_uid := auth.uid();
 END IF;
 -- Serializa referência também com o formulário humano, sem alterar duplicidades humanas legadas.
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.module_id::text||':'||NEW.source_locator,0));
 IF EXISTS(SELECT 1 FROM public.nucleo_specialist_contributions c
 WHERE c.module_id=NEW.module_id AND c.source_locator=NEW.source_locator
 AND (NEW.registration_origin='administrativo_lovable' OR c.registration_origin='administrativo_lovable'))
 THEN RAISE EXCEPTION 'U06-F referencia ja registrada; reconciliar' USING ERRCODE='23505'; END IF;
 NEW.recorded_at := now();
 IF NOT EXISTS (SELECT 1 FROM public.nucleo_development_workstreams w
   WHERE w.id=NEW.module_id AND w.kind='modulo') THEN
   RAISE EXCEPTION 'AC-01 requer módulo M3 válido';
 END IF;
 IF NEW.workstream_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM public.nucleo_development_workstreams w
   LEFT JOIN public.nucleo_development_workstreams f ON f.id=w.parent_id
   WHERE w.id=NEW.workstream_id AND
    ((w.kind='frente' AND w.parent_id=NEW.module_id) OR
     (w.kind='subfrente' AND f.parent_id=NEW.module_id))
 ) THEN RAISE EXCEPTION 'AC-01 frente não pertence ao módulo'; END IF;
 IF NEW.source_reference_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM public.nucleo_source_references s
   WHERE s.id=NEW.source_reference_id
    AND s.provider=NEW.source_kind AND s.provider_file_id=NEW.source_locator
 ) THEN RAISE EXCEPTION 'AC-01 referência não coincide com metadados de origem'; END IF;
 IF NEW.parent_revision_id IS NULL THEN
   NEW.version_no:=1;
   NEW.authority_state:='proposta';
 ELSE
   SELECT * INTO parent FROM public.nucleo_specialist_contributions p
    WHERE p.id=NEW.parent_revision_id;
   IF NOT FOUND OR parent.module_id<>NEW.module_id OR
      parent.specialist_role<>NEW.specialist_role OR
      parent.contribution_kind<>NEW.contribution_kind THEN
      RAISE EXCEPTION 'AC-01 cadeia documental incompatível';
   END IF;
   NEW.lineage_id:=parent.lineage_id;
   NEW.version_no:=parent.version_no+1;
   NEW.authority_state:='em_evolucao';
 END IF;
 RETURN NEW;
END;$$;
CREATE FUNCTION nucleo_u06f_private.register_ac01_proposal(
 p_request uuid,p_module uuid,p_workstream uuid,p_role text,p_kind text,p_title text,
 p_locator text,p_note text,p_decision text)
RETURNS TABLE(id uuid,request_id uuid,authority_state text,registration_origin text,recorded_by_auth_uid uuid,result text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.nucleo_specialist_contributions%ROWTYPE;
        desired public.nucleo_specialist_contributions%ROWTYPE;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR auth.uid() IS NOT NULL THEN
  RAISE EXCEPTION 'U06-F requer canal administrativo sem UID humano' USING ERRCODE='42501'; END IF;
 IF p_request='87d4757e-9391-4fbd-a111-b3a8cf86aa06'::uuid THEN
  RAISE EXCEPTION 'U06-F request reservado ao piloto' USING ERRCODE='42501'; END IF;
 desired.request_id:=p_request; desired.module_id:=p_module; desired.workstream_id:=p_workstream;
 desired.specialist_role:=p_role; desired.contribution_kind:=p_kind; desired.title:=p_title;
 desired.source_kind:='github'; desired.source_locator:=p_locator; desired.note:=p_note;
 desired.registration_origin:='administrativo_lovable'; desired.registration_reference:=p_decision;
 desired.version_no:=1; desired.authority_state:='proposta';
 IF NOT nucleo_u06f_private.valid_ac01_proposal(desired) THEN
  RAISE EXCEPTION 'U06-F proposta invalida' USING ERRCODE='22023'; END IF;
 -- Mesmo lock e ordem do piloto; serializa com humanos e reenvios.
 LOCK TABLE public.nucleo_specialist_contributions IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO r FROM public.nucleo_specialist_contributions c WHERE c.request_id=p_request;
 IF FOUND THEN
  IF (to_jsonb(r)-ARRAY['id','lineage_id','recorded_at']) IS DISTINCT FROM
     (to_jsonb(desired)-ARRAY['id','lineage_id','recorded_at'])
  THEN RAISE EXCEPTION 'U06-F colisao de request; reconciliar' USING ERRCODE='23505'; END IF;
  RETURN QUERY SELECT r.id,r.request_id,r.authority_state,r.registration_origin,r.recorded_by_auth_uid,'confirmado_existente'::text;
  RETURN;
 END IF;
 INSERT INTO public.nucleo_specialist_contributions(request_id,module_id,workstream_id,specialist_role,
 contribution_kind,title,source_kind,source_locator,note,registration_origin,registration_reference)
 VALUES(p_request,p_module,p_workstream,p_role,p_kind,p_title,'github',p_locator,p_note,'administrativo_lovable',p_decision)
 RETURNING * INTO r;
 IF (to_jsonb(r)-ARRAY['id','lineage_id','recorded_at']) IS DISTINCT FROM
    (to_jsonb(desired)-ARRAY['id','lineage_id','recorded_at'])
 THEN RAISE EXCEPTION 'U06-F readback divergente'; END IF;
 RETURN QUERY SELECT r.id,r.request_id,r.authority_state,r.registration_origin,r.recorded_by_auth_uid,'confirmado_por_readback'::text;
END;$$;
REVOKE ALL ON FUNCTION nucleo_u06f_private.register_ac01_proposal(uuid,uuid,uuid,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON FUNCTION nucleo_u06f_private.register_ac01_proposal(uuid,uuid,uuid,text,text,text,text,text,text)
 IS 'U06-F: proposta documental inicial, fonte/decisão verificadas pelo chamador; não atesta identidade individual, existência da fonte ou autoridade soberana.';
