\set ON_ERROR_STOP on
-- Isolated AC01 P4 intake tests. Dependency fixtures from prior CI test scripts.
DO $schema$
BEGIN
 IF to_regclass('public.nucleo_ac01_decision_requests') IS NULL THEN RAISE EXCEPTION 'Decision intake table absent'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.nucleo_ac01_decision_requests'::regclass)
 OR NOT has_table_privilege('authenticated','public.nucleo_ac01_decision_requests','SELECT')
 OR NOT has_table_privilege('authenticated','public.nucleo_ac01_decision_requests','INSERT')
 OR has_table_privilege('authenticated','public.nucleo_ac01_decision_requests','UPDATE')
 OR has_table_privilege('authenticated','public.nucleo_ac01_decision_requests','DELETE')
 OR has_table_privilege('anon','public.nucleo_ac01_decision_requests','SELECT')
 THEN RAISE EXCEPTION 'Decision intake grants/RLS invalid'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public'
 AND tablename='nucleo_ac01_decision_requests' AND cmd IN ('SELECT','INSERT'))<>2
 THEN RAISE EXCEPTION 'Decision intake policies invalid'; END IF;
END $schema$;

-- Previous CI fixture: admin 111 was revoked, admin 444 was revoked. Provision new synthetic capability.
INSERT INTO public.app_admin_capabilities(auth_user_id,capability)
VALUES ('55555555-5555-4555-8555-555555555555','nucleo_manage');
SET ROLE authenticated;
SET request.jwt.claim.sub='55555555-5555-4555-8555-555555555555';
INSERT INTO public.nucleo_ac01_decision_requests
(id,module_id,contribution_id,review_event_id,requested_outcome,
 authority_source_locator,authority_decision_ref,justification,request_id)
VALUES(
 '30000000-0000-4000-8000-000000000001',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 '10000000-0000-4000-8000-000000000004',
 'avaliar_aprovacao',
 'https://example.invalid/authority/pending',
 '',
 'Analisar a revisão com a autoridade competente; não homologado.',
 '30000000-0000-4000-8000-000000000002'
);
DO $check$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.nucleo_ac01_decision_requests
  WHERE id='30000000-0000-4000-8000-000000000001'
  AND submitter_auth_uid=auth.uid() AND requested_outcome='avaliar_aprovacao')
 THEN RAISE EXCEPTION 'Decision intake readback failed'; END IF;
 BEGIN
 INSERT INTO public.nucleo_ac01_decision_requests
 (module_id,contribution_id,review_event_id,requested_outcome,
  authority_source_locator,justification,request_id)
 VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 '10000000-0000-4000-8000-000000000004','avaliar_aprovacao',
 'https://example.invalid/authority/pending',
 'Retry same request ID must be rejected.',
 '30000000-0000-4000-8000-000000000002');
 RAISE EXCEPTION 'Decision intake accepted duplicate request';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
 INSERT INTO public.nucleo_ac01_decision_requests
 (module_id,contribution_id,review_event_id,requested_outcome,
  authority_source_locator,justification,request_id)
 VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 '10000000-0000-4000-8000-000000000004','avaliar_aprovacao',
 'https://example.invalid/authority/pending',
 'Referral event targets a different revision.',
 '30000000-0000-4000-8000-000000000003');
 RAISE EXCEPTION 'Decision intake allowed mismatched review';
 EXCEPTION WHEN raise_exception THEN
 IF SQLERRM <> 'AC01 decision intake requires matching referral event' THEN RAISE; END IF;
 END;
 BEGIN
 UPDATE public.nucleo_ac01_decision_requests SET requested_outcome='avaliar_rejeicao'
 WHERE id='30000000-0000-4000-8000-000000000001';
 RAISE EXCEPTION 'Decision intake UPDATE allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
 DELETE FROM public.nucleo_ac01_decision_requests WHERE id='30000000-0000-4000-8000-000000000001';
 RAISE EXCEPTION 'Decision intake DELETE allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $check$;
RESET ROLE;
SET ROLE authenticated;
SET request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
DO $denied$
BEGIN
 IF EXISTS(SELECT 1 FROM public.nucleo_ac01_decision_requests) THEN
 RAISE EXCEPTION 'Unauthorized decision intake visible'; END IF;
 BEGIN
 INSERT INTO public.nucleo_ac01_decision_requests
 (module_id,contribution_id,review_event_id,requested_outcome,
 authority_source_locator,justification,request_id)
 VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 '10000000-0000-4000-8000-000000000004','avaliar_aprovacao',
 'https://example.invalid/authority/pending',
 'User without nucleo_manage should be blocked.',
 '30000000-0000-4000-8000-000000000004');
 RAISE EXCEPTION 'Unauthorized request allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 WHEN raise_exception THEN
 IF SQLERRM <> 'AC01 decision intake needs active nucleo_manage' THEN RAISE; END IF; END;
END $denied$;
RESET ROLE;
SET ROLE anon;
DO $anon$
BEGIN
 BEGIN PERFORM count(*) FROM public.nucleo_ac01_decision_requests;
 RAISE EXCEPTION 'anon read allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $anon$;
RESET ROLE;
UPDATE public.app_admin_capabilities SET active=false,revoked_at=now()
WHERE auth_user_id='55555555-5555-4555-8555-555555555555' AND capability='nucleo_manage';
SET ROLE authenticated;
SET request.jwt.claim.sub='55555555-5555-4555-8555-555555555555';
DO $revocation$
BEGIN
 IF EXISTS(SELECT 1 FROM public.nucleo_ac01_decision_requests) THEN
 RAISE EXCEPTION 'Revoked user retained decision intake access'; END IF;
END $revocation$;
RESET ROLE;
SELECT 'PASS: decision requests are requests only; authorization, idempotency and immutability' as result;
