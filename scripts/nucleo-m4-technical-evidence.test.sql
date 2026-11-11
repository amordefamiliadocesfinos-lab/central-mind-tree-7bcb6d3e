\set ON_ERROR_STOP on
INSERT INTO public.app_admin_capabilities(auth_user_id,capability)
VALUES('11111111-1111-4111-8111-111111111111','nucleo_manage');
SET ROLE authenticated;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
INSERT INTO public.nucleo_development_workstreams(id,code,kind,title)
VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','NUC','modulo','Núcleo simulado');
INSERT INTO public.nucleo_development_evidence
(workstream_id,source,kind,repository,external_key,reference_url,title,observed_state,checked_at,snapshot)
VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','github','pull_request',
'amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e','614',
'https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/614',
'PR sintética','verificado',now(),'{"merged":true}'::jsonb);
INSERT INTO public.nucleo_development_evidence
(workstream_id,source,kind,external_key,title,observed_state,checked_at)
VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','supabase','migration',
'20261111222000','Migration sintética','verificado',now());
DO $assert$
BEGIN
 IF (SELECT count(*) FROM public.nucleo_development_evidence)<>2 THEN RAISE EXCEPTION 'M4 authorized read failed'; END IF;
 IF (SELECT count(*) FROM public.nucleo_development_evidence WHERE recorded_by_auth_uid=auth.uid())<>2 THEN RAISE EXCEPTION 'M4 audit identity missing'; END IF;
 BEGIN
  INSERT INTO public.nucleo_development_evidence
  (workstream_id,source,kind,repository,external_key,reference_url,title,observed_state)
  VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','github','pull_request',
  'amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e','fake',
  'https://github.com/evil/repo/pull/1','invalid','verificado');
  RAISE EXCEPTION 'M4 invalid URL or unchecked verification allowed';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN
  INSERT INTO public.nucleo_development_evidence
  (workstream_id,source,kind,external_key,title,snapshot)
  VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','supabase','migration','1','invalid','{"percent_complete":80}'::jsonb);
  RAISE EXCEPTION 'M4 fake progress allowed';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $assert$;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
DO $deny$
BEGIN
 IF EXISTS(SELECT 1 FROM public.nucleo_development_evidence) THEN RAISE EXCEPTION 'M4 read leak'; END IF;
 BEGIN
 INSERT INTO public.nucleo_development_evidence(workstream_id,source,kind,external_key,title)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','supabase','migration','bad','unauthorized');
 RAISE EXCEPTION 'M4 unauthorized insert permitted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $deny$;
RESET ROLE;

SET ROLE anon;
DO $anon$
BEGIN
 BEGIN
  PERFORM count(*) FROM public.nucleo_development_evidence;
  RAISE EXCEPTION 'M4 anon SELECT allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $anon$;
RESET ROLE;

DO $immut$
BEGIN
 BEGIN
  DELETE FROM public.nucleo_development_evidence;
  RAISE EXCEPTION 'M4 DELETE allowed';
 EXCEPTION WHEN raise_exception THEN
 IF SQLERRM <> 'Núcleo revision snapshots are immutable' THEN RAISE; END IF;
 END;
 BEGIN
  UPDATE public.nucleo_development_evidence SET title='replaced';
  RAISE EXCEPTION 'M4 UPDATE allowed';
 EXCEPTION WHEN raise_exception THEN
 IF SQLERRM <> 'Núcleo revision snapshots are immutable' THEN RAISE; END IF;
 END;
END $immut$;
UPDATE public.app_admin_capabilities SET active=false,revoked_at=now()
WHERE auth_user_id='11111111-1111-4111-8111-111111111111' AND capability='nucleo_manage';
SET ROLE authenticated;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $revoked$
BEGIN
 IF EXISTS(SELECT 1 FROM public.nucleo_development_evidence) THEN RAISE EXCEPTION 'M4 revocation failed'; END IF;
END $revoked$;
RESET ROLE;
SELECT 'M4 append-only, grant, revoke, validity, source identity: PASS' result;
