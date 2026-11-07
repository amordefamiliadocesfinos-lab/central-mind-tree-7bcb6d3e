-- M7 Health — Deterministic Nutrition Decision Engine

CREATE OR REPLACE FUNCTION public.health_m7_evaluate_nutrition_decision(
  p_athlete_id uuid,
  p_as_of_date date,
  p_window_days integer DEFAULT 7
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rolling public.health_nutrition_rolling_states%ROWTYPE;
  v_plan_version_id uuid;
  v_strategy_type text;

  v_min_sufficient_days integer;
  v_min_comparable_days integer;
  v_min_adherence numeric := 0.80;

  v_decision_status text := 'paused';
  v_decision_class text := 'data_quality';
  v_decision_code text := 'decision_paused';
  v_target_domain text := 'overall';
  v_confidence text := 'low';
  v_reasons text[] := '{}'::text[];

  v_plan_adjustment_status text := 'paused';
  v_plan_adjustment_reasons text[] := ARRAY['BODY_RESPONSE_REQUIRED_FOR_PLAN_ADJUSTMENT']::text[];

  v_previous_id uuid;
  v_decision_id uuid;
BEGIN
  IF p_as_of_date IS NULL THEN
    RAISE EXCEPTION 'as_of_date is required';
  END IF;

  IF p_window_days NOT IN (7,14,28) THEN
    RAISE EXCEPTION 'window_days must be 7, 14, or 28';
  END IF;

  IF NOT public.health_can_write_athlete(p_athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  -- Always evaluate against a freshly derived M6 rolling state.
  PERFORM public.health_m6_refresh_rolling_state(
    p_athlete_id,
    p_as_of_date,
    p_window_days
  );

  SELECT *
  INTO v_rolling
  FROM public.health_nutrition_rolling_states r
  WHERE r.athlete_id=p_athlete_id
    AND r.window_end_date=p_as_of_date
    AND r.window_days=p_window_days;

  IF v_rolling.id IS NULL THEN
    RAISE EXCEPTION 'rolling nutrition state not available';
  END IF;

  SELECT pv.id,pv.strategy_type
  INTO v_plan_version_id,v_strategy_type
  FROM public.health_nutrition_plan_versions pv
  JOIN public.health_nutrition_plans p
    ON p.id=pv.plan_id
   AND p.athlete_id=pv.athlete_id
  WHERE pv.athlete_id=p_athlete_id
    AND pv.status='published'
    AND COALESCE(pv.effective_from,pv.published_at::date) <= p_as_of_date
    AND (pv.effective_to IS NULL OR pv.effective_to >= p_as_of_date)
  ORDER BY
    COALESCE(pv.effective_from,pv.published_at::date) DESC,
    pv.published_at DESC
  LIMIT 1;

  v_min_sufficient_days := CEIL(p_window_days * 0.70)::integer;
  v_min_comparable_days := v_min_sufficient_days;

  IF v_plan_version_id IS NULL THEN
    v_reasons := array_append(v_reasons,'NO_NUTRITION_PLAN_FOR_DATE');
  END IF;

  IF v_rolling.sufficient_day_count < v_min_sufficient_days THEN
    v_reasons := array_append(v_reasons,'INSUFFICIENT_SUFFICIENT_DAYS');
  END IF;

  IF v_rolling.energy_comparable_day_count < v_min_comparable_days THEN
    v_reasons := array_append(v_reasons,'INSUFFICIENT_ENERGY_COMPARABLE_DAYS');
  END IF;

  IF v_rolling.protein_comparable_day_count < v_min_comparable_days THEN
    v_reasons := array_append(v_reasons,'INSUFFICIENT_PROTEIN_COMPARABLE_DAYS');
  END IF;

  IF v_rolling.coverage_status IN ('unobserved','sparse') THEN
    v_reasons := array_append(v_reasons,'ROLLING_COVERAGE_TOO_LOW');
  END IF;

  IF cardinality(v_reasons) > 0 THEN
    v_decision_status := 'paused';
    v_decision_class := 'data_quality';
    v_decision_code := 'review_data_quality';
    v_target_domain := 'overall';
    v_confidence := 'low';
  ELSE
    v_decision_status := 'ready';
    v_confidence := CASE
      WHEN v_rolling.confidence='high' THEN 'high'
      ELSE 'moderate'
    END;

    IF v_rolling.energy_target_adherence_ratio < v_min_adherence
       AND v_rolling.protein_target_adherence_ratio < v_min_adherence THEN
      v_decision_class := 'execution';
      v_decision_code := 'review_energy_and_protein_execution';
      v_target_domain := 'energy_and_protein';
      v_reasons := ARRAY['ENERGY_ADHERENCE_BELOW_THRESHOLD','PROTEIN_ADHERENCE_BELOW_THRESHOLD'];

    ELSIF v_rolling.energy_target_adherence_ratio < v_min_adherence THEN
      v_decision_class := 'execution';
      v_decision_code := 'review_energy_execution';
      v_target_domain := 'energy';
      v_reasons := ARRAY['ENERGY_ADHERENCE_BELOW_THRESHOLD'];

    ELSIF v_rolling.protein_target_adherence_ratio < v_min_adherence THEN
      v_decision_class := 'execution';
      v_decision_code := 'review_protein_execution';
      v_target_domain := 'protein';
      v_reasons := ARRAY['PROTEIN_ADHERENCE_BELOW_THRESHOLD'];

    ELSE
      v_decision_class := 'maintenance';
      v_decision_code := 'maintain_plan';
      v_target_domain := 'overall';
      v_reasons := ARRAY['ENERGY_AND_PROTEIN_ADHERENCE_ACCEPTABLE'];
    END IF;
  END IF;

  -- Plan adjustment remains paused in M7 v1 until Body/response state exists.
  v_plan_adjustment_status := 'paused';
  v_plan_adjustment_reasons := ARRAY['BODY_RESPONSE_REQUIRED_FOR_PLAN_ADJUSTMENT'];

  SELECT d.id
  INTO v_previous_id
  FROM public.health_nutrition_decisions d
  WHERE d.athlete_id=p_athlete_id
    AND d.as_of_date=p_as_of_date
    AND d.window_days=p_window_days
    AND d.record_status='current'
  FOR UPDATE;

  IF v_previous_id IS NOT NULL THEN
    UPDATE public.health_nutrition_decisions
    SET record_status='superseded'
    WHERE id=v_previous_id;
  END IF;

  INSERT INTO public.health_nutrition_decisions (
    athlete_id,
    as_of_date,
    window_days,
    rolling_state_id,
    plan_version_id,
    strategy_type,
    decision_status,
    decision_class,
    decision_code,
    target_domain,
    confidence,
    reason_codes,
    plan_adjustment_status,
    plan_adjustment_reason_codes,
    observed_day_count,
    sufficient_day_count,
    energy_comparable_day_count,
    protein_comparable_day_count,
    energy_target_adherence_ratio,
    protein_target_adherence_ratio,
    rolling_coverage_status,
    rolling_confidence,
    evidence_snapshot,
    algorithm_version,
    parameter_set,
    record_status,
    supersedes_decision_id
  ) VALUES (
    p_athlete_id,
    p_as_of_date,
    p_window_days,
    v_rolling.id,
    v_plan_version_id,
    v_strategy_type,
    v_decision_status,
    v_decision_class,
    v_decision_code,
    v_target_domain,
    v_confidence,
    v_reasons,
    v_plan_adjustment_status,
    v_plan_adjustment_reasons,
    v_rolling.observed_day_count,
    v_rolling.sufficient_day_count,
    v_rolling.energy_comparable_day_count,
    v_rolling.protein_comparable_day_count,
    v_rolling.energy_target_adherence_ratio,
    v_rolling.protein_target_adherence_ratio,
    v_rolling.coverage_status,
    v_rolling.confidence,
    jsonb_build_object(
      'rolling_state_id',v_rolling.id,
      'window_start_date',v_rolling.window_start_date,
      'window_end_date',v_rolling.window_end_date,
      'window_days',v_rolling.window_days,
      'observed_day_count',v_rolling.observed_day_count,
      'sufficient_day_count',v_rolling.sufficient_day_count,
      'energy_comparable_day_count',v_rolling.energy_comparable_day_count,
      'protein_comparable_day_count',v_rolling.protein_comparable_day_count,
      'energy_target_adherence_ratio',v_rolling.energy_target_adherence_ratio,
      'protein_target_adherence_ratio',v_rolling.protein_target_adherence_ratio,
      'coverage_status',v_rolling.coverage_status,
      'rolling_confidence',v_rolling.confidence,
      'rolling_reason_codes',v_rolling.reason_codes,
      'plan_version_id',v_plan_version_id,
      'strategy_type',v_strategy_type
    ),
    'M7_NUTRITION_DECISION_V1',
    jsonb_build_object(
      'minimum_sufficient_days',v_min_sufficient_days,
      'minimum_comparable_days',v_min_comparable_days,
      'minimum_adherence_ratio',v_min_adherence,
      'plan_adjustment_requires_body_state',true
    ),
    'current',
    v_previous_id
  )
  RETURNING id INTO v_decision_id;

  RETURN v_decision_id;
END;
$$;
