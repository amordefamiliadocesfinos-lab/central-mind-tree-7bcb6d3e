-- F6-O.2b: previne registros duplicados do mesmo documento privado.
-- Aplicar apenas em janela autorizada no Lovable Cloud após validação da PR.
-- Pré-checagem em 15/10/2026 encontrou zero chaves duplicadas.
CREATE UNIQUE INDEX IF NOT EXISTS order_documents_storage_locator_unique
  ON public.order_documents (storage_bucket, storage_path)
  WHERE storage_bucket IS NOT NULL AND storage_path IS NOT NULL;
