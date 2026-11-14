\set ON_ERROR_STOP on
-- AC-01: piloto sintético POSITIVO/NEGATIVO apenas no PostgreSQL descartável do CI.
-- Nunca executar este script no Lovable Cloud de produção.
INSERT INTO public.app_admin_capabilities(auth_user_id,capability)
VALUES ('11111111-1111-4111-8111-111111111111','nucleo_manage');
INSERT INTO public.nucleo_development_workstreams
(id,code,kind,title,description,specialist)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','NUC','modulo',
'Núcleo teste AC-01','Somente CI','Especialista teste');

-- Um usuário real no ambiente sintético possui a capability necessária.
SET ROLE authenticated;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
INSERT INTO public.nucleo_specialist_contributions
(id,module_id,specialist_role,contribution_kind,title,source_kind,source_locator,request_id,note)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
'NUC_TESTE','metodo','Método sintético v1','github','https://example.invalid/method/v1',
'cccccccc-cccc-4ccc-8ccc-cccccccccccc','Versão original no CI');
DO $positive$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.nucleo_specialist_contributions
 WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
 AND version_no=1 AND authority_state='proposta'
 AND recorded_by_auth_uid=auth.uid()) THEN
 RAISE EXCEPTION 'AC-01 v1: insert/readback autenticado falhou'; END IF;
END $positive$;
INSERT INTO public.nucleo_specialist_contributions
(id,module_id,specialist_role,contribution_kind,title,source_kind,source_locator,
parent_revision_id,request_id,note)
VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
'NUC_TESTE','metodo','Método sintético v2','github','https://example.invalid/method/v2',
'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Nova revisão CI');
DO $revision$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.nucleo_specialist_contributions
 WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
 AND version_no=2 AND authority_state='em_evolucao'
 AND parent_revision_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
 AND lineage_id=(SELECT lineage_id FROM public.nucleo_specialist_contributions
 WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')) THEN
 RAISE EXCEPTION 'AC-01 v2: parentesco/linhagem/readback falhou'; END IF;
 IF (SELECT count(*) FROM public.nucleo_specialist_contributions)<>2 THEN
 RAISE EXCEPTION 'AC-01: original não preservado'; END IF;
 BEGIN
  INSERT INTO public.nucleo_specialist_contributions(module_id,specialist_role,contribution_kind,
  title,source_kind,source_locator,request_id)
  VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','NUC_TESTE','metodo','Repetição',
  'github','https://example.invalid/again','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  RAISE EXCEPTION 'AC-01 request_id duplicado foi aceito';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  UPDATE public.nucleo_specialist_contributions SET title='Alterado'
  WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  RAISE EXCEPTION 'AC-01 UPDATE permitido';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  DELETE FROM public.nucleo_specialist_contributions
  WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  RAISE EXCEPTION 'AC-01 DELETE permitido';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $revision$;
RESET ROLE;

-- Mesmo papel authenticated, sem grant do Núcleo: nega leitura e escrita.
SET ROLE authenticated;
SET request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
DO $deny$
BEGIN
 IF EXISTS (SELECT 1 FROM public.nucleo_specialist_contributions)
 THEN RAISE EXCEPTION 'AC-01 vazou dados ao autenticado sem nucleo_manage'; END IF;
 BEGIN
  INSERT INTO public.nucleo_specialist_contributions(module_id,specialist_role,contribution_kind,
  title,source_kind,source_locator,request_id)
  VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','NUC_TESTE','metodo',
  'Proposta negada','github','https://example.invalid/denied',
  'ffffffff-ffff-4fff-8fff-ffffffffffff');
  RAISE EXCEPTION 'AC-01 INSERT sem capability permitido';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $deny$;
RESET ROLE;

SET ROLE anon;
DO $anon$
BEGIN
 BEGIN
  PERFORM count(*) FROM public.nucleo_specialist_contributions;
  RAISE EXCEPTION 'AC-01 leitura anônima permitida';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $anon$;
RESET ROLE;

-- Revogação deve eliminar acesso de sessão anteriormente autorizada.
UPDATE public.app_admin_capabilities
SET active=false,revoked_at=now()
WHERE auth_user_id='11111111-1111-4111-8111-111111111111' AND capability='nucleo_manage';
SET ROLE authenticated;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $revoke$
BEGIN
 IF EXISTS (SELECT 1 FROM public.nucleo_specialist_contributions)
 THEN RAISE EXCEPTION 'AC-01 revogação não bloqueou leitura'; END IF;
END $revoke$;
RESET ROLE;

SELECT 'PASS: AC-01 role/RLS insert, v1-v2, preservation, duplicate idempotency, denied, revoke' AS result;
