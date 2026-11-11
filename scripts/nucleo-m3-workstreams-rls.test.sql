\set ON_ERROR_STOP on
-- M3: PostgreSQL descartável, sem dados do Painel Central.
INSERT INTO public.app_admin_capabilities(auth_user_id,capability) VALUES
('11111111-1111-4111-8111-111111111111','nucleo_manage');

SET ROLE authenticated;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';

INSERT INTO public.nucleo_development_workstreams
 (id,code,kind,title,description,specialist)
 VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','NUC','modulo','Núcleo 2.0','Módulo sintético','Especialista');
INSERT INTO public.nucleo_development_workstreams
 (id,code,parent_id,kind,title,description)
 VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','NUC-M3',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','frente','Central Visual','Controle sintético');
INSERT INTO public.nucleo_development_workstreams
 (id,code,parent_id,kind,title)
 VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','NUC-M3-F1',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','subfrente','Mapa de trabalho');

INSERT INTO public.nucleo_development_dependencies(workstream_id,depends_on_id,description)
VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Depende da frente mãe');

-- A segunda aresta fecharia um ciclo frente -> subfrente -> frente.
DO $acyclic$
BEGIN
 BEGIN
  INSERT INTO public.nucleo_development_dependencies(workstream_id,depends_on_id)
  VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  RAISE EXCEPTION 'M3 dependency cycle was allowed';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'M3 dependency cycle forbidden' THEN RAISE; END IF;
 END;
END $acyclic$;

UPDATE public.nucleo_development_workstreams
SET status='em_andamento',next_action='Testar interface',priority='alta'
WHERE code='NUC-M3-F1';
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.nucleo_development_workstreams)<>3 THEN RAISE EXCEPTION 'M3 hierarchy missing'; END IF;
 IF (SELECT count(*) FROM public.nucleo_development_events)<>4 THEN RAISE EXCEPTION 'M3 append-only audit missing'; END IF;
 IF (SELECT count(*) FROM public.nucleo_development_dependencies)<>1 THEN RAISE EXCEPTION 'M3 dependency missing'; END IF;
 IF (SELECT count(*) FROM public.nucleo_development_events WHERE actor_auth_uid=auth.uid())<>4 THEN
  RAISE EXCEPTION 'M3 actor audit missing';
 END IF;
 BEGIN
  UPDATE public.nucleo_development_workstreams SET status='concluido' WHERE code='NUC-M3';
  RAISE EXCEPTION 'M3 allowed unproven completion';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  UPDATE public.nucleo_development_workstreams SET status='bloqueado' WHERE code='NUC-M3';
  RAISE EXCEPTION 'M3 allowed blocker without reason';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  INSERT INTO public.nucleo_development_workstreams(code,parent_id,kind,title)
  VALUES ('BAD', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','subfrente','Bad hierarchy');
  RAISE EXCEPTION 'M3 allowed invalid hierarchy';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM<>'M3 invalid parent hierarchy' THEN RAISE; END IF;
 END;
 BEGIN
  UPDATE public.nucleo_development_workstreams SET code='CHANGED' WHERE code='NUC-M3';
  RAISE EXCEPTION 'M3 mutated stable code';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM<>'M3 identity fields immutable' THEN RAISE; END IF;
 END;
 BEGIN
  UPDATE public.nucleo_development_workstreams SET kind='subfrente' WHERE code='NUC-M3';
  RAISE EXCEPTION 'M3 mutated hierarchical kind';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM<>'M3 identity fields immutable' THEN RAISE; END IF;
 END;
 BEGIN
  INSERT INTO public.nucleo_development_events
   (workstream_id,event_type,after_state,actor_auth_uid)
  VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','alterado','{}'::jsonb,auth.uid());
  RAISE EXCEPTION 'M3 forged history event from client';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $check$;
RESET ROLE;

-- Outro administrador possui provision_users mas não nucleo_manage: nunca vê dados M3.
SET ROLE authenticated;
SET request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
DO $deny$
BEGIN
 IF EXISTS(SELECT 1 FROM public.nucleo_development_workstreams)
 OR EXISTS(SELECT 1 FROM public.nucleo_development_events)
 OR EXISTS(SELECT 1 FROM public.nucleo_development_dependencies) THEN
   RAISE EXCEPTION 'M3 unauthorized read';
 END IF;
 BEGIN
  INSERT INTO public.nucleo_development_workstreams(code,kind,title)
  VALUES('DENIED','modulo','Forbidden item');
  RAISE EXCEPTION 'M3 unauthorized write';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $deny$;
RESET ROLE;

-- Usuário scoped sem capability: leitura negada.
SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $scoped$
BEGIN
 IF EXISTS(SELECT 1 FROM public.nucleo_development_workstreams) THEN RAISE EXCEPTION 'M3 scoped leak'; END IF;
END $scoped$;
RESET ROLE;

SET ROLE anon;
DO $anonymous$
BEGIN
 BEGIN
  PERFORM count(*) FROM public.nucleo_development_workstreams;
  RAISE EXCEPTION 'M3 anon read';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $anonymous$;
RESET ROLE;

-- Revisions de status imutáveis e remoção de item protegida.
DO $history$
BEGIN
 BEGIN
  DELETE FROM public.nucleo_development_workstreams WHERE code='NUC-M3-F1';
  RAISE EXCEPTION 'M3 deletion permitted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'Núcleo M1: deletion forbidden; preserve document heritage' THEN RAISE; END IF;
 END;
 BEGIN
  UPDATE public.nucleo_development_events SET event_type='alterado';
  RAISE EXCEPTION 'M3 history rewrite permitted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'Núcleo revision snapshots are immutable' THEN RAISE; END IF;
 END;
END $history$;

UPDATE public.app_admin_capabilities SET active=false,revoked_at=now()
WHERE auth_user_id='11111111-1111-4111-8111-111111111111' AND capability='nucleo_manage';
SET ROLE authenticated;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $revoked$
BEGIN
 IF EXISTS(SELECT 1 FROM public.nucleo_development_workstreams) THEN RAISE EXCEPTION 'M3 revocation failed'; END IF;
END $revoked$;
RESET ROLE;

SELECT 'PASS: M3 hierarchy, audit, acceptance, authorization, immutability, revocation' AS result;
