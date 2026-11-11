\set ON_ERROR_STOP on
-- Aqui a migration proposta já foi aplicada no Postgres descartável.
-- O grant dedicado é feito pelo ator de teste privilegiado, jamais pelo navegador.
INSERT INTO public.app_admin_capabilities(auth_user_id,capability)
VALUES ('11111111-1111-4111-8111-111111111111','nucleo_manage');

DO $$
BEGIN
 IF (SELECT count(*) FROM public.app_admin_capabilities WHERE capability='provision_users')<>2 THEN
   RAISE EXCEPTION 'REGRESSION: provision_users grants changed';
 END IF;
 IF (SELECT count(*) FROM public.app_admin_capabilities WHERE capability='nucleo_manage')<>1 THEN
   RAISE EXCEPTION 'Capability not explicitly registered';
 END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='app_admin_capabilities')<>1 THEN
   RAISE EXCEPTION 'Existing capability policy changed';
 END IF;
END $$;

-- A role authenticated não pode conceder a si própria nucleo_manage,
-- nem enxergar capabilities de terceiros (conferência de isolamento da fonte RLS).
SET ROLE authenticated;
SET request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
DO $selfgrant$
BEGIN
  IF (SELECT count(*) FROM public.app_admin_capabilities)<>1 THEN
    RAISE EXCEPTION 'Capability own-select leaked another identity';
  END IF;
  BEGIN
    INSERT INTO public.app_admin_capabilities(auth_user_id,capability)
    VALUES('22222222-2222-4222-8222-222222222222','nucleo_manage');
    RAISE EXCEPTION 'Client could self-grant nucleo_manage';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.app_admin_capabilities SET capability='nucleo_manage'
    WHERE auth_user_id='22222222-2222-4222-8222-222222222222';
    RAISE EXCEPTION 'Client could change own capability';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $selfgrant$;
RESET ROLE;

-- Autorizado: administra o Núcleo porque recebeu a capacidade específica.
SET ROLE authenticated;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
INSERT INTO public.nucleo_import_batches (id,source_kind,source_sha256,exported_at,source_label,page_count)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','local_legacy',repeat('a',64),now(),'synthetic',2);
INSERT INTO public.nucleo_documents (id,import_batch_id,legacy_id,area_id,title,content,origin_kind,content_sha256,created_at,updated_at)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','original-a','biblioteca','Test','synthetic','local_legacy',repeat('b',64),now(),now());
INSERT INTO public.nucleo_document_revisions(document_id,revision_number,title,content,content_sha256)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1,'Test','synthetic',repeat('b',64));
DO $$
BEGIN
 IF (SELECT count(*) FROM public.nucleo_documents)<>1 OR (SELECT count(*) FROM public.nucleo_document_revisions)<>1 THEN
 RAISE EXCEPTION 'Authorized access not working'; END IF;
END $$;
RESET ROLE;

-- Legado com provision_users e sem nucleo_manage: negado mesmo com cargo operacional elevado.
SET ROLE authenticated;
SET request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
DO $$
BEGIN
 IF (SELECT count(*) FROM public.nucleo_documents)<>0 THEN RAISE EXCEPTION 'Legacy leakage'; END IF;
 BEGIN
 INSERT INTO public.nucleo_import_batches(source_kind,source_sha256,exported_at,source_label,page_count)
 VALUES('local_legacy',repeat('c',64),now(),'deny',0);
 RAISE EXCEPTION 'Legacy insert incorrectly allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
RESET ROLE;

-- Scoped Saúde-only: não possui capability dedicada, mesmo autenticado.
SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $$
BEGIN
 IF (SELECT count(*) FROM public.nucleo_documents)<>0 THEN RAISE EXCEPTION 'Scoped leakage'; END IF;
 BEGIN
 INSERT INTO public.nucleo_documents(import_batch_id,legacy_id,area_id,title,content,origin_kind,content_sha256,created_at,updated_at)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','scoped','biblioteca','Denied','X','local_legacy',repeat('c',64),now(),now());
 RAISE EXCEPTION 'Scoped insert incorrectly allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
RESET ROLE;

-- Anônimo nem sequer tem GRANT de tabela.
SET ROLE anon;
DO $$
BEGIN
 BEGIN
 PERFORM count(*) FROM public.nucleo_documents;
 RAISE EXCEPTION 'Anon read incorrectly allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
RESET ROLE;

-- Revogação: acesso anterior é imediatamente negado em novas consultas.
UPDATE public.app_admin_capabilities SET active=false,revoked_at=now()
WHERE auth_user_id='11111111-1111-4111-8111-111111111111' AND capability='nucleo_manage';
SET ROLE authenticated;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $$
BEGIN
 IF (SELECT count(*) FROM public.nucleo_documents)<>0 THEN RAISE EXCEPTION 'Revocation ineffective'; END IF;
END $$;
RESET ROLE;

-- Service role deve ter somente leitura/inserção mesmo com grants default amplos.
DO $
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['nucleo_documents','nucleo_document_revisions','nucleo_import_batches'] LOOP
    IF has_table_privilege('service_role',format('public.%I',t),'DELETE')
      OR has_table_privilege('service_role',format('public.%I',t),'UPDATE')
      OR has_table_privilege('service_role',format('public.%I',t),'TRUNCATE') THEN
      RAISE EXCEPTION 'Excessive service_role privileges on %',t;
    END IF;
    IF NOT has_table_privilege('service_role',format('public.%I',t),'SELECT')
      OR NOT has_table_privilege('service_role',format('public.%I',t),'INSERT') THEN
      RAISE EXCEPTION 'Missing service_role basic privileges on %',t;
    END IF;
  END LOOP;
END $;

-- Mesmo postgres não pode excluir registros sem remover conscientemente os guards.
DO $
BEGIN
  BEGIN
    DELETE FROM public.nucleo_documents WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    RAISE EXCEPTION 'M1 document deletion incorrectly allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Núcleo M1: deletion forbidden; preserve document heritage' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM public.nucleo_import_batches WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    RAISE EXCEPTION 'M1 batch deletion incorrectly allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Núcleo M1: deletion forbidden; preserve document heritage' THEN RAISE; END IF;
  END;
END $;

-- Imutabilidade também quando a tentativa parte do ator privilegiado da simulação.
DO $$
BEGIN
 BEGIN
 UPDATE public.nucleo_document_revisions SET content='changed' WHERE document_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 RAISE EXCEPTION 'Revision overwrite allowed';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'Núcleo revision snapshots are immutable' THEN RAISE; END IF;
 END;
 BEGIN
 DELETE FROM public.nucleo_document_revisions WHERE document_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 RAISE EXCEPTION 'Revision deletion allowed';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'Núcleo revision snapshots are immutable' THEN RAISE; END IF;
 END;
END $$;
-- Confere que não foram criadas políticas sobre módulos operacionais.
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
 AND tablename NOT IN ('app_admin_capabilities','nucleo_import_batches','nucleo_documents','nucleo_document_revisions')) THEN
 RAISE EXCEPTION 'Unexpected non-nucleo RLS policy'; END IF;
END $$;
SELECT 'PASS: capability independence, authorized, legacy, scoped, anon, revoke, immutable, nonregression' AS test_result;
