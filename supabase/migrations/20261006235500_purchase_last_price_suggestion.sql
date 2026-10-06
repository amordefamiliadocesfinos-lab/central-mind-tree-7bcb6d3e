-- Referência automática de preço na Nova Compra.
-- Forma cadastrada: usa a última compra válida da mesma combinação
-- fornecedor + identidade física + forma de compra.
-- Unidade direta: usa o custo físico canônico por unidade de estoque.
-- O valor retornado é apenas sugestão editável na interface.

CREATE OR REPLACE FUNCTION public.get_purchase_price_reference(
  p_supplier_contact_id uuid,
  p_product_id uuid,
  p_variant_id uuid,
  p_purchase_presentation_id uuid,
  p_purchase_unit_label text,
  p_conversion_factor numeric
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_price numeric;
BEGIN
  IF p_purchase_presentation_id IS NULL THEN
    SELECT CASE
             WHEN p_variant_id IS NULL THEN p.cost
             ELSE COALESCE(pv.cost_override, p.cost)
           END
      INTO v_price
      FROM public.products p
      LEFT JOIN public.product_variants pv
        ON pv.id = p_variant_id
       AND pv.product_id = p.id
     WHERE p.id = p_product_id;

    RETURN v_price;
  END IF;

  SELECT poi.unit_price
    INTO v_price
    FROM public.purchase_order_items poi
    JOIN public.purchase_orders po ON po.id = poi.purchase_order_id
   WHERE po.supplier_contact_id = p_supplier_contact_id
     AND po.status IN ('confirmado', 'em_transito', 'parcialmente_recebido', 'recebido')
     AND poi.product_id = p_product_id
     AND poi.variant_id IS NOT DISTINCT FROM p_variant_id
     AND poi.purchase_presentation_id = p_purchase_presentation_id
     AND poi.purchase_unit_label = p_purchase_unit_label
     AND poi.conversion_factor = p_conversion_factor
     AND poi.unit_price IS NOT NULL
   ORDER BY COALESCE(po.ordered_at, po.created_at) DESC, poi.created_at DESC
   LIMIT 1;

  RETURN v_price;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_purchase_price_reference(uuid,uuid,uuid,uuid,text,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_purchase_price_reference(uuid,uuid,uuid,uuid,text,numeric) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_purchase_price_reference(uuid,uuid,uuid,uuid,text,numeric) IS
  'Sugere preço editável na compra: última compra válida para apresentação cadastrada; custo físico canônico para unidade direta.';
