\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.nucleo_development_workstreams(id,code,kind,title) VALUES
('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','CRM','modulo','CRM CI'),
('aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa','SHO','modulo','Shopee CI');
INSERT INTO public.app_admin_capabilities(auth_user_id,capability) VALUES ('33333333-3333-4333-8333-333333333333','nucleo_manage');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
INSERT INTO public.nucleo_module_knowledge_revisions(module_id,section_code,version_no,title,body)
VALUES ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','FM-08',1,'Método anterior','Conteúdo histórico de teste'),
('aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa','FM-10',1,'Aprendizado anterior','Conteúdo histórico de teste');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',false);
DO $fm$
DECLARE a record;b record;c record;
 m constant uuid:='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
 q constant uuid:='aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa';
 src constant text:='https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/docs/teste.md';
 dec constant text:='https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/issues/1037#issuecomment-7223290532';
BEGIN
 SELECT * INTO a FROM nucleo_u06f_private.register_fm_revision(q,m,'FM-08',1,'Método atualizado','Conteúdo novo consultivo de teste',src,dec);
 SELECT * INTO b FROM nucleo_u06f_private.register_fm_revision(q,m,'FM-08',1,'Método atualizado','Conteúdo novo consultivo de teste',src,dec);
 SELECT * INTO c FROM nucleo_u06f_private.register_fm_revision(gen_random_uuid(),'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa','FM-10',1,'Aprendizado atualizado','Aprendizado consultivo de teste',src,dec);
 IF a.id IS NULL OR a.id IS DISTINCT FROM b.id OR a.version_no<>2 OR c.version_no<>2 OR a.result<>'confirmado_por_readback' OR b.result<>'confirmado_existente'
 THEN RAISE EXCEPTION 'FM replay/transversal falhou'; END IF;
 BEGIN
 PERFORM * FROM nucleo_u06f_private.register_fm_revision(gen_random_uuid(),m,'FM-08',1,'Versao obsoleta','Conteúdo concorrente de teste',src,dec);
 RAISE EXCEPTION 'versao obsoleta aceita';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN
 PERFORM * FROM nucleo_u06f_private.register_fm_revision(q,m,'FM-08',1,'Método divergente','Conteúdo novo consultivo de teste',src,dec);
 RAISE EXCEPTION 'request divergente aceito';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
 PERFORM * FROM nucleo_u06f_private.register_fm_revision(gen_random_uuid(),m,'FM-09',1,'Secao ausente','Conteúdo novo consultivo de teste',src,dec);
 RAISE EXCEPTION 'secao ausente aceita';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN
 PERFORM * FROM nucleo_u06f_private.register_fm_revision(gen_random_uuid(),m,'FM-08',2,'Fonte mutavel','Conteúdo novo consultivo de teste',replace(src,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','main'),dec);
 RAISE EXCEPTION 'fonte mutavel aceita';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 IF (SELECT count(*) FROM public.nucleo_module_knowledge_revisions WHERE module_id=m)<>2
 OR NOT EXISTS(SELECT 1 FROM public.nucleo_module_knowledge_revisions WHERE id=a.id AND authority_state='rascunho' AND evidence_level='declarado' AND reviewed_by='' AND recorded_by_auth_uid IS NULL AND registration_origin='administrativo_lovable')
 OR NOT EXISTS(SELECT 1 FROM public.nucleo_module_knowledge_revisions WHERE module_id=m AND version_no=1 AND recorded_by_auth_uid='33333333-3333-4333-8333-333333333333' AND registration_origin='auth_app')
 THEN RAISE EXCEPTION 'FM integridade/autoria falhou'; END IF;
END $fm$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
DO $human$
BEGIN
 INSERT INTO public.nucleo_module_knowledge_revisions(module_id,section_code,version_no,title,body)
 VALUES ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','FM-08',3,'Nova revisão humana','Conteúdo humano de teste');
 IF NOT EXISTS(SELECT 1 FROM public.nucleo_module_knowledge_revisions WHERE module_id='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa' AND version_no=3 AND registration_origin='auth_app' AND recorded_by_auth_uid=auth.uid())
 THEN RAISE EXCEPTION 'regressao humana FM'; END IF;
 BEGIN
 INSERT INTO public.nucleo_module_knowledge_revisions(module_id,section_code,version_no,title,body,registration_origin,registration_request_id,registration_reference)
 VALUES ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','FM-08',4,'Origem falsa','Conteúdo sintético de teste','administrativo_lovable',gen_random_uuid(),'fake');
 RAISE EXCEPTION 'origem falsa aceita';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $human$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',false);
DO $acl$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') AND (has_schema_privilege(rolname,'nucleo_u06f_private','USAGE') OR has_function_privilege(rolname,'nucleo_u06f_private.register_fm_revision(uuid,uuid,text,integer,text,text,text,text)','EXECUTE'))) THEN RAISE EXCEPTION 'FM escritor exposto'; END IF;
 BEGIN
 TRUNCATE public.nucleo_module_knowledge_revisions;
 RAISE EXCEPTION 'truncamento FM aceito';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $acl$;
ROLLBACK;
SELECT 'PASS A07.2: FM two modules, CAS, exact replay, immutable source, human authorship and draft authority' AS result;
