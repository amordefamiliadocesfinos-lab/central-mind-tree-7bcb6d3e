\set ON_ERROR_STOP on
-- ONLY disposable CI. Existing synthetic grant/mandate from positive AC01 test.
DO $schema$
BEGIN
 IF to_regclass('public.nucleo_ac01_authority_revocations') IS NULL
 OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.nucleo_ac01_authority_revocations'::regclass)
 OR has_table_privilege('authenticated','public.nucleo_ac01_authority_revocations','INSERT')
 OR has_table_privilege('service_role','public.nucleo_ac01_authority_revocations','INSERT')
 OR has_table_privilege('anon','public.nucleo_ac01_authority_revocations','SELECT')
 OR NOT has_table_privilege('authenticated','public.nucleo_ac01_authority_revocations','SELECT')
 THEN RAISE EXCEPTION 'AC01 revocation effective grants/RLS invalid'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE tablename='nucleo_ac01_authority_revocations')<>1
 THEN RAISE EXCEPTION 'AC01 revocation policies not read-only'; END IF;
END $schema$;

-- Authoritative human simulation only in this test database.
INSERT INTO public.app_admin_capabilities(auth_user_id,capability)
VALUES('99999999-9999-4999-8999-999999999999','nucleo_manage');
SET request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';

-- A successor cannot be granted before the old one was revoked.
DO $before$
BEGIN
 BEGIN
  INSERT INTO public.nucleo_ac01_authority_grants
  (module_id,specialist_role,contribution_kind,delegate_auth_uid,authority_kind,mandate_record_id,
   authority_source_locator,evidence_ref,granted_by_auth_uid,effective_from,supersedes_grant_id)
  VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','NUC_TESTE','metodo',
   '77777777-7777-4777-8777-777777777777','decisor',
   '40000000-0000-4000-8000-000000000001',
   'https://example.invalid/authority','CI-REPLACEMENT-ATTEMPT',
   '99999999-9999-4999-8999-999999999999',now(),
   '40000000-0000-4000-8000-000000000002');
  RAISE EXCEPTION 'AC01 succession before revocation accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'AC01: replacement requires revoked predecessor in same scope' THEN RAISE; END IF;
 END;
END $before$;

INSERT INTO public.nucleo_ac01_authority_revocations
(id,authority_grant_id,revocation_kind,reason,authority_source_locator,
 authority_decision_ref,revoked_by_auth_uid,request_id)
VALUES
('50000000-0000-4000-8000-000000000001',
 '40000000-0000-4000-8000-000000000002',
 'revogacao','Revogação definitiva de competência decisória fictícia.',
 'https://example.invalid/master/decision','CI-REVOCATION-DECIDER',
 '99999999-9999-4999-8999-999999999999',
 '50000000-0000-4000-8000-000000000002'),
('50000000-0000-4000-8000-000000000003',
 '40000000-0000-4000-8000-000000000003',
 'suspensao','Suspensão definitiva no contrato atual até novo ato.',
 'https://example.invalid/master/suspension','CI-SUSPENSION-EXECUTOR',
 '99999999-9999-4999-8999-999999999999',
 '50000000-0000-4000-8000-000000000004');

DO $revoke$
BEGIN
 IF NOT public.nucleo_ac01_grant_is_revoked('40000000-0000-4000-8000-000000000002')
 OR NOT public.nucleo_ac01_grant_is_revoked('40000000-0000-4000-8000-000000000003')
 THEN RAISE EXCEPTION 'AC01 termination not effective'; END IF;
 BEGIN
  INSERT INTO public.nucleo_ac01_authority_revocations
   (authority_grant_id,revocation_kind,reason,authority_source_locator,
   authority_decision_ref,revoked_by_auth_uid,request_id)
  VALUES('40000000-0000-4000-8000-000000000002',
  'revogacao','Repeated revocation should not be allowed.',
  'https://example.invalid/master/decision','CI-REVOCATION-DECIDER',
  '99999999-9999-4999-8999-999999999999',gen_random_uuid());
  RAISE EXCEPTION 'AC01 duplicate grant revocation accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
END $revoke$;
INSERT INTO public.nucleo_ac01_authority_grants
(id,module_id,specialist_role,contribution_kind,delegate_auth_uid,authority_kind,mandate_record_id,
authority_source_locator,evidence_ref,granted_by_auth_uid,effective_from,supersedes_grant_id)
VALUES('50000000-0000-4000-8000-000000000005',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','NUC_TESTE','metodo',
 '77777777-7777-4777-8777-777777777777','decisor',
 '40000000-0000-4000-8000-000000000001',
 'https://example.invalid/master/authority','CI-REPLACEMENT-AFTER-REVOCATION',
 '99999999-9999-4999-8999-999999999999',now(),
 '40000000-0000-4000-8000-000000000002');

-- The original grant stays immutable and visible, but no longer authorizes decisions.
INSERT INTO public.nucleo_ac01_decision_requests
(id,module_id,contribution_id,review_event_id,requested_outcome,authority_source_locator,
 justification,submitter_auth_uid,request_id)
VALUES('50000000-0000-4000-8000-000000000006',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 '10000000-0000-4000-8000-000000000004',
 'avaliar_aprovacao','https://example.invalid/master/authority',
 'Pedido sintético distinto para ensaio de revogação.',
 '99999999-9999-4999-8999-999999999999',
 '50000000-0000-4000-8000-000000000007');

-- Restricted temp route ONLY in disposable CI. Revert immediately after test.
GRANT INSERT ON public.nucleo_ac01_decision_acts TO authenticated;
CREATE POLICY ci_temporary_decision_insert ON public.nucleo_ac01_decision_acts
 FOR INSERT TO authenticated WITH CHECK (true);
RESET request.jwt.claim.sub;
SET ROLE authenticated;
SET request.jwt.claim.sub='66666666-6666-4666-8666-666666666666';
DO $blocked$
BEGIN
 IF NOT public.nucleo_ac01_grant_is_revoked('40000000-0000-4000-8000-000000000002')
 THEN RAISE EXCEPTION 'Authorized reader cannot see own revoked grant'; END IF;
 BEGIN
 INSERT INTO public.nucleo_ac01_decision_acts
 (decision_request_id,contribution_id,authority_grant_id,outcome,
 reasoning,authority_decision_ref,decided_by_auth_uid,request_id)
 VALUES('50000000-0000-4000-8000-000000000006',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 '40000000-0000-4000-8000-000000000002','aprovada',
 'Revoked decider must not approve new decisions.',
 'CI-BLOCKED-DECISION','66666666-6666-4666-8666-666666666666',
 '50000000-0000-4000-8000-000000000008');
 RAISE EXCEPTION 'Revoked decision grant accepted';
 EXCEPTION WHEN raise_exception THEN
 IF SQLERRM<>'AC01: delegated decision authority revoked or suspended' THEN RAISE; END IF;
 END;
END $blocked$;
RESET ROLE;
DROP POLICY ci_temporary_decision_insert ON public.nucleo_ac01_decision_acts;
REVOKE INSERT ON public.nucleo_ac01_decision_acts FROM authenticated;

-- No client write authority should be exposed after test.
DO $sealed$
BEGIN
 IF has_table_privilege('authenticated','public.nucleo_ac01_decision_acts','INSERT')
 OR has_table_privilege('authenticated','public.nucleo_ac01_authority_revocations','INSERT')
 OR has_table_privilege('service_role','public.nucleo_ac01_authority_revocations','INSERT')
 THEN RAISE EXCEPTION 'Revocation CI temporarily opened a productive write gate'; END IF;
END $sealed$;
SELECT 'PASS revocation, suspension, succession, denied decision, immutable history' AS result;
