-- M5A Health — Nutrition Foundation Integrity

-- 5) INTEGRITY FUNCTIONS / GUARDS

CREATE OR REPLACE FUNCTION public.health_m5_validate_current_nutrition_plan_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.current_version_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.health_nutrition_plan_versions v
      WHERE v.id = NEW.current_version_id
        AND v.plan_id = NEW.id
        AND v.athlete_id = NEW.athlete_id
        AND v.status = 'published'
    ) THEN
      RAISE EXCEPTION 'current_version_id must reference a published version of the same nutrition plan and athlete';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m5_validate_recipe_version_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_scope text;
  v_recipe_athlete uuid;
BEGIN
  SELECT owner_scope, athlete_id
  INTO v_scope, v_recipe_athlete
  FROM public.health_recipes
  WHERE id = NEW.recipe_id;

  IF v_scope IS NULL THEN
    RAISE EXCEPTION 'recipe not found';
  END IF;

  IF v_scope = 'global' AND NEW.athlete_id IS NOT NULL THEN
    RAISE EXCEPTION 'global recipe version must have null athlete_id';
  END IF;

  IF v_scope = 'athlete' AND NEW.athlete_id IS DISTINCT FROM v_recipe_athlete THEN
    RAISE EXCEPTION 'athlete recipe version must match recipe athlete_id';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m5_validate_current_recipe_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.current_version_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.health_recipe_versions v
      WHERE v.id = NEW.current_version_id
        AND v.recipe_id = NEW.id
        AND v.status = 'published'
        AND (
          (NEW.owner_scope='global' AND v.athlete_id IS NULL)
          OR
          (NEW.owner_scope='athlete' AND v.athlete_id = NEW.athlete_id)
        )
    ) THEN
      RAISE EXCEPTION 'current_version_id must reference a published version of the same recipe and scope';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m5_guard_published_plan_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.status='published' THEN
    RAISE EXCEPTION 'published nutrition plan versions are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m5_guard_published_targets()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan_version_id uuid;
BEGIN
  v_plan_version_id := CASE
    WHEN TG_OP='DELETE' THEN OLD.plan_version_id
    ELSE NEW.plan_version_id
  END;

  IF EXISTS (
    SELECT 1 FROM public.health_nutrition_plan_versions v
    WHERE v.id = v_plan_version_id
      AND v.status='published'
  ) THEN
    RAISE EXCEPTION 'targets of a published nutrition plan version are immutable';
  END IF;

  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m5_guard_published_recipe_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.status='published' THEN
    RAISE EXCEPTION 'published recipe versions are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m5_validate_recipe_ingredient_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_scope text;
  v_recipe_athlete uuid;
BEGIN
  SELECT r.owner_scope, r.athlete_id
    INTO v_scope, v_recipe_athlete
  FROM public.health_recipe_versions rv
  JOIN public.health_recipes r ON r.id=rv.recipe_id
  WHERE rv.id=NEW.recipe_version_id;

  IF v_scope IS NULL THEN
    RAISE EXCEPTION 'recipe version not found';
  END IF;

  IF v_scope='global' AND NEW.athlete_id IS NOT NULL THEN
    RAISE EXCEPTION 'global recipe ingredient must have null athlete_id';
  END IF;

  IF v_scope='athlete' AND NEW.athlete_id IS DISTINCT FROM v_recipe_athlete THEN
    RAISE EXCEPTION 'recipe ingredient athlete_id must match recipe athlete_id';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m5_guard_published_recipe_ingredients()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_version_id uuid;
BEGIN
  v_version_id := CASE WHEN TG_OP='DELETE' THEN OLD.recipe_version_id ELSE NEW.recipe_version_id END;

  IF EXISTS (
    SELECT 1 FROM public.health_recipe_versions v
    WHERE v.id=v_version_id AND v.status='published'
  ) THEN
    RAISE EXCEPTION 'ingredients of a published recipe version are immutable';
  END IF;

  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m5_validate_meal_item_recipe_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_scope text;
  v_recipe_athlete uuid;
BEGIN
  IF NEW.recipe_version_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT r.owner_scope, r.athlete_id
    INTO v_scope, v_recipe_athlete
  FROM public.health_recipe_versions rv
  JOIN public.health_recipes r ON r.id=rv.recipe_id
  WHERE rv.id=NEW.recipe_version_id
    AND rv.status='published';

  IF v_scope IS NULL THEN
    RAISE EXCEPTION 'meal item recipe_version_id must reference a published recipe version';
  END IF;

  IF v_scope='athlete' AND v_recipe_athlete IS DISTINCT FROM NEW.athlete_id THEN
    RAISE EXCEPTION 'meal item cannot reference another athlete''s personal recipe';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m5_validate_nutrition_plan_goal_phase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_phase_goal_id uuid;
  v_phase_athlete_id uuid;
BEGIN
  IF NEW.goal_phase_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT gp.goal_id, gp.athlete_id
  INTO v_phase_goal_id, v_phase_athlete_id
  FROM public.health_goal_phases gp
  WHERE gp.id=NEW.goal_phase_id;

  IF v_phase_goal_id IS NULL THEN
    RAISE EXCEPTION 'goal phase not found';
  END IF;

  IF v_phase_athlete_id IS DISTINCT FROM NEW.athlete_id THEN
    RAISE EXCEPTION 'goal phase must belong to nutrition plan athlete';
  END IF;

  IF NEW.goal_id IS NULL OR NEW.goal_id IS DISTINCT FROM v_phase_goal_id THEN
    RAISE EXCEPTION 'goal_phase_id must belong to the same goal_id';
  END IF;

  RETURN NEW;
END;
$$;

-- 6) TRIGGERS

CREATE TRIGGER health_nutrition_plans_validate_goal_phase
BEFORE INSERT OR UPDATE OF goal_id, goal_phase_id, athlete_id ON public.health_nutrition_plans
FOR EACH ROW EXECUTE FUNCTION public.health_m5_validate_nutrition_plan_goal_phase();

CREATE TRIGGER health_nutrition_plans_updated_at
BEFORE UPDATE ON public.health_nutrition_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_nutrition_plan_versions_updated_at
BEFORE UPDATE ON public.health_nutrition_plan_versions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_nutrition_targets_updated_at
BEFORE UPDATE ON public.health_nutrition_targets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_recipes_updated_at
BEFORE UPDATE ON public.health_recipes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_recipe_versions_updated_at
BEFORE UPDATE ON public.health_recipe_versions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_food_log_days_updated_at
BEFORE UPDATE ON public.health_food_log_days
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_meal_logs_updated_at
BEFORE UPDATE ON public.health_meal_logs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_meal_items_updated_at
BEFORE UPDATE ON public.health_meal_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_nutrition_plans_validate_current_version
BEFORE INSERT OR UPDATE OF current_version_id ON public.health_nutrition_plans
FOR EACH ROW EXECUTE FUNCTION public.health_m5_validate_current_nutrition_plan_version();

CREATE TRIGGER health_recipe_versions_validate_scope
BEFORE INSERT OR UPDATE OF recipe_id, athlete_id ON public.health_recipe_versions
FOR EACH ROW EXECUTE FUNCTION public.health_m5_validate_recipe_version_scope();

CREATE TRIGGER health_recipes_validate_current_version
BEFORE INSERT OR UPDATE OF current_version_id, athlete_id, owner_scope ON public.health_recipes
FOR EACH ROW EXECUTE FUNCTION public.health_m5_validate_current_recipe_version();

CREATE TRIGGER health_nutrition_plan_versions_guard_published
BEFORE UPDATE ON public.health_nutrition_plan_versions
FOR EACH ROW EXECUTE FUNCTION public.health_m5_guard_published_plan_version();

CREATE TRIGGER health_nutrition_targets_guard_published
BEFORE UPDATE OR DELETE ON public.health_nutrition_targets
FOR EACH ROW EXECUTE FUNCTION public.health_m5_guard_published_targets();

CREATE TRIGGER health_recipe_versions_guard_published
BEFORE UPDATE ON public.health_recipe_versions
FOR EACH ROW EXECUTE FUNCTION public.health_m5_guard_published_recipe_version();

CREATE TRIGGER health_recipe_ingredients_validate_scope
BEFORE INSERT OR UPDATE OF recipe_version_id, athlete_id ON public.health_recipe_ingredients
FOR EACH ROW EXECUTE FUNCTION public.health_m5_validate_recipe_ingredient_scope();

CREATE TRIGGER health_recipe_ingredients_guard_published
BEFORE UPDATE OR DELETE ON public.health_recipe_ingredients
FOR EACH ROW EXECUTE FUNCTION public.health_m5_guard_published_recipe_ingredients();

CREATE TRIGGER health_meal_items_validate_recipe_scope
BEFORE INSERT OR UPDATE OF recipe_version_id, athlete_id ON public.health_meal_items
FOR EACH ROW EXECUTE FUNCTION public.health_m5_validate_meal_item_recipe_scope();
