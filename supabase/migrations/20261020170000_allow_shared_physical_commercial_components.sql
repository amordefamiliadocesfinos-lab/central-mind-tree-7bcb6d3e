-- Permit commercial kits to reference a real physical variant belonging to
-- another Product Master. The component's product/variant identity stays exact.
-- No products, variants, stocks, orders or listings are inserted or modified.
CREATE OR REPLACE FUNCTION public.assert_commercial_component_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.commercial_presentations cp
    WHERE cp.id = NEW.presentation_id AND cp.composition_mode = 'composite'
  ) THEN
    RAISE EXCEPTION 'Componente não pertence a uma apresentação composta válida.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.products p
    JOIN public.product_variants v ON v.product_id = p.id
    WHERE p.id = NEW.product_id
      AND v.id = NEW.variant_id
      AND p.is_active = true
      AND v.is_active = true
  ) THEN
    RAISE EXCEPTION 'Componente físico inexistente, inativo ou variante incompatível com Produto Mestre.';
  END IF;

  IF NEW.quantity IS NULL OR NEW.quantity <= 0 OR NEW.quantity <> trunc(NEW.quantity) THEN
    RAISE EXCEPTION 'Quantidade física do componente deve ser um inteiro positivo.';
  END IF;

  RETURN NEW;
END;
$function$;
