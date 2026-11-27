\set ON_ERROR_STOP on
-- PostgreSQL descartável. Nenhum dado real.
BEGIN;
INSERT INTO public.nucleo_development_workstreams(id,code,kind,title)
VALUES ('3d9351f1-75e0-4581-86e1-edb902532ae3','SHO','modulo','Shopee CI'),
('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','CRM','modulo','CRM CI');
INSERT INTO public.nucleo_development_workstreams(id,code,kind,title,parent_id)
VALUES ('078fcd0b-3e45-4c76-878d-1a9e14a50b64','SHO-F12','frente','F12 CI','3d9351f1-75e0-4581-86e1-edb902532ae3');
SELECT set_config('request.jwt.claim.sub','',false);
DO $test$
DECLARE a record;b record;c record;pilot record;again record;
 s constant uuid:='3d9351f1-75e0-4581-86e1-edb902532ae3';
 f constant uuid:='078fcd0b-3e45-4c76-878d-1a9e14a50b64';
 m constant uuid:='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
 q constant uuid:='aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa';
 z constant uuid:='aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa';
 loc constant text:='https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/docs/teste.md';
 dec constant text:='https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/issues/1037#issuecomment-7223290532';
BEGIN
 SELECT * INTO pilot FROM nucleo_u06f_private.register_sho_ac01_pilot();
 SELECT * INTO a FROM nucleo_u06f_private.register_ac01_proposal(q,s,f,'Especialista SHO','aprendizado','Aprendizado teste',loc,'Proposta consultiva',dec);
 SELECT * INTO b FROM nucleo_u06f_private.register_ac01_proposal(q,s,f,'Especialista SHO','aprendizado','Aprendizado teste',loc,'Proposta consultiva',dec);
 SELECT * INTO c FROM nucleo_u06f_private.register_ac01_proposal(z,m,NULL,'Especialista CRM','mapa','Mapa teste',loc,'Proposta consultiva',dec);
 SELECT * INTO again FROM nucleo_u06f_private.register_sho_ac01_pilot();
 IF a.id IS NULL OR a.id IS DISTINCT FROM b.id OR a.result<>'confirmado_por_readback' OR b.result<>'confirmado_existente'
 OR c.id IS NULL OR c.id=a.id OR a.recorded_by_auth_uid IS NOT NULL OR c.recorded_by_auth_uid IS NOT NULL
 OR a.authority_state<>'proposta' OR c.authority_state<>'proposta'
 OR pilot.id IS DISTINCT FROM again.id OR again.result<>'confirmado_existente'
 THEN RAISE EXCEPTION 'A07 readback/replay/pilot regression'; END IF;
 BEGIN
  PERFORM * FROM nucleo_u06f_private.register_ac01_proposal(q,s,f,'Especialista SHO','aprendizado','Título divergente',loc,'Proposta consultiva',dec);
  RAISE EXCEPTION 'request divergente aceito';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  PERFORM * FROM nucleo_u06f_private.register_ac01_proposal(gen_random_uuid(),s,f,'Especialista SHO','mapa','Outra proposta',loc,'Proposta consultiva',dec);
  RAISE EXCEPTION 'referência duplicada aceita';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  PERFORM * FROM nucleo_u06f_private.register_ac01_proposal(gen_random_uuid(),m,f,'Especialista CRM','mapa','Escopo cruzado',replace(loc,'teste.md','outro.md'),'Proposta consultiva',dec);
  RAISE EXCEPTION 'escopo cruzado aceito';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'AC-01 frente não pertence ao módulo' THEN RAISE; END IF; END;
 BEGIN
  PERFORM * FROM nucleo_u06f_private.register_ac01_proposal(gen_random_uuid(),s,f,'Especialista SHO','mapa','Fonte mutável',replace(loc,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','main'),'Proposta consultiva',dec);
  RAISE EXCEPTION 'fonte mutavel aceita';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
  PERFORM * FROM nucleo_u06f_private.register_ac01_proposal(gen_random_uuid(),s,f,'Especialista SHO','mapa','Sem decisão',replace(loc,'teste.md','outro.md'),'Proposta consultiva',NULL);
  RAISE EXCEPTION 'decisão ausente aceita';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
  PERFORM * FROM nucleo_u06f_private.register_ac01_proposal('87d4757e-9391-4fbd-a111-b3a8cf86aa06',s,f,'Especialista SHO','mapa','Piloto invadido',loc,'Proposta consultiva',dec);
  RAISE EXCEPTION 'request piloto reutilizado';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF (SELECT count(*) FROM public.nucleo_specialist_contributions WHERE module_id IN(s,m))<>3
 THEN RAISE EXCEPTION 'quantidade divergente'; END IF;
END $test$;
DO $acl$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')
 AND (has_schema_privilege(rolname,'nucleo_u06f_private','USAGE') OR has_function_privilege(rolname,'nucleo_u06f_private.register_ac01_proposal(uuid,uuid,uuid,text,text,text,text,text,text)','EXECUTE')))
 THEN RAISE EXCEPTION 'escritor exposto'; END IF;
END $acl$;
INSERT INTO public.app_admin_capabilities(auth_user_id,capability)
VALUES ('33333333-3333-4333-8333-333333333333','nucleo_manage');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
DO $human$
BEGIN
 INSERT INTO public.nucleo_specialist_contributions(module_id,specialist_role,contribution_kind,title,source_kind,source_locator,request_id)
 VALUES ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','Especialista CRM','mapa','Human proposal','github','https://example.invalid/human','aaaaaaaa-4444-4444-8444-aaaaaaaaaaaa');
 IF NOT EXISTS(SELECT 1 FROM public.nucleo_specialist_contributions WHERE request_id='aaaaaaaa-4444-4444-8444-aaaaaaaaaaaa' AND recorded_by_auth_uid=auth.uid() AND registration_origin='auth_app') THEN RAISE EXCEPTION 'autoria humana divergente'; END IF;
 BEGIN
  INSERT INTO public.nucleo_specialist_contributions(module_id,specialist_role,contribution_kind,title,source_kind,source_locator,request_id)
  VALUES ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','Especialista CRM','mapa','Duplicate','github','https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/docs/teste.md','aaaaaaaa-5555-4555-8555-aaaaaaaaaaaa');
  RAISE EXCEPTION 'duplicidade humana com proposta administrativa aceita';
 EXCEPTION WHEN unique_violation THEN NULL; END;
END $human$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',false);
ROLLBACK;
SELECT 'PASS A07.1: two modules, immutable source, replay, conflicts, scope, pilot and human writer preserved' AS result;
