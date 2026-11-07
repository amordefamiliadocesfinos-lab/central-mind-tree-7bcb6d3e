-- M6 Health — Nutrition State RPCs

CREATE OR REPLACE FUNCTION public.health_m6_target_status(
  p_value numeric,
  p_min numeric,
  p_max numeric
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_min IS NULL AND p_max IS NULL THEN 'not_targeted'
    WHEN p_value IS NULL THEN 'unknown'
    WHEN p_min IS NOT NULL AND p_value < p_min THEN 'below'
    WHEN p_max IS NOT NULL AND p_value > p_max THEN 'above'
    ELSE 'in_range'
  END;
$$;

CREATE OR REPLACE FUNCTION public.health_m6_refresh_daily_state(
  p_athlete_id uuid,
  p_state_date date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_day public.health_food_log_days%ROWTYPE;
  v_plan_version_id uuid;
  v_target public.health_nutrition_targets%ROWTYPE;

  v_meal_count integer := 0;
  v_item_count integer := 0;

  v_energy numeric;
  v_protein numeric;
  v_carbs numeric;
  v_fat numeric;
  v_fiber numeric;
  v_sodium numeric;

  v_energy_unknown integer := 0;
  v_protein_unknown integer := 0;
  v_carbs_unknown integer := 0;
  v_fat_unknown integer := 0;
  v_fiber_unknown integer := 0;
  v_sodium_unknown integer := 0;

  v_state_status text := 'unobserved';
  v_confidence text := 'low';
  v_confidence_score numeric := NULL;
  v_reasons text[] := '{}'::text[];
  v_state_id uuid;
BEGIN
  IF p_state_date IS NULL THEN
    RAISE EXCEPTION 'state date is required';
  END IF;

  IF NOT public.health_can_read_athlete(p_athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  SELECT *
  INTO v_day
  FROM public.health_food_log_days d
  WHERE d.athlete_id=p_athlete_id
    AND d.log_date=p_state_date;

  SELECT pv.id
  INTO v_plan_version_id
  FROM public.health_nutrition_plans p
  JOIN public.health_nutrition_plan_versions pv
    ON pv.id=p.current_version_id
   AND pv.athlete_id=p.athlete_id
  WHERE p.athlete_id=p_athlete_id
    AND p.status='active'
    AND pv.status='published'
    AND (pv.effective_from IS NULL OR pv.effective_from <= p_state_date)
    AND (pv.effective_to IS NULL OR pv.effective_to >= p_state_date)
  ORDER BY pv.published_at DESC
  LIMIT 1;

  IF v_plan_version_id IS NOT NULL THEN
    SELECT *
    INTO v_target
    FROM public.health_nutrition_targets t
    WHERE t.athlete_id=p_athlete_id
      AND t.plan_version_id=v_plan_version_id
    LIMIT 1;
  END IF;

  IF v_day.id IS NULL THEN
    v_reasons := array_append(v_reasons,'NO_FOOD_LOG_DAY');
    IF v_plan_version_id IS NULL THEN
      v_reasons := array_append(v_reasons,'NO_ACTIVE_NUTRITION_PLAN');
    ELSIF v_target.id IS NULL THEN
      v_reasons := array_append(v_reasons,'NO_NUTRITION_TARGET');
    END IF;
  ELSE
    SELECT count(*)
    INTO v_meal_count
    FROM public.health_meal_logs m
    WHERE m.food_log_day_id=v_day.id
      AND m.athlete_id=p_athlete_id;

    SELECT
      count(*),
      count(*) FILTER (WHERE i.energy_kcal_snapshot IS NULL),
      count(*) FILTER (WHERE i.protein_g_snapshot IS NULL),
      count(*) FILTER (WHERE i.carbohydrate_g_snapshot IS NULL),
      count(*) FILTER (WHERE i.fat_g_snapshot IS NULL),
      count(*) FILTER (WHERE i.fiber_g_snapshot IS NULL),
      count(*) FILTER (WHERE i.sodium_mg_snapshot IS NULL),
      sum(i.energy_kcal_snapshot),
      sum(i.protein_g_snapshot),
      sum(i.carbohydrate_g_snapshot),
      sum(i.fat_g_snapshot),
      sum(i.fiber_g_snapshot),
      sum(i.sodium_mg_snapshot)
    INTO
      v_item_count,
      v_energy_unknown,
      v_protein_unknown,
      v_carbs_unknown,
      v_fat_unknown,
      v_fiber_unknown,
      v_sodium_unknown,
      v_energy,
      v_protein,
      v_carbs,
      v_fat,
      v_fiber,
      v_sodium
    FROM public.health_meal_items i
    JOIN public.health_meal_logs m
      ON m.id=i.meal_log_id
     AND m.athlete_id=i.athlete_id
    WHERE m.food_log_day_id=v_day.id
      AND i.athlete_id=p_athlete_id
      AND i.status='active';

    IF v_item_count=0 THEN
      IF v_day.completeness_status='complete' THEN
        v_energy := 0;
        v_protein := 0;
        v_carbs := 0;
        v_fat := 0;
        v_fiber := 0;
        v_sodium := 0;
        v_reasons := array_append(v_reasons,'COMPLETE_DAY_WITH_NO_ACTIVE_ITEMS');
      ELSE
        v_energy := NULL;
        v_protein := NULL;
        v_carbs := NULL;
        v_fat := NULL;
        v_fiber := NULL;
        v_sodium := NULL;
        v_reasons := array_append(v_reasons,'NO_ACTIVE_MEAL_ITEMS');
      END IF;
    ELSE
      IF v_energy_unknown > 0 THEN v_energy := NULL; v_reasons := array_append(v_reasons,'ENERGY_COVERAGE_INCOMPLETE'); END IF;
      IF v_protein_unknown > 0 THEN v_protein := NULL; v_reasons := array_append(v_reasons,'PROTEIN_COVERAGE_INCOMPLETE'); END IF;
      IF v_carbs_unknown > 0 THEN v_carbs := NULL; v_reasons := array_append(v_reasons,'CARBOHYDRATE_COVERAGE_INCOMPLETE'); END IF;
      IF v_fat_unknown > 0 THEN v_fat := NULL; v_reasons := array_append(v_reasons,'FAT_COVERAGE_INCOMPLETE'); END IF;
      IF v_fiber_unknown > 0 THEN v_fiber := NULL; v_reasons := array_append(v_reasons,'FIBER_COVERAGE_INCOMPLETE'); END IF;
      IF v_sodium_unknown > 0 THEN v_sodium := NULL; v_reasons := array_append(v_reasons,'SODIUM_COVERAGE_INCOMPLETE'); END IF;
    END IF;

    IF v_day.completeness_status <> 'complete' THEN
      v_reasons := array_append(v_reasons,'DAY_NOT_COMPLETE');
    END IF;

    IF v_plan_version_id IS NULL THEN
      v_reasons := array_append(v_reasons,'NO_ACTIVE_NUTRITION_PLAN');
    ELSIF v_target.id IS NULL THEN
      v_reasons := array_append(v_reasons,'NO_NUTRITION_TARGET');
    END IF;

    IF v_day.completeness_status='complete'
       AND v_energy IS NOT NULL
       AND v_protein IS NOT NULL THEN
      v_state_status := 'sufficient';
    ELSE
      v_state_status := 'partial';
    END IF;

    IF v_state_status='sufficient' AND v_day.confidence='high' THEN
      v_confidence := 'high';
      v_confidence_score := COALESCE(v_day.confidence_score,1.0);
    ELSIF v_energy IS NOT NULL AND v_protein IS NOT NULL THEN
      v_confidence := 'moderate';
      v_confidence_score := COALESCE(v_day.confidence_score,0.65);
    ELSE
      v_confidence := 'low';
      v_confidence_score := COALESCE(v_day.confidence_score,0.35);
    END IF;
  END IF;

  INSERT INTO public.health_nutrition_daily_states (
    athlete_id,state_date,food_log_day_id,plan_version_id,target_id,
    observed_meal_count,observed_item_count,
    energy_kcal_consumed,protein_g_consumed,carbohydrate_g_consumed,
    fat_g_consumed,fiber_g_consumed,sodium_mg_consumed,
    energy_unknown_item_count,protein_unknown_item_count,carbohydrate_unknown_item_count,
    fat_unknown_item_count,fiber_unknown_item_count,sodium_unknown_item_count,
    energy_kcal_min_target,energy_kcal_max_target,
    protein_g_min_target,protein_g_max_target,
    carbohydrate_g_min_target,carbohydrate_g_max_target,
    fat_g_min_target,fat_g_max_target,
    fiber_g_min_target,fiber_g_max_target,
    energy_target_status,protein_target_status,carbohydrate_target_status,
    fat_target_status,fiber_target_status,
    completeness_status,registration_level,state_status,confidence,confidence_score,
    reason_codes,algorithm_version,parameter_set,calculated_at
  )
  VALUES (
    p_athlete_id,p_state_date,v_day.id,v_plan_version_id,v_target.id,
    v_meal_count,v_item_count,
    v_energy,v_protein,v_carbs,v_fat,v_fiber,v_sodium,
    v_energy_unknown,v_protein_unknown,v_carbs_unknown,
    v_fat_unknown,v_fiber_unknown,v_sodium_unknown,
    v_target.energy_kcal_min,v_target.energy_kcal_max,
    v_target.protein_g_min,v_target.protein_g_max,
    v_target.carbohydrate_g_min,v_target.carbohydrate_g_max,
    v_target.fat_g_min,v_target.fat_g_max,
    v_target.fiber_g_min,v_target.fiber_g_max,
    public.health_m6_target_status(v_energy,v_target.energy_kcal_min,v_target.energy_kcal_max),
    public.health_m6_target_status(v_protein,v_target.protein_g_min,v_target.protein_g_max),
    public.health_m6_target_status(v_carbs,v_target.carbohydrate_g_min,v_target.carbohydrate_g_max),
    public.health_m6_target_status(v_fat,v_target.fat_g_min,v_target.fat_g_max),
    public.health_m6_target_status(v_fiber,v_target.fiber_g_min,v_target.fiber_g_max),
    COALESCE(v_day.completeness_status,'unknown'),
    v_day.registration_level,
    v_state_status,v_confidence,v_confidence_score,
    v_reasons,'M6_DAILY_STATE_V1',
    jsonb_build_object('unknown_is_zero',false,'active_items_only',true),
    now()
  )
  ON CONFLICT (athlete_id,state_date)
  DO UPDATE SET
    food_log_day_id=EXCLUDED.food_log_day_id,
    plan_version_id=EXCLUDED.plan_version_id,
    target_id=EXCLUDED.target_id,
    observed_meal_count=EXCLUDED.observed_meal_count,
    observed_item_count=EXCLUDED.observed_item_count,
    energy_kcal_consumed=EXCLUDED.energy_kcal_consumed,
    protein_g_consumed=EXCLUDED.protein_g_consumed,
    carbohydrate_g_consumed=EXCLUDED.carbohydrate_g_consumed,
    fat_g_consumed=EXCLUDED.fat_g_consumed,
    fiber_g_consumed=EXCLUDED.fiber_g_consumed,
    sodium_mg_consumed=EXCLUDED.sodium_mg_consumed,
    energy_unknown_item_count=EXCLUDED.energy_unknown_item_count,
    protein_unknown_item_count=EXCLUDED.protein_unknown_item_count,
    carbohydrate_unknown_item_count=EXCLUDED.carbohydrate_unknown_item_count,
    fat_unknown_item_count=EXCLUDED.fat_unknown_item_count,
    fiber_unknown_item_count=EXCLUDED.fiber_unknown_item_count,
    sodium_unknown_item_count=EXCLUDED.sodium_unknown_item_count,
    energy_kcal_min_target=EXCLUDED.energy_kcal_min_target,
    energy_kcal_max_target=EXCLUDED.energy_kcal_max_target,
    protein_g_min_target=EXCLUDED.protein_g_min_target,
    protein_g_max_target=EXCLUDED.protein_g_max_target,
    carbohydrate_g_min_target=EXCLUDED.carbohydrate_g_min_target,
    carbohydrate_g_max_target=EXCLUDED.carbohydrate_g_max_target,
    fat_g_min_target=EXCLUDED.fat_g_min_target,
    fat_g_max_target=EXCLUDED.fat_g_max_target,
    fiber_g_min_target=EXCLUDED.fiber_g_min_target,
    fiber_g_max_target=EXCLUDED.fiber_g_max_target,
    energy_target_status=EXCLUDED.energy_target_status,
    protein_target_status=EXCLUDED.protein_target_status,
    carbohydrate_target_status=EXCLUDED.carbohydrate_target_status,
    fat_target_status=EXCLUDED.fat_target_status,
    fiber_target_status=EXCLUDED.fiber_target_status,
    completeness_status=EXCLUDED.completeness_status,
    registration_level=EXCLUDED.registration_level,
    state_status=EXCLUDED.state_status,
    confidence=EXCLUDED.confidence,
    confidence_score=EXCLUDED.confidence_score,
    reason_codes=EXCLUDED.reason_codes,
    algorithm_version=EXCLUDED.algorithm_version,
    parameter_set=EXCLUDED.parameter_set,
    calculated_at=EXCLUDED.calculated_at
  RETURNING id INTO v_state_id;

  RETURN v_state_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m6_refresh_rolling_state(
  p_athlete_id uuid,
  p_window_end_date date,
  p_window_days integer DEFAULT 7
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_start date;
  v_state_id uuid;
  v_observed integer;
  v_sufficient integer;
  v_partial integer;
  v_unobserved integer;
  v_coverage numeric;
  v_sufficient_coverage numeric;
  v_energy_comp integer;
  v_energy_in integer;
  v_protein_comp integer;
  v_protein_in integer;
  v_coverage_status text;
  v_confidence text;
  v_reasons text[] := '{}'::text[];
  v_date date;
BEGIN
  IF p_window_days NOT IN (7,14,28) THEN
    RAISE EXCEPTION 'window_days must be 7, 14, or 28';
  END IF;

  IF NOT public.health_can_read_athlete(p_athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  v_start := p_window_end_date - (p_window_days - 1);

  FOR v_date IN
    SELECT generate_series(v_start,p_window_end_date,interval '1 day')::date
  LOOP
    PERFORM public.health_m6_refresh_daily_state(p_athlete_id,v_date);
  END LOOP;

  SELECT
    count(*) FILTER (WHERE state_status <> 'unobserved'),
    count(*) FILTER (WHERE state_status = 'sufficient'),
    count(*) FILTER (WHERE state_status = 'partial'),
    count(*) FILTER (WHERE state_status = 'unobserved'),
    count(*) FILTER (WHERE energy_target_status IN ('below','in_range','above')),
    count(*) FILTER (WHERE energy_target_status='in_range'),
    count(*) FILTER (WHERE protein_target_status IN ('below','in_range','above')),
    count(*) FILTER (WHERE protein_target_status='in_range')
  INTO
    v_observed,v_sufficient,v_partial,v_unobserved,
    v_energy_comp,v_energy_in,v_protein_comp,v_protein_in
  FROM public.health_nutrition_daily_states s
  WHERE s.athlete_id=p_athlete_id
    AND s.state_date BETWEEN v_start AND p_window_end_date;

  v_coverage := v_observed::numeric / p_window_days;
  v_sufficient_coverage := v_sufficient::numeric / p_window_days;

  IF v_observed=0 THEN
    v_coverage_status := 'unobserved';
    v_confidence := 'low';
    v_reasons := array_append(v_reasons,'NO_OBSERVED_DAYS');
  ELSIF v_coverage < 0.50 THEN
    v_coverage_status := 'sparse';
    v_confidence := 'low';
    v_reasons := array_append(v_reasons,'SPARSE_OBSERVATION_COVERAGE');
  ELSIF v_coverage < 1.0 OR v_sufficient < v_observed THEN
    v_coverage_status := 'partial';
    v_confidence := CASE WHEN v_sufficient_coverage >= 0.70 THEN 'moderate' ELSE 'low' END;
    v_reasons := array_append(v_reasons,'PARTIAL_WINDOW_COVERAGE');
  ELSE
    v_coverage_status := 'complete';
    v_confidence := 'high';
  END IF;

  IF v_energy_comp=0 THEN v_reasons := array_append(v_reasons,'NO_ENERGY_COMPARABLE_DAYS'); END IF;
  IF v_protein_comp=0 THEN v_reasons := array_append(v_reasons,'NO_PROTEIN_COMPARABLE_DAYS'); END IF;

  INSERT INTO public.health_nutrition_rolling_states (
    athlete_id,window_end_date,window_days,window_start_date,
    calendar_day_count,observed_day_count,sufficient_day_count,partial_day_count,unobserved_day_count,
    observation_coverage_ratio,sufficient_coverage_ratio,
    avg_energy_kcal,avg_protein_g,avg_carbohydrate_g,avg_fat_g,avg_fiber_g,
    energy_comparable_day_count,energy_in_target_day_count,energy_target_adherence_ratio,
    protein_comparable_day_count,protein_in_target_day_count,protein_target_adherence_ratio,
    coverage_status,confidence,reason_codes,algorithm_version,parameter_set,calculated_at
  )
  SELECT
    p_athlete_id,p_window_end_date,p_window_days,v_start,
    p_window_days,v_observed,v_sufficient,v_partial,v_unobserved,
    v_coverage,v_sufficient_coverage,
    avg(energy_kcal_consumed) FILTER (WHERE state_status='sufficient'),
    avg(protein_g_consumed) FILTER (WHERE state_status='sufficient'),
    avg(carbohydrate_g_consumed) FILTER (WHERE state_status='sufficient'),
    avg(fat_g_consumed) FILTER (WHERE state_status='sufficient'),
    avg(fiber_g_consumed) FILTER (WHERE state_status='sufficient'),
    v_energy_comp,v_energy_in,
    CASE WHEN v_energy_comp>0 THEN v_energy_in::numeric/v_energy_comp ELSE NULL END,
    v_protein_comp,v_protein_in,
    CASE WHEN v_protein_comp>0 THEN v_protein_in::numeric/v_protein_comp ELSE NULL END,
    v_coverage_status,v_confidence,v_reasons,
    'M6_ROLLING_STATE_V1',
    jsonb_build_object('window_days',p_window_days,'complete_days_for_average_only',true),
    now()
  FROM public.health_nutrition_daily_states s
  WHERE s.athlete_id=p_athlete_id
    AND s.state_date BETWEEN v_start AND p_window_end_date
  ON CONFLICT (athlete_id,window_end_date,window_days)
  DO UPDATE SET
    window_start_date=EXCLUDED.window_start_date,
    calendar_day_count=EXCLUDED.calendar_day_count,
    observed_day_count=EXCLUDED.observed_day_count,
    sufficient_day_count=EXCLUDED.sufficient_day_count,
    partial_day_count=EXCLUDED.partial_day_count,
    unobserved_day_count=EXCLUDED.unobserved_day_count,
    observation_coverage_ratio=EXCLUDED.observation_coverage_ratio,
    sufficient_coverage_ratio=EXCLUDED.sufficient_coverage_ratio,
    avg_energy_kcal=EXCLUDED.avg_energy_kcal,
    avg_protein_g=EXCLUDED.avg_protein_g,
    avg_carbohydrate_g=EXCLUDED.avg_carbohydrate_g,
    avg_fat_g=EXCLUDED.avg_fat_g,
    avg_fiber_g=EXCLUDED.avg_fiber_g,
    energy_comparable_day_count=EXCLUDED.energy_comparable_day_count,
    energy_in_target_day_count=EXCLUDED.energy_in_target_day_count,
    energy_target_adherence_ratio=EXCLUDED.energy_target_adherence_ratio,
    protein_comparable_day_count=EXCLUDED.protein_comparable_day_count,
    protein_in_target_day_count=EXCLUDED.protein_in_target_day_count,
    protein_target_adherence_ratio=EXCLUDED.protein_target_adherence_ratio,
    coverage_status=EXCLUDED.coverage_status,
    confidence=EXCLUDED.confidence,
    reason_codes=EXCLUDED.reason_codes,
    algorithm_version=EXCLUDED.algorithm_version,
    parameter_set=EXCLUDED.parameter_set,
    calculated_at=EXCLUDED.calculated_at
  RETURNING id INTO v_state_id;

  RETURN v_state_id;
END;
$$;
