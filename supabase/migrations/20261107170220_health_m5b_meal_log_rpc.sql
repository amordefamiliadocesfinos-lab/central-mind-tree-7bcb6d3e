-- M5B Health — Meal Item Logging RPC

CREATE OR REPLACE FUNCTION public.health_m5_log_meal_item(
  p_meal_log_id uuid,
  p_client_event_id uuid,
  p_item_name text,
  p_quantity numeric DEFAULT NULL,
  p_unit_code text DEFAULT NULL,
  p_food_id uuid DEFAULT NULL,
  p_recipe_version_id uuid DEFAULT NULL,
  p_estimation_method text DEFAULT 'approximate_description',
  p_data_source text DEFAULT 'USER_REPORTED',
  p_confidence text DEFAULT 'low',
  p_household_measure_text text DEFAULT NULL,
  p_preparation_state text DEFAULT 'unknown'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_athlete_id uuid;
  v_existing_item_id uuid;
  v_item_id uuid;
  v_basis_amount numeric;
  v_basis_unit text;
  v_energy numeric;
  v_protein numeric;
  v_carbs numeric;
  v_fat numeric;
  v_fiber numeric;
  v_sodium numeric;
  v_source_id uuid;
  v_source_version text;
  v_data_quality text;
BEGIN
  SELECT m.athlete_id
  INTO v_athlete_id
  FROM public.health_meal_logs m
  WHERE m.id=p_meal_log_id;

  IF v_athlete_id IS NULL THEN
    RAISE EXCEPTION 'meal log not found';
  END IF;

  IF NOT public.health_can_write_athlete(v_athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF p_client_event_id IS NOT NULL THEN
    SELECT e.meal_item_id
    INTO v_existing_item_id
    FROM public.health_meal_item_events e
    WHERE e.athlete_id=v_athlete_id
      AND e.client_event_id=p_client_event_id
      AND e.event_type='created'
    LIMIT 1;

    IF v_existing_item_id IS NOT NULL THEN
      RETURN v_existing_item_id;
    END IF;
  END IF;

  IF p_item_name IS NULL OR btrim(p_item_name)='' THEN
    RAISE EXCEPTION 'item name is required';
  END IF;

  IF p_food_id IS NOT NULL AND p_recipe_version_id IS NOT NULL THEN
    RAISE EXCEPTION 'food_id and recipe_version_id are mutually exclusive';
  END IF;

  IF p_food_id IS NOT NULL THEN
    SELECT
      f.basis_amount, f.basis_unit,
      f.energy_kcal, f.protein_g, f.carbohydrate_g,
      f.fat_g, f.fiber_g, f.sodium_mg,
      f.source_id, f.source_version, f.data_quality
    INTO
      v_basis_amount, v_basis_unit,
      v_energy, v_protein, v_carbs,
      v_fat, v_fiber, v_sodium,
      v_source_id, v_source_version, v_data_quality
    FROM public.health_foods f
    WHERE f.id=p_food_id
      AND f.is_active=true;

    IF v_basis_amount IS NULL THEN
      RAISE EXCEPTION 'active food not found';
    END IF;

    IF p_quantity IS NOT NULL AND p_unit_code = v_basis_unit THEN
      v_energy := CASE WHEN v_energy IS NULL THEN NULL ELSE v_energy * p_quantity / v_basis_amount END;
      v_protein := CASE WHEN v_protein IS NULL THEN NULL ELSE v_protein * p_quantity / v_basis_amount END;
      v_carbs := CASE WHEN v_carbs IS NULL THEN NULL ELSE v_carbs * p_quantity / v_basis_amount END;
      v_fat := CASE WHEN v_fat IS NULL THEN NULL ELSE v_fat * p_quantity / v_basis_amount END;
      v_fiber := CASE WHEN v_fiber IS NULL THEN NULL ELSE v_fiber * p_quantity / v_basis_amount END;
      v_sodium := CASE WHEN v_sodium IS NULL THEN NULL ELSE v_sodium * p_quantity / v_basis_amount END;
    ELSE
      v_energy := NULL;
      v_protein := NULL;
      v_carbs := NULL;
      v_fat := NULL;
      v_fiber := NULL;
      v_sodium := NULL;
    END IF;
  END IF;

  IF p_recipe_version_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.health_recipe_versions rv
      JOIN public.health_recipes r ON r.id=rv.recipe_id
      WHERE rv.id=p_recipe_version_id
        AND rv.status='published'
        AND (
          r.owner_scope='global'
          OR (r.owner_scope='athlete' AND r.athlete_id=v_athlete_id)
        )
    ) THEN
      RAISE EXCEPTION 'published recipe version is not available for athlete';
    END IF;

    SELECT
      s.basis_amount,
      s.basis_unit,
      s.energy_kcal,
      s.protein_g,
      s.carbohydrate_g,
      s.fat_g,
      s.fiber_g,
      s.sodium_mg,
      s.algorithm_version,
      s.confidence
    INTO
      v_basis_amount,
      v_basis_unit,
      v_energy,
      v_protein,
      v_carbs,
      v_fat,
      v_fiber,
      v_sodium,
      v_source_version,
      v_data_quality
    FROM public.health_recipe_nutrition_snapshots s
    WHERE s.recipe_version_id=p_recipe_version_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'published recipe version has no frozen nutrition snapshot';
    END IF;

    IF p_quantity IS NOT NULL
       AND p_unit_code IS NOT NULL
       AND v_basis_amount IS NOT NULL
       AND p_unit_code = v_basis_unit THEN
      v_energy := CASE WHEN v_energy IS NULL THEN NULL ELSE v_energy * p_quantity / v_basis_amount END;
      v_protein := CASE WHEN v_protein IS NULL THEN NULL ELSE v_protein * p_quantity / v_basis_amount END;
      v_carbs := CASE WHEN v_carbs IS NULL THEN NULL ELSE v_carbs * p_quantity / v_basis_amount END;
      v_fat := CASE WHEN v_fat IS NULL THEN NULL ELSE v_fat * p_quantity / v_basis_amount END;
      v_fiber := CASE WHEN v_fiber IS NULL THEN NULL ELSE v_fiber * p_quantity / v_basis_amount END;
      v_sodium := CASE WHEN v_sodium IS NULL THEN NULL ELSE v_sodium * p_quantity / v_basis_amount END;
    ELSE
      v_energy := NULL;
      v_protein := NULL;
      v_carbs := NULL;
      v_fat := NULL;
      v_fiber := NULL;
      v_sodium := NULL;
    END IF;

    v_source_id := NULL;
  END IF;

  INSERT INTO public.health_meal_items (
    meal_log_id,
    athlete_id,
    food_id,
    recipe_version_id,
    item_name_snapshot,
    quantity,
    unit_code,
    household_measure_text,
    preparation_state,
    estimation_method,
    data_source,
    confidence,
    basis_amount_snapshot,
    basis_unit_snapshot,
    energy_kcal_snapshot,
    protein_g_snapshot,
    carbohydrate_g_snapshot,
    fat_g_snapshot,
    fiber_g_snapshot,
    sodium_mg_snapshot,
    food_source_id_snapshot,
    source_version_snapshot,
    data_quality_snapshot,
    status
  )
  VALUES (
    p_meal_log_id,
    v_athlete_id,
    p_food_id,
    p_recipe_version_id,
    p_item_name,
    p_quantity,
    p_unit_code,
    p_household_measure_text,
    p_preparation_state,
    p_estimation_method,
    p_data_source,
    p_confidence,
    v_basis_amount,
    v_basis_unit,
    v_energy,
    v_protein,
    v_carbs,
    v_fat,
    v_fiber,
    v_sodium,
    v_source_id,
    v_source_version,
    v_data_quality,
    'active'
  )
  RETURNING id INTO v_item_id;

  INSERT INTO public.health_meal_item_events (
    athlete_id,
    meal_item_id,
    event_type,
    payload,
    client_event_id
  )
  VALUES (
    v_athlete_id,
    v_item_id,
    'created',
    jsonb_build_object('meal_log_id',p_meal_log_id),
    p_client_event_id
  );

  RETURN v_item_id;
END;
$$;
