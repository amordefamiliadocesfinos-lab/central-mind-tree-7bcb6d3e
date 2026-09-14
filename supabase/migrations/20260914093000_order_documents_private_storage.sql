-- Documentos de pedidos: Storage privado e metadados compatíveis com URLs legadas.
-- A migration não move nem invalida registros existentes de order_documents.

INSERT INTO storage.buckets (id, name, public)
VALUES ('order-documents', 'order-documents', false)
ON CONFLICT (id) DO UPDATE
SET public = false;

DROP POLICY IF EXISTS "Authenticated users read order documents" ON storage.objects;
CREATE POLICY "Authenticated users read order documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'order-documents');

DROP POLICY IF EXISTS "Authenticated users upload order documents" ON storage.objects;
CREATE POLICY "Authenticated users upload order documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'order-documents');

DROP POLICY IF EXISTS "Authenticated users delete order documents" ON storage.objects;
CREATE POLICY "Authenticated users delete order documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'order-documents');

ALTER TABLE public.order_documents
  ALTER COLUMN file_url DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS storage_bucket text NULL,
  ADD COLUMN IF NOT EXISTS storage_path text NULL,
  ADD COLUMN IF NOT EXISTS mime_type text NULL,
  ADD COLUMN IF NOT EXISTS file_size bigint NULL;

ALTER TABLE public.order_documents
  DROP CONSTRAINT IF EXISTS order_documents_document_type_check;

ALTER TABLE public.order_documents
  ADD CONSTRAINT order_documents_document_type_check
  CHECK (document_type IN ('order_pdf', 'shipping_label', 'invoice', 'declaration', 'receipt', 'other'));

ALTER TABLE public.order_documents
  ADD CONSTRAINT order_documents_file_location_check
  CHECK (
    COALESCE(NULLIF(trim(file_url), '') IS NOT NULL, false)
    OR (
      COALESCE(NULLIF(trim(storage_bucket), '') IS NOT NULL, false)
      AND COALESCE(NULLIF(trim(storage_path), '') IS NOT NULL, false)
    )
  );

CREATE INDEX IF NOT EXISTS order_documents_storage_path_idx
  ON public.order_documents(storage_bucket, storage_path)
  WHERE storage_path IS NOT NULL;
