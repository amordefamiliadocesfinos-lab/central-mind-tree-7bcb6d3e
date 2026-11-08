-- M9A Health — Sleep & Recovery RPCs.
-- Writes are RPC-only and preserve unknown != zero.

CREATE OR REPLACE FUNCTION public.health_m9_record_sleep_period(
  p_athlete_id uuid,
  p_sleep_date date,
  p_period_type text DEFAULT 'nocturnal',
  p_bed_at timestamptz DEFAULT NULL,
  p_sleep_start_at timestamptz DEFAULT NULL,
  p_final_wake_at timestamptz DEFAULT NULL,
  p_out_of_bed_at timestamptz DEFAULT NULL,
  p_declared_sleep_minutes integer DEFAULT NULL,
  p_awakenings_count integer DEFAULT NULL,
  p_awake_during_period_minutes integer DEFAULT NULL,
  p_timezone text DEFAULT NULL,
  p_data_source text DEFAULT 'USER_REPORTED',
  p_confidence text DEFAULT 'moderate',
  p_notes text DEFAULT NULL,
  p_client_event_id uuid DEFAULT NULL,
  p_supersedes_sleep_period_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing_id uuid;
  v_previous_status text;
  v_period_id uuid;
  v_time_in_bed integer;
  v_calculated_sleep integer;
  v_end_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.health_can_write_athlete(p_athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF p_sleep_date IS NULL THEN
    RAISE EXCEPTION 'sleep_date is required';
  END IF;

  IF p_client_event_id IS NOT NULL THEN
    SELECT s.id INTO v_existing_id
    FROM public.health_sleep_periods s
    WHERE s.athlete_id=p_athlete_id AND s.client_event_id=p_client_event_id;
    IF v_existing_id IS NOT NULL THEN RETURN v_existing_id; END IF;
  END IF;

  IF p_supersedes_sleep_period_id IS NOT NULL THEN
    SELECT s.status INTO v_previous_status
    FROM public.health_sleep_periods s
    WHERE s.id=p_supersedes_sleep_period_id AND s.athlete_id=p_athlete_id
    FOR UPDATE;
    IF v_previous_status IS NULL THEN RAISE EXCEPTION 'sleep period to supersede not found'; END IF;
    IF v_previous_status <> 'active' THEN RAISE EXCEPTION 'sleep period to supersede is not active'; END IF;
  END IF;

  v_end_at := COALESCE(p_out_of_bed_at, p_final_wake_at);
  IF p_bed_at IS NOT NULL AND v_end_at IS NOT NULL AND v_end_at >= p_bed_at THEN
    v_time_in_bed := round(extract(epoch FROM (v_end_at-p_bed_at))/60.0)::integer;
  END IF;

  IF p_sleep_start_at IS NOT NULL AND p_final_wake_at IS NOT NULL AND p_final_wake_at >= p_sleep_start_at THEN
    v_calculated_sleep := GREATEST(
      0,
      round(extract(epoch FROM (p_final_wake_at-p_sleep_start_at))/60.0)::integer
      - COALESCE(p_awake_during_period_minutes,0)
    );
  END IF;

  INSERT INTO public.health_sleep_periods (
    athlete_id,sleep_date,period_type,bed_at,sleep_start_at,final_wake_at,out_of_bed_at,
    declared_sleep_minutes,calculated_time_in_bed_minutes,calculated_sleep_minutes,
    awakenings_count,awake_during_period_minutes,timezone,data_source,confidence,notes,
    status,supersedes_sleep_period_id,client_event_id
  ) VALUES (
    p_athlete_id,p_sleep_date,p_period_type,p_bed_at,p_sleep_start_at,p_final_wake_at,p_out_of_bed_at,
    p_declared_sleep_minutes,v_time_in_bed,v_calculated_sleep,
    p_awakenings_count,p_awake_during_period_minutes,NULLIF(btrim(p_timezone),''),p_data_source,p_confidence,
    NULLIF(btrim(p_notes),''),'active',p_supersedes_sleep_period_id,p_client_event_id
  ) RETURNING id INTO v_period_id;

  IF p_supersedes_sleep_period_id IS NOT NULL THEN
    UPDATE public.health_sleep_periods
    SET status='superseded', status_changed_at=now()
    WHERE id=p_supersedes_sleep_period_id AND athlete_id=p_athlete_id AND status='active';
  END IF;

  RETURN v_period_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m9_void_sleep_period(
  p_sleep_period_id uuid,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_athlete_id uuid;
  v_status text;
BEGIN
  SELECT s.athlete_id,s.status INTO v_athlete_id,v_status
  FROM public.health_sleep_periods s WHERE s.id=p_sleep_period_id FOR UPDATE;
  IF v_athlete_id IS NULL THEN RAISE EXCEPTION 'sleep period not found'; END IF;
  IF auth.uid() IS NULL OR NOT public.health_can_write_athlete(v_athlete_id) THEN RAISE EXCEPTION 'not authorized for athlete'; END IF;
  IF v_status <> 'active' THEN RETURN p_sleep_period_id; END IF;
  IF NULLIF(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'void reason is required'; END IF;
  UPDATE public.health_sleep_periods
  SET status='voided',void_reason=btrim(p_reason),status_changed_at=now()
  WHERE id=p_sleep_period_id;
  RETURN p_sleep_period_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m9_record_recovery_checkin(
  p_athlete_id uuid,
  p_checkin_event_id uuid,
  p_observed_at timestamptz,
  p_observed_on date,
  p_metric_code text,
  p_value_ordinal smallint DEFAULT NULL,
  p_raw_text text DEFAULT NULL,
  p_data_source text DEFAULT 'USER_REPORTED',
  p_confidence text DEFAULT 'moderate',
  p_client_event_id uuid DEFAULT NULL,
  p_supersedes_checkin_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing_id uuid;
  v_previous_metric text;
  v_previous_status text;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.health_can_write_athlete(p_athlete_id) THEN RAISE EXCEPTION 'not authorized for athlete'; END IF;
  IF p_checkin_event_id IS NULL OR p_observed_at IS NULL OR p_observed_on IS NULL THEN RAISE EXCEPTION 'checkin_event_id, observed_at, and observed_on are required'; END IF;
  IF p_value_ordinal IS NULL AND NULLIF(btrim(p_raw_text),'') IS NULL THEN RAISE EXCEPTION 'ordinal value or raw text is required'; END IF;

  SELECT c.id INTO v_existing_id
  FROM public.health_recovery_checkins c
  WHERE c.athlete_id=p_athlete_id AND c.checkin_event_id=p_checkin_event_id AND c.metric_code=p_metric_code;
  IF v_existing_id IS NOT NULL THEN RETURN v_existing_id; END IF;

  IF p_client_event_id IS NOT NULL THEN
    SELECT c.id INTO v_existing_id
    FROM public.health_recovery_checkins c
    WHERE c.athlete_id=p_athlete_id AND c.client_event_id=p_client_event_id;
    IF v_existing_id IS NOT NULL THEN RETURN v_existing_id; END IF;
  END IF;

  IF p_supersedes_checkin_id IS NOT NULL THEN
    SELECT c.metric_code,c.status INTO v_previous_metric,v_previous_status
    FROM public.health_recovery_checkins c
    WHERE c.id=p_supersedes_checkin_id AND c.athlete_id=p_athlete_id FOR UPDATE;
    IF v_previous_status IS NULL THEN RAISE EXCEPTION 'checkin to supersede not found'; END IF;
    IF v_previous_status <> 'active' OR v_previous_metric <> p_metric_code THEN RAISE EXCEPTION 'checkin supersession is not compatible'; END IF;
  END IF;

  INSERT INTO public.health_recovery_checkins (
    athlete_id,checkin_event_id,observed_at,observed_on,metric_code,value_ordinal,raw_text,
    scale_version,data_source,confidence,status,supersedes_checkin_id,client_event_id
  ) VALUES (
    p_athlete_id,p_checkin_event_id,p_observed_at,p_observed_on,p_metric_code,p_value_ordinal,
    NULLIF(btrim(p_raw_text),''),'M9_RECOVERY_ORDINAL_V1',p_data_source,p_confidence,'active',
    p_supersedes_checkin_id,p_client_event_id
  ) RETURNING id INTO v_id;

  IF p_supersedes_checkin_id IS NOT NULL THEN
    UPDATE public.health_recovery_checkins
    SET status='superseded',status_changed_at=now()
    WHERE id=p_supersedes_checkin_id AND athlete_id=p_athlete_id AND status='active';
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m9_void_recovery_checkin(
  p_checkin_id uuid,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_athlete_id uuid;
  v_status text;
BEGIN
  SELECT c.athlete_id,c.status INTO v_athlete_id,v_status
  FROM public.health_recovery_checkins c WHERE c.id=p_checkin_id FOR UPDATE;
  IF v_athlete_id IS NULL THEN RAISE EXCEPTION 'recovery checkin not found'; END IF;
  IF auth.uid() IS NULL OR NOT public.health_can_write_athlete(v_athlete_id) THEN RAISE EXCEPTION 'not authorized for athlete'; END IF;
  IF v_status <> 'active' THEN RETURN p_checkin_id; END IF;
  IF NULLIF(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'void reason is required'; END IF;
  UPDATE public.health_recovery_checkins
  SET status='voided',void_reason=btrim(p_reason),status_changed_at=now()
  WHERE id=p_checkin_id;
  RETURN p_checkin_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m9_record_device_observations(
  p_athlete_id uuid,
  p_observations jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item jsonb;
  v_inserted integer := 0;
  v_rows integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.health_can_write_athlete(p_athlete_id) THEN RAISE EXCEPTION 'not authorized for athlete'; END IF;
  IF p_observations IS NULL OR jsonb_typeof(p_observations) <> 'array' THEN RAISE EXCEPTION 'observations must be a JSON array'; END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_observations)
  LOOP
    IF NULLIF(v_item->>'observed_at','') IS NULL OR NULLIF(v_item->>'observed_on','') IS NULL
       OR NULLIF(v_item->>'metric_code','') IS NULL OR NULLIF(v_item->>'numeric_value','') IS NULL
       OR NULLIF(v_item->>'unit_code','') IS NULL OR NULLIF(v_item->>'provider','') IS NULL THEN
      RAISE EXCEPTION 'device observation missing required fields';
    END IF;

    INSERT INTO public.health_sleep_device_observations (
      athlete_id,observed_at,observed_on,window_start_at,window_end_at,metric_code,numeric_value,
      unit_code,provider,device_model,external_id,provider_algorithm_version,confidence,raw_metadata,
      client_event_id,status
    ) VALUES (
      p_athlete_id,(v_item->>'observed_at')::timestamptz,(v_item->>'observed_on')::date,
      NULLIF(v_item->>'window_start_at','')::timestamptz,NULLIF(v_item->>'window_end_at','')::timestamptz,
      v_item->>'metric_code',(v_item->>'numeric_value')::numeric,v_item->>'unit_code',v_item->>'provider',
      NULLIF(v_item->>'device_model',''),NULLIF(v_item->>'external_id',''),NULLIF(v_item->>'provider_algorithm_version',''),
      COALESCE(NULLIF(v_item->>'confidence',''),'moderate'),v_item->'raw_metadata',
      NULLIF(v_item->>'client_event_id','')::uuid,'active'
    ) ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_inserted := v_inserted + v_rows;
  END LOOP;

  RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m9_void_device_observation(
  p_observation_id uuid,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_athlete_id uuid;
  v_status text;
BEGIN
  SELECT d.athlete_id,d.status INTO v_athlete_id,v_status
  FROM public.health_sleep_device_observations d WHERE d.id=p_observation_id FOR UPDATE;
  IF v_athlete_id IS NULL THEN RAISE EXCEPTION 'device observation not found'; END IF;
  IF auth.uid() IS NULL OR NOT public.health_can_write_athlete(v_athlete_id) THEN RAISE EXCEPTION 'not authorized for athlete'; END IF;
  IF v_status <> 'active' THEN RETURN p_observation_id; END IF;
  IF NULLIF(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'void reason is required'; END IF;
  UPDATE public.health_sleep_device_observations
  SET status='voided',void_reason=btrim(p_reason),status_changed_at=now()
  WHERE id=p_observation_id;
  RETURN p_observation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m9_refresh_sleep_recovery_state(
  p_athlete_id uuid,
  p_as_of_date date,
  p_window_days integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_start date;
  v_required integer;
  v_sleep_days integer := 0;
  v_timing_days integer := 0;
  v_quality_days integer := 0;
  v_recovery_days integer := 0;
  v_fatigue_days integer := 0;
  v_readiness_days integer := 0;
  v_manual_sleep_days integer := 0;
  v_device_sleep_days integer := 0;
  v_avg_sleep numeric;
  v_sleep_var numeric;
  v_avg_quality numeric;
  v_avg_recovery numeric;
  v_avg_fatigue numeric;
  v_avg_readiness numeric;
  v_cov_sleep text;
  v_cov_timing text;
  v_cov_quality text;
  v_cov_recovery text;
  v_cov_fatigue text;
  v_cov_readiness text;
  v_confidence text := 'low';
  v_reasons text[] := '{}'::text[];
  v_state_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.health_can_write_athlete(p_athlete_id) THEN RAISE EXCEPTION 'not authorized for athlete'; END IF;
  IF p_as_of_date IS NULL OR p_window_days NOT IN (7,14,28) THEN RAISE EXCEPTION 'invalid state window'; END IF;

  v_start := p_as_of_date - (p_window_days - 1);
  v_required := CASE p_window_days WHEN 7 THEN 5 WHEN 14 THEN 10 WHEN 28 THEN 20 END;

  WITH manual_daily AS (
    SELECT s.sleep_date AS d,
           SUM(COALESCE(s.calculated_sleep_minutes,s.declared_sleep_minutes))::numeric AS minutes
    FROM public.health_sleep_periods s
    WHERE s.athlete_id=p_athlete_id AND s.status='active'
      AND s.sleep_date BETWEEN v_start AND p_as_of_date
      AND COALESCE(s.calculated_sleep_minutes,s.declared_sleep_minutes) IS NOT NULL
    GROUP BY s.sleep_date
  ), device_daily AS (
    SELECT d.observed_on AS d, MAX(d.numeric_value)::numeric AS minutes
    FROM public.health_sleep_device_observations d
    WHERE d.athlete_id=p_athlete_id AND d.status='active'
      AND d.observed_on BETWEEN v_start AND p_as_of_date
      AND d.metric_code='sleep_duration_minutes_estimated'
    GROUP BY d.observed_on
  ), combined AS (
    SELECT COALESCE(m.d,d.d) AS day, COALESCE(m.minutes,d.minutes) AS minutes
    FROM manual_daily m FULL OUTER JOIN device_daily d ON d.d=m.d
  )
  SELECT COUNT(*)::integer, AVG(minutes), STDDEV_POP(minutes)
  INTO v_sleep_days,v_avg_sleep,v_sleep_var
  FROM combined;

  SELECT COUNT(DISTINCT s.sleep_date)::integer INTO v_manual_sleep_days
  FROM public.health_sleep_periods s
  WHERE s.athlete_id=p_athlete_id AND s.status='active'
    AND s.sleep_date BETWEEN v_start AND p_as_of_date
    AND COALESCE(s.calculated_sleep_minutes,s.declared_sleep_minutes) IS NOT NULL;

  SELECT COUNT(DISTINCT d.observed_on)::integer INTO v_device_sleep_days
  FROM public.health_sleep_device_observations d
  WHERE d.athlete_id=p_athlete_id AND d.status='active'
    AND d.observed_on BETWEEN v_start AND p_as_of_date
    AND d.metric_code='sleep_duration_minutes_estimated';

  SELECT COUNT(DISTINCT s.sleep_date)::integer INTO v_timing_days
  FROM public.health_sleep_periods s
  WHERE s.athlete_id=p_athlete_id AND s.status='active' AND s.period_type='nocturnal'
    AND s.sleep_date BETWEEN v_start AND p_as_of_date
    AND s.bed_at IS NOT NULL AND s.final_wake_at IS NOT NULL;

  SELECT COUNT(DISTINCT c.observed_on)::integer, AVG(c.value_ordinal::numeric)
  INTO v_quality_days,v_avg_quality
  FROM public.health_recovery_checkins c
  WHERE c.athlete_id=p_athlete_id AND c.status='active'
    AND c.observed_on BETWEEN v_start AND p_as_of_date
    AND c.metric_code='sleep_quality' AND c.value_ordinal IS NOT NULL;

  SELECT COUNT(DISTINCT c.observed_on)::integer, AVG(c.value_ordinal::numeric)
  INTO v_recovery_days,v_avg_recovery
  FROM public.health_recovery_checkins c
  WHERE c.athlete_id=p_athlete_id AND c.status='active'
    AND c.observed_on BETWEEN v_start AND p_as_of_date
    AND c.metric_code='physical_recovery' AND c.value_ordinal IS NOT NULL;

  SELECT COUNT(DISTINCT c.observed_on)::integer, AVG(c.value_ordinal::numeric)
  INTO v_fatigue_days,v_avg_fatigue
  FROM public.health_recovery_checkins c
  WHERE c.athlete_id=p_athlete_id AND c.status='active'
    AND c.observed_on BETWEEN v_start AND p_as_of_date
    AND c.metric_code IN ('general_fatigue','muscular_fatigue','mental_fatigue')
    AND c.value_ordinal IS NOT NULL;

  SELECT COUNT(DISTINCT c.observed_on)::integer, AVG(c.value_ordinal::numeric)
  INTO v_readiness_days,v_avg_readiness
  FROM public.health_recovery_checkins c
  WHERE c.athlete_id=p_athlete_id AND c.status='active'
    AND c.observed_on BETWEEN v_start AND p_as_of_date
    AND c.metric_code='training_readiness' AND c.value_ordinal IS NOT NULL;

  v_cov_sleep := CASE WHEN v_sleep_days=0 THEN 'unobserved' WHEN v_sleep_days*100 < p_window_days*50 THEN 'sparse' WHEN v_sleep_days*100 < p_window_days*70 THEN 'partial' ELSE 'complete' END;
  v_cov_timing := CASE WHEN v_timing_days=0 THEN 'unobserved' WHEN v_timing_days*100 < p_window_days*50 THEN 'sparse' WHEN v_timing_days*100 < p_window_days*70 THEN 'partial' ELSE 'complete' END;
  v_cov_quality := CASE WHEN v_quality_days=0 THEN 'unobserved' WHEN v_quality_days*100 < p_window_days*50 THEN 'sparse' WHEN v_quality_days*100 < p_window_days*70 THEN 'partial' ELSE 'complete' END;
  v_cov_recovery := CASE WHEN v_recovery_days=0 THEN 'unobserved' WHEN v_recovery_days*100 < p_window_days*50 THEN 'sparse' WHEN v_recovery_days*100 < p_window_days*70 THEN 'partial' ELSE 'complete' END;
  v_cov_fatigue := CASE WHEN v_fatigue_days=0 THEN 'unobserved' WHEN v_fatigue_days*100 < p_window_days*50 THEN 'sparse' WHEN v_fatigue_days*100 < p_window_days*70 THEN 'partial' ELSE 'complete' END;
  v_cov_readiness := CASE WHEN v_readiness_days=0 THEN 'unobserved' WHEN v_readiness_days*100 < p_window_days*50 THEN 'sparse' WHEN v_readiness_days*100 < p_window_days*70 THEN 'partial' ELSE 'complete' END;

  IF 'unobserved'=ANY(ARRAY[v_cov_sleep,v_cov_timing,v_cov_quality,v_cov_recovery,v_cov_fatigue,v_cov_readiness])
     OR 'sparse'=ANY(ARRAY[v_cov_sleep,v_cov_timing,v_cov_quality,v_cov_recovery,v_cov_fatigue,v_cov_readiness]) THEN
    v_confidence := 'low';
  ELSIF 'partial'=ANY(ARRAY[v_cov_sleep,v_cov_timing,v_cov_quality,v_cov_recovery,v_cov_fatigue,v_cov_readiness]) THEN
    v_confidence := 'moderate';
  ELSE
    v_confidence := 'high';
  END IF;

  IF v_sleep_days=0 THEN v_reasons := array_append(v_reasons,'NO_SLEEP_DATA');
  ELSIF v_sleep_days < v_required THEN v_reasons := array_append(v_reasons,'INSUFFICIENT_SLEEP_COVERAGE'); END IF;
  IF v_timing_days=0 THEN v_reasons := array_append(v_reasons,'TIME_IN_BED_ONLY');
  ELSIF v_timing_days < v_required THEN v_reasons := array_append(v_reasons,'INSUFFICIENT_SLEEP_TIMING_COVERAGE'); END IF;
  IF v_recovery_days=0 THEN v_reasons := array_append(v_reasons,'RECOVERY_UNOBSERVED'); END IF;
  IF v_fatigue_days=0 THEN v_reasons := array_append(v_reasons,'FATIGUE_UNOBSERVED'); END IF;
  IF v_readiness_days=0 THEN v_reasons := array_append(v_reasons,'READINESS_UNOBSERVED'); END IF;
  IF v_manual_sleep_days=0 AND v_device_sleep_days>0 THEN v_reasons := array_append(v_reasons,'DEVICE_ESTIMATE_ONLY'); END IF;
  IF v_manual_sleep_days>0 AND v_device_sleep_days>0 THEN v_reasons := array_append(v_reasons,'MIXED_SLEEP_SOURCES'); END IF;

  INSERT INTO public.health_sleep_recovery_rolling_states (
    athlete_id,as_of_date,window_days,window_start_date,
    sleep_duration_observed_days,sleep_timing_observed_days,sleep_quality_observed_days,
    recovery_observed_days,fatigue_observed_days,readiness_observed_days,
    sleep_duration_coverage,sleep_timing_coverage,sleep_quality_coverage,
    recovery_coverage,fatigue_coverage,readiness_coverage,
    average_sleep_minutes,sleep_duration_variability_minutes,average_sleep_quality,
    average_recovery,average_fatigue,average_readiness,confidence,reason_codes,
    algorithm_version,computed_at
  ) VALUES (
    p_athlete_id,p_as_of_date,p_window_days,v_start,
    v_sleep_days,v_timing_days,v_quality_days,v_recovery_days,v_fatigue_days,v_readiness_days,
    v_cov_sleep,v_cov_timing,v_cov_quality,v_cov_recovery,v_cov_fatigue,v_cov_readiness,
    CASE WHEN v_sleep_days>=v_required THEN v_avg_sleep ELSE NULL END,
    CASE WHEN v_sleep_days>=v_required THEN v_sleep_var ELSE NULL END,
    CASE WHEN v_quality_days>=v_required THEN v_avg_quality ELSE NULL END,
    CASE WHEN v_recovery_days>=v_required THEN v_avg_recovery ELSE NULL END,
    CASE WHEN v_fatigue_days>=v_required THEN v_avg_fatigue ELSE NULL END,
    CASE WHEN v_readiness_days>=v_required THEN v_avg_readiness ELSE NULL END,
    v_confidence,v_reasons,'M9_SLEEP_RECOVERY_STATE_V1',now()
  ) ON CONFLICT (athlete_id,as_of_date,window_days)
  DO UPDATE SET
    window_start_date=EXCLUDED.window_start_date,
    sleep_duration_observed_days=EXCLUDED.sleep_duration_observed_days,
    sleep_timing_observed_days=EXCLUDED.sleep_timing_observed_days,
    sleep_quality_observed_days=EXCLUDED.sleep_quality_observed_days,
    recovery_observed_days=EXCLUDED.recovery_observed_days,
    fatigue_observed_days=EXCLUDED.fatigue_observed_days,
    readiness_observed_days=EXCLUDED.readiness_observed_days,
    sleep_duration_coverage=EXCLUDED.sleep_duration_coverage,
    sleep_timing_coverage=EXCLUDED.sleep_timing_coverage,
    sleep_quality_coverage=EXCLUDED.sleep_quality_coverage,
    recovery_coverage=EXCLUDED.recovery_coverage,
    fatigue_coverage=EXCLUDED.fatigue_coverage,
    readiness_coverage=EXCLUDED.readiness_coverage,
    average_sleep_minutes=EXCLUDED.average_sleep_minutes,
    sleep_duration_variability_minutes=EXCLUDED.sleep_duration_variability_minutes,
    average_sleep_quality=EXCLUDED.average_sleep_quality,
    average_recovery=EXCLUDED.average_recovery,
    average_fatigue=EXCLUDED.average_fatigue,
    average_readiness=EXCLUDED.average_readiness,
    confidence=EXCLUDED.confidence,
    reason_codes=EXCLUDED.reason_codes,
    algorithm_version=EXCLUDED.algorithm_version,
    computed_at=EXCLUDED.computed_at
  RETURNING id INTO v_state_id;

  RETURN v_state_id;
END;
$$;
