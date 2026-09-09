CREATE TABLE IF NOT EXISTS public.marketplace_product_mapping_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mapping_id uuid NOT NULL REFERENCES public.marketplace_product_mappings(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  variant_id uuid REFERENCES public.product_variants(id),
  physical_multiplier numeric(20,10) NOT NULL CHECK (physical_multiplier > 0),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_product_mapping_items TO authenticated;
GRANT ALL ON public.marketplace_product_mapping_items TO service_role;

ALTER TABLE public.marketplace_product_mapping_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'marketplace_product_mapping_items'
      AND policyname = 'Authenticated manage marketplace mapping items'
  ) THEN
    CREATE POLICY "Authenticated manage marketplace mapping items"
      ON public.marketplace_product_mapping_items
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mpmi_mapping_id ON public.marketplace_product_mapping_items(mapping_id, position);

DROP TRIGGER IF EXISTS update_marketplace_product_mapping_items_updated_at ON public.marketplace_product_mapping_items;
CREATE TRIGGER update_marketplace_product_mapping_items_updated_at
  BEFORE UPDATE ON public.marketplace_product_mapping_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.marketplace_product_mapping_items (mapping_id, product_id, variant_id, physical_multiplier, position)
SELECT m.id, m.product_id, m.variant_id, GREATEST(m.physical_multiplier, 0.0000000001), 0
FROM public.marketplace_product_mappings m
WHERE m.product_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.marketplace_product_mapping_items i WHERE i.mapping_id = m.id
  );