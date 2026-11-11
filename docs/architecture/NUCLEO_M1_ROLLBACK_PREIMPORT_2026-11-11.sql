-- NÚCLEO 2.0 / M1: ROLLBACK CONTROLADO PRE-IMPORTAÇÃO
-- Executar apenas em ambiente isolado ou com autorização posterior.
-- NUNCA descartar documentos de uma implantação já utilizada.
BEGIN;
DO $guard$
BEGIN
 IF EXISTS (SELECT 1 FROM public.nucleo_import_batches LIMIT 1)
 OR EXISTS (SELECT 1 FROM public.nucleo_documents LIMIT 1)
 OR EXISTS (SELECT 1 FROM public.nucleo_document_revisions LIMIT 1) THEN
   RAISE EXCEPTION 'Rollback físico bloqueado: existem dados Núcleo. Use rollback lógico e preserve acervo';
 END IF;
 IF EXISTS (SELECT 1 FROM public.app_admin_capabilities WHERE capability='nucleo_manage' LIMIT 1) THEN
   RAISE EXCEPTION 'Rollback físico bloqueado: grants nucleo_manage devem ser reconciliados';
 END IF;
END $guard$;

DROP TABLE public.nucleo_document_revisions;
DROP TABLE public.nucleo_documents;
DROP TABLE public.nucleo_import_batches;
DROP FUNCTION public.nucleo_revisions_immutable_guard();

ALTER TABLE public.app_admin_capabilities
DROP CONSTRAINT app_admin_capabilities_capability_check;
ALTER TABLE public.app_admin_capabilities
ADD CONSTRAINT app_admin_capabilities_capability_check
CHECK (capability IN ('provision_users'));

-- Sem modificar ou apagar provision_users existentes.
COMMIT;
