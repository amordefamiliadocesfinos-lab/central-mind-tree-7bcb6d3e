\set ON_ERROR_STOP on
-- SOMENTE CI descartável. Simula uma certificação e separação de funções.
-- NEVER run in the official Lovable Cloud.
INSERT INTO public.nucleo_specialist_mandate_records
(id,module_id,record_kind,specialist_role,specialist_auth_uid,
 method_name,method_version,authority_source_url,authority_decision_ref,
 decision_note,effective_from,decided_by_auth_uid)
VALUES('40000000-0000-4000-8000-000000000001',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','certificacao','NUC_TESTE',
 '77777777-7777-4777-8777-777777777777',
 'Método sintético CI','v1','https://example.invalid/mandate',
 'TEST-AUTHORITY-ONLY-CI','Certificação fictícia exclusivamente no PostgreSQL CI.',
 now()-interval '1 day','99999999-9999-4999-8999-999999999999');

INSERT INTO public.nucleo_ac01_authority_grants
(id,module_id,specialist_role,contribution_kind,delegate_auth_uid,authority_kind,
 mandate_record_id,authority_source_locator,evidence_ref,
 granted_by_auth_uid,effective_from)
VALUES
('40000000-0000-4000-8000-000000000002',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','NUC_TESTE','metodo',
 '66666666-6666-4666-8666-666666666666','decisor',
 '40000000-0000-4000-8000-000000000001',
 'https://example.invalid/authority','CI-DECIDER-AUTHORITY-REF',
 '99999999-9999-4999-8999-999999999999',now()),
('40000000-0000-4000-8000-000000000003',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','NUC_TESTE','metodo',
 '88888888-8888-4888-8888-888888888888','executor',
 '40000000-0000-4000-8000-000000000001',
 'https://example.invalid/authority','CI-EXECUTOR-AUTHORITY-REF',
 '99999999-9999-4999-8999-999999999999',now());

INSERT INTO public.app_admin_capabilities(auth_user_id,capability)
VALUES
('66666666-6666-4666-8666-666666666666','nucleo_manage'),
('88888888-8888-4888-8888-888888888888','nucleo_manage');

-- Só para o ensaio em CI: ativar via SQL grants temporários,
-- NUNCA adicionar estas policies à migration ou ao Core de produção.
GRANT INSERT ON public.nucleo_ac01_decision_acts,public.nucleo_ac01_publication_events TO authenticated;
CREATE POLICY test_only_acts_insert ON public.nucleo_ac01_decision_acts
 FOR INSERT TO authenticated WITH CHECK(true);
CREATE POLICY test_only_publication_insert ON public.nucleo_ac01_publication_events
 FOR INSERT TO authenticated WITH CHECK(true);

SET ROLE authenticated;
SET request.jwt.claim.sub='66666666-6666-4666-8666-666666666666';
INSERT INTO public.nucleo_ac01_decision_acts
(id,decision_request_id,contribution_id,authority_grant_id,outcome,
 reasoning,authority_decision_ref,decided_by_auth_uid,request_id)
VALUES
('40000000-0000-4000-8000-000000000004',
 '30000000-0000-4000-8000-000000000001',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 '40000000-0000-4000-8000-000000000002',
 'aprovada','Decisão sintética com fundamento conferido exclusivamente no CI.',
 'TEST-DECISION-PROOF-CI','66666666-6666-4666-8666-666666666666',
 '40000000-0000-4000-8000-000000000005');

DO $decision$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.nucleo_ac01_decision_acts
 WHERE id='40000000-0000-4000-8000-000000000004'
 AND decided_by_auth_uid=auth.uid() AND outcome='aprovada')
 THEN RAISE EXCEPTION 'Gated decision readback failed'; END IF;
 BEGIN
  INSERT INTO public.nucleo_ac01_publication_events
  (decision_act_id,contribution_id,executor_grant_id,publication_note,executed_by_auth_uid,request_id)
  VALUES('40000000-0000-4000-8000-000000000004',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '40000000-0000-4000-8000-000000000003',
  'Decisor não pode executar a publicação.',
  '66666666-6666-4666-8666-666666666666',gen_random_uuid());
  RAISE EXCEPTION 'Decider could publish';
 EXCEPTION WHEN raise_exception THEN
 IF SQLERRM<>'AC01: publication requires approved decision and scoped executor'
 THEN RAISE; END IF; END;
END $decision$;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub='88888888-8888-4888-8888-888888888888';
INSERT INTO public.nucleo_ac01_publication_events
(id,decision_act_id,contribution_id,executor_grant_id,previous_publication_id,
 publication_note,executed_by_auth_uid,request_id)
VALUES(
 '40000000-0000-4000-8000-000000000006',
 '40000000-0000-4000-8000-000000000004',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 '40000000-0000-4000-8000-000000000003',
 NULL,'Publicação interna sintética após ato competente distinto.',
 '88888888-8888-4888-8888-888888888888',
 '40000000-0000-4000-8000-000000000007');

DO $publish$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.nucleo_ac01_publication_events
 WHERE id='40000000-0000-4000-8000-000000000006'
 AND executed_by_auth_uid=auth.uid() AND previous_publication_id IS NULL)
 THEN RAISE EXCEPTION 'Gated publication readback failed'; END IF;
 IF (SELECT count(*) FROM public.nucleo_specialist_contributions)<>2
 THEN RAISE EXCEPTION 'Original contributions unexpectedly rewritten'; END IF;
END $publish$;
RESET ROLE;

-- Restaurar explicitamente o portão de produção após o ensaio.
DROP POLICY test_only_acts_insert ON public.nucleo_ac01_decision_acts;
DROP POLICY test_only_publication_insert ON public.nucleo_ac01_publication_events;
REVOKE INSERT ON public.nucleo_ac01_decision_acts,public.nucleo_ac01_publication_events FROM authenticated;
DO $sealed$
BEGIN
 IF has_table_privilege('authenticated','public.nucleo_ac01_decision_acts','INSERT')
 OR has_table_privilege('authenticated','public.nucleo_ac01_publication_events','INSERT')
 THEN RAISE EXCEPTION 'Temporary CI grant was not revoked'; END IF;
END $sealed$;
SELECT 'PASS gated decision and internal publication with synthetic mandate and separated actors' AS result;
