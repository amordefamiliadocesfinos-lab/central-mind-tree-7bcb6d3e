-- U3.1: bloqueia somente mudanças de unidade que alterariam o significado
-- histórico de uma identidade física já usada. Não converte dados existentes.

CREATE OR REPLACE FUNCTION public.physical_identity_has_operational_usage(
  p_product_id uuid,
  p_variant_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN
    EXISTS (SELECT 1 FROM public.inventory WHERE product_id = p_product_id AND variant_id IS NOT DISTINCT FROM p_variant_id)
    OR EXISTS (SELECT 1 FROM public.inventory_movements WHERE product_id = p_product_id AND variant_id IS NOT DISTINCT FROM p_variant_id)
    OR EXISTS (SELECT 1 FROM public.purchase_order_items WHERE product_id = p_product_id AND variant_id IS NOT DISTINCT FROM p_variant_id)
    OR EXISTS (SELECT 1 FROM public.production_orders WHERE product_id = p_product_id AND variant_id IS NOT DISTINCT FROM p_variant_id)
    OR EXISTS (SELECT 1 FROM public.order_items WHERE product_id = p_product_id AND variant_id IS NOT DISTINCT FROM p_variant_id)
    OR EXISTS (
      SELECT 1
      FROM public.product_components
      WHERE (component_id = p_product_id AND variant_id IS NOT DISTINCT FROM p_variant_id)
         OR (product_id = p_product_id AND product_variant_id IS NOT DISTINCT FROM p_variant_id)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_used_product_unit_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_variant record;
BEGIN
  IF lower(btrim(COALESCE(OLD.unit, ''))) = lower(btrim(COALESCE(NEW.unit, ''))) THEN
    RETURN NEW;
  END IF;

  IF public.physical_identity_has_operational_usage(OLD.id, NULL) THEN
    RAISE EXCEPTION 'Esta unidade física já está em uso por Estoque, BOM, Produção, Compras ou Pedidos. Alterar a unidade agora mudaria o significado histórico das quantidades.';
  END IF;

  FOR v_variant IN
    SELECT id FROM public.product_variants WHERE product_id = OLD.id AND unit IS NULL
  LOOP
    IF public.physical_identity_has_operational_usage(OLD.id, v_variant.id) THEN
      RAISE EXCEPTION 'Esta unidade física já está em uso por Estoque, BOM, Produção, Compras ou Pedidos. Alterar a unidade agora mudaria o significado histórico das quantidades.';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_used_variant_unit_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_master_unit text;
BEGIN
  SELECT unit INTO v_master_unit FROM public.products WHERE id = OLD.product_id;
  IF lower(btrim(COALESCE(OLD.unit, v_master_unit, ''))) = lower(btrim(COALESCE(NEW.unit, v_master_unit, ''))) THEN
    RETURN NEW;
  END IF;
  IF public.physical_identity_has_operational_usage(OLD.product_id, OLD.id) THEN
    RAISE EXCEPTION 'Esta unidade física já está em uso por Estoque, BOM, Produção, Compras ou Pedidos. Alterar a unidade agora mudaria o significado histórico das quantidades.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_prevent_used_unit_change ON public.products;
CREATE TRIGGER products_prevent_used_unit_change
BEFORE UPDATE OF unit ON public.products
FOR EACH ROW EXECUTE FUNCTION public.prevent_used_product_unit_change();

DROP TRIGGER IF EXISTS product_variants_prevent_used_unit_change ON public.product_variants;
CREATE TRIGGER product_variants_prevent_used_unit_change
BEFORE UPDATE OF unit ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.prevent_used_variant_unit_change();
