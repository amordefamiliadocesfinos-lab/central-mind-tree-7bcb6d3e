-- F11 Health — deterministic integrated decision evaluator.
-- Reads materialized M7/M8/M9A sources only. Never refreshes or mutates specialist domains.

CREATE OR REPLACE FUNCTION public.health_f11_evaluate_integrated_decision(
  p_athlete_id uuid,
  p_as_of_date date,
  p_window_days integer DEFAULT 7
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_algorithm_version text := 'F11_INTEGRATED_DECISION_V1';
  v_parameter_set jsonb := pg_catalog.jsonb_build_object(
    'version','F11_PARAMETERS_V1',
    'body_accepted_coverage',pg_catalog.jsonb_build_array('partial','complete'),
    'recovery_accepted_coverage',pg_catalog.jsonb_build_array('partial','complete'),
    'clinical_decision_policy','excluded_v1',
    'training_decision_capability','disabled_v1',
    'automatic_action_allowed',false
  );

  v_nutrition public.health_nutrition_decisions%ROWTYPE;
  v_body public.health_body_rolling_states%ROWTYPE;
  v_recovery public.health_sleep_recovery_rolling_states%ROWTYPE;

  v_has_nutrition boolean := false;
  v_has_body boolean := false;
  v_has_recovery boolean := false;

  v_nutrition_date_mismatch boolean := false;
  v_nutrition_window_mismatch boolean := false;
  v_nutrition_not_current boolean := false;
  v_body_date_mismatch boolean := false;
  v_body_window_mismatch boolean := false;
  v_recovery_date_mismatch boolean := false;
  v_recovery_window_mismatch boolean := false;

  v_body_response_available boolean := false;
  v_recovery_context_available boolean := false;

  v_input_snapshot jsonb;
  v_input_fingerprint text;
  v_current_run_id uuid;
  v_current_fingerprint text;
  v_run_id uuid;
  v_run_status text := 'paused';

  v_c1_create boolean := false;
  v_c1_status text := 'paused';
  v_c1_class text := 'data_quality';
  v_c1_code text := 'review_data_quality';
  v_c1_confidence text := 'low';
  v_c1_reasons text[] := '{}'::text[];

  v_c2_status text := 'paused';
  v_c2_class text := 'data_quality';
  v_c2_code text := 'review_data_quality';
  v_c2_confidence text := 'low';
  v_c2_reasons text[] := '{}'::text[];

  v_source_reasons jsonb;
  v_previous_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.health_can_write_athlete(p_athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF p_as_of_date IS NULL THEN
    RAISE EXCEPTION 'as_of_date is required';
  END IF;

  IF p_window_days NOT IN (7,14,28) THEN
    RAISE EXCEPTION 'window_days must be 7, 14, or 28';
  END IF;

  -- Serialize evaluation per athlete/date/window/algorithm to make retries deterministic.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_athlete_id::text || '|' || p_as_of_date::text || '|' ||
      p_window_days::text || '|' || v_algorithm_version,
      0
    )
  );

  SELECT d.*
  INTO v_nutrition
  FROM public.health_nutrition_decisions d
  WHERE d.athlete_id=p_athlete_id
    AND d.as_of_date=p_as_of_date
    AND d.window_days=p_window_days
    AND d.record_status='current'
  ORDER BY d.created_at DESC
  LIMIT 1;
  v_has_nutrition := FOUND;

  IF NOT v_has_nutrition THEN
    SELECT EXISTS (
      SELECT 1 FROM public.health_nutrition_decisions d
      WHERE d.athlete_id=p_athlete_id
        AND d.as_of_date=p_as_of_date
        AND d.window_days<>p_window_days
        AND d.record_status='current'
    ) INTO v_nutrition_window_mismatch;

    SELECT EXISTS (
      SELECT 1 FROM public.health_nutrition_decisions d
      WHERE d.athlete_id=p_athlete_id
        AND d.window_days=p_window_days
        AND d.as_of_date<>p_as_of_date
        AND d.record_status='current'
    ) INTO v_nutrition_date_mismatch;

    SELECT EXISTS (
      SELECT 1 FROM public.health_nutrition_decisions d
      WHERE d.athlete_id=p_athlete_id
        AND d.as_of_date=p_as_of_date
        AND d.window_days=p_window_days
        AND d.record_status<>'current'
    ) INTO v_nutrition_not_current;
  END IF;

  SELECT b.*
  INTO v_body
  FROM public.health_body_rolling_states b
  WHERE b.athlete_id=p_athlete_id
    AND b.as_of_date=p_as_of_date
    AND b.window_days=p_window_days
  LIMIT 1;
  v_has_body := FOUND;

  IF NOT v_has_body THEN
    SELECT EXISTS (
      SELECT 1 FROM public.health_body_rolling_states b
      WHERE b.athlete_id=p_athlete_id
        AND b.as_of_date=p_as_of_date
        AND b.window_days<>p_window_days
    ) INTO v_body_window_mismatch;

    SELECT EXISTS (
      SELECT 1 FROM public.health_body_rolling_states b
      WHERE b.athlete_id=p_athlete_id
        AND b.window_days=p_window_days
        AND b.as_of_date<>p_as_of_date
    ) INTO v_body_date_mismatch;
  END IF;

  SELECT r.*
  INTO v_recovery
  FROM public.health_sleep_recovery_rolling_states r
  WHERE r.athlete_id=p_athlete_id
    AND r.as_of_date=p_as_of_date
    AND r.window_days=p_window_days
  LIMIT 1;
  v_has_recovery := FOUND;

  IF NOT v_has_recovery THEN
    SELECT EXISTS (
      SELECT 1 FROM public.health_sleep_recovery_rolling_states r
      WHERE r.athlete_id=p_athlete_id
        AND r.as_of_date=p_as_of_date
        AND r.window_days<>p_window_days
    ) INTO v_recovery_window_mismatch;

    SELECT EXISTS (
      SELECT 1 FROM public.health_sleep_recovery_rolling_states r
      WHERE r.athlete_id=p_athlete_id
        AND r.window_days=p_window_days
        AND r.as_of_date<>p_as_of_date
    ) INTO v_recovery_date_mismatch;
  END IF;

  v_body_response_available :=
    v_has_body
    AND v_body.coverage_status IN ('partial','complete')
    AND (
      v_body.weight_change_kg IS NOT NULL
      OR v_body.weight_trend_kg_per_week IS NOT NULL
      OR v_body.waist_change_cm IS NOT NULL
      OR v_body.body_fat_change_pct IS NOT NULL
    );

  v_recovery_context_available :=
    v_has_recovery
    AND (
      (v_recovery.recovery_coverage IN ('partial','complete') AND v_recovery.average_recovery IS NOT NULL)
      OR
      (v_recovery.fatigue_coverage IN ('partial','complete') AND v_recovery.average_fatigue IS NOT NULL)
      OR
      (v_recovery.readiness_coverage IN ('partial','complete') AND v_recovery.average_readiness IS NOT NULL)
    );

  v_input_snapshot := pg_catalog.jsonb_build_object(
    'nutrition_decision',
      CASE WHEN v_has_nutrition THEN pg_catalog.jsonb_build_object(
        'id',v_nutrition.id,
        'decision_status',v_nutrition.decision_status,
        'decision_class',v_nutrition.decision_class,
        'decision_code',v_nutrition.decision_code,
        'target_domain',v_nutrition.target_domain,
        'confidence',v_nutrition.confidence,
        'reason_codes',v_nutrition.reason_codes,
        'plan_adjustment_status',v_nutrition.plan_adjustment_status,
        'algorithm_version',v_nutrition.algorithm_version,
        'plan_version_id',v_nutrition.plan_version_id,
        'strategy_type',v_nutrition.strategy_type,
        'created_at',v_nutrition.created_at
      ) ELSE NULL END,
    'body_state',
      CASE WHEN v_has_body THEN pg_catalog.jsonb_build_object(
        'id',v_body.id,
        'coverage_status',v_body.coverage_status,
        'confidence',v_body.confidence,
        'reason_codes',v_body.reason_codes,
        'algorithm_version',v_body.algorithm_version,
        'weight_change_kg',v_body.weight_change_kg,
        'weight_trend_kg_per_week',v_body.weight_trend_kg_per_week,
        'waist_change_cm',v_body.waist_change_cm,
        'body_fat_change_pct',v_body.body_fat_change_pct,
        'response_available',v_body_response_available,
        'computed_at',v_body.computed_at
      ) ELSE NULL END,
    'recovery_state',
      CASE WHEN v_has_recovery THEN pg_catalog.jsonb_build_object(
        'id',v_recovery.id,
        'confidence',v_recovery.confidence,
        'reason_codes',v_recovery.reason_codes,
        'algorithm_version',v_recovery.algorithm_version,
        'recovery_coverage',v_recovery.recovery_coverage,
        'fatigue_coverage',v_recovery.fatigue_coverage,
        'readiness_coverage',v_recovery.readiness_coverage,
        'average_recovery',v_recovery.average_recovery,
        'average_fatigue',v_recovery.average_fatigue,
        'average_readiness',v_recovery.average_readiness,
        'context_available',v_recovery_context_available,
        'computed_at',v_recovery.computed_at
      ) ELSE NULL END,
    'clinical_decision_policy','excluded_v1',
    'training_decision_capability','disabled_v1'
  );

  v_input_fingerprint := pg_catalog.md5(
    v_input_snapshot::text || '|' || v_parameter_set::text || '|' || v_algorithm_version
  );

  SELECT r.id,r.input_fingerprint
  INTO v_current_run_id,v_current_fingerprint
  FROM public.health_integrated_decision_runs r
  WHERE r.athlete_id=p_athlete_id
    AND r.as_of_date=p_as_of_date
    AND r.window_days=p_window_days
    AND r.algorithm_version=v_algorithm_version
    AND r.record_status='current'
  FOR UPDATE;

  IF v_current_run_id IS NOT NULL AND v_current_fingerprint=v_input_fingerprint THEN
    RETURN v_current_run_id;
  END IF;

  -- C1: execution review. Only created when M7 is missing/paused or explicitly execution.
  IF NOT v_has_nutrition THEN
    v_c1_create := true;
    v_c1_reasons := ARRAY['NUTRITION_DECISION_MISSING']::text[];
    IF v_nutrition_date_mismatch THEN v_c1_reasons := pg_catalog.array_append(v_c1_reasons,'SOURCE_DATE_MISMATCH'); END IF;
    IF v_nutrition_window_mismatch THEN v_c1_reasons := pg_catalog.array_append(v_c1_reasons,'SOURCE_WINDOW_MISMATCH'); END IF;
    IF v_nutrition_not_current THEN v_c1_reasons := pg_catalog.array_append(v_c1_reasons,'SOURCE_RECORD_NOT_CURRENT'); END IF;
  ELSIF v_nutrition.decision_status='paused' THEN
    v_c1_create := true;
    v_c1_reasons := ARRAY['NUTRITION_DECISION_PAUSED']::text[];
  ELSIF v_nutrition.decision_status='ready' AND v_nutrition.decision_class='execution' THEN
    v_c1_create := true;
    v_c1_status := 'ready';
    v_c1_class := 'execution';
    v_c1_code := 'review_nutrition_execution';
    v_c1_confidence := v_nutrition.confidence;
    v_c1_reasons := ARRAY['NUTRITION_EXECUTION_REVIEW_REQUIRED']::text[];
  END IF;

  -- C2: plan review candidate. Never changes the plan; it only determines review eligibility.
  IF NOT v_has_nutrition THEN
    v_c2_reasons := ARRAY['NUTRITION_DECISION_MISSING']::text[];
    IF v_nutrition_date_mismatch THEN v_c2_reasons := pg_catalog.array_append(v_c2_reasons,'SOURCE_DATE_MISMATCH'); END IF;
    IF v_nutrition_window_mismatch THEN v_c2_reasons := pg_catalog.array_append(v_c2_reasons,'SOURCE_WINDOW_MISMATCH'); END IF;
    IF v_nutrition_not_current THEN v_c2_reasons := pg_catalog.array_append(v_c2_reasons,'SOURCE_RECORD_NOT_CURRENT'); END IF;

  ELSIF v_nutrition.decision_status='paused' THEN
    v_c2_reasons := ARRAY['NUTRITION_DECISION_PAUSED']::text[];

  ELSIF v_nutrition.decision_class='execution' THEN
    v_c2_reasons := ARRAY['NUTRITION_EXECUTION_REVIEW_PRECEDES_PLAN_REVIEW']::text[];

  ELSE
    IF NOT v_has_body THEN
      v_c2_reasons := pg_catalog.array_append(v_c2_reasons,'BODY_STATE_MISSING');
      IF v_body_date_mismatch THEN v_c2_reasons := pg_catalog.array_append(v_c2_reasons,'SOURCE_DATE_MISMATCH'); END IF;
      IF v_body_window_mismatch THEN v_c2_reasons := pg_catalog.array_append(v_c2_reasons,'SOURCE_WINDOW_MISMATCH'); END IF;
    ELSE
      IF v_body.coverage_status NOT IN ('partial','complete') THEN
        v_c2_reasons := pg_catalog.array_append(v_c2_reasons,'BODY_COVERAGE_TOO_LOW');
      END IF;
      IF NOT v_body_response_available THEN
        v_c2_reasons := pg_catalog.array_append(v_c2_reasons,'BODY_RESPONSE_INSUFFICIENT');
      END IF;
    END IF;

    IF NOT v_has_recovery THEN
      v_c2_reasons := pg_catalog.array_append(v_c2_reasons,'RECOVERY_STATE_MISSING');
      IF v_recovery_date_mismatch THEN v_c2_reasons := pg_catalog.array_append(v_c2_reasons,'SOURCE_DATE_MISMATCH'); END IF;
      IF v_recovery_window_mismatch THEN v_c2_reasons := pg_catalog.array_append(v_c2_reasons,'SOURCE_WINDOW_MISMATCH'); END IF;
    ELSE
      IF NOT (
        v_recovery.recovery_coverage IN ('partial','complete')
        OR v_recovery.fatigue_coverage IN ('partial','complete')
        OR v_recovery.readiness_coverage IN ('partial','complete')
      ) THEN
        v_c2_reasons := pg_catalog.array_append(v_c2_reasons,'RECOVERY_COVERAGE_TOO_LOW');
      END IF;
      IF NOT v_recovery_context_available THEN
        v_c2_reasons := pg_catalog.array_append(v_c2_reasons,'RECOVERY_CONTEXT_INSUFFICIENT');
      END IF;
    END IF;

    IF pg_catalog.cardinality(v_c2_reasons)=0 THEN
      v_c2_status := 'ready';
      v_c2_class := 'plan_review';
      v_c2_code := 'review_nutrition_plan_candidate';
      v_c2_reasons := ARRAY['BODY_RESPONSE_AVAILABLE','RECOVERY_CONTEXT_AVAILABLE']::text[];
      v_c2_confidence := CASE
        WHEN 'low'=ANY(ARRAY[v_nutrition.confidence,v_body.confidence,v_recovery.confidence]) THEN 'low'
        WHEN 'moderate'=ANY(ARRAY[v_nutrition.confidence,v_body.confidence,v_recovery.confidence]) THEN 'moderate'
        ELSE 'high'
      END;
    END IF;
  END IF;

  IF (v_c1_create AND v_c1_status='ready') OR v_c2_status='ready' THEN
    v_run_status := 'complete';
  ELSE
    v_run_status := 'paused';
  END IF;

  IF v_current_run_id IS NOT NULL THEN
    UPDATE public.health_integrated_decision_runs
    SET record_status='superseded'
    WHERE id=v_current_run_id
      AND athlete_id=p_athlete_id
      AND record_status='current';
    v_previous_id := v_current_run_id;
  END IF;

  INSERT INTO public.health_integrated_decision_runs (
    athlete_id,as_of_date,window_days,run_status,algorithm_version,parameter_set,
    evidence_snapshot,input_fingerprint,record_status,supersedes_run_id
  ) VALUES (
    p_athlete_id,p_as_of_date,p_window_days,v_run_status,v_algorithm_version,v_parameter_set,
    v_input_snapshot,v_input_fingerprint,'current',v_previous_id
  )
  RETURNING id INTO v_run_id;

  v_source_reasons := pg_catalog.jsonb_build_object(
    'nutrition',
      CASE WHEN v_has_nutrition THEN pg_catalog.to_jsonb(v_nutrition.reason_codes) ELSE '[]'::jsonb END,
    'body',
      CASE WHEN v_has_body THEN pg_catalog.to_jsonb(v_body.reason_codes) ELSE '[]'::jsonb END,
    'recovery',
      CASE WHEN v_has_recovery THEN pg_catalog.to_jsonb(v_recovery.reason_codes) ELSE '[]'::jsonb END
  );

  IF v_c1_create THEN
    INSERT INTO public.health_integrated_decisions (
      athlete_id,run_id,decision_scope,decision_status,decision_class,decision_code,
      target_domain,confidence,reason_codes,source_reason_codes,action_status,evidence_snapshot
    ) VALUES (
      p_athlete_id,v_run_id,'nutrition_execution',v_c1_status,v_c1_class,v_c1_code,
      'nutrition',v_c1_confidence,v_c1_reasons,v_source_reasons,'none',
      pg_catalog.jsonb_build_object(
        'nutrition_decision_id',CASE WHEN v_has_nutrition THEN v_nutrition.id ELSE NULL END,
        'automatic_action_allowed',false
      )
    );
  END IF;

  INSERT INTO public.health_integrated_decisions (
    athlete_id,run_id,decision_scope,decision_status,decision_class,decision_code,
    target_domain,confidence,reason_codes,source_reason_codes,action_status,evidence_snapshot
  ) VALUES (
    p_athlete_id,v_run_id,'nutrition_plan_review',v_c2_status,v_c2_class,v_c2_code,
    'nutrition',v_c2_confidence,v_c2_reasons,v_source_reasons,'none',
    pg_catalog.jsonb_build_object(
      'nutrition_decision_id',CASE WHEN v_has_nutrition THEN v_nutrition.id ELSE NULL END,
      'body_state_id',CASE WHEN v_has_body THEN v_body.id ELSE NULL END,
      'recovery_state_id',CASE WHEN v_has_recovery THEN v_recovery.id ELSE NULL END,
      'body_response_available',v_body_response_available,
      'recovery_context_available',v_recovery_context_available,
      'automatic_action_allowed',false
    )
  );

  RETURN v_run_id;
END;
$$;
