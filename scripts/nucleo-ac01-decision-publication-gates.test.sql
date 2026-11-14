\set ON_ERROR_STOP on
-- Núcleo AC01 P4: portões fechados, sem inventar mandato ou autoridade.
DO $check$
DECLARE tbl text;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['nucleo_ac01_authority_grants','nucleo_ac01_decision_acts','nucleo_ac01_publication_events'] LOOP
  IF to_regclass('public.'||tbl) IS NULL THEN RAISE EXCEPTION 'Missing table %',tbl; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=('public.'||tbl)::regclass)
  THEN RAISE EXCEPTION 'RLS missing %',tbl; END IF;
  IF NOT has_table_privilege('authenticated',('public.'||tbl),'SELECT')
  OR has_table_privilege('authenticated',('public.'||tbl),'INSERT')
  OR has_table_privilege('authenticated',('public.'||tbl),'UPDATE')
  OR has_table_privilege('authenticated',('public.'||tbl),'DELETE')
  OR has_table_privilege('anon',('public.'||tbl),'SELECT')
  OR has_table_privilege('service_role',('public.'||tbl),'INSERT')
  THEN RAISE EXCEPTION 'Privilege leakage %',tbl; END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename=tbl)<>1
  THEN RAISE EXCEPTION 'Unexpected policies %',tbl; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=('public.'||tbl)::regclass
    AND tgname LIKE '%immutable' AND NOT tgisinternal)
  THEN RAISE EXCEPTION 'Immutability missing %',tbl; END IF;
 END LOOP;
END $check$;

SET ROLE authenticated;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $deny$
BEGIN
 BEGIN
 INSERT INTO public.nucleo_ac01_decision_acts
 (decision_request_id,contribution_id,authority_grant_id,outcome,reasoning,
 authority_decision_ref,decided_by_auth_uid,request_id)
 VALUES ('30000000-0000-4000-8000-000000000001',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',gen_random_uuid(),
 'aprovada','Nenhum papel tem permissão implícita de aprovar.',
 'https://example.invalid/proof','11111111-1111-4111-8111-111111111111',gen_random_uuid());
 RAISE EXCEPTION 'Client approval accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
 INSERT INTO public.nucleo_ac01_publication_events
 (decision_act_id,contribution_id,executor_grant_id,publication_note,
 executed_by_auth_uid,request_id)
 VALUES (gen_random_uuid(),'dddddddd-dddd-4ddd-8ddd-dddddddddddd',gen_random_uuid(),
 'Cliente não pode publicar com nucleo_manage.',
 '11111111-1111-4111-8111-111111111111',gen_random_uuid());
 RAISE EXCEPTION 'Client publication accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
 INSERT INTO public.nucleo_ac01_authority_grants
 (module_id,specialist_role,contribution_kind,delegate_auth_uid,authority_kind,
 mandate_record_id,authority_source_locator,evidence_ref,granted_by_auth_uid,effective_from)
 VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','NUC_TESTE','metodo',
 '11111111-1111-4111-8111-111111111111','decisor',gen_random_uuid(),
 'https://example.invalid/authority','https://example.invalid/proof',
 '22222222-2222-4222-8222-222222222222',now());
 RAISE EXCEPTION 'Client delegated own powers';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $deny$;
RESET ROLE;

-- Nem o operador privilegiado pode cadastrar delegação sem mandato certificado.
DO $closed$
BEGIN
 BEGIN
 INSERT INTO public.nucleo_ac01_authority_grants
 (module_id,specialist_role,contribution_kind,delegate_auth_uid,authority_kind,
 mandate_record_id,authority_source_locator,evidence_ref,granted_by_auth_uid,effective_from)
 VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','NUC_TESTE','metodo',
 '11111111-1111-4111-8111-111111111111','decisor',gen_random_uuid(),
 'https://example.invalid/authority','https://example.invalid/proof',
 '22222222-2222-4222-8222-222222222222',now());
 RAISE EXCEPTION 'Mandate-less delegation accepted';
 EXCEPTION WHEN raise_exception THEN
 IF SQLERRM<>'AC01: certified and current mandate required' THEN RAISE; END IF;
 END;
END $closed$;
SELECT 'PASS: no implied decision authority, publication or mandate certification' AS result;
