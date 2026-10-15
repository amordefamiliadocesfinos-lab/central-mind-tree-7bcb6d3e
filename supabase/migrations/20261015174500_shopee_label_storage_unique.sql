-- F6-O.2b — executar somente via Lovable Cloud oficial, após aprovação produtiva.
-- Armazenamento de etiquetas com informações pessoais, isolado dos PDFs legados.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('shopee-labels', 'shopee-labels', false, 4194304, ARRAY['application/pdf']::text[])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Leitura restrita aos mesmos papéis operacionais que executam a separação.
-- Sem políticas INSERT/UPDATE/DELETE para usuários autenticados neste bucket;
-- upload por URL temporária emitida exclusivamente pelo Core service_role.
CREATE POLICY "Operational staff can read Shopee labels"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'shopee-labels'
  AND public.current_app_user_role() IN ('Administrador', 'VENDA', 'LIDER PRODUÇÃO')
);

-- A tabela legada tem política de leitura ampla. Esta política restritiva não
-- interfere em documentos de outras origens, mas protege metadata da Shopee.
CREATE POLICY "Shopee label metadata operational access"
ON public.order_documents AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  (source IS DISTINCT FROM 'shopee_open_platform'
   AND storage_bucket IS DISTINCT FROM 'shopee-labels')
  OR public.current_app_user_role() IN ('Administrador', 'VENDA', 'LIDER PRODUÇÃO')
)
WITH CHECK (
  (source IS DISTINCT FROM 'shopee_open_platform'
   AND storage_bucket IS DISTINCT FROM 'shopee-labels')
  OR public.current_app_user_role() IN ('Administrador', 'VENDA', 'LIDER PRODUÇÃO')
);

-- Verificado em 15/10/2026: nenhuma localização duplicada.
-- Idempotência para arquivos privados (inclusive de origens futuras).
CREATE UNIQUE INDEX IF NOT EXISTS order_documents_storage_locator_unique
  ON public.order_documents (storage_bucket, storage_path)
  WHERE storage_bucket IS NOT NULL AND storage_path IS NOT NULL;
