-- M8 Health — Body assessment and rolling state RPCs.

CREATE OR REPLACE FUNCTION public.health_m8_record_body_assessment(
  p_athlete_id uuid,
  p_observed_at timestamptz,
  p_observed_on date,
  p_client_event_id uuid,
  p_measurements jsonb,
  p_conditions jsonb DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_data_source text DEFAULT 'MEASURED',
  p_confidence text DEFAULT 'high',
  p_supersedes_assessment_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_id uuid;
  v_previous_status text;
  v_assessment_id uuid;
BEGIN
  IF NOT public.health_can_write_athlete(p_athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF p_observed_at IS NULL OR p_observed_on IS NULL THEN
    RAISE EXCEPTION 'observed_at and observed_on are required';
  END IF;

  IF p_measurements IS NULL
     OR jsonb_typeof(p_measurements) <> 'array'
     OR jsonb_array_length(p_measurements) = 0 THEN
    RAISE EXCEPTION 'measurements must be a non-empty JSON array';
  END IF;

  IF p_client_event_id IS NOT NULL THEN
    SELECT a.id
    INTO v_existing_id
    FROM public.health_body_assessments a
    WHERE a.athlete_id=p_athlete_id
      AND a.client_event_id=p_client_event_id;

    IF v_existing_id IS NOT NULL THEN
      RETURN v_existing_id;
    END IF;
  END IF;

  IF p_supersedes_assessment_id IS NOT NULL THEN
    SELECT a.status
    INTO v_previous_status
    FROM public.health_body_assessments a
    WHERE a.id=p_supersedes_assessment_id
      AND a.athlete_id=p_athlete_id
    FOR UPDATE;

    IF v_previous_status IS NULL THEN
      RAISE EXCEPTION 'assessment to supersede not found';
    END IF;

    IF v_previous_status <> 'active' THEN
      RAISE EXCEPTION 'only an active assessment can be superseded';
    END IF;
  END IF;

  INSERT INTO public.health_body_assessments (
    athlete_id,
    observed_at,
    observed_on,
    data_source,
    confidence,
    conditions,
    notes,
    status,
    supersedes_assessment_id,
    client_event_id
  ) VALUES (
    p_athlete_id,
    p_observed_at,
    p_observed_on,
    p_data_source,
    p_confidence,
    p_conditions,
    NULLIF(btrim(p_notes),''),
    'active',
    p_supersedes_assessment_id,
    p_client_event_id
  )
  RETURNING id INTO v_assessment_id;

  INSERT INTO public.health_body_measurements (
    assessment_id,
    athlete_id,
    metric_code,
    value,
    unit_code,
    method,
    confidence,
    notes
  )
  SELECT
    v_assessment_id,
    p_athlete_id,
    m.metric_code,
    m.value,
    m.unit_code,
    COALESCE(NULLIF(btrim(m.method),''),'other'),
    COALESCE(NULLIF(btrim(m.confidence),''),p_confidence),
    NULLIF(btrim(m.notes),'')
  FROM jsonb_to_recordset(p_measurements) AS m(
    metric_code text,
    value numeric,
    unit_code text,
    method text,
    confidence text,
    notes text
  );

  IF p_supersedes_assessment_id IS NOT NULL THEN
    UPDATE public.health_body_assessments
    SET status='superseded',
        status_changed_at=now()
    WHERE id=p_supersedes_assessment_id
      AND athlete_id=p_athlete_id;
  END IF;

  RETURN v_assessment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m8_void_body_assessment(
  p_assessment_id uuid,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_athlete_id uuid;
  v_status text;
BEGIN
  SELECT a.athlete_id,a.status
  INTO v_athlete_id,v_status
  FROM public.health_body_assessments a
  WHERE a.id=p_assessment_id
  FOR UPDATE;

  IF v_athlete_id IS NULL THEN
    RAISE EXCEPTION 'body assessment not found';
  END IF;

  IF NOT public.health_can_write_athlete(v_athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'only an active assessment can be voided';
  END IF;

  IF NULLIF(btrim(p_reason),'') IS NULL THEN
    RAISE EXCEPTION 'void reason is required';
  END IF;

  UPDATE public.health_body_assessments
  SET status='voided',
      void_reason=btrim(p_reason),
      status_changed_at=now()
  WHERE id=p_assessment_id;

  RETURN p_assessment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m8_refresh_body_state(
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
  v_window_start date;
  v_required_weight_days integer;

  v_weight_count integer := 0;
  v_weight_method_count integer := 0;
  v_weight_first numeric;
  v_weight_latest numeric;
  v_weight_trend numeric;

  v_waist_count integer := 0;
  v_waist_first numeric;
  v_waist_latest numeric;

  v_body_fat_count integer := 0;
  v_body_fat_first numeric;
  v_body_fat_latest numeric;

  v_photo_set_count integer := 0;
  v_height_cm numeric;

  v_coverage_status text;
  v_confidence text;
  v_reasons text[] := '{}'::text[];
  v_state_id uuid;
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

  v_window_start := p_as_of_date - (p_window_days - 1);
  v_required_weight_days := CEIL(p_window_days * 0.70)::integer;

  WITH daily_weight AS (
    SELECT DISTINCT ON (a.observed_on)
      a.observed_on,
      a.observed_at,
      m.value,
      m.method
    FROM public.health_body_assessments a
    JOIN public.health_body_measurements m
      ON m.assessment_id=a.id
     AND m.athlete_id=a.athlete_id
    WHERE a.athlete_id=p_athlete_id
      AND a.status='active'
      AND a.observed_on BETWEEN v_window_start AND p_as_of_date
      AND m.metric_code='weight_kg'
    ORDER BY a.observed_on,a.observed_at DESC,a.created_at DESC
  )
  SELECT
    COUNT(*)::integer,
    COUNT(DISTINCT method)::integer,
    (array_agg(value ORDER BY observed_on,observed_at))[1],
    (array_agg(value ORDER BY observed_on DESC,observed_at DESC))[1],
    CASE
      WHEN COUNT(*) >= 2 THEN
        regr_slope(
          value::double precision,
          ((observed_on - date '2000-01-01')::double precision / 7.0)
        )::numeric
      ELSE NULL
    END
  INTO
    v_weight_count,
    v_weight_method_count,
    v_weight_first,
    v_weight_latest,
    v_weight_trend
  FROM daily_weight;

  WITH daily_waist AS (
    SELECT DISTINCT ON (a.observed_on)
      a.observed_on,
      a.observed_at,
      m.value
    FROM public.health_body_assessments a
    JOIN public.health_body_measurements m
      ON m.assessment_id=a.id
     AND m.athlete_id=a.athlete_id
    WHERE a.athlete_id=p_athlete_id
      AND a.status='active'
      AND a.observed_on BETWEEN v_window_start AND p_as_of_date
      AND m.metric_code='waist_cm'
    ORDER BY a.observed_on,a.observed_at DESC,a.created_at DESC
  )
  SELECT
    COUNT(*)::integer,
    (array_agg(value ORDER BY observed_on,observed_at))[1],
    (array_agg(value ORDER BY observed_on DESC,observed_at DESC))[1]
  INTO v_waist_count,v_waist_first,v_waist_latest
  FROM daily_waist;

  WITH daily_body_fat AS (
    SELECT DISTINCT ON (a.observed_on)
      a.observed_on,
      a.observed_at,
      m.value
    FROM public.health_body_assessments a
    JOIN public.health_body_measurements m
      ON m.assessment_id=a.id
     AND m.athlete_id=a.athlete_id
    WHERE a.athlete_id=p_athlete_id
      AND a.status='active'
      AND a.observed_on BETWEEN v_window_start AND p_as_of_date
      AND m.metric_code='body_fat_pct'
    ORDER BY a.observed_on,a.observed_at DESC,a.created_at DESC
  )
  SELECT
    COUNT(*)::integer,
    (array_agg(value ORDER BY observed_on,observed_at))[1],
    (array_agg(value ORDER BY observed_on DESC,observed_at DESC))[1]
  INTO v_body_fat_count,v_body_fat_first,v_body_fat_latest
  FROM daily_body_fat;

  SELECT COUNT(*)::integer
  INTO v_photo_set_count
  FROM public.health_body_photo_sets s
  WHERE s.athlete_id=p_athlete_id
    AND s.status='active'
    AND s.captured_on BETWEEN v_window_start AND p_as_of_date;

  SELECT p.height_cm
  INTO v_height_cm
  FROM public.health_athlete_profiles p
  WHERE p.athlete_id=p_athlete_id;

  IF v_weight_count=0 AND v_waist_count=0 AND v_body_fat_count=0 AND v_photo_set_count=0 THEN
    v_coverage_status := 'unobserved';
    v_confidence := 'low';
    v_reasons := array_append(v_reasons,'NO_BODY_DATA');
  ELSIF v_weight_count < 2 THEN
    v_coverage_status := 'sparse';
    v_confidence := 'low';
    IF v_weight_count=0 THEN
      v_reasons := array_append(v_reasons,'NO_WEIGHT_OBSERVATIONS');
    ELSE
      v_reasons := array_append(v_reasons,'INSUFFICIENT_WEIGHT_OBSERVATIONS');
    END IF;
  ELSIF v_weight_count >= v_required_weight_days THEN
    v_coverage_status := 'complete';
    v_confidence := CASE WHEN v_weight_method_count <= 1 THEN 'high' ELSE 'moderate' END;
  ELSE
    v_coverage_status := 'partial';
    v_confidence := 'moderate';
    v_reasons := array_append(v_reasons,'PARTIAL_WEIGHT_COVERAGE');
  END IF;

  IF v_weight_method_count > 1 THEN
    v_reasons := array_append(v_reasons,'MIXED_WEIGHT_METHODS');
  END IF;

  IF v_waist_count=0 THEN
    v_reasons := array_append(v_reasons,'NO_WAIST_OBSERVATIONS');
  END IF;

  IF v_photo_set_count=0 THEN
    v_reasons := array_append(v_reasons,'NO_PHOTO_SETS_IN_WINDOW');
  END IF;

  IF v_height_cm IS NULL OR v_weight_latest IS NULL THEN
    v_reasons := array_append(v_reasons,'BMI_NOT_AVAILABLE');
  END IF;

  INSERT INTO public.health_body_rolling_states (
    athlete_id,
    as_of_date,
    window_days,
    window_start_date,
    weight_observation_count,
    weight_method_count,
    weight_first_kg,
    weight_latest_kg,
    weight_change_kg,
    weight_trend_kg_per_week,
    waist_observation_count,
    waist_first_cm,
    waist_latest_cm,
    waist_change_cm,
    body_fat_observation_count,
    body_fat_first_pct,
    body_fat_latest_pct,
    body_fat_change_pct,
    photo_set_count,
    latest_bmi,
    coverage_status,
    confidence,
    reason_codes,
    algorithm_version,
    computed_at
  ) VALUES (
    p_athlete_id,
    p_as_of_date,
    p_window_days,
    v_window_start,
    v_weight_count,
    v_weight_method_count,
    v_weight_first,
    v_weight_latest,
    CASE WHEN v_weight_count >= 2 THEN v_weight_latest-v_weight_first ELSE NULL END,
    CASE WHEN v_weight_count >= 2 THEN v_weight_trend ELSE NULL END,
    v_waist_count,
    v_waist_first,
    v_waist_latest,
    CASE WHEN v_waist_count >= 2 THEN v_waist_latest-v_waist_first ELSE NULL END,
    v_body_fat_count,
    v_body_fat_first,
    v_body_fat_latest,
    CASE WHEN v_body_fat_count >= 2 THEN v_body_fat_latest-v_body_fat_first ELSE NULL END,
    v_photo_set_count,
    CASE
      WHEN v_height_cm IS NOT NULL AND v_height_cm > 0 AND v_weight_latest IS NOT NULL
      THEN v_weight_latest / power(v_height_cm/100.0,2)
      ELSE NULL
    END,
    v_coverage_status,
    v_confidence,
    v_reasons,
    'M8_BODY_STATE_V1',
    now()
  )
  ON CONFLICT (athlete_id,as_of_date,window_days)
  DO UPDATE SET
    window_start_date=EXCLUDED.window_start_date,
    weight_observation_count=EXCLUDED.weight_observation_count,
    weight_method_count=EXCLUDED.weight_method_count,
    weight_first_kg=EXCLUDED.weight_first_kg,
    weight_latest_kg=EXCLUDED.weight_latest_kg,
    weight_change_kg=EXCLUDED.weight_change_kg,
    weight_trend_kg_per_week=EXCLUDED.weight_trend_kg_per_week,
    waist_observation_count=EXCLUDED.waist_observation_count,
    waist_first_cm=EXCLUDED.waist_first_cm,
    waist_latest_cm=EXCLUDED.waist_latest_cm,
    waist_change_cm=EXCLUDED.waist_change_cm,
    body_fat_observation_count=EXCLUDED.body_fat_observation_count,
    body_fat_first_pct=EXCLUDED.body_fat_first_pct,
    body_fat_latest_pct=EXCLUDED.body_fat_latest_pct,
    body_fat_change_pct=EXCLUDED.body_fat_change_pct,
    photo_set_count=EXCLUDED.photo_set_count,
    latest_bmi=EXCLUDED.latest_bmi,
    coverage_status=EXCLUDED.coverage_status,
    confidence=EXCLUDED.confidence,
    reason_codes=EXCLUDED.reason_codes,
    algorithm_version=EXCLUDED.algorithm_version,
    computed_at=EXCLUDED.computed_at
  RETURNING id INTO v_state_id;

  RETURN v_state_id;
END;
$$;
