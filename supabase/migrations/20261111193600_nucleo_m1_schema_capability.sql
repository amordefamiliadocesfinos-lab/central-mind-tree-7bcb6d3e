-- NÚCLEO 2.0 / M1 / MIGRATION ADITIVA — aplicação somente pelo portão de governança
-- Camada Mestre 11/11/2026: autoriza implantação técnica aditiva após testes comprovados.
-- Não importar documentos, modificar localStorage, conceder nucleo_manage ou trocar fonte de leitura.
BEGIN;

-- O CHECK anterior restringe capability a provision_users; ampliar sem revogar grants.
DO $guard$
DECLARE v_name name;
BEGIN
  SELECT c.conname INTO v_name FROM pg_constraint c
  WHERE c.conrelid = 'public.app_admin_capabilities'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%provision_users%'
    AND pg_get_constraintdef(c.oid) NOT LIKE '%nucleo_manage%';
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Original capability CHECK not found; manual reconciliation required';
  END IF;
  EXECUTE format('ALTER TABLE public.app_admin_capabilities DROP CONSTRAINT %I',v_name);
  ALTER TABLE public.app_admin_capabilities
    ADD CONSTRAINT app_admin_capabilities_capability_check
    CHECK (capability IN ('provision_users','nucleo_manage'));
END $guard$;

-- Não é concedida automaticamente nenhuma capacidade.
-- Grant/revoke de nucleo_manage fica exclusivamente sob o ator administrativo
-- privilegiado existente, com trilha granted_by_auth_user_id/revoked_at.
-- A política SELECT própria existente permanece inalterada.

CREATE TABLE public.nucleo_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind text NOT NULL CHECK (source_kind IN ('local_legacy')),
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  exported_at timestamptz NOT NULL,
  source_label text NOT NULL,
  page_count integer NOT NULL CHECK (page_count >= 0),
  flags jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(flags) = 'object'),
  state text NOT NULL DEFAULT 'staged' CHECK (state IN ('staged','reconciled','cancelled')),
  imported_at timestamptz,
  imported_by_auth_uid uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_kind,source_sha256)
);

CREATE TABLE public.nucleo_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id uuid REFERENCES public.nucleo_import_batches(id) ON DELETE RESTRICT,
  legacy_id text,
  area_id text NOT NULL CHECK (area_id IN (
    'biblioteca','consciencia','arquitetura','principios',
    'atlas','ia-orquestradora','evolucao','estado-atual')),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  content text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  authority_state text NOT NULL DEFAULT 'nao_classificado'
    CHECK (authority_state IN ('nao_classificado','historico','provisorio','vigente_comprovado')),
  origin_kind text NOT NULL CHECK (origin_kind IN ('local_legacy','nucleo_native')),
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by_auth_uid uuid,
  CONSTRAINT nucleo_legacy_identity CHECK (
    (origin_kind = 'local_legacy' AND import_batch_id IS NOT NULL AND legacy_id IS NOT NULL)
    OR (origin_kind = 'nucleo_native' AND import_batch_id IS NULL AND legacy_id IS NULL)
  ),
  UNIQUE (import_batch_id,legacy_id)
);
CREATE INDEX nucleo_documents_area_idx ON public.nucleo_documents(area_id,updated_at DESC);

CREATE TABLE public.nucleo_document_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.nucleo_documents(id) ON DELETE RESTRICT,
  revision_number integer NOT NULL CHECK (revision_number > 0),
  title text NOT NULL,
  content text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  source_version_id text,
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  label text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by_auth_uid uuid,
  UNIQUE (document_id,revision_number)
);

-- Defesa independente: impossibilitar UPDATE/DELETE de revisões, inclusive
-- para caminhos privilegiados acidentais de execução.
CREATE FUNCTION public.nucleo_revisions_immutable_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $immut$
BEGIN
  RAISE EXCEPTION 'Núcleo revision snapshots are immutable';
END;
$immut$;
REVOKE ALL ON FUNCTION public.nucleo_revisions_immutable_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER nucleo_revisions_immutable
BEFORE UPDATE OR DELETE ON public.nucleo_document_revisions
FOR EACH ROW EXECUTE FUNCTION public.nucleo_revisions_immutable_guard();

-- Acesso concedido somente a authenticated; anon não tem privilégios de tabela.
-- Não há UPDATE/DELETE habilitados via Data API na M1: importação será etapa posterior.
ALTER TABLE public.nucleo_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nucleo_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nucleo_document_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nucleo_import_batches,public.nucleo_documents,
  public.nucleo_document_revisions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.nucleo_import_batches,public.nucleo_documents,
  public.nucleo_document_revisions TO authenticated;
GRANT SELECT,INSERT ON public.nucleo_import_batches,public.nucleo_documents,
  public.nucleo_document_revisions TO service_role;

-- Consulta permitida pela RLS já existente de app_admin_capabilities:
-- um login só pode ler as próprias capacidades ativas. Não há SECURITY DEFINER.
CREATE POLICY nucleo_batches_select ON public.nucleo_import_batches
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.app_admin_capabilities c
    WHERE c.auth_user_id = (SELECT auth.uid())
      AND c.capability = 'nucleo_manage' AND c.active AND c.revoked_at IS NULL));
CREATE POLICY nucleo_batches_insert ON public.nucleo_import_batches
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.app_admin_capabilities c
    WHERE c.auth_user_id = (SELECT auth.uid())
      AND c.capability = 'nucleo_manage' AND c.active AND c.revoked_at IS NULL));

CREATE POLICY nucleo_documents_select ON public.nucleo_documents
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.app_admin_capabilities c
    WHERE c.auth_user_id = (SELECT auth.uid())
      AND c.capability = 'nucleo_manage' AND c.active AND c.revoked_at IS NULL));
CREATE POLICY nucleo_documents_insert ON public.nucleo_documents
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.app_admin_capabilities c
    WHERE c.auth_user_id = (SELECT auth.uid())
      AND c.capability = 'nucleo_manage' AND c.active AND c.revoked_at IS NULL));

CREATE POLICY nucleo_revisions_select ON public.nucleo_document_revisions
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.app_admin_capabilities c
    WHERE c.auth_user_id = (SELECT auth.uid())
      AND c.capability = 'nucleo_manage' AND c.active AND c.revoked_at IS NULL));
CREATE POLICY nucleo_revisions_insert ON public.nucleo_document_revisions
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.app_admin_capabilities c
    WHERE c.auth_user_id = (SELECT auth.uid())
      AND c.capability = 'nucleo_manage' AND c.active AND c.revoked_at IS NULL));

-- Sem políticas ou GRANT de UPDATE/DELETE de documentos, revisões ou lotes.
-- Nenhum bootstrap de nucleo_manage; 82 páginas continuam apenas no backup privado.
COMMIT;
