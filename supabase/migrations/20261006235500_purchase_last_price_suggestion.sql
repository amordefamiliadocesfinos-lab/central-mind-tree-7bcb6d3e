-- Sugestão de preço de compra por histórico real da mesma combinação.
-- Não altera preço automaticamente no backend: apenas devolve a última referência válida
-- para o formulário de Nova Compra. Rascunhos e compras canceladas são ignorados.

CREATE OR REPLACE FUNCTION public.get_last_purchase_unit_price(
  p_supplier_contact_id uuid,
  p_product_id uuid,
  p_variant_id uuid,
  p_purchase_presentation_id uuid,
  p_purchase_unit_label text,
  p_conversion_factor numeric
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT poi.unit_price
  FROM public.purchase_order_items poi
  JOIN public.purchase_orders po ON po.id = poi.purchase_order_id
  WHERE po.supplier_contact_id = p_supplier_contact_id
    AND po.status IN ('confirmado', 'em_transito', 'parcialmente_recebido', 'recebido')
    AND poi.product_id = p_product_id
    AND poi.variant_id IS NOT DISTINCT FROM p_variant_id
    AND poi.unit_price IS NOT NULL
    AND (
      (
        p_purchase_presentation_id IS NOT NULL
        AND poi.purchase_presentation_id = p_purchase_presentation_id
      )
      OR
      (
        p_purchase_presentation_id IS NULL
        AND poi.purchase_presentation_id IS NULL
        AND poi.purchase_unit_label = p_purchase_unit_label
        AND poi.conversion_factor = p_conversion_factor
      )
    )
  ORDER BY COALESCE(po.ordered_at, po.created_at) DESC, poi.created_at DESC
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_last_purchase_unit_price(uuid,uuid,uuid,uuid,text,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_last_purchase_unit_price(uuid,uuid,uuid,uuid,text,numeric) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_last_purchase_unit_price(uuid,uuid,uuid,uuid,text,numeric) IS
  'Retorna o último preço unitário válido da mesma combinação fornecedor + identidade física + forma de compra; ignora rascunhos e cancelados.';
