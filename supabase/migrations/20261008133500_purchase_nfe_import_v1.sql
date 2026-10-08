-- Importação assistida de NF-e/DANFE em Compras.
-- A nota fiscal transcreve fatos já presentes no documento:
-- metadados, itens/valores extraídos e condição financeira.
-- NÃO cria recebimento físico, NÃO altera estoque e NÃO registra pagamento.

ALTER TABLE public.purchase_documents
  ADD COLUMN IF NOT EXISTS document_number text NULL,
  ADD COLUMN IF NOT EXISTS document_series text NULL,
  ADD COLUMN IF NOT EXISTS document_date date NULL,
  ADD COLUMN IF NOT EXISTS access_key text NULL,
  ADD COLUMN IF NOT EXISTS issuer_document text NULL,
  ADD COLUMN IF NOT EXISTS extraction_status text NOT NULL DEFAULT 'not_processed',
  ADD COLUMN IF NOT EXISTS extracted_data jsonb NULL;

ALTER TABLE public.purchase_documents
  DROP CONSTRAINT IF EXISTS purchase_documents_extraction_status_check;

ALTER TABLE public.purchase_documents
  ADD CONSTRAINT purchase_documents_extraction_status_check
  CHECK (extraction_status IN ('not_processed','parsed','confirmed','mismatch'));

CREATE UNIQUE INDEX IF NOT EXISTS purchase_documents_nfe_access_key_unique
  ON public.purchase_documents(access_key)
  WHERE access_key IS NOT NULL AND btrim(access_key) <> '';

CREATE OR REPLACE FUNCTION public.register_purchase_invoice_billing(
  p_purchase_order_id uuid,
  p_installments jsonb,
  p_invoice_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_result jsonb;
  v_billed_at timestamptz;
BEGIN
  IF auth.role() <> 'service_role'
     AND COALESCE(public.current_app_user_role(), '') NOT IN ('Administrador','VENDA','LIDER PRODUÇÃO') THEN
    RAISE EXCEPTION 'operations_order_write_required';
  END IF;

  IF p_invoice_date IS NULL THEN
    RAISE EXCEPTION 'Informe a data de emissão da nota fiscal.';
  END IF;

  v_result := public.register_purchase_billing(
    p_purchase_order_id,
    p_installments
  );

  IF COALESCE((v_result->>'billing_status')::text,'') = 'invoiced' THEN
    v_billed_at := (p_invoice_date::timestamp AT TIME ZONE 'America/Sao_Paulo');

    PERFORM set_config('app.purchase_billing_authorized', '1', true);

    UPDATE public.purchase_orders
    SET billed_at = v_billed_at,
        updated_at = now()
    WHERE id = p_purchase_order_id
      AND billing_status = 'invoiced';

    v_result := v_result || jsonb_build_object(
      'billed_at', v_billed_at,
      'invoice_date', p_invoice_date
    );
  END IF;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.register_purchase_invoice_billing(uuid,jsonb,date)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_purchase_invoice_billing(uuid,jsonb,date)
TO authenticated, service_role;

COMMENT ON FUNCTION public.register_purchase_invoice_billing(uuid,jsonb,date) IS
  'Registra faturamento a partir de uma NF-e conferida. Cria obrigações financeiras e usa a data da NF como billed_at; não registra pagamento nem recebimento físico.';
