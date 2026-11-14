\set ON_ERROR_STOP on
-- Execute only after AC-01 disposable schema and the AC-02 proposal SQL.
-- ZERO production credentials/records. Synthetic identities.
INSERT INTO public.app_admin_capabilities(auth_user_id,capability)
VALUES ('11111111-1111-4111-8111-111111111111','nucleo_manage')
ON CONFLICT DO NOTHING;
INSERT INTO public.nucleo_development_workstreams(id,code,title,kind)
VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','QA2','Módulo de teste AC02','modulo')
ON CONFLICT DO NOTHING;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);

INSERT INTO public.nucleo_ac02_handoff_events
(id,package_id,package_version,package_sha256,module_id,specialist_role_code,
 recipient_kind,recipient_auth_uid,event_kind,previous_event_id,evidence_class,
 source_ref,expires_at,request_id,actor_auth_uid)
VALUES
('aaaaaaaa-1111-4111-8111-111111111111',
 'bbbbbbbb-1111-4111-8111-111111111111','1.0',repeat('a',64),
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','especialista_crm',
 'sucessor_humano','22222222-2222-4222-8222-222222222222',
 'preparado',NULL,'declaracao_gestor','ac02:pacote:v1',now()+interval '1 day',
 'cccccccc-1111-4111-8111-111111111111','ffffffff-ffff-4fff-8fff-ffffffffffff');

-- A data de expiração deve ser herdada do primeiro evento, não recalculada.
INSERT INTO public.nucleo_ac02_handoff_events
(id,package_id,package_version,package_sha256,module_id,specialist_role_code,
 recipient_kind,recipient_auth_uid,event_kind,previous_event_id,evidence_class,
 source_ref,expires_at,request_id,actor_auth_uid)
SELECT 'aaaaaaaa-2222-4222-8222-222222222222',package_id,package_version,package_sha256,module_id,
 specialist_role_code,recipient_kind,recipient_auth_uid,'disponibilizado',id,'declaracao_gestor',
 source_ref,expires_at,'cccccccc-2222-4222-8222-222222222222',auth.uid()
FROM public.nucleo_ac02_handoff_events WHERE id='aaaaaaaa-1111-4111-8111-111111111111';

-- Uma alegação de entrega sem prova/referência é rejeitada mesmo pelo gestor.
DO $test$
BEGIN
 BEGIN
  INSERT INTO public.nucleo_ac02_handoff_events
  (package_id,package_version,package_sha256,module_id,specialist_role_code,
   recipient_kind,recipient_auth_uid,event_kind,previous_event_id,evidence_class,
   source_ref,expires_at,request_id,actor_auth_uid)
  SELECT package_id,package_version,package_sha256,module_id,specialist_role_code,
    recipient_kind,recipient_auth_uid,'entregue',id,'declaracao_gestor',
    source_ref,expires_at,gen_random_uuid(),auth.uid()
  FROM public.nucleo_ac02_handoff_events WHERE id='aaaaaaaa-2222-4222-8222-222222222222';
  RAISE EXCEPTION 'TEST FAIL: delivery without evidence ref';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='TEST FAIL: delivery without evidence ref' THEN RAISE; END IF;
 END;
END $test$;
INSERT INTO public.nucleo_ac02_handoff_events
(id,package_id,package_version,package_sha256,module_id,specialist_role_code,
 recipient_kind,recipient_auth_uid,event_kind,previous_event_id,evidence_class,
 evidence_ref,source_ref,expires_at,request_id,actor_auth_uid)
SELECT 'aaaaaaaa-3333-4333-8333-333333333333',package_id,package_version,package_sha256,module_id,
 specialist_role_code,recipient_kind,recipient_auth_uid,'entregue',id,'declaracao_gestor',
 'ac02:evidencia:entrega_sintetica',source_ref,expires_at,'cccccccc-3333-4333-8333-333333333333',auth.uid()
FROM public.nucleo_ac02_handoff_events WHERE id='aaaaaaaa-2222-4222-8222-222222222222';

DO $test$
BEGIN
 -- Referência de falha e retificação não é opcional.
 BEGIN
  INSERT INTO public.nucleo_ac02_handoff_events
  (package_id,package_version,package_sha256,module_id,specialist_role_code,
   recipient_kind,recipient_auth_uid,event_kind,previous_event_id,evidence_class,
   source_ref,expires_at,request_id,actor_auth_uid)
  SELECT package_id,package_version,package_sha256,module_id,specialist_role_code,
    recipient_kind,recipient_auth_uid,'falha',id,'declaracao_gestor',
    source_ref,expires_at,gen_random_uuid(),auth.uid()
  FROM public.nucleo_ac02_handoff_events WHERE id='aaaaaaaa-3333-4333-8333-333333333333';
  RAISE EXCEPTION 'TEST FAIL: failure without evidence ref';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='TEST FAIL: failure without evidence ref' THEN RAISE; END IF;
 END;
 BEGIN
  INSERT INTO public.nucleo_ac02_handoff_events
  (package_id,package_version,package_sha256,module_id,specialist_role_code,
   recipient_kind,recipient_auth_uid,event_kind,previous_event_id,evidence_class,
   source_ref,expires_at,request_id,actor_auth_uid)
  SELECT package_id,package_version,package_sha256,module_id,specialist_role_code,
    recipient_kind,recipient_auth_uid,'retificado',id,'declaracao_gestor',
    source_ref,expires_at,gen_random_uuid(),auth.uid()
  FROM public.nucleo_ac02_handoff_events WHERE id='aaaaaaaa-3333-4333-8333-333333333333';
  RAISE EXCEPTION 'TEST FAIL: rectification without evidence ref';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='TEST FAIL: rectification without evidence ref' THEN RAISE; END IF;
 END;
 -- Administrador não pode fingir recebimento pelo destinatário.
 BEGIN
  INSERT INTO public.nucleo_ac02_handoff_events
  (package_id,package_version,package_sha256,module_id,specialist_role_code,
   recipient_kind,recipient_auth_uid,event_kind,previous_event_id,evidence_class,
   source_ref,expires_at,request_id,actor_auth_uid)
  SELECT package_id,package_version,package_sha256,module_id,specialist_role_code,
    recipient_kind,recipient_auth_uid,'recebido',id,'confirmacao_destinatario',
    source_ref,expires_at,gen_random_uuid(),auth.uid()
  FROM public.nucleo_ac02_handoff_events WHERE id='aaaaaaaa-3333-4333-8333-333333333333';
  RAISE EXCEPTION 'TEST FAIL: admin impersonated recipient';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='TEST FAIL: admin impersonated recipient' THEN RAISE; END IF;
 END;
 -- Expiração antecipada não pode ser registrada como fato.
 BEGIN
  INSERT INTO public.nucleo_ac02_handoff_events
  (package_id,package_version,package_sha256,module_id,specialist_role_code,
   recipient_kind,recipient_auth_uid,event_kind,previous_event_id,evidence_class,
   source_ref,expires_at,request_id,actor_auth_uid)
  SELECT package_id,package_version,package_sha256,module_id,specialist_role_code,
    recipient_kind,recipient_auth_uid,'expirado',id,'declaracao_gestor',
    source_ref,expires_at,gen_random_uuid(),auth.uid()
  FROM public.nucleo_ac02_handoff_events WHERE id='aaaaaaaa-3333-4333-8333-333333333333';
  RAISE EXCEPTION 'TEST FAIL: premature expiry';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='TEST FAIL: premature expiry' THEN RAISE; END IF;
 END;
 -- Hash/versão devem permanecer imutáveis na cadeia.
 BEGIN
  INSERT INTO public.nucleo_ac02_handoff_events
  (package_id,package_version,package_sha256,module_id,specialist_role_code,
   recipient_kind,recipient_auth_uid,event_kind,previous_event_id,evidence_class,
   source_ref,expires_at,request_id,actor_auth_uid)
  SELECT package_id,package_version,repeat('b',64),module_id,specialist_role_code,
    recipient_kind,recipient_auth_uid,'falha',id,'declaracao_gestor',
    source_ref,expires_at,gen_random_uuid(),auth.uid()
  FROM public.nucleo_ac02_handoff_events WHERE id='aaaaaaaa-3333-4333-8333-333333333333';
  RAISE EXCEPTION 'TEST FAIL: hash mutation';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='TEST FAIL: hash mutation' THEN RAISE; END IF;
 END;
 -- Append-only: nem administrador pode reescrever o primeiro evento.
 BEGIN
  UPDATE public.nucleo_ac02_handoff_events SET event_kind='aceito'
    WHERE id='aaaaaaaa-1111-4111-8111-111111111111';
  RAISE EXCEPTION 'TEST FAIL: update allowed';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='TEST FAIL: update allowed' THEN RAISE; END IF;
 END;
END $test$;

SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
-- Destinatário sem nucleo_manage NÃO pode criar uma preparação por conta própria.
DO $test$
BEGIN
 BEGIN
  INSERT INTO public.nucleo_ac02_handoff_events
  (package_id,package_version,package_sha256,module_id,specialist_role_code,
   recipient_kind,recipient_auth_uid,event_kind,previous_event_id,evidence_class,
   source_ref,expires_at,request_id,actor_auth_uid)
  VALUES (gen_random_uuid(),'1.0',repeat('b',64),
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','especialista_crm',
   'sucessor_humano',auth.uid(),'preparado',NULL,'declaracao_gestor',
   'ac02:pacote:v1',now()+interval '1 day',gen_random_uuid(),auth.uid());
  RAISE EXCEPTION 'TEST FAIL: recipient created preparation';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='TEST FAIL: recipient created preparation' THEN RAISE; END IF;
 END;
END $test$;
INSERT INTO public.nucleo_ac02_handoff_events
(id,package_id,package_version,package_sha256,module_id,specialist_role_code,
 recipient_kind,recipient_auth_uid,event_kind,previous_event_id,evidence_class,
 source_ref,expires_at,request_id,actor_auth_uid)
SELECT 'aaaaaaaa-4444-4444-8444-444444444444',package_id,package_version,package_sha256,module_id,
 specialist_role_code,recipient_kind,recipient_auth_uid,'recebido',id,'confirmacao_destinatario',
 source_ref,expires_at,'cccccccc-4444-4444-8444-444444444444',auth.uid()
FROM public.nucleo_ac02_handoff_events WHERE id='aaaaaaaa-3333-4333-8333-333333333333';

INSERT INTO public.nucleo_ac02_handoff_events
(id,package_id,package_version,package_sha256,module_id,specialist_role_code,
 recipient_kind,recipient_auth_uid,event_kind,previous_event_id,evidence_class,
 source_ref,expires_at,request_id,actor_auth_uid)
SELECT 'aaaaaaaa-5555-4555-8555-555555555555',package_id,package_version,package_sha256,module_id,
 specialist_role_code,recipient_kind,recipient_auth_uid,'aceito',id,'confirmacao_destinatario',
 source_ref,expires_at,'cccccccc-5555-4555-8555-555555555555',auth.uid()
FROM public.nucleo_ac02_handoff_events WHERE id='aaaaaaaa-4444-4444-8444-444444444444';

DO $test$
DECLARE c integer;
BEGIN
 SELECT count(*) INTO c FROM public.nucleo_ac02_handoff_events
 WHERE package_id='bbbbbbbb-1111-4111-8111-111111111111';
 IF c<>5 THEN RAISE EXCEPTION 'TEST FAIL: expected 5 linked events, got %',c; END IF;
 IF EXISTS (SELECT 1 FROM public.nucleo_ac02_handoff_events
  WHERE actor_auth_uid='ffffffff-ffff-4fff-8fff-ffffffffffff') THEN
   RAISE EXCEPTION 'TEST FAIL: actor was spoofed'; END IF;
 -- Uma confirmação humana não deve produzir outro evento após aceite.
 BEGIN
  INSERT INTO public.nucleo_ac02_handoff_events
  (package_id,package_version,package_sha256,module_id,specialist_role_code,
   recipient_kind,recipient_auth_uid,event_kind,previous_event_id,evidence_class,
   source_ref,expires_at,request_id,actor_auth_uid)
  SELECT package_id,package_version,package_sha256,module_id,specialist_role_code,
    recipient_kind,recipient_auth_uid,'aceito',id,'confirmacao_destinatario',
    source_ref,expires_at,gen_random_uuid(),auth.uid()
  FROM public.nucleo_ac02_handoff_events WHERE id='aaaaaaaa-5555-4555-8555-555555555555';
  RAISE EXCEPTION 'TEST FAIL: repeated acceptance';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='TEST FAIL: repeated acceptance' THEN RAISE; END IF;
 END;
END $test$;
RESET ROLE;
-- Final check: scope, grants and RLS structural facts.
DO $test$
BEGIN
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.nucleo_ac02_handoff_events'::regclass)
 THEN RAISE EXCEPTION 'TEST FAIL: RLS disabled'; END IF;
 IF has_table_privilege('anon','public.nucleo_ac02_handoff_events','INSERT')
 OR has_table_privilege('authenticated','public.nucleo_ac02_handoff_events','UPDATE')
 OR has_table_privilege('authenticated','public.nucleo_ac02_handoff_events','DELETE')
 OR has_table_privilege('service_role','public.nucleo_ac02_handoff_events','INSERT')
 THEN RAISE EXCEPTION 'TEST FAIL: inappropriate grants'; END IF;
END $test$;
SELECT 'PASS AC02 append-only: verified recipient, five stages, immutable, isolated RLS, no privileged writes' AS result;
