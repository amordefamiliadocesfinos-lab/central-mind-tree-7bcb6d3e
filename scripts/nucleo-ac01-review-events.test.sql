\set ON_ERROR_STOP on
-- CI PostgreSQL descartável: revisar, devolver, consolidar e encaminhar sem promulgar.
DO $schema$
BEGIN
 IF to_regclass('public.nucleo_ac01_review_events') IS NULL THEN RAISE EXCEPTION 'Review schema missing'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.nucleo_ac01_review_events'::regclass)
 THEN RAISE EXCEPTION 'Review RLS disabled'; END IF;
 IF NOT has_table_privilege('authenticated','public.nucleo_ac01_review_events','SELECT')
 OR NOT has_table_privilege('authenticated','public.nucleo_ac01_review_events','INSERT')
 OR has_table_privilege('authenticated','public.nucleo_ac01_review_events','UPDATE')
 OR has_table_privilege('authenticated','public.nucleo_ac01_review_events','DELETE')
 OR has_table_privilege('anon','public.nucleo_ac01_review_events','SELECT')
 THEN RAISE EXCEPTION 'Review effective grants invalid'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE tablename='nucleo_ac01_review_events')<>2
 THEN RAISE EXCEPTION 'Review policies missing'; END IF;
END $schema$;
INSERT INTO public.app_admin_capabilities(auth_user_id,capability)
VALUES ('44444444-4444-4444-8444-444444444444','nucleo_manage');
SET ROLE authenticated;
SET request.jwt.claim.sub='44444444-4444-4444-8444-444444444444';
INSERT INTO public.nucleo_ac01_review_events
(id,contribution_id,module_id,event_kind,body,request_id)
VALUES
('10000000-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
'comentario','Origem e hash precisam de conferência humana.','20000000-0000-4000-8000-000000000001'),
('10000000-0000-4000-8000-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
'solicitar_refinamento','Revisar referências e registrar motivo da divergência.','20000000-0000-4000-8000-000000000002'),
('10000000-0000-4000-8000-000000000003','dddddddd-dddd-4ddd-8ddd-dddddddddddd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
'minuta_consolidacao','Minuta de metadados, não homologada e sujeita a decisão.','20000000-0000-4000-8000-000000000003'),
('10000000-0000-4000-8000-000000000004','dddddddd-dddd-4ddd-8ddd-dddddddddddd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
'encaminhar_decisao','Solicitação de decisão à autoridade, sem promulgação.','20000000-0000-4000-8000-000000000004');
DO $positive$
BEGIN
 IF (SELECT count(*) FROM public.nucleo_ac01_review_events)<>4 THEN
  RAISE EXCEPTION 'Review events missing'; END IF;
 IF EXISTS(SELECT 1 FROM public.nucleo_ac01_review_events WHERE actor_auth_uid<>auth.uid()) THEN
  RAISE EXCEPTION 'Review authorship forged'; END IF;
 BEGIN
  INSERT INTO public.nucleo_ac01_review_events(contribution_id,module_id,event_kind,body,request_id)
  VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'comentario','Repetição idempotente proibida.','20000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'Request id duplicate accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  INSERT INTO public.nucleo_ac01_review_events(contribution_id,module_id,event_kind,body,request_id)
  VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'comentario','Não pode referenciar outro módulo.','20000000-0000-4000-8000-000000000005');
  RAISE EXCEPTION 'Cross-module allowed';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 WHEN raise_exception THEN
  IF SQLERRM<>'AC-01 review: referência de outro módulo ou não visível' THEN RAISE; END IF;
 END;
 BEGIN
  UPDATE public.nucleo_ac01_review_events SET body='Mutado'
  WHERE id='10000000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'Review UPDATE accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  DELETE FROM public.nucleo_ac01_review_events WHERE id='10000000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'Review DELETE accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $positive$;
RESET ROLE;
SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $denied$
BEGIN
 IF EXISTS(SELECT 1 FROM public.nucleo_ac01_review_events) THEN
 RAISE EXCEPTION 'Review unauthorized read'; END IF;
 BEGIN
  INSERT INTO public.nucleo_ac01_review_events(contribution_id,module_id,event_kind,body,request_id)
  VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'comentario','Proposta sem permissão deve falhar.','20000000-0000-4000-8000-000000000006');
  RAISE EXCEPTION 'Review unauthorized write';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 WHEN raise_exception THEN
  IF SQLERRM<>'AC-01 review: autorização nucleo_manage obrigatória' THEN RAISE; END IF;
 END;
END $denied$;
RESET ROLE;
SET ROLE anon;
DO $anon$
BEGIN
 BEGIN
  PERFORM count(*) FROM public.nucleo_ac01_review_events;
  RAISE EXCEPTION 'Review anon SELECT accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $anon$;
RESET ROLE;
UPDATE public.app_admin_capabilities SET active=false,revoked_at=now()
WHERE auth_user_id='44444444-4444-4444-8444-444444444444' AND capability='nucleo_manage';
SET ROLE authenticated;
SET request.jwt.claim.sub='44444444-4444-4444-8444-444444444444';
DO $revoked$
BEGIN
 IF EXISTS(SELECT 1 FROM public.nucleo_ac01_review_events) THEN
 RAISE EXCEPTION 'Review revoked user has access'; END IF;
END $revoked$;
RESET ROLE;
SELECT 'AC01 review event authorization and append-only PASS' AS result;
