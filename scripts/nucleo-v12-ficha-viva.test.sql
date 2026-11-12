\set ON_ERROR_STOP on
-- Nucleo FM V1.2: laboratorio isolado, sem tocar no Core de producao.
INSERT INTO public.app_admin_capabilities(auth_user_id,capability)
VALUES('11111111-1111-4111-8111-111111111111','nucleo_manage');

SET ROLE authenticated;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
INSERT INTO public.nucleo_development_workstreams(id,code,kind,title)
VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','CRM','modulo','CRM de Teste');
INSERT INTO public.nucleo_development_workstreams(id,code,kind,title,parent_id)
VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','CRM-UX02','frente','UX02 Teste','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

INSERT INTO public.nucleo_module_knowledge_revisions
(module_id,section_code,version_no,title,body,source_reference)
VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','FM-01',1,'Identidade','Modulo CRM de teste sintentico','github:src/App.tsx');
INSERT INTO public.nucleo_module_knowledge_revisions
(module_id,section_code,version_no,title,body,source_reference)
VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','FM-01',2,'Identidade v2','Modulo CRM de teste sintentico revisado','github:src/App.tsx');

DO $authorized$
BEGIN
 IF (SELECT count(*) FROM public.nucleo_module_knowledge_revisions)<>2 THEN
 RAISE EXCEPTION 'FM authorized history missing'; END IF;
 IF (SELECT count(*) FROM public.nucleo_module_knowledge_revisions WHERE authority_state='rascunho' AND evidence_level='declarado' AND recorded_by_auth_uid=auth.uid())<>2 THEN
 RAISE EXCEPTION 'FM authorship or draft classification wrong'; END IF;
 BEGIN
  INSERT INTO public.nucleo_module_knowledge_revisions(module_id,section_code,version_no,title,body)
  VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','FM-02',1,'Invalido','Frente nao e modulo');
  RAISE EXCEPTION 'FM accepted a front as module';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'Ficha Viva requires an existing module record' THEN RAISE; END IF;
 END;
 BEGIN
  INSERT INTO public.nucleo_module_knowledge_revisions(module_id,section_code,version_no,title,body,authority_state,reviewed_by,evidence_level)
  VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','FM-02',1,'Forjado','Conteudo de exemplo forjado','homologado','usuario ficticio','codigo_verificado');
  RAISE EXCEPTION 'FM allowed forged approval';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'Ficha Viva client may only submit unverified draft revisions' THEN RAISE; END IF;
 END;
 BEGIN
  INSERT INTO public.nucleo_module_knowledge_revisions(module_id,section_code,version_no,title,body)
  VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','FM-01',2,'Duplicado','Revisao duplicada de versao');
  RAISE EXCEPTION 'FM allowed duplicate version';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  UPDATE public.nucleo_module_knowledge_revisions SET body='Alteracao proibida';
  RAISE EXCEPTION 'FM allowed history rewrite';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'Núcleo revision snapshots are immutable' THEN RAISE; END IF;
 END;
END $authorized$;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
DO $unauthorized$
BEGIN
 IF EXISTS(SELECT 1 FROM public.nucleo_module_knowledge_revisions) THEN
 RAISE EXCEPTION 'FM RLS read leak'; END IF;
 BEGIN
  INSERT INTO public.nucleo_module_knowledge_revisions(module_id,section_code,version_no,title,body)
  VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','FM-02',1,'Nao autorizado','Tentativa nao autorizada');
  RAISE EXCEPTION 'FM unauthorized insert';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $unauthorized$;
RESET ROLE;
SET ROLE anon;
DO $anon$
BEGIN
 BEGIN
  PERFORM count(*) FROM public.nucleo_module_knowledge_revisions;
  RAISE EXCEPTION 'FM anonymous read';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $anon$;
RESET ROLE;

UPDATE public.app_admin_capabilities SET active=false,revoked_at=now()
WHERE auth_user_id='11111111-1111-4111-8111-111111111111' AND capability='nucleo_manage';
SET ROLE authenticated;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $revoke$
BEGIN
 IF EXISTS(SELECT 1 FROM public.nucleo_module_knowledge_revisions) THEN
 RAISE EXCEPTION 'FM revocation leak'; END IF;
END $revoke$;
RESET ROLE;
SELECT 'PASS: FM revisions, identity, authority, RLS, immutability and revocation' AS result;
