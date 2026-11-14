\set ON_ERROR_STOP on
-- SQL test only in ephemeral Postgres following the original AC02 flow.
DO $test$
BEGIN
 IF has_table_privilege('authenticated','public.nucleo_ac02_handoff_events','INSERT')
 OR has_table_privilege('service_role','public.nucleo_ac02_handoff_events','INSERT')
 OR has_table_privilege('anon','public.nucleo_ac02_handoff_events','INSERT')
 THEN RAISE EXCEPTION 'TEST FAIL: direct INSERT route still open'; END IF;
 IF (SELECT count(*) FROM pg_policies
     WHERE schemaname='public' AND tablename='nucleo_ac02_handoff_events'
     AND cmd='INSERT')<>0
 THEN RAISE EXCEPTION 'TEST FAIL: direct INSERT RLS policy remains'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.nucleo_ac02_handoff_events'::regclass)
 THEN RAISE EXCEPTION 'TEST FAIL: RLS disabled'; END IF;
END $test$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
-- Even a valid administrative capability cannot bypass the new write gate.
DO $test$
BEGIN
 BEGIN
 INSERT INTO public.nucleo_ac02_handoff_events
  (package_id,package_version,package_sha256,module_id,specialist_role_code,
   recipient_kind,recipient_auth_uid,event_kind,previous_event_id,evidence_class,
   source_ref,expires_at,request_id,actor_auth_uid)
 VALUES(gen_random_uuid(),'1.0',repeat('a',64),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','especialista_crm',
  'novo_chat_ia',NULL,'preparado',NULL,'declaracao_gestor',
  'ac02:pacote:v1',now()+interval '1 day',gen_random_uuid(),auth.uid());
 RAISE EXCEPTION 'TEST FAIL: direct JWT INSERT succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $test$;
RESET ROLE;
SELECT 'PASS AC02 direct write closed: authenticated, anon, service_role no insert' AS result;
