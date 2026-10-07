-- Uso real 2026-10-07 — quando ainda não há histórico válido do fornecedor,
-- usar o custo físico canônico convertido pela apresentação como referência editável.
-- Isso permite que compras atuais da Du Porto tragam o valor já conhecido no cadastro
-- sem fabricar histórico de compra.

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
SET search_path TO 'public'
AS $function$
DECLARE
  v_price numeric;
  v_canonical_cost numeric;
BEGIN
  SELECT CASE
           WHEN p_variant_id IS NULL THEN p.cost
           ELSE COALESCE(pv.cost_override, p.cost)
         END
    INTO v_canonical_cost
    FROM public.products p
    LEFT JOIN public.product_variants pv
      ON pv.id = p_variant_id
     AND pv.product_id = p.id
   WHERE p.id = p_product_id;

  IF p_purchase_presentation_id IS NULL THEN
    RETURN v_canonical_cost;
  END IF;

  -- 1) mesma apresentação formal.
  SELECT poi.unit_price
    INTO v_price
    FROM public.purchase_order_items poi
    JOIN public.purchase_orders po ON po.id = poi.purchase_order_id
   WHERE po.supplier_contact_id = p_supplier_contact_id
     AND po.status IN ('confirmado','em_transito','parcialmente_recebido','recebido')
     AND poi.product_id = p_product_id
     AND poi.variant_id IS NOT DISTINCT FROM p_variant_id
     AND poi.purchase_presentation_id = p_purchase_presentation_id
     AND poi.purchase_unit_label = p_purchase_unit_label
     AND poi.conversion_factor = p_conversion_factor
     AND poi.unit_price IS NOT NULL
   ORDER BY COALESCE(po.ordered_at, po.created_at) DESC, poi.created_at DESC
   LIMIT 1;

  IF v_price IS NOT NULL THEN
    RETURN v_price;
  END IF;

  -- 2) fallback legado confiável.
  SELECT poi.unit_price
    INTO v_price
    FROM public.purchase_order_items poi
    JOIN public.purchase_orders po ON po.id = poi.purchase_order_id
   WHERE po.supplier_contact_id = p_supplier_contact_id
     AND po.status IN ('confirmado','em_transito','parcialmente_recebido','recebido')
     AND poi.product_id = p_product_id
     AND poi.variant_id IS NOT DISTINCT FROM p_variant_id
     AND poi.purchase_presentation_id IS NULL
     AND poi.unit_price IS NOT NULL
     AND p_conversion_factor > 0
     AND (
       poi.conversion_factor = p_conversion_factor
       OR (
         poi.conversion_factor = 1
         AND p_conversion_factor > 1
         AND v_canonical_cost IS NOT NULL
         AND v_canonical_cost > 0
         AND (poi.unit_price / p_conversion_factor)
               BETWEEN (v_canonical_cost * 0.5) AND (v_canonical_cost * 1.5)
       )
     )
   ORDER BY COALESCE(po.ordered_at, po.created_at) DESC, poi.created_at DESC
   LIMIT 1;

  IF v_price IS NOT NULL THEN
    RETURN v_price;
  END IF;

  -- 3) sem histórico: custo físico atual convertido pela apresentação.
  IF v_canonical_cost IS NOT NULL
     AND v_canonical_cost > 0
     AND p_conversion_factor IS NOT NULL
     AND p_conversion_factor > 0 THEN
    RETURN round(v_canonical_cost * p_conversion_factor, 10);
  END IF;

  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_purchase_price_reference(uuid,uuid,uuid,uuid,text,numeric)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_purchase_price_reference(uuid,uuid,uuid,uuid,text,numeric)
TO authenticated, service_role;

COMMENT ON FUNCTION public.get_purchase_price_reference(uuid,uuid,uuid,uuid,text,numeric) IS
  'Sugere preço editável: histórico exato, legado confiável ou custo físico canônico convertido pela apresentação.';
