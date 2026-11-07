-- M5B Health — Meal Item Correction RPCs

CREATE OR REPLACE FUNCTION public.health_m5_correct_meal_item(
  p_original_item_id uuid,
  p_client_event_id uuid,
  p_item_name text,
  p_quantity numeric DEFAULT NULL,
  p_unit_code text DEFAULT NULL,
  p_food_id uuid DEFAULT NULL,
  p_recipe_version_id uuid DEFAULT NULL,
  p_estimation_method text DEFAULT 'approximate_description',
  p_data_source text DEFAULT 'USER_REPORTED',
  p_confidence text DEFAULT 'low',
  p_correction_reason text DEFAULT NULL,
  p_household_measure_text text DEFAULT NULL,
  p_preparation_state text DEFAULT 'unknown'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_original public.health_meal_items%ROWTYPE;
  v_existing_item_id uuid;
  v_new_item_id uuid;
BEGIN
  SELECT *
  INTO v_original
  FROM public.health_meal_items
  WHERE id=p_original_item_id
  FOR UPDATE;

  IF v_original.id IS NULL THEN
    RAISE EXCEPTION 'meal item not found';
  END IF;

  IF NOT public.health_can_write_athlete(v_original.athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF p_client_event_id IS NOT NULL THEN
    SELECT e.meal_item_id
    INTO v_existing_item_id
    FROM public.health_meal_item_events e
    WHERE e.athlete_id=v_original.athlete_id
      AND e.client_event_id=p_client_event_id
      AND e.event_type='corrected'
    LIMIT 1;

    IF v_existing_item_id IS NOT NULL THEN
      RETURN v_existing_item_id;
    END IF;
  END IF;

  IF v_original.status <> 'active' THEN
    RAISE EXCEPTION 'only active meal items can be corrected';
  END IF;

  v_new_item_id := public.health_m5_log_meal_item(
    v_original.meal_log_id,
    NULL,
    p_item_name,
    p_quantity,
    p_unit_code,
    p_food_id,
    p_recipe_version_id,
    p_estimation_method,
    p_data_source,
    p_confidence,
    p_household_measure_text,
    p_preparation_state
  );

  UPDATE public.health_meal_items
  SET status='superseded',
      updated_at=now()
  WHERE id=v_original.id
    AND athlete_id=v_original.athlete_id
    AND status='active';

  UPDATE public.health_meal_items
  SET supersedes_item_id=v_original.id,
      correction_reason=p_correction_reason,
      updated_at=now()
  WHERE id=v_new_item_id
    AND athlete_id=v_original.athlete_id;

  INSERT INTO public.health_meal_item_events (
    athlete_id,
    meal_item_id,
    event_type,
    payload,
    client_event_id
  )
  VALUES
  (
    v_original.athlete_id,
    v_original.id,
    'superseded',
    jsonb_build_object('superseded_by',v_new_item_id),
    NULL
  ),
  (
    v_original.athlete_id,
    v_new_item_id,
    'corrected',
    jsonb_build_object(
      'supersedes',v_original.id,
      'reason',p_correction_reason
    ),
    p_client_event_id
  );

  RETURN v_new_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m5_void_meal_item(
  p_item_id uuid,
  p_client_event_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item public.health_meal_items%ROWTYPE;
  v_existing uuid;
BEGIN
  SELECT *
  INTO v_item
  FROM public.health_meal_items
  WHERE id=p_item_id
  FOR UPDATE;

  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'meal item not found';
  END IF;

  IF NOT public.health_can_write_athlete(v_item.athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF p_client_event_id IS NOT NULL THEN
    SELECT e.meal_item_id
    INTO v_existing
    FROM public.health_meal_item_events e
    WHERE e.athlete_id=v_item.athlete_id
      AND e.client_event_id=p_client_event_id
      AND e.event_type='voided'
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      RETURN v_existing;
    END IF;
  END IF;

  IF v_item.status='voided' THEN
    RETURN v_item.id;
  END IF;

  IF v_item.status<>'active' THEN
    RAISE EXCEPTION 'only active meal items can be voided';
  END IF;

  UPDATE public.health_meal_items
  SET status='voided',
      correction_reason=COALESCE(p_reason, correction_reason),
      updated_at=now()
  WHERE id=v_item.id
    AND athlete_id=v_item.athlete_id;

  INSERT INTO public.health_meal_item_events (
    athlete_id,
    meal_item_id,
    event_type,
    payload,
    client_event_id
  )
  VALUES (
    v_item.athlete_id,
    v_item.id,
    'voided',
    jsonb_build_object('reason',p_reason),
    p_client_event_id
  );

  RETURN v_item.id;
END;
$$;
