\set ON_ERROR_STOP on
-- PostgreSQL descartável. Nenhum fileId ou conteúdo real do Drive.
DO $$
BEGIN
 IF (SELECT count(*) FROM public.app_admin_capabilities WHERE capability='provision_users')<>2 THEN
  RAISE EXCEPTION 'M2 regression on provision_users';
 END IF;
 IF (SELECT count(*) FROM pg_policies WHERE tablename='nucleo_source_references')<>2 THEN
  RAISE EXCEPTION 'M2 RLS policies missing';
 END IF;
 IF has_table_privilege('anon','public.nucleo_source_references','SELECT')
    OR has_table_privilege('authenticated','public.nucleo_source_references','DELETE')
    OR has_table_privilege('service_role','public.nucleo_source_references','UPDATE') THEN
  RAISE EXCEPTION 'M2 unexpected grants';
 END IF;
END $$;

INSERT INTO public.app_admin_capabilities(auth_user_id,capability)
VALUES ('11111111-1111-4111-8111-111111111111','nucleo_manage');

SET ROLE authenticated;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
INSERT INTO public.nucleo_source_references
(provider,provider_file_id,source_name,source_mime_type,source_access_class,authority_state)
VALUES ('google_drive','synthetic-drive-file-1','Synthetic source','text/plain','privado','provisorio');
DO $$
BEGIN
 IF (SELECT count(*) FROM public.nucleo_source_references)<>1 THEN
  RAISE EXCEPTION 'M2 authorized reference not visible';
 END IF;
END $$;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM public.nucleo_source_references) THEN
  RAISE EXCEPTION 'M2 legacy user read leak';
 END IF;
 BEGIN
  INSERT INTO public.nucleo_source_references(provider,provider_file_id,source_name,source_mime_type)
   VALUES ('google_drive','synthetic-denied','Forbidden','text/plain');
  RAISE EXCEPTION 'M2 legacy user inserted without grant';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM public.nucleo_source_references) THEN
   RAISE EXCEPTION 'M2 scoped Health-only leaked';
 END IF;
END $$;
RESET ROLE;

SET ROLE anon;
DO $$
BEGIN
 BEGIN
  PERFORM count(*) FROM public.nucleo_source_references;
  RAISE EXCEPTION 'M2 anon read allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
RESET ROLE;

-- Autoridade não pode ser elevada acidentalmente a partir da referência.
DO $$
BEGIN
 BEGIN
  INSERT INTO public.nucleo_source_references
   (provider,provider_file_id,source_name,source_mime_type,content_imported)
  VALUES ('google_drive','synthetic-imported','Invalid','text/plain',true);
  RAISE EXCEPTION 'M2 content_imported true allowed';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN
  INSERT INTO public.nucleo_source_references
   (provider,provider_file_id,source_name,source_mime_type)
  VALUES ('google_drive','synthetic-drive-file-1','Collision','text/plain');
  RAISE EXCEPTION 'M2 duplicate source identity allowed';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 BEGIN
  DELETE FROM public.nucleo_source_references WHERE provider_file_id='synthetic-drive-file-1';
  RAISE EXCEPTION 'M2 delete guard bypassed';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'Núcleo M1: deletion forbidden; preserve document heritage' THEN RAISE; END IF;
 END;
END $$;

UPDATE public.app_admin_capabilities SET active=false,revoked_at=now()
WHERE auth_user_id='11111111-1111-4111-8111-111111111111' AND capability='nucleo_manage';

SET ROLE authenticated;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM public.nucleo_source_references) THEN RAISE EXCEPTION 'M2 revoked user retained access'; END IF;
END $$;
RESET ROLE;
SELECT 'PASS M2 RLS, ID uniqueness, content guard, anonymous, legacy, scoped, revoke, immutability' AS result;
