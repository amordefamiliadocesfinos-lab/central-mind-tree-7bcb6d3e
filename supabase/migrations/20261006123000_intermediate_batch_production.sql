-- F04 Operações — produção física de lotes intermediários
-- Reutiliza production_facts/inventory como fontes canônicas.
-- Receita do lote permanece em product_batch_recipes; o rendimento real é informado por fato.

CREATE OR REPLACE FUNCTION public.register_intermediate_batch_fact(
  p_recipe_id uuid,
  p_output_quantity numeric,
  p_event_key text,
  p_location text DEFAULT 'Fábrica'::text,
  p_occurred_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_recipe public.product_batch_recipes;
  v_output_product public.products;
  v_existing public.production_facts;
  v_fact_id uuid;
  v_location text := COALESCE(NULLIF(btrim(p_location), ''), 'Fábrica');
  v_location_id uuid;
  v_component record;
  v_inventory record;
  v_remaining numeric;
  v_take numeric;
  v_applied numeric;
  v_previous numeric;
  v_new numeric;
  v_shortages jsonb := '[]'::jsonb;
  v_consumption_count integer := 0;
  v_movement_count integer := 0;
  v_finished_key text;
BEGIN
  IF p_event_key IS NULL OR btrim(p_event_key) = '' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'missing_event_key');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_event_key, 0));

  SELECT * INTO v_existing
  FROM public.production_facts
  WHERE event_key = p_event_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'production_fact_id', v_existing.id,
      'product_id', v_existing.product_id,
      'variant_id', v_existing.variant_id,
      'quantity', v_existing.quantity,
      'location', v_existing.location,
      'material_adjustment_required', EXISTS (
        SELECT 1
        FROM public.production_fact_consumptions pfc
        WHERE pfc.production_fact_id = v_existing.id
          AND pfc.adjustment_status = 'pending'
      )
    );
  END IF;

  IF p_output_quantity IS NULL OR p_output_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_output_quantity');
  END IF;

  SELECT * INTO v_recipe
  FROM public.product_batch_recipes
  WHERE id = p_recipe_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'recipe_not_found');
  END IF;

  SELECT * INTO v_output_product
  FROM public.products
  WHERE id = v_recipe.output_product_id;

  IF NOT FOUND
     OR NOT COALESCE(v_output_product.is_active, false)
     OR NOT COALESCE(v_output_product.is_manufactured, false)
     OR NOT COALESCE(v_output_product.is_intermediate, false) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_intermediate_product');
  END IF;

  PERFORM public.assert_physical_identity(
    v_recipe.output_product_id,
    v_recipe.output_variant_id,
    'intermediate_batch_fact'
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.product_batch_recipe_items ri
    WHERE ri.recipe_id = v_recipe.id
      AND COALESCE(ri.qty, 0) > 0
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'recipe_without_items');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.product_batch_recipe_items ri
    WHERE ri.recipe_id = v_recipe.id
      AND COALESCE(ri.qty, 0) > 0
      AND (
        ri.component_product_id IS NULL
        OR ri.mapping_status <> 'mapeado'
        OR COALESCE(ri.relation, 'quantidade') <> 'quantidade'
      )
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'recipe_mapping_incomplete');
  END IF;

  SELECT id INTO v_location_id
  FROM public.storage_locations
  WHERE name = v_location
    AND is_active = true
  LIMIT 1;

  IF v_location_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_location', 'location', v_location);
  END IF;

  INSERT INTO public.production_facts(
    product_id,
    variant_id,
    quantity,
    location,
    location_id,
    occurred_at,
    source,
    status,
    event_key,
    created_by
  ) VALUES (
    v_recipe.output_product_id,
    v_recipe.output_variant_id,
    p_output_quantity,
    v_location,
    v_location_id,
    COALESCE(p_occurred_at, now()),
    'intermediate_batch',
    'confirmed',
    p_event_key,
    auth.uid()
  )
  ON CONFLICT (event_key) DO NOTHING
  RETURNING id INTO v_fact_id;

  IF v_fact_id IS NULL THEN
    SELECT * INTO v_existing
    FROM public.production_facts
    WHERE event_key = p_event_key;

    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'production_fact_id', v_existing.id,
      'product_id', v_existing.product_id,
      'variant_id', v_existing.variant_id,
      'quantity', v_existing.quantity,
      'location', v_existing.location
    );
  END IF;

  INSERT INTO public.production_fact_consumptions(
    production_fact_id,
    component_id,
    variant_id,
    qty_per_unit_snapshot,
    quantity_consumed,
    quantity_applied,
    adjustment_status,
    unit_snapshot
  )
  SELECT
    v_fact_id,
    ri.component_product_id,
    ri.component_variant_id,
    CASE
      WHEN p_output_quantity > 0 THEN ri.qty / p_output_quantity
      ELSE 0
    END,
    ri.qty,
    0,
    CASE WHEN ri.qty <= 0 THEN 'applied' ELSE 'pending' END,
    COALESCE(pv.unit, p.unit, ri.unit)
  FROM public.product_batch_recipe_items ri
  JOIN public.products p
    ON p.id = ri.component_product_id
  LEFT JOIN public.product_variants pv
    ON pv.id = ri.component_variant_id
  WHERE ri.recipe_id = v_recipe.id
    AND COALESCE(ri.qty, 0) > 0;

  GET DIAGNOSTICS v_consumption_count = ROW_COUNT;

  FOR v_component IN
    SELECT
      pfc.id,
      pfc.component_id,
      pfc.variant_id,
      pfc.quantity_consumed,
      pfc.unit_snapshot,
      p.name AS component_name,
      pv.variant_name AS component_variant_name
    FROM public.production_fact_consumptions pfc
    JOIN public.products p
      ON p.id = pfc.component_id
    LEFT JOIN public.product_variants pv
      ON pv.id = pfc.variant_id
    WHERE pfc.production_fact_id = v_fact_id
    ORDER BY pfc.component_id, pfc.variant_id
  LOOP
    v_remaining := v_component.quantity_consumed;
    v_applied := 0;

    FOR v_inventory IN
      SELECT id, location, quantity
      FROM public.inventory
      WHERE product_id = v_component.component_id
        AND variant_id IS NOT DISTINCT FROM v_component.variant_id
        AND quantity > 0
      ORDER BY id
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_remaining, v_inventory.quantity);

      UPDATE public.inventory
      SET quantity = quantity - v_take,
          updated_at = now()
      WHERE id = v_inventory.id;

      INSERT INTO public.inventory_movements(
        product_id,
        variant_id,
        movement_type,
        quantity,
        previous_balance,
        new_balance,
        location,
        reference_type,
        reference_id,
        event_key,
        notes
      ) VALUES (
        v_component.component_id,
        v_component.variant_id,
        'consume',
        v_take,
        v_inventory.quantity,
        v_inventory.quantity - v_take,
        v_inventory.location,
        'intermediate_batch_fact',
        v_fact_id,
        'intermediate_batch:' || v_fact_id::text || ':consume:' || v_inventory.id::text,
        'Consumo do lote intermediário ' || v_recipe.code
      );

      v_remaining := v_remaining - v_take;
      v_applied := v_applied + v_take;
      v_movement_count := v_movement_count + 1;
    END LOOP;

    UPDATE public.production_fact_consumptions
    SET quantity_applied = v_applied,
        adjustment_status = CASE WHEN v_remaining <= 0 THEN 'applied' ELSE 'pending' END
    WHERE id = v_component.id;

    IF v_remaining > 0 THEN
      v_shortages := v_shortages || jsonb_build_array(jsonb_build_object(
        'product_id', v_component.component_id,
        'variant_id', v_component.variant_id,
        'component_name', v_component.component_name,
        'component_variant_name', v_component.component_variant_name,
        'unit', v_component.unit_snapshot,
        'required_quantity', v_component.quantity_consumed,
        'applied_quantity', v_applied,
        'missing_quantity', v_remaining
      ));
    END IF;
  END LOOP;

  INSERT INTO public.inventory(
    product_id,
    variant_id,
    location,
    location_id,
    quantity,
    updated_at
  ) VALUES (
    v_recipe.output_product_id,
    v_recipe.output_variant_id,
    v_location,
    v_location_id,
    p_output_quantity,
    now()
  )
  ON CONFLICT(product_id, variant_id, location)
  DO UPDATE SET
    quantity = public.inventory.quantity + EXCLUDED.quantity,
    location_id = COALESCE(public.inventory.location_id, EXCLUDED.location_id),
    updated_at = now()
  RETURNING quantity - p_output_quantity, quantity
  INTO v_previous, v_new;

  v_finished_key :=
    'intermediate_batch:' || v_fact_id::text || ':finished:' ||
    v_recipe.output_product_id::text || ':' ||
    COALESCE(v_recipe.output_variant_id::text, 'simple') || ':' ||
    v_location_id::text;

  INSERT INTO public.inventory_movements(
    product_id,
    variant_id,
    movement_type,
    quantity,
    previous_balance,
    new_balance,
    location,
    reference_type,
    reference_id,
    event_key,
    notes
  ) VALUES (
    v_recipe.output_product_id,
    v_recipe.output_variant_id,
    'in',
    p_output_quantity,
    v_previous,
    v_new,
    v_location,
    'intermediate_batch_fact',
    v_fact_id,
    v_finished_key,
    CASE
      WHEN jsonb_array_length(v_shortages) > 0
        THEN 'Entrada de lote intermediário com consumo de insumos pendente'
      ELSE 'Entrada de lote intermediário'
    END
  );

  v_movement_count := v_movement_count + 1;

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'production_fact_id', v_fact_id,
    'recipe_id', v_recipe.id,
    'recipe_code', v_recipe.code,
    'product_id', v_recipe.output_product_id,
    'variant_id', v_recipe.output_variant_id,
    'quantity', p_output_quantity,
    'unit', v_recipe.batch_output_unit,
    'location', v_location,
    'material_adjustment_required', jsonb_array_length(v_shortages) > 0,
    'shortages', v_shortages,
    'consumption_count', v_consumption_count,
    'inventory_movement_count', v_movement_count
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.register_intermediate_batch_fact(uuid, numeric, text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_intermediate_batch_fact(uuid, numeric, text, text, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.register_intermediate_batch_fact(uuid, numeric, text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_intermediate_batch_fact(uuid, numeric, text, text, timestamptz) TO service_role;
