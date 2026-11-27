\set ON_ERROR_STOP on
-- SOMENTE PostgreSQL descartável; nunca executar no Core.
BEGIN;
INSERT INTO public.nucleo_development_workstreams(id,code,kind,title)
VALUES ('3d9351f1-75e0-4581-86e1-edb902532ae3','SHO','modulo','Shopee CI');
INSERT INTO public.nucleo_development_workstreams(id,code,kind,title,parent_id)
VALUES ('078fcd0b-3e45-4c76-878d-1a9e14a50b64','SHO-F12','frente','F12 CI','3d9351f1-75e0-4581-86e1-edb902532ae3');
-- Reutiliza o contrato histórico de autoria humana; nunca gera UID em produção.
SELECT set_config('request.jwt.claim.sub','',false);
DO $test$
DECLARE a record; b record;
BEGIN
 IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'ambiente de teste inesperado'; END IF;
 SELECT * INTO a FROM nucleo_u06f_private.register_sho_ac01_pilot();
 SELECT * INTO b FROM nucleo_u06f_private.register_sho_ac01_pilot();
 IF a.id IS NULL OR a.id IS DISTINCT FROM b.id OR a.result IS DISTINCT FROM 'confirmado_por_readback'
  OR b.result IS DISTINCT FROM 'confirmado_existente' OR a.recorded_by_auth_uid IS NOT NULL
  OR a.authority_state IS DISTINCT FROM 'proposta' OR a.registration_origin IS DISTINCT FROM 'administrativo_lovable'
 THEN RAISE EXCEPTION 'pilot readback/replay failed'; END IF;
 IF (SELECT count(*) FROM public.nucleo_specialist_contributions WHERE module_id='3d9351f1-75e0-4581-86e1-edb902532ae3')<>1
 THEN RAISE EXCEPTION 'pilot duplicated'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.nucleo_specialist_contributions WHERE id=a.id AND version_no=1 AND parent_revision_id IS NULL AND registration_reference IS NOT NULL)
 THEN RAISE EXCEPTION 'pilot metadata invalid'; END IF;
 IF EXISTS(SELECT 1 FROM public.nucleo_development_workstreams WHERE code IN ('SHO','SHO-F12') AND next_action<>'')
 THEN RAISE EXCEPTION 'unexpected M3 modification'; END IF;
 BEGIN
  INSERT INTO public.nucleo_specialist_contributions(module_id,specialist_role,contribution_kind,title,source_kind,source_locator,request_id)
  VALUES ('3d9351f1-75e0-4581-86e1-edb902532ae3','CI','metodo','Invalid anonymous author','github','https://example.invalid/source','44444444-4444-4444-8444-444444444444');
  RAISE EXCEPTION 'unattributed insert accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'AC-01 requer sessão autenticada' THEN RAISE; END IF;
 END;
 BEGIN
  INSERT INTO public.nucleo_specialist_contributions(module_id,specialist_role,contribution_kind,title,source_kind,source_locator,request_id,registration_origin,registration_reference)
  VALUES ('3d9351f1-75e0-4581-86e1-edb902532ae3','CI','metodo','Invalid admin scope','github','https://example.invalid/source','44444444-4444-4444-8444-444444444444','administrativo_lovable','fake');
  RAISE EXCEPTION 'admin scope escaped';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $test$;
DO $acl$
BEGIN
 IF has_schema_privilege('anon','nucleo_u06f_private','USAGE') OR has_schema_privilege('authenticated','nucleo_u06f_private','USAGE')
 OR has_schema_privilege('service_role','nucleo_u06f_private','USAGE')
 OR has_function_privilege('anon','nucleo_u06f_private.register_sho_ac01_pilot()','EXECUTE')
 OR has_function_privilege('authenticated','nucleo_u06f_private.register_sho_ac01_pilot()','EXECUTE')
 OR has_function_privilege('service_role','nucleo_u06f_private.register_sho_ac01_pilot()','EXECUTE')
 THEN RAISE EXCEPTION 'pilot exposed to application roles'; END IF;
END $acl$;
INSERT INTO public.app_admin_capabilities(auth_user_id,capability)
VALUES ('33333333-3333-4333-8333-333333333333','nucleo_manage');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
DO $human$
BEGIN
 INSERT INTO public.nucleo_specialist_contributions(module_id,specialist_role,contribution_kind,title,source_kind,source_locator,request_id,recorded_by_auth_uid)
 VALUES ('3d9351f1-75e0-4581-86e1-edb902532ae3','CI','metodo','Human proposal','github','https://example.invalid/human','55555555-5555-4555-8555-555555555555','66666666-6666-4666-8666-666666666666');
 IF NOT EXISTS(SELECT 1 FROM public.nucleo_specialist_contributions WHERE request_id='55555555-5555-4555-8555-555555555555' AND recorded_by_auth_uid=auth.uid() AND registration_origin='auth_app' AND registration_reference IS NULL)
 THEN RAISE EXCEPTION 'human authorship regression'; END IF;
 BEGIN
  PERFORM * FROM nucleo_u06f_private.register_sho_ac01_pilot();
  RAISE EXCEPTION 'authenticated caller accessed pilot';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.nucleo_specialist_contributions(module_id,specialist_role,contribution_kind,title,source_kind,source_locator,request_id,registration_origin,registration_reference)
  VALUES ('3d9351f1-75e0-4581-86e1-edb902532ae3','CI','metodo','Forged origin','github','https://example.invalid/forged','77777777-7777-4777-8777-777777777777','administrativo_lovable','fake');
  RAISE EXCEPTION 'forged origin accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $human$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',false);
ROLLBACK;
SELECT 'PASS U06-F: one proposal, replay, scope, no UID fabrication, denied roles, human authorship' AS result;
