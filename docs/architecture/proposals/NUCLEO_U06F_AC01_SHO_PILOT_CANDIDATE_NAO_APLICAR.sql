-- U06-F A04: CANDIDATA para PostgreSQL descartável. NÃO APLICAR EM PRODUÇÃO.
-- Piloto único autorizado: referência documental SHO-F12, sem identidade Auth fictícia.
-- Não cria permissões, não modifica RLS, não usa SECURITY DEFINER.
-- O canal postgres já possui autoridade administrativa: não constitui isolamento contra superusuário.
ALTER TABLE public.nucleo_specialist_contributions
 ADD COLUMN registration_origin text NOT NULL DEFAULT 'auth_app',
 ADD COLUMN registration_reference text,
 ALTER COLUMN recorded_by_auth_uid DROP NOT NULL;
ALTER TABLE public.nucleo_specialist_contributions ADD CONSTRAINT nucleo_ac01_registration_identity_check CHECK (
 (registration_origin='auth_app' AND recorded_by_auth_uid IS NOT NULL AND registration_reference IS NULL)
 OR (registration_origin='administrativo_lovable' AND recorded_by_auth_uid IS NULL AND registration_reference IS NOT NULL
     AND module_id='3d9351f1-75e0-4581-86e1-edb902532ae3'::uuid AND request_id='87d4757e-9391-4fbd-a111-b3a8cf86aa06'::uuid
     AND parent_revision_id IS NULL AND version_no=1 AND authority_state='proposta')
);
-- Serialização de referência canônica deste piloto, inclusive contra o formulário humano.
CREATE UNIQUE INDEX nucleo_u06f_sho_pilot_source_once
 ON public.nucleo_specialist_contributions(module_id,source_locator)
 WHERE module_id='3d9351f1-75e0-4581-86e1-edb902532ae3'::uuid AND source_locator='https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/095adee52910ecae78949595c4eeba65b60e2d46/docs/operations/REFINAMENTO_METODO_INTEGRACAO_SHOPEE_MULTICONTAS_V2_0_2026-11-26.md';
CREATE OR REPLACE FUNCTION public.nucleo_ac01_before_insert() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE parent public.nucleo_specialist_contributions%ROWTYPE;
BEGIN
 IF NEW.registration_origin='administrativo_lovable' THEN
   IF current_user<>'postgres' OR session_user<>'postgres' OR auth.uid() IS NOT NULL
      OR (NEW.module_id='3d9351f1-75e0-4581-86e1-edb902532ae3'::uuid AND NEW.workstream_id='078fcd0b-3e45-4c76-878d-1a9e14a50b64'::uuid AND NEW.request_id='87d4757e-9391-4fbd-a111-b3a8cf86aa06'::uuid AND NEW.specialist_role='Integração Shopee Multicontas' AND NEW.contribution_kind='metodo' AND NEW.title='Refinamento do Método de Integração Shopee Multicontas V2.0' AND NEW.source_kind='github' AND NEW.source_locator='https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/095adee52910ecae78949595c4eeba65b60e2d46/docs/operations/REFINAMENTO_METODO_INTEGRACAO_SHOPEE_MULTICONTAS_V2_0_2026-11-26.md' AND NEW.note='Refinamento conceitual R01–R05; proposta documental, sem promoção soberana ou autorização produtiva. Origem administrativa, sem identidade humana Auth.' AND NEW.parent_revision_id IS NULL AND NEW.source_reference_id IS NULL AND NEW.source_checksum_sha256 IS NULL AND NEW.registration_origin='administrativo_lovable' AND NEW.registration_reference='https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/issues/1037#issuecomment-7221728368' AND NEW.recorded_by_auth_uid IS NULL AND NEW.version_no=1 AND NEW.authority_state='proposta') IS DISTINCT FROM true THEN
     RAISE EXCEPTION 'U06-F origem ou escopo administrativo inválido' USING ERRCODE='42501';
   END IF;
 ELSE
   IF NEW.registration_origin IS DISTINCT FROM 'auth_app' OR NEW.registration_reference IS NOT NULL
      OR auth.uid() IS NULL THEN RAISE EXCEPTION 'AC-01 requer sessão autenticada'; END IF;
   NEW.recorded_by_auth_uid := auth.uid();
 END IF;
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
CREATE SCHEMA nucleo_u06f_private;
REVOKE ALL ON SCHEMA nucleo_u06f_private FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION nucleo_u06f_private.register_sho_ac01_pilot()
RETURNS TABLE(id uuid,request_id uuid,authority_state text,registration_origin text,recorded_by_auth_uid uuid,result text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.nucleo_specialist_contributions%ROWTYPE;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR auth.uid() IS NOT NULL THEN
   RAISE EXCEPTION 'U06-F requer canal administrativo sem UID humano' USING ERRCODE='42501';
 END IF;
 LOCK TABLE public.nucleo_specialist_contributions IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO r FROM public.nucleo_specialist_contributions c WHERE c.request_id='87d4757e-9391-4fbd-a111-b3a8cf86aa06'::uuid;
 IF FOUND THEN
   IF (r.module_id='3d9351f1-75e0-4581-86e1-edb902532ae3'::uuid AND r.workstream_id='078fcd0b-3e45-4c76-878d-1a9e14a50b64'::uuid AND r.request_id='87d4757e-9391-4fbd-a111-b3a8cf86aa06'::uuid AND r.specialist_role='Integração Shopee Multicontas' AND r.contribution_kind='metodo' AND r.title='Refinamento do Método de Integração Shopee Multicontas V2.0' AND r.source_kind='github' AND r.source_locator='https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/095adee52910ecae78949595c4eeba65b60e2d46/docs/operations/REFINAMENTO_METODO_INTEGRACAO_SHOPEE_MULTICONTAS_V2_0_2026-11-26.md' AND r.note='Refinamento conceitual R01–R05; proposta documental, sem promoção soberana ou autorização produtiva. Origem administrativa, sem identidade humana Auth.' AND r.parent_revision_id IS NULL AND r.source_reference_id IS NULL AND r.source_checksum_sha256 IS NULL AND r.registration_origin='administrativo_lovable' AND r.registration_reference='https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/issues/1037#issuecomment-7221728368' AND r.recorded_by_auth_uid IS NULL AND r.version_no=1 AND r.authority_state='proposta') IS DISTINCT FROM true THEN
     RAISE EXCEPTION 'U06-F colisão de requisição; reconciliar' USING ERRCODE='23505';
   END IF;
   RETURN QUERY SELECT r.id,r.request_id,r.authority_state,r.registration_origin,r.recorded_by_auth_uid,'confirmado_existente'::text;
   RETURN;
 END IF;
 IF EXISTS(SELECT 1 FROM public.nucleo_specialist_contributions c
   WHERE c.module_id='3d9351f1-75e0-4581-86e1-edb902532ae3'::uuid AND c.source_locator='https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/095adee52910ecae78949595c4eeba65b60e2d46/docs/operations/REFINAMENTO_METODO_INTEGRACAO_SHOPEE_MULTICONTAS_V2_0_2026-11-26.md') THEN
   RAISE EXCEPTION 'U06-F referência já registrada; reconciliar sem duplicar' USING ERRCODE='23505';
 END IF;
 INSERT INTO public.nucleo_specialist_contributions(module_id,workstream_id,request_id,specialist_role,
   contribution_kind,title,source_kind,source_locator,note,registration_origin,registration_reference)
 VALUES ('3d9351f1-75e0-4581-86e1-edb902532ae3','078fcd0b-3e45-4c76-878d-1a9e14a50b64','87d4757e-9391-4fbd-a111-b3a8cf86aa06','Integração Shopee Multicontas','metodo','Refinamento do Método de Integração Shopee Multicontas V2.0','github','https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/095adee52910ecae78949595c4eeba65b60e2d46/docs/operations/REFINAMENTO_METODO_INTEGRACAO_SHOPEE_MULTICONTAS_V2_0_2026-11-26.md','Refinamento conceitual R01–R05; proposta documental, sem promoção soberana ou autorização produtiva. Origem administrativa, sem identidade humana Auth.','administrativo_lovable','https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/issues/1037#issuecomment-7221728368')
 RETURNING * INTO r;
 IF (r.module_id='3d9351f1-75e0-4581-86e1-edb902532ae3'::uuid AND r.workstream_id='078fcd0b-3e45-4c76-878d-1a9e14a50b64'::uuid AND r.request_id='87d4757e-9391-4fbd-a111-b3a8cf86aa06'::uuid AND r.specialist_role='Integração Shopee Multicontas' AND r.contribution_kind='metodo' AND r.title='Refinamento do Método de Integração Shopee Multicontas V2.0' AND r.source_kind='github' AND r.source_locator='https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/095adee52910ecae78949595c4eeba65b60e2d46/docs/operations/REFINAMENTO_METODO_INTEGRACAO_SHOPEE_MULTICONTAS_V2_0_2026-11-26.md' AND r.note='Refinamento conceitual R01–R05; proposta documental, sem promoção soberana ou autorização produtiva. Origem administrativa, sem identidade humana Auth.' AND r.parent_revision_id IS NULL AND r.source_reference_id IS NULL AND r.source_checksum_sha256 IS NULL AND r.registration_origin='administrativo_lovable' AND r.registration_reference='https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/issues/1037#issuecomment-7221728368' AND r.recorded_by_auth_uid IS NULL AND r.version_no=1 AND r.authority_state='proposta') IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'U06-F readback divergente';
 END IF;
 RETURN QUERY SELECT r.id,r.request_id,r.authority_state,r.registration_origin,r.recorded_by_auth_uid,'confirmado_por_readback'::text;
END;$$;
REVOKE ALL ON FUNCTION nucleo_u06f_private.register_sho_ac01_pilot() FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON FUNCTION nucleo_u06f_private.register_sho_ac01_pilot() IS 'Candidata U06-F: proposta única, fonte e autorização conferidas externamente; não atesta identidade individual nem consulta GitHub pelo banco.';
