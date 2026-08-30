-- Fase 4.5D.1: identidade física opcional do componente na BOM.
ALTER TABLE public.product_components
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE RESTRICT;

-- A chave antiga permite apenas um componente mestre. Com variante, permite
-- apresentações físicas distintas do mesmo mestre, sem duplicar a mesma escolha.
ALTER TABLE public.product_components
  DROP CONSTRAINT IF EXISTS product_components_product_component_unique;
ALTER TABLE public.product_components
  DROP CONSTRAINT IF EXISTS product_components_product_id_component_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS product_components_simple_component_unique
  ON public.product_components(product_id, component_id)
  WHERE variant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_components_variant_component_unique
  ON public.product_components(product_id, component_id, variant_id)
  WHERE variant_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_product_component_variant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.variant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.product_variants pv
    WHERE pv.id = NEW.variant_id
      AND pv.product_id = NEW.component_id
  ) THEN
    RAISE EXCEPTION 'A variante informada não pertence ao produto mestre do componente';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_product_component_variant_trigger ON public.product_components;
CREATE TRIGGER validate_product_component_variant_trigger
  BEFORE INSERT OR UPDATE OF component_id, variant_id ON public.product_components
  FOR EACH ROW EXECUTE FUNCTION public.validate_product_component_variant();

CREATE INDEX IF NOT EXISTS idx_product_components_variant
  ON public.product_components(variant_id)
  WHERE variant_id IS NOT NULL;
