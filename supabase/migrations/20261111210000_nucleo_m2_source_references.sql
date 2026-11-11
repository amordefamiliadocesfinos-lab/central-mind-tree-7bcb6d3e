-- Núcleo 2.0 / M2 — referências externas governadas (ADITIVA)
-- Sem cópia do conteúdo Drive, sem concessão de capacidade, sem publicação.
-- Aplicação aditiva aprovada após testes PostgreSQL 17; não copiar documentos.
BEGIN;

DO $guard$
BEGIN
 IF to_regclass('public.nucleo_documents') IS NULL
  OR to_regclass('public.nucleo_import_batches') IS NULL
  OR to_regclass('public.app_admin_capabilities') IS NULL THEN
   RAISE EXCEPTION 'M2 requires existing Núcleo M1';
 END IF;
END $guard$;

CREATE TABLE public.nucleo_source_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('google_drive')),
  provider_file_id text NOT NULL CHECK (length(trim(provider_file_id)) > 0),
  source_name text NOT NULL CHECK (length(trim(source_name)) > 0),
  source_mime_type text NOT NULL CHECK (length(trim(source_mime_type)) > 0),
  source_parent_id text,
  source_modified_at timestamptz,
  source_checksum_sha256 text CHECK (source_checksum_sha256 IS NULL OR source_checksum_sha256 ~ '^[0-9a-f]{64}$'),
  source_access_class text NOT NULL DEFAULT 'nao_verificado'
    CHECK (source_access_class IN ('nao_verificado','privado','restrito','publico_verificado')),
  authority_state text NOT NULL DEFAULT 'nao_classificado'
    CHECK (authority_state IN ('nao_classificado','historico','provisorio','pendente_homologacao','vigente_comprovado')),
  reference_state text NOT NULL DEFAULT 'inventariado'
    CHECK (reference_state IN ('inventariado','reconciliacao_pendente','validado_metadados','arquivado')),
  provenance_note text,
  content_imported boolean NOT NULL DEFAULT false CHECK (content_imported = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  recorded_by_auth_uid uuid,
  UNIQUE (provider,provider_file_id)
);
COMMENT ON TABLE public.nucleo_source_references IS
  'M2 metadata-only external references, not document contents or approved canonical authority';
ALTER TABLE public.nucleo_source_references ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nucleo_source_references FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.nucleo_source_references TO authenticated,service_role;

CREATE POLICY nucleo_source_refs_select ON public.nucleo_source_references
 FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.app_admin_capabilities cap
  WHERE cap.auth_user_id=(SELECT auth.uid()) AND cap.capability='nucleo_manage'
    AND cap.active AND cap.revoked_at IS NULL
 ));
CREATE POLICY nucleo_source_refs_insert ON public.nucleo_source_references
 FOR INSERT TO authenticated WITH CHECK (EXISTS (
  SELECT 1 FROM public.app_admin_capabilities cap
  WHERE cap.auth_user_id=(SELECT auth.uid()) AND cap.capability='nucleo_manage'
    AND cap.active AND cap.revoked_at IS NULL
 ));

-- Não conceder UPDATE/DELETE. Impedir exclusão mesmo por executor privilegiado.
CREATE TRIGGER nucleo_source_refs_no_delete
BEFORE DELETE ON public.nucleo_source_references
FOR EACH ROW EXECUTE FUNCTION public.nucleo_reject_delete_guard();

COMMIT;
