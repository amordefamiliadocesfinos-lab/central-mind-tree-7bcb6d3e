-- M5B Health — Recipe RPCs

CREATE OR REPLACE FUNCTION public.health_m5_create_recipe_draft(
  p_athlete_id uuid,
  p_name text,
  p_title text DEFAULT NULL
)
RETURNS TABLE (
  recipe_id uuid,
  recipe_version_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recipe_id uuid;
  v_version_id uuid;
BEGIN
  IF NOT public.health_can_write_athlete(p_athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'recipe name is required';
  END IF;

  INSERT INTO public.health_recipes (
    athlete_id, owner_scope, name, status
  )
  VALUES (
    p_athlete_id, 'athlete', p_name, 'draft'
  )
  RETURNING id INTO v_recipe_id;

  INSERT INTO public.health_recipe_versions (
    recipe_id, athlete_id, version_number, status, title
  )
  VALUES (
    v_recipe_id, p_athlete_id, 1, 'draft', COALESCE(NULLIF(btrim(p_title),''), p_name)
  )
  RETURNING id INTO v_version_id;

  RETURN QUERY SELECT v_recipe_id, v_version_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m5_publish_recipe_version(
  p_recipe_version_id uuid
)
RETURNS TABLE (
  recipe_id uuid,
  published_version_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recipe_id uuid;
  v_athlete_id uuid;
  v_status text;
  v_yield_amount numeric;
  v_yield_unit text;
  v_servings numeric;
  v_energy numeric := 0;
  v_protein numeric := 0;
  v_carbs numeric := 0;
  v_fat numeric := 0;
  v_fiber numeric := 0;
  v_sodium numeric := 0;
  v_any_energy_null boolean := false;
  v_any_protein_null boolean := false;
  v_any_carbs_null boolean := false;
  v_any_fat_null boolean := false;
  v_any_fiber_null boolean := false;
  v_any_sodium_null boolean := false;
  v_confidence text := 'high';
  v_confidence_reasons text[] := '{}'::text[];
  v_ingredient_count integer := 0;
BEGIN
  SELECT
    rv.recipe_id,
    rv.athlete_id,
    rv.status,
    rv.yield_amount,
    rv.yield_unit,
    rv.servings
  INTO
    v_recipe_id,
    v_athlete_id,
    v_status,
    v_yield_amount,
    v_yield_unit,
    v_servings
  FROM public.health_recipe_versions rv
  WHERE rv.id=p_recipe_version_id
  FOR UPDATE;

  IF v_recipe_id IS NULL THEN
    RAISE EXCEPTION 'recipe version not found';
  END IF;

  IF v_athlete_id IS NULL THEN
    RAISE EXCEPTION 'global recipes are not publishable through athlete RPC';
  END IF;

  IF NOT public.health_can_write_athlete(v_athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'only draft recipe versions can be published';
  END IF;

  SELECT count(*)
  INTO v_ingredient_count
  FROM public.health_recipe_ingredients i
  WHERE i.recipe_version_id=p_recipe_version_id;

  IF v_ingredient_count < 1 THEN
    RAISE EXCEPTION 'at least one recipe ingredient is required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.health_recipe_ingredients i
    JOIN public.health_foods f ON f.id=i.food_id
    WHERE i.recipe_version_id=p_recipe_version_id
      AND f.is_active=false
  ) THEN
    RAISE EXCEPTION 'recipe contains inactive food';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.health_recipe_nutrition_snapshots s
    WHERE s.recipe_version_id=p_recipe_version_id
  ) THEN
    RAISE EXCEPTION 'recipe nutrition snapshot already exists';
  END IF;

  INSERT INTO public.health_recipe_ingredient_snapshots (
    recipe_version_id,
    recipe_ingredient_id,
    athlete_id,
    food_id,
    food_name_snapshot,
    quantity,
    unit_code,
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
    data_quality_snapshot
  )
  SELECT
    p_recipe_version_id,
    i.id,
    v_athlete_id,
    f.id,
    f.canonical_name,
    i.quantity,
    i.unit_code,
    f.basis_amount,
    f.basis_unit,
    CASE WHEN i.unit_code=f.basis_unit AND f.energy_kcal IS NOT NULL
      THEN f.energy_kcal * i.quantity / f.basis_amount ELSE NULL END,
    CASE WHEN i.unit_code=f.basis_unit AND f.protein_g IS NOT NULL
      THEN f.protein_g * i.quantity / f.basis_amount ELSE NULL END,
    CASE WHEN i.unit_code=f.basis_unit AND f.carbohydrate_g IS NOT NULL
      THEN f.carbohydrate_g * i.quantity / f.basis_amount ELSE NULL END,
    CASE WHEN i.unit_code=f.basis_unit AND f.fat_g IS NOT NULL
      THEN f.fat_g * i.quantity / f.basis_amount ELSE NULL END,
    CASE WHEN i.unit_code=f.basis_unit AND f.fiber_g IS NOT NULL
      THEN f.fiber_g * i.quantity / f.basis_amount ELSE NULL END,
    CASE WHEN i.unit_code=f.basis_unit AND f.sodium_mg IS NOT NULL
      THEN f.sodium_mg * i.quantity / f.basis_amount ELSE NULL END,
    f.source_id,
    f.source_version,
    f.data_quality
  FROM public.health_recipe_ingredients i
  JOIN public.health_foods f ON f.id=i.food_id
  WHERE i.recipe_version_id=p_recipe_version_id;

  IF EXISTS (
    SELECT 1
    FROM public.health_recipe_ingredient_snapshots s
    WHERE s.recipe_version_id=p_recipe_version_id
      AND s.unit_code IS DISTINCT FROM s.basis_unit_snapshot
  ) THEN
    RAISE EXCEPTION 'recipe ingredient unit is incompatible with food basis unit; normalize before publication';
  END IF;

  SELECT
    COALESCE(sum(energy_kcal_snapshot),0),
    COALESCE(sum(protein_g_snapshot),0),
    COALESCE(sum(carbohydrate_g_snapshot),0),
    COALESCE(sum(fat_g_snapshot),0),
    COALESCE(sum(fiber_g_snapshot),0),
    COALESCE(sum(sodium_mg_snapshot),0),
    bool_or(energy_kcal_snapshot IS NULL),
    bool_or(protein_g_snapshot IS NULL),
    bool_or(carbohydrate_g_snapshot IS NULL),
    bool_or(fat_g_snapshot IS NULL),
    bool_or(fiber_g_snapshot IS NULL),
    bool_or(sodium_mg_snapshot IS NULL)
  INTO
    v_energy,
    v_protein,
    v_carbs,
    v_fat,
    v_fiber,
    v_sodium,
    v_any_energy_null,
    v_any_protein_null,
    v_any_carbs_null,
    v_any_fat_null,
    v_any_fiber_null,
    v_any_sodium_null
  FROM public.health_recipe_ingredient_snapshots
  WHERE recipe_version_id=p_recipe_version_id;

  IF EXISTS (
    SELECT 1
    FROM public.health_recipe_ingredient_snapshots s
    WHERE s.recipe_version_id=p_recipe_version_id
      AND s.data_quality_snapshot IN ('calculated','provisional')
  ) THEN
    v_confidence := 'moderate';
    v_confidence_reasons := array_append(v_confidence_reasons,'RECIPE_SOURCE_NOT_HIGH_CONFIDENCE');
  END IF;

  IF v_any_energy_null OR v_any_protein_null OR v_any_carbs_null
     OR v_any_fat_null OR v_any_fiber_null OR v_any_sodium_null THEN
    v_confidence := 'moderate';
    v_confidence_reasons := array_append(v_confidence_reasons,'RECIPE_PARTIAL_NUTRIENT_COVERAGE');
  END IF;

  INSERT INTO public.health_recipe_nutrition_snapshots (
    recipe_version_id,
    athlete_id,
    basis_amount,
    basis_unit,
    energy_kcal,
    protein_g,
    carbohydrate_g,
    fat_g,
    fiber_g,
    sodium_mg,
    calculation_method,
    confidence,
    confidence_reason_codes,
    algorithm_version,
    parameter_set
  )
  VALUES (
    p_recipe_version_id,
    v_athlete_id,
    CASE
      WHEN v_yield_amount IS NOT NULL THEN v_yield_amount
      WHEN v_servings IS NOT NULL THEN v_servings
      ELSE NULL
    END,
    CASE
      WHEN v_yield_amount IS NOT NULL THEN v_yield_unit
      WHEN v_servings IS NOT NULL THEN 'serving'
      ELSE NULL
    END,
    CASE WHEN v_any_energy_null THEN NULL ELSE v_energy END,
    CASE WHEN v_any_protein_null THEN NULL ELSE v_protein END,
    CASE WHEN v_any_carbs_null THEN NULL ELSE v_carbs END,
    CASE WHEN v_any_fat_null THEN NULL ELSE v_fat END,
    CASE WHEN v_any_fiber_null THEN NULL ELSE v_fiber END,
    CASE WHEN v_any_sodium_null THEN NULL ELSE v_sodium END,
    'ingredient_snapshot_sum',
    v_confidence,
    v_confidence_reasons,
    'M5C_RECIPE_SNAPSHOT_V1',
    jsonb_build_object(
      'ingredient_count',v_ingredient_count,
      'yield_amount',v_yield_amount,
      'yield_unit',v_yield_unit,
      'servings',v_servings
    )
  );

  UPDATE public.health_recipe_versions
  SET status='published',
      published_at=now()
  WHERE id=p_recipe_version_id
    AND status='draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'recipe version could not be published';
  END IF;

  UPDATE public.health_recipes
  SET current_version_id=p_recipe_version_id,
      status='active'
  WHERE id=v_recipe_id
    AND athlete_id=v_athlete_id
    AND owner_scope='athlete';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'recipe could not be activated';
  END IF;

  RETURN QUERY SELECT v_recipe_id, p_recipe_version_id;
END;
$$;
