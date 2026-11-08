-- F13 Health — deterministic longitudinal comparison and explicit human outcome RPCs.

CREATE OR REPLACE FUNCTION public.health_f13_generate_longitudinal_review(
  p_athlete_id uuid,
  p_as_of_date date,
  p_window_days integer DEFAULT 28
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_algorithm_version text := 'F13_LONGITUDINAL_REVIEW_V1';
  v_parameter_set jsonb := pg_catalog.jsonb_build_object(
    'version','F13_PARAMETERS_V1',
    'window_days',28,
    'domains',pg_catalog.jsonb_build_array('training','nutrition','body','recovery'),
    'clinical_comparison','excluded_v1',
    'automatic_replanning',false,
    'causal_inference',false,
    'human_outcome_required',true
  );

  v_current_start date;
  v_current_end date;
  v_prior_start date;
  v_prior_end date;

  v_goal jsonb := 'null'::jsonb;
  v_phase jsonb := 'null'::jsonb;

  v_training_known boolean := false;
  v_training_current_sessions integer := 0;
  v_training_prior_sessions integer := 0;
  v_training_current_sets integer := 0;
  v_training_prior_sets integer := 0;
  v_training_current_exercises integer := 0;
  v_training_prior_exercises integer := 0;

  v_nutrition_current public.health_nutrition_rolling_states%ROWTYPE;
  v_nutrition_prior public.health_nutrition_rolling_states%ROWTYPE;
  v_has_nutrition_current boolean := false;
  v_has_nutrition_prior boolean := false;

  v_body_current public.health_body_rolling_states%ROWTYPE;
  v_body_prior public.health_body_rolling_states%ROWTYPE;
  v_has_body_current boolean := false;
  v_has_body_prior boolean := false;

  v_recovery_current public.health_sleep_recovery_rolling_states%ROWTYPE;
  v_recovery_prior public.health_sleep_recovery_rolling_states%ROWTYPE;
  v_has_recovery_current boolean := false;
  v_has_recovery_prior boolean := false;

  v_f11_current jsonb := 'null'::jsonb;
  v_f11_prior jsonb := 'null'::jsonb;

  v_available text[] := '{}'::text[];
  v_unavailable text[] := '{}'::text[];
  v_reasons text[] := '{}'::text[];

  v_training_snapshot jsonb;
  v_nutrition_snapshot jsonb;
  v_body_snapshot jsonb;
  v_recovery_snapshot jsonb;
  v_snapshot jsonb;
  v_fingerprint text;
  v_run_status text;

  v_current_run_id uuid;
  v_current_fingerprint text;
  v_previous_id uuid;
  v_run_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.health_can_write_athlete(p_athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF p_as_of_date IS NULL THEN
    RAISE EXCEPTION 'as_of_date is required';
  END IF;

  IF p_window_days <> 28 THEN
    RAISE EXCEPTION 'window_days must be 28 for F13 v1';
  END IF;

  v_current_end := p_as_of_date;
  v_current_start := p_as_of_date - 27;
  v_prior_end := p_as_of_date - 28;
  v_prior_start := p_as_of_date - 55;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_athlete_id::text || '|' || p_as_of_date::text || '|28|' || v_algorithm_version,
      0
    )
  );

  SELECT pg_catalog.jsonb_build_object(
    'id',g.id,
    'goal_type',g.goal_type,
    'title',g.title,
    'priority',g.priority,
    'started_on',g.started_on,
    'target_date',g.target_date
  )
  INTO v_goal
  FROM public.health_goals g
  WHERE g.athlete_id=p_athlete_id
    AND g.status='active'
    AND g.is_primary=true
  LIMIT 1;

  SELECT pg_catalog.jsonb_build_object(
    'id',p.id,
    'goal_id',p.goal_id,
    'phase_type',p.phase_type,
    'title',p.title,
    'starts_on',p.starts_on,
    'ends_on',p.ends_on
  )
  INTO v_phase
  FROM public.health_goal_phases p
  WHERE p.athlete_id=p_athlete_id
    AND p.status='active'
  LIMIT 1;

  v_goal := COALESCE(v_goal,'null'::jsonb);
  v_phase := COALESCE(v_phase,'null'::jsonb);

  SELECT EXISTS(
    SELECT 1
    FROM public.health_workout_sessions s
    WHERE s.athlete_id=p_athlete_id
      AND s.status='completed'
  ) INTO v_training_known;

  SELECT count(*)::integer
  INTO v_training_current_sessions
  FROM public.health_workout_sessions s
  WHERE s.athlete_id=p_athlete_id
    AND s.status='completed'
    AND s.ended_at::date BETWEEN v_current_start AND v_current_end;

  SELECT count(*)::integer
  INTO v_training_prior_sessions
  FROM public.health_workout_sessions s
  WHERE s.athlete_id=p_athlete_id
    AND s.status='completed'
    AND s.ended_at::date BETWEEN v_prior_start AND v_prior_end;

  SELECT count(*)::integer
  INTO v_training_current_sets
  FROM public.health_workout_sets ws
  JOIN public.health_workout_sessions s
    ON s.id=ws.session_id AND s.athlete_id=ws.athlete_id
  WHERE ws.athlete_id=p_athlete_id
    AND ws.status='completed'
    AND s.status='completed'
    AND s.ended_at::date BETWEEN v_current_start AND v_current_end;

  SELECT count(*)::integer
  INTO v_training_prior_sets
  FROM public.health_workout_sets ws
  JOIN public.health_workout_sessions s
    ON s.id=ws.session_id AND s.athlete_id=ws.athlete_id
  WHERE ws.athlete_id=p_athlete_id
    AND ws.status='completed'
    AND s.status='completed'
    AND s.ended_at::date BETWEEN v_prior_start AND v_prior_end;

  SELECT count(DISTINCT we.exercise_id)::integer
  INTO v_training_current_exercises
  FROM public.health_workout_exercises we
  JOIN public.health_workout_sessions s
    ON s.id=we.session_id AND s.athlete_id=we.athlete_id
  WHERE we.athlete_id=p_athlete_id
    AND s.status='completed'
    AND s.ended_at::date BETWEEN v_current_start AND v_current_end;

  SELECT count(DISTINCT we.exercise_id)::integer
  INTO v_training_prior_exercises
  FROM public.health_workout_exercises we
  JOIN public.health_workout_sessions s
    ON s.id=we.session_id AND s.athlete_id=we.athlete_id
  WHERE we.athlete_id=p_athlete_id
    AND s.status='completed'
    AND s.ended_at::date BETWEEN v_prior_start AND v_prior_end;

  v_training_snapshot := pg_catalog.jsonb_build_object(
    'status',CASE WHEN v_training_known THEN 'available' ELSE 'unavailable' END,
    'current',pg_catalog.jsonb_build_object(
      'start_date',v_current_start,
      'end_date',v_current_end,
      'completed_session_count',v_training_current_sessions,
      'completed_set_count',v_training_current_sets,
      'distinct_exercise_count',v_training_current_exercises
    ),
    'prior',pg_catalog.jsonb_build_object(
      'start_date',v_prior_start,
      'end_date',v_prior_end,
      'completed_session_count',v_training_prior_sessions,
      'completed_set_count',v_training_prior_sets,
      'distinct_exercise_count',v_training_prior_exercises
    ),
    'delta',pg_catalog.jsonb_build_object(
      'completed_session_count',v_training_current_sessions-v_training_prior_sessions,
      'completed_set_count',v_training_current_sets-v_training_prior_sets,
      'distinct_exercise_count',v_training_current_exercises-v_training_prior_exercises
    )
  );

  IF v_training_known THEN
    v_available := pg_catalog.array_append(v_available,'training');
    IF v_training_current_sessions=0 THEN
      v_reasons := pg_catalog.array_append(v_reasons,'TRAINING_CURRENT_PERIOD_EMPTY');
    ELSE
      v_reasons := pg_catalog.array_append(v_reasons,'TRAINING_CURRENT_PERIOD_AVAILABLE');
    END IF;
    IF v_training_prior_sessions=0 THEN
      v_reasons := pg_catalog.array_append(v_reasons,'TRAINING_PRIOR_PERIOD_EMPTY');
    ELSE
      v_reasons := pg_catalog.array_append(v_reasons,'TRAINING_PRIOR_PERIOD_AVAILABLE');
    END IF;
  ELSE
    v_unavailable := pg_catalog.array_append(v_unavailable,'training');
    v_reasons := pg_catalog.array_append(v_reasons,'TRAINING_CURRENT_PERIOD_EMPTY');
    v_reasons := pg_catalog.array_append(v_reasons,'TRAINING_PRIOR_PERIOD_EMPTY');
  END IF;

  SELECT n.*
  INTO v_nutrition_current
  FROM public.health_nutrition_rolling_states n
  WHERE n.athlete_id=p_athlete_id
    AND n.window_days=28
    AND n.window_end_date=v_current_end
  LIMIT 1;
  v_has_nutrition_current := FOUND;

  SELECT n.*
  INTO v_nutrition_prior
  FROM public.health_nutrition_rolling_states n
  WHERE n.athlete_id=p_athlete_id
    AND n.window_days=28
    AND n.window_end_date=v_prior_end
  LIMIT 1;
  v_has_nutrition_prior := FOUND;

  v_nutrition_snapshot := pg_catalog.jsonb_build_object(
    'status',CASE WHEN v_has_nutrition_current AND v_has_nutrition_prior THEN 'available' ELSE 'unavailable' END,
    'current',CASE WHEN v_has_nutrition_current THEN pg_catalog.jsonb_build_object(
      'id',v_nutrition_current.id,
      'observed_day_count',v_nutrition_current.observed_day_count,
      'sufficient_day_count',v_nutrition_current.sufficient_day_count,
      'observation_coverage_ratio',v_nutrition_current.observation_coverage_ratio,
      'sufficient_coverage_ratio',v_nutrition_current.sufficient_coverage_ratio,
      'avg_energy_kcal',v_nutrition_current.avg_energy_kcal,
      'avg_protein_g',v_nutrition_current.avg_protein_g,
      'avg_carbohydrate_g',v_nutrition_current.avg_carbohydrate_g,
      'avg_fat_g',v_nutrition_current.avg_fat_g,
      'avg_fiber_g',v_nutrition_current.avg_fiber_g,
      'energy_target_adherence_ratio',v_nutrition_current.energy_target_adherence_ratio,
      'protein_target_adherence_ratio',v_nutrition_current.protein_target_adherence_ratio,
      'coverage_status',v_nutrition_current.coverage_status,
      'confidence',v_nutrition_current.confidence,
      'reason_codes',v_nutrition_current.reason_codes,
      'algorithm_version',v_nutrition_current.algorithm_version
    ) ELSE NULL END,
    'prior',CASE WHEN v_has_nutrition_prior THEN pg_catalog.jsonb_build_object(
      'id',v_nutrition_prior.id,
      'observed_day_count',v_nutrition_prior.observed_day_count,
      'sufficient_day_count',v_nutrition_prior.sufficient_day_count,
      'observation_coverage_ratio',v_nutrition_prior.observation_coverage_ratio,
      'sufficient_coverage_ratio',v_nutrition_prior.sufficient_coverage_ratio,
      'avg_energy_kcal',v_nutrition_prior.avg_energy_kcal,
      'avg_protein_g',v_nutrition_prior.avg_protein_g,
      'avg_carbohydrate_g',v_nutrition_prior.avg_carbohydrate_g,
      'avg_fat_g',v_nutrition_prior.avg_fat_g,
      'avg_fiber_g',v_nutrition_prior.avg_fiber_g,
      'energy_target_adherence_ratio',v_nutrition_prior.energy_target_adherence_ratio,
      'protein_target_adherence_ratio',v_nutrition_prior.protein_target_adherence_ratio,
      'coverage_status',v_nutrition_prior.coverage_status,
      'confidence',v_nutrition_prior.confidence,
      'reason_codes',v_nutrition_prior.reason_codes,
      'algorithm_version',v_nutrition_prior.algorithm_version
    ) ELSE NULL END,
    'delta',CASE WHEN v_has_nutrition_current AND v_has_nutrition_prior THEN pg_catalog.jsonb_build_object(
      'observed_day_count',v_nutrition_current.observed_day_count-v_nutrition_prior.observed_day_count,
      'sufficient_day_count',v_nutrition_current.sufficient_day_count-v_nutrition_prior.sufficient_day_count,
      'avg_energy_kcal',CASE WHEN v_nutrition_current.avg_energy_kcal IS NOT NULL AND v_nutrition_prior.avg_energy_kcal IS NOT NULL THEN v_nutrition_current.avg_energy_kcal-v_nutrition_prior.avg_energy_kcal ELSE NULL END,
      'avg_protein_g',CASE WHEN v_nutrition_current.avg_protein_g IS NOT NULL AND v_nutrition_prior.avg_protein_g IS NOT NULL THEN v_nutrition_current.avg_protein_g-v_nutrition_prior.avg_protein_g ELSE NULL END,
      'avg_carbohydrate_g',CASE WHEN v_nutrition_current.avg_carbohydrate_g IS NOT NULL AND v_nutrition_prior.avg_carbohydrate_g IS NOT NULL THEN v_nutrition_current.avg_carbohydrate_g-v_nutrition_prior.avg_carbohydrate_g ELSE NULL END,
      'avg_fat_g',CASE WHEN v_nutrition_current.avg_fat_g IS NOT NULL AND v_nutrition_prior.avg_fat_g IS NOT NULL THEN v_nutrition_current.avg_fat_g-v_nutrition_prior.avg_fat_g ELSE NULL END,
      'avg_fiber_g',CASE WHEN v_nutrition_current.avg_fiber_g IS NOT NULL AND v_nutrition_prior.avg_fiber_g IS NOT NULL THEN v_nutrition_current.avg_fiber_g-v_nutrition_prior.avg_fiber_g ELSE NULL END
    ) ELSE NULL END
  );

  IF v_has_nutrition_current AND v_has_nutrition_prior THEN
    v_available := pg_catalog.array_append(v_available,'nutrition');
    v_reasons := pg_catalog.array_append(v_reasons,'NUTRITION_COMPARISON_AVAILABLE');
    IF v_nutrition_current.coverage_status IN ('unobserved','sparse') THEN
      v_reasons := pg_catalog.array_append(v_reasons,'NUTRITION_CURRENT_COVERAGE_LOW');
    END IF;
    IF v_nutrition_prior.coverage_status IN ('unobserved','sparse') THEN
      v_reasons := pg_catalog.array_append(v_reasons,'NUTRITION_PRIOR_COVERAGE_LOW');
    END IF;
  ELSE
    v_unavailable := pg_catalog.array_append(v_unavailable,'nutrition');
    IF NOT v_has_nutrition_current THEN v_reasons := pg_catalog.array_append(v_reasons,'NUTRITION_CURRENT_STATE_MISSING'); END IF;
    IF NOT v_has_nutrition_prior THEN v_reasons := pg_catalog.array_append(v_reasons,'NUTRITION_PRIOR_STATE_MISSING'); END IF;
  END IF;

  SELECT b.* INTO v_body_current
  FROM public.health_body_rolling_states b
  WHERE b.athlete_id=p_athlete_id AND b.window_days=28 AND b.as_of_date=v_current_end
  LIMIT 1;
  v_has_body_current := FOUND;

  SELECT b.* INTO v_body_prior
  FROM public.health_body_rolling_states b
  WHERE b.athlete_id=p_athlete_id AND b.window_days=28 AND b.as_of_date=v_prior_end
  LIMIT 1;
  v_has_body_prior := FOUND;

  v_body_snapshot := pg_catalog.jsonb_build_object(
    'status',CASE WHEN v_has_body_current AND v_has_body_prior THEN 'available' ELSE 'unavailable' END,
    'current',CASE WHEN v_has_body_current THEN pg_catalog.jsonb_build_object(
      'id',v_body_current.id,
      'weight_observation_count',v_body_current.weight_observation_count,
      'weight_latest_kg',v_body_current.weight_latest_kg,
      'weight_change_kg',v_body_current.weight_change_kg,
      'weight_trend_kg_per_week',v_body_current.weight_trend_kg_per_week,
      'waist_observation_count',v_body_current.waist_observation_count,
      'waist_latest_cm',v_body_current.waist_latest_cm,
      'waist_change_cm',v_body_current.waist_change_cm,
      'body_fat_observation_count',v_body_current.body_fat_observation_count,
      'body_fat_latest_pct',v_body_current.body_fat_latest_pct,
      'body_fat_change_pct',v_body_current.body_fat_change_pct,
      'coverage_status',v_body_current.coverage_status,
      'confidence',v_body_current.confidence,
      'reason_codes',v_body_current.reason_codes,
      'algorithm_version',v_body_current.algorithm_version
    ) ELSE NULL END,
    'prior',CASE WHEN v_has_body_prior THEN pg_catalog.jsonb_build_object(
      'id',v_body_prior.id,
      'weight_observation_count',v_body_prior.weight_observation_count,
      'weight_latest_kg',v_body_prior.weight_latest_kg,
      'weight_change_kg',v_body_prior.weight_change_kg,
      'weight_trend_kg_per_week',v_body_prior.weight_trend_kg_per_week,
      'waist_observation_count',v_body_prior.waist_observation_count,
      'waist_latest_cm',v_body_prior.waist_latest_cm,
      'waist_change_cm',v_body_prior.waist_change_cm,
      'body_fat_observation_count',v_body_prior.body_fat_observation_count,
      'body_fat_latest_pct',v_body_prior.body_fat_latest_pct,
      'body_fat_change_pct',v_body_prior.body_fat_change_pct,
      'coverage_status',v_body_prior.coverage_status,
      'confidence',v_body_prior.confidence,
      'reason_codes',v_body_prior.reason_codes,
      'algorithm_version',v_body_prior.algorithm_version
    ) ELSE NULL END,
    'delta',CASE WHEN v_has_body_current AND v_has_body_prior THEN pg_catalog.jsonb_build_object(
      'weight_latest_kg',CASE WHEN v_body_current.weight_latest_kg IS NOT NULL AND v_body_prior.weight_latest_kg IS NOT NULL THEN v_body_current.weight_latest_kg-v_body_prior.weight_latest_kg ELSE NULL END,
      'waist_latest_cm',CASE WHEN v_body_current.waist_latest_cm IS NOT NULL AND v_body_prior.waist_latest_cm IS NOT NULL THEN v_body_current.waist_latest_cm-v_body_prior.waist_latest_cm ELSE NULL END,
      'body_fat_latest_pct',CASE WHEN v_body_current.body_fat_latest_pct IS NOT NULL AND v_body_prior.body_fat_latest_pct IS NOT NULL THEN v_body_current.body_fat_latest_pct-v_body_prior.body_fat_latest_pct ELSE NULL END
    ) ELSE NULL END
  );

  IF v_has_body_current AND v_has_body_prior THEN
    v_available := pg_catalog.array_append(v_available,'body');
    v_reasons := pg_catalog.array_append(v_reasons,'BODY_COMPARISON_AVAILABLE');
    IF v_body_current.coverage_status IN ('unobserved','sparse') THEN v_reasons := pg_catalog.array_append(v_reasons,'BODY_CURRENT_COVERAGE_LOW'); END IF;
    IF v_body_prior.coverage_status IN ('unobserved','sparse') THEN v_reasons := pg_catalog.array_append(v_reasons,'BODY_PRIOR_COVERAGE_LOW'); END IF;
  ELSE
    v_unavailable := pg_catalog.array_append(v_unavailable,'body');
    IF NOT v_has_body_current THEN v_reasons := pg_catalog.array_append(v_reasons,'BODY_CURRENT_STATE_MISSING'); END IF;
    IF NOT v_has_body_prior THEN v_reasons := pg_catalog.array_append(v_reasons,'BODY_PRIOR_STATE_MISSING'); END IF;
  END IF;

  SELECT r.* INTO v_recovery_current
  FROM public.health_sleep_recovery_rolling_states r
  WHERE r.athlete_id=p_athlete_id AND r.window_days=28 AND r.as_of_date=v_current_end
  LIMIT 1;
  v_has_recovery_current := FOUND;

  SELECT r.* INTO v_recovery_prior
  FROM public.health_sleep_recovery_rolling_states r
  WHERE r.athlete_id=p_athlete_id AND r.window_days=28 AND r.as_of_date=v_prior_end
  LIMIT 1;
  v_has_recovery_prior := FOUND;

  v_recovery_snapshot := pg_catalog.jsonb_build_object(
    'status',CASE WHEN v_has_recovery_current AND v_has_recovery_prior THEN 'available' ELSE 'unavailable' END,
    'current',CASE WHEN v_has_recovery_current THEN pg_catalog.jsonb_build_object(
      'id',v_recovery_current.id,
      'average_sleep_minutes',v_recovery_current.average_sleep_minutes,
      'sleep_duration_variability_minutes',v_recovery_current.sleep_duration_variability_minutes,
      'average_sleep_quality',v_recovery_current.average_sleep_quality,
      'average_recovery',v_recovery_current.average_recovery,
      'average_fatigue',v_recovery_current.average_fatigue,
      'average_readiness',v_recovery_current.average_readiness,
      'confidence',v_recovery_current.confidence,
      'reason_codes',v_recovery_current.reason_codes,
      'algorithm_version',v_recovery_current.algorithm_version
    ) ELSE NULL END,
    'prior',CASE WHEN v_has_recovery_prior THEN pg_catalog.jsonb_build_object(
      'id',v_recovery_prior.id,
      'average_sleep_minutes',v_recovery_prior.average_sleep_minutes,
      'sleep_duration_variability_minutes',v_recovery_prior.sleep_duration_variability_minutes,
      'average_sleep_quality',v_recovery_prior.average_sleep_quality,
      'average_recovery',v_recovery_prior.average_recovery,
      'average_fatigue',v_recovery_prior.average_fatigue,
      'average_readiness',v_recovery_prior.average_readiness,
      'confidence',v_recovery_prior.confidence,
      'reason_codes',v_recovery_prior.reason_codes,
      'algorithm_version',v_recovery_prior.algorithm_version
    ) ELSE NULL END,
    'delta',CASE WHEN v_has_recovery_current AND v_has_recovery_prior THEN pg_catalog.jsonb_build_object(
      'average_sleep_minutes',CASE WHEN v_recovery_current.average_sleep_minutes IS NOT NULL AND v_recovery_prior.average_sleep_minutes IS NOT NULL THEN v_recovery_current.average_sleep_minutes-v_recovery_prior.average_sleep_minutes ELSE NULL END,
      'average_sleep_quality',CASE WHEN v_recovery_current.average_sleep_quality IS NOT NULL AND v_recovery_prior.average_sleep_quality IS NOT NULL THEN v_recovery_current.average_sleep_quality-v_recovery_prior.average_sleep_quality ELSE NULL END,
      'average_recovery',CASE WHEN v_recovery_current.average_recovery IS NOT NULL AND v_recovery_prior.average_recovery IS NOT NULL THEN v_recovery_current.average_recovery-v_recovery_prior.average_recovery ELSE NULL END,
      'average_fatigue',CASE WHEN v_recovery_current.average_fatigue IS NOT NULL AND v_recovery_prior.average_fatigue IS NOT NULL THEN v_recovery_current.average_fatigue-v_recovery_prior.average_fatigue ELSE NULL END,
      'average_readiness',CASE WHEN v_recovery_current.average_readiness IS NOT NULL AND v_recovery_prior.average_readiness IS NOT NULL THEN v_recovery_current.average_readiness-v_recovery_prior.average_readiness ELSE NULL END
    ) ELSE NULL END
  );

  IF v_has_recovery_current AND v_has_recovery_prior THEN
    v_available := pg_catalog.array_append(v_available,'recovery');
    v_reasons := pg_catalog.array_append(v_reasons,'RECOVERY_COMPARISON_AVAILABLE');
    IF (
      v_recovery_current.recovery_coverage IN ('unobserved','sparse')
      AND v_recovery_current.fatigue_coverage IN ('unobserved','sparse')
      AND v_recovery_current.readiness_coverage IN ('unobserved','sparse')
    ) THEN v_reasons := pg_catalog.array_append(v_reasons,'RECOVERY_CURRENT_COVERAGE_LOW'); END IF;
    IF (
      v_recovery_prior.recovery_coverage IN ('unobserved','sparse')
      AND v_recovery_prior.fatigue_coverage IN ('unobserved','sparse')
      AND v_recovery_prior.readiness_coverage IN ('unobserved','sparse')
    ) THEN v_reasons := pg_catalog.array_append(v_reasons,'RECOVERY_PRIOR_COVERAGE_LOW'); END IF;
  ELSE
    v_unavailable := pg_catalog.array_append(v_unavailable,'recovery');
    IF NOT v_has_recovery_current THEN v_reasons := pg_catalog.array_append(v_reasons,'RECOVERY_CURRENT_STATE_MISSING'); END IF;
    IF NOT v_has_recovery_prior THEN v_reasons := pg_catalog.array_append(v_reasons,'RECOVERY_PRIOR_STATE_MISSING'); END IF;
  END IF;

  SELECT pg_catalog.jsonb_build_object(
    'id',r.id,
    'as_of_date',r.as_of_date,
    'window_days',r.window_days,
    'run_status',r.run_status,
    'algorithm_version',r.algorithm_version,
    'decisions',COALESCE((
      SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'decision_scope',d.decision_scope,
        'decision_status',d.decision_status,
        'decision_code',d.decision_code,
        'target_domain',d.target_domain,
        'confidence',d.confidence,
        'reason_codes',d.reason_codes
      ) ORDER BY d.decision_scope)
      FROM public.health_integrated_decisions d
      WHERE d.run_id=r.id AND d.athlete_id=r.athlete_id
    ),'[]'::jsonb)
  )
  INTO v_f11_current
  FROM public.health_integrated_decision_runs r
  WHERE r.athlete_id=p_athlete_id
    AND r.as_of_date BETWEEN v_current_start AND v_current_end
    AND r.record_status='current'
  ORDER BY r.as_of_date DESC,r.created_at DESC
  LIMIT 1;

  SELECT pg_catalog.jsonb_build_object(
    'id',r.id,
    'as_of_date',r.as_of_date,
    'window_days',r.window_days,
    'run_status',r.run_status,
    'algorithm_version',r.algorithm_version,
    'decisions',COALESCE((
      SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'decision_scope',d.decision_scope,
        'decision_status',d.decision_status,
        'decision_code',d.decision_code,
        'target_domain',d.target_domain,
        'confidence',d.confidence,
        'reason_codes',d.reason_codes
      ) ORDER BY d.decision_scope)
      FROM public.health_integrated_decisions d
      WHERE d.run_id=r.id AND d.athlete_id=r.athlete_id
    ),'[]'::jsonb)
  )
  INTO v_f11_prior
  FROM public.health_integrated_decision_runs r
  WHERE r.athlete_id=p_athlete_id
    AND r.as_of_date BETWEEN v_prior_start AND v_prior_end
    AND r.record_status='current'
  ORDER BY r.as_of_date DESC,r.created_at DESC
  LIMIT 1;

  v_f11_current := COALESCE(v_f11_current,'null'::jsonb);
  v_f11_prior := COALESCE(v_f11_prior,'null'::jsonb);

  IF pg_catalog.cardinality(v_available)=0 THEN
    v_run_status := 'paused';
    v_reasons := pg_catalog.array_append(v_reasons,'NO_COMPARABLE_DOMAINS');
  ELSE
    v_run_status := 'available';
    v_reasons := pg_catalog.array_append(v_reasons,'LONGITUDINAL_COMPARISON_AVAILABLE');
    IF pg_catalog.cardinality(v_available)<4 THEN
      v_reasons := pg_catalog.array_append(v_reasons,'PARTIAL_LONGITUDINAL_COVERAGE');
    END IF;
  END IF;

  v_reasons := pg_catalog.array_append(v_reasons,'CLINICAL_COMPARISON_EXCLUDED_V1');
  v_reasons := pg_catalog.array_append(v_reasons,'NO_AUTOMATIC_REPLANNING_V1');
  v_reasons := pg_catalog.array_append(v_reasons,'NO_CAUSAL_INFERENCE_V1');
  v_reasons := pg_catalog.array_append(v_reasons,'HUMAN_OUTCOME_REQUIRED_V1');

  v_snapshot := pg_catalog.jsonb_build_object(
    'periods',pg_catalog.jsonb_build_object(
      'current',pg_catalog.jsonb_build_object('start_date',v_current_start,'end_date',v_current_end),
      'prior',pg_catalog.jsonb_build_object('start_date',v_prior_start,'end_date',v_prior_end)
    ),
    'goal_context',v_goal,
    'phase_context',v_phase,
    'training',v_training_snapshot,
    'nutrition',v_nutrition_snapshot,
    'body',v_body_snapshot,
    'recovery',v_recovery_snapshot,
    'integrated_decision_context',pg_catalog.jsonb_build_object(
      'current_period',v_f11_current,
      'prior_period',v_f11_prior
    ),
    'clinical_comparison_policy','excluded_v1',
    'automatic_replanning',false,
    'causal_inference',false
  );

  v_fingerprint := pg_catalog.md5(
    v_snapshot::text || '|' || v_parameter_set::text || '|' || v_algorithm_version
  );

  SELECT r.id,r.input_fingerprint
  INTO v_current_run_id,v_current_fingerprint
  FROM public.health_longitudinal_review_runs r
  WHERE r.athlete_id=p_athlete_id
    AND r.as_of_date=p_as_of_date
    AND r.window_days=28
    AND r.algorithm_version=v_algorithm_version
    AND r.record_status='current'
  FOR UPDATE;

  IF v_current_run_id IS NOT NULL AND v_current_fingerprint=v_fingerprint THEN
    RETURN v_current_run_id;
  END IF;

  IF v_current_run_id IS NOT NULL THEN
    UPDATE public.health_longitudinal_review_runs
    SET record_status='superseded'
    WHERE id=v_current_run_id
      AND athlete_id=p_athlete_id
      AND record_status='current';
    v_previous_id := v_current_run_id;
  END IF;

  INSERT INTO public.health_longitudinal_review_runs (
    athlete_id,as_of_date,window_days,
    current_start_date,current_end_date,prior_start_date,prior_end_date,
    run_status,available_domains,unavailable_domains,reason_codes,
    algorithm_version,parameter_set,evidence_snapshot,input_fingerprint,
    record_status,supersedes_run_id
  ) VALUES (
    p_athlete_id,p_as_of_date,28,
    v_current_start,v_current_end,v_prior_start,v_prior_end,
    v_run_status,v_available,v_unavailable,v_reasons,
    v_algorithm_version,v_parameter_set,v_snapshot,v_fingerprint,
    'current',v_previous_id
  )
  RETURNING id INTO v_run_id;

  RETURN v_run_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_f13_record_review_outcome(
  p_review_run_id uuid,
  p_outcome_code text,
  p_target_domains text[] DEFAULT '{}'::text[],
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_run public.health_longitudinal_review_runs%ROWTYPE;
  v_targets text[];
  v_notes text;
  v_current public.health_longitudinal_review_outcomes%ROWTYPE;
  v_outcome_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT r.*
  INTO v_run
  FROM public.health_longitudinal_review_runs r
  WHERE r.id=p_review_run_id;

  IF v_run.id IS NULL THEN
    RAISE EXCEPTION 'review run not found';
  END IF;

  IF NOT public.health_can_write_athlete(v_run.athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF p_outcome_code NOT IN (
    'continue_observation','review_goal','review_training','review_nutrition',
    'review_recovery','review_multiple','insufficient_data'
  ) THEN
    RAISE EXCEPTION 'invalid outcome code';
  END IF;

  SELECT COALESCE(pg_catalog.array_agg(x ORDER BY x),'{}'::text[])
  INTO v_targets
  FROM (
    SELECT DISTINCT d AS x
    FROM pg_catalog.unnest(COALESCE(p_target_domains,'{}'::text[])) AS d
  ) q;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.unnest(v_targets) d
    WHERE d NOT IN ('goal','training','nutrition','body','recovery')
  ) THEN
    RAISE EXCEPTION 'invalid target domain';
  END IF;

  IF p_outcome_code='continue_observation' AND pg_catalog.cardinality(v_targets)<>0 THEN
    RAISE EXCEPTION 'continue_observation requires no target domains';
  ELSIF p_outcome_code='review_goal' AND NOT ('goal'=ANY(v_targets)) THEN
    RAISE EXCEPTION 'review_goal requires goal target';
  ELSIF p_outcome_code='review_training' AND NOT ('training'=ANY(v_targets)) THEN
    RAISE EXCEPTION 'review_training requires training target';
  ELSIF p_outcome_code='review_nutrition' AND NOT ('nutrition'=ANY(v_targets)) THEN
    RAISE EXCEPTION 'review_nutrition requires nutrition target';
  ELSIF p_outcome_code='review_recovery' AND NOT ('recovery'=ANY(v_targets)) THEN
    RAISE EXCEPTION 'review_recovery requires recovery target';
  ELSIF p_outcome_code='review_multiple' AND pg_catalog.cardinality(v_targets)<2 THEN
    RAISE EXCEPTION 'review_multiple requires at least two target domains';
  END IF;

  v_notes := NULLIF(btrim(COALESCE(p_notes,'')),'');

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_review_run_id::text || '|F13_OUTCOME',0)
  );

  SELECT o.*
  INTO v_current
  FROM public.health_longitudinal_review_outcomes o
  WHERE o.review_run_id=p_review_run_id
    AND o.record_status='current'
  FOR UPDATE;

  IF v_current.id IS NOT NULL
    AND v_current.outcome_code=p_outcome_code
    AND v_current.target_domains=v_targets
    AND COALESCE(v_current.notes,'')=COALESCE(v_notes,'')
  THEN
    RETURN v_current.id;
  END IF;

  IF v_current.id IS NOT NULL THEN
    UPDATE public.health_longitudinal_review_outcomes
    SET record_status='superseded'
    WHERE id=v_current.id
      AND record_status='current';
  END IF;

  INSERT INTO public.health_longitudinal_review_outcomes (
    athlete_id,review_run_id,outcome_code,target_domains,notes,
    record_status,supersedes_outcome_id,reviewed_by_auth_user_id
  ) VALUES (
    v_run.athlete_id,p_review_run_id,p_outcome_code,v_targets,v_notes,
    'current',v_current.id,auth.uid()
  )
  RETURNING id INTO v_outcome_id;

  RETURN v_outcome_id;
END;
$$;
