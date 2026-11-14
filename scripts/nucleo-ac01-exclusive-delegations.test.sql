\set ON_ERROR_STOP on
-- Synthetic facts only, disposable PostgreSQL CI; no activation in official Core.
DO $checks$
BEGIN
 IF has_table_privilege('authenticated','public.nucleo_ac01_authority_grants','INSERT')
 OR has_table_privilege('service_role','public.nucleo_ac01_authority_grants','INSERT')
 OR has_table_privilege('authenticated','public.nucleo_ac01_decision_acts','INSERT')
 OR has_table_privilege('authenticated','public.nucleo_ac01_publication_events','INSERT')
 THEN RAISE EXCEPTION 'AC01 authority write gate accidentally opened'; END IF;
END $checks$;
-- Fixture: Gnew 500..005 is active and replaces revoked 400..002 in decisor scope.
SET request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
DO $conflicts$
BEGIN
 BEGIN
  INSERT INTO public.nucleo_ac01_authority_grants
  (module_id,specialist_role,contribution_kind,delegate_auth_uid,authority_kind,
   mandate_record_id,authority_source_locator,evidence_ref,granted_by_auth_uid,effective_from)
  VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','NUC_TESTE','metodo',
  '66666666-6666-4666-8666-666666666666','decisor',
  '40000000-0000-4000-8000-000000000001',
  'https://example.invalid/authority','CI-OVERLAP-MUST-FAIL',
  '99999999-9999-4999-8999-999999999999',now());
  RAISE EXCEPTION 'AC01 overlap unexpectedly allowed';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'AC01: overlapping authority grant in scope' THEN RAISE; END IF;
 END;
 BEGIN
  INSERT INTO public.nucleo_ac01_authority_grants
  (module_id,specialist_role,contribution_kind,delegate_auth_uid,authority_kind,
   mandate_record_id,authority_source_locator,evidence_ref,granted_by_auth_uid,effective_from)
  VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','NUC_TESTE','metodo',
  '66666666-6666-4666-8666-666666666666','decisor',
  '40000000-0000-4000-8000-000000000001',
  'https://example.invalid/authority','CI-FORGED-GRANTOR',
  '22222222-2222-4222-8222-222222222222',now());
  RAISE EXCEPTION 'AC01 unauthorized grantor accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'AC01: grantor lacks matching mandate certification' THEN RAISE; END IF;
 END;
END $conflicts$;

-- Executor scope was suspended; a future nonoverlapping delegation is allowed.
INSERT INTO public.nucleo_ac01_authority_grants
 (id,module_id,specialist_role,contribution_kind,delegate_auth_uid,authority_kind,
 mandate_record_id,authority_source_locator,evidence_ref,granted_by_auth_uid,effective_from)
VALUES
 ('60000000-0000-4000-8000-000000000001',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','NUC_TESTE','metodo',
 '77777777-7777-4777-8777-777777777777','executor',
 '40000000-0000-4000-8000-000000000001',
 'https://example.invalid/authority','CI-NONOVERLAPPING-EXECUTOR',
 '99999999-9999-4999-8999-999999999999',now());

DO $proof$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.nucleo_ac01_authority_grants
 WHERE id='60000000-0000-4000-8000-000000000001') THEN
  RAISE EXCEPTION 'AC01 new executor role blocked incorrectly'; END IF;
 IF (SELECT count(*) FROM public.nucleo_ac01_authority_grants
 WHERE module_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
 AND specialist_role='NUC_TESTE' AND contribution_kind='metodo'
 AND authority_kind='decisor' AND id NOT IN
 ('40000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000005'))>0
 THEN RAISE EXCEPTION 'AC01 duplicate decider created'; END IF;
END $proof$;
RESET request.jwt.claim.sub;
SELECT 'PASS: grantor provenance, exclusivity and independent role with closed write gates' AS result;
