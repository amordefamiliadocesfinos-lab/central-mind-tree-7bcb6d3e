-- Fase 4.5G.1: identidade física opcional do produto acabado e da BOM final.
-- Registros históricos permanecem compatíveis com os dois campos nulos.
ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE RESTRICT;

ALTER TABLE public.product_components
  ADD COLUMN IF NOT EXISTS product_variant_id uuid REFERENCES public.product_variants(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_production_orders_variant
  ON public.production_orders(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_components_product_variant
  ON public.product_components(product_variant_id) WHERE product_variant_id IS NOT NULL;

-- A identidade completa da linha é produto final + variante final opcional +
-- componente + variante do componente opcional. Isto permite receitas distintas
-- para variantes finais sem duplicar a mesma linha.
DROP INDEX IF EXISTS public.product_components_simple_component_unique;
DROP INDEX IF EXISTS public.product_components_variant_component_unique;
CREATE UNIQUE INDEX IF NOT EXISTS product_components_identity_unique
  ON public.product_components(
    product_id,
    component_id,
    COALESCE(product_variant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE OR REPLACE FUNCTION public.validate_product_component_variant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.product_variant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.product_variants pv
    WHERE pv.id = NEW.product_variant_id AND pv.product_id = NEW.product_id
  ) THEN
    RAISE EXCEPTION 'A variante final informada não pertence ao produto da BOM';
  END IF;

  IF NEW.variant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.product_variants pv
    WHERE pv.id = NEW.variant_id AND pv.product_id = NEW.component_id
  ) THEN
    RAISE EXCEPTION 'A variante informada não pertence ao produto mestre do componente';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_product_component_variant_trigger ON public.product_components;
CREATE TRIGGER validate_product_component_variant_trigger
  BEFORE INSERT OR UPDATE OF product_id, component_id, product_variant_id, variant_id
  ON public.product_components
  FOR EACH ROW EXECUTE FUNCTION public.validate_product_component_variant();

CREATE OR REPLACE FUNCTION public.validate_production_order_variant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.variant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.product_variants pv
    WHERE pv.id = NEW.variant_id AND pv.product_id = NEW.product_id
  ) THEN
    RAISE EXCEPTION 'A variante final informada não pertence ao produto da ordem de produção';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_production_order_variant_trigger ON public.production_orders;
CREATE TRIGGER validate_production_order_variant_trigger
  BEFORE INSERT OR UPDATE OF product_id, variant_id ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_production_order_variant();
