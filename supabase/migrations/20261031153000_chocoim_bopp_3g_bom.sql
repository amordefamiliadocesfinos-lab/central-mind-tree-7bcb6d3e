-- CHOCOIM 34g: BOPP film nominal consumption, BOM-CHO-01.
-- Existing product/variants preserved; no inventory or production events.
DO $$
DECLARE v uuid; recipe uuid;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    '3e67edc6-1cb7-463e-8c8e-a50bfb5092f7'::uuid,
    '66708945-22f3-43bf-b68e-127021448cd8'::uuid,
    '1a84c7f3-4130-45fc-920f-62aecafe4c91'::uuid
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.product_components
      WHERE product_id='e01a87f3-615d-4330-87c6-d0f9878a7c3b'::uuid
        AND product_variant_id=v
        AND component_id='c5cd604c-f7aa-45b8-8886-504e2012270e'::uuid
    ) THEN
      INSERT INTO public.product_components(product_id,product_variant_id,component_id,variant_id,qty_per_unit,notes)
      VALUES ('e01a87f3-615d-4330-87c6-d0f9878a7c3b',v,
        'c5cd604c-f7aa-45b8-8886-504e2012270e',NULL,3,
        'BOM-CHO-01: bobina BOPP, 1 Flow Pack/un, aproximadamente 3 g de filme/un; perdas pendentes.');
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM public.product_components
        WHERE product_id='e01a87f3-615d-4330-87c6-d0f9878a7c3b'::uuid
          AND product_variant_id=v
          AND component_id='c5cd604c-f7aa-45b8-8886-504e2012270e'::uuid
          AND variant_id IS NULL AND qty_per_unit=3
      ) THEN
        RAISE EXCEPTION 'Conflicting Chocoim BOPP component for variant %',v;
      END IF;
    END IF;

    SELECT id INTO recipe FROM public.product_batch_recipes
    WHERE output_product_id='e01a87f3-615d-4330-87c6-d0f9878a7c3b'::uuid
      AND output_variant_id=v;
    IF recipe IS NULL THEN RAISE EXCEPTION 'Chocoim recipe missing %',v; END IF;

    UPDATE public.product_batch_recipe_items
       SET component_product_id='c5cd604c-f7aa-45b8-8886-504e2012270e'::uuid,
           component_label='Bobina BOPP — Flow Pack individual',
           qty=3,unit='g',mapping_status='mapeado',
           notes='BOM-CHO-01: 1 Flow Pack/un; consumo nominal ~3 g de BOPP/un, perdas não mensuradas.'
     WHERE recipe_id=recipe
       AND (component_label='Flow Pack individual Chocoim'
            OR (component_product_id='c5cd604c-f7aa-45b8-8886-504e2012270e'::uuid
                AND component_label='Bobina BOPP — Flow Pack individual'));
    IF NOT FOUND THEN RAISE EXCEPTION 'Flow Pack recipe item missing %',v; END IF;
  END LOOP;
END $$;
