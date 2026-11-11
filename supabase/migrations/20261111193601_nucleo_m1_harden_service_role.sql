-- Núcleo 2.0 M1 — hardening aditivo pós-preflight (sem dados/documentos)
-- Tabelas existentes podem herdar GRANTs amplos de ALTER DEFAULT PRIVILEGES;
-- restringir exclusivamente service_role nas três tabelas novas.
BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.nucleo_documents') IS NULL
    OR to_regclass('public.nucleo_document_revisions') IS NULL
    OR to_regclass('public.nucleo_import_batches') IS NULL THEN
    RAISE EXCEPTION 'M1 hardening requires schema migration first';
  END IF;
END $guard$;

REVOKE ALL ON TABLE public.nucleo_import_batches,
  public.nucleo_documents, public.nucleo_document_revisions FROM service_role;
GRANT SELECT, INSERT ON TABLE public.nucleo_import_batches,
  public.nucleo_documents, public.nucleo_document_revisions TO service_role;

-- Camada independente de preservação dos documentos e lotes.
-- A administração de status será modelada em uma migration futura específica;
-- DELETE acidental fica proibido inclusive a executores privilegiados.
CREATE FUNCTION public.nucleo_reject_delete_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $immutable$
BEGIN
  RAISE EXCEPTION 'Núcleo M1: deletion forbidden; preserve document heritage';
END;
$immutable$;
REVOKE ALL ON FUNCTION public.nucleo_reject_delete_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER nucleo_documents_no_delete
BEFORE DELETE ON public.nucleo_documents
FOR EACH ROW EXECUTE FUNCTION public.nucleo_reject_delete_guard();
CREATE TRIGGER nucleo_import_batches_no_delete
BEFORE DELETE ON public.nucleo_import_batches
FOR EACH ROW EXECUTE FUNCTION public.nucleo_reject_delete_guard();

COMMIT;
