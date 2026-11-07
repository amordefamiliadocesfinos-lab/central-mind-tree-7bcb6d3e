-- M5B Health — Nutrition Plan RPCs

CREATE OR REPLACE FUNCTION public.health_m5_create_nutrition_plan_draft(
  p_athlete_id uuid,
  p_name text,
  p_goal_id uuid DEFAULT NULL,
  p_goal_phase_id uuid DEFAULT NULL,
  p_strategy_type text DEFAULT 'maintenance',
  p_title text DEFAULT 'Plano nutricional'
)
RETURNS TABLE (
  plan_id uuid,
  plan_version_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_plan_id uuid;
  v_version_id uuid;
BEGIN
  IF NOT public.health_can_write_athlete(p_athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'plan name is required';
  END IF;

  IF p_strategy_type NOT IN (
    'maintenance','energy_deficit','energy_surplus',
    'recomposition_support','performance_support','custom'
  ) THEN
    RAISE EXCEPTION 'invalid nutrition strategy_type';
  END IF;

  IF p_goal_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.health_goals g
    WHERE g.id=p_goal_id AND g.athlete_id=p_athlete_id
  ) THEN
    RAISE EXCEPTION 'goal does not belong to athlete';
  END IF;

  IF p_goal_phase_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.health_goal_phases gp
    WHERE gp.id=p_goal_phase_id AND gp.athlete_id=p_athlete_id
  ) THEN
    RAISE EXCEPTION 'goal phase does not belong to athlete';
  END IF;

  INSERT INTO public.health_nutrition_plans (
    athlete_id, goal_id, goal_phase_id, name, status, source
  )
  VALUES (
    p_athlete_id, p_goal_id, p_goal_phase_id, p_name, 'draft', 'manual'
  )
  RETURNING id INTO v_plan_id;

  INSERT INTO public.health_nutrition_plan_versions (
    plan_id, athlete_id, version_number, status, strategy_type, title
  )
  VALUES (
    v_plan_id, p_athlete_id, 1, 'draft', p_strategy_type, p_title
  )
  RETURNING id INTO v_version_id;

  RETURN QUERY SELECT v_plan_id, v_version_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m5_publish_nutrition_plan_version(
  p_plan_version_id uuid
)
RETURNS TABLE (
  plan_id uuid,
  published_version_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_plan_id uuid;
  v_athlete_id uuid;
  v_status text;
BEGIN
  SELECT v.plan_id, v.athlete_id, v.status
  INTO v_plan_id, v_athlete_id, v_status
  FROM public.health_nutrition_plan_versions v
  WHERE v.id=p_plan_version_id;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'nutrition plan version not found';
  END IF;

  IF NOT public.health_can_write_athlete(v_athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'only draft nutrition plan versions can be published';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.health_nutrition_targets t
    WHERE t.plan_version_id=p_plan_version_id
      AND t.athlete_id=v_athlete_id
  ) THEN
    RAISE EXCEPTION 'nutrition targets are required before publication';
  END IF;

  UPDATE public.health_nutrition_plan_versions
  SET status='published',
      published_at=now()
  WHERE id=p_plan_version_id
    AND athlete_id=v_athlete_id
    AND status='draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'nutrition plan version could not be published';
  END IF;

  UPDATE public.health_nutrition_plans
  SET status='paused',
      updated_at=now()
  WHERE athlete_id=v_athlete_id
    AND id<>v_plan_id
    AND status='active';

  UPDATE public.health_nutrition_plans
  SET current_version_id=p_plan_version_id,
      status='active'
  WHERE id=v_plan_id
    AND athlete_id=v_athlete_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'nutrition plan could not be activated';
  END IF;

  RETURN QUERY SELECT v_plan_id, p_plan_version_id;
END;
$$;
