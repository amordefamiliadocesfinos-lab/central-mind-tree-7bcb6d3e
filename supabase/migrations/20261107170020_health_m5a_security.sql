-- M5A Health — Nutrition Foundation Security

-- 7) RLS + GRANTS

ALTER TABLE public.health_nutrition_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_nutrition_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_nutrition_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_recipe_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_food_log_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_meal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_meal_item_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
  public.health_nutrition_plans,
  public.health_nutrition_plan_versions,
  public.health_nutrition_targets,
  public.health_recipes,
  public.health_recipe_versions,
  public.health_recipe_ingredients,
  public.health_food_log_days,
  public.health_meal_logs,
  public.health_meal_items,
  public.health_meal_item_events
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT ON public.health_nutrition_plans TO authenticated;
GRANT UPDATE (name, goal_id, goal_phase_id, notes) ON public.health_nutrition_plans TO authenticated;
GRANT SELECT, INSERT ON public.health_nutrition_plan_versions TO authenticated;
GRANT UPDATE (strategy_type, title, rationale, effective_from, effective_to) ON public.health_nutrition_plan_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.health_nutrition_targets TO authenticated;
GRANT SELECT, INSERT ON public.health_recipes TO authenticated;
GRANT UPDATE (name) ON public.health_recipes TO authenticated;
GRANT SELECT, INSERT ON public.health_recipe_versions TO authenticated;
GRANT UPDATE (title, preparation_notes, yield_amount, yield_unit, servings) ON public.health_recipe_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_recipe_ingredients TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.health_food_log_days TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.health_meal_logs TO authenticated;
GRANT SELECT ON public.health_meal_items TO authenticated;
GRANT SELECT ON public.health_meal_item_events TO authenticated;

CREATE POLICY health_nutrition_plans_select
ON public.health_nutrition_plans FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_nutrition_plans_insert
ON public.health_nutrition_plans FOR INSERT TO authenticated
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND status='draft'
  AND current_version_id IS NULL
  AND source IN ('manual','template')
  AND created_by_auth_user_id=auth.uid()
);

CREATE POLICY health_nutrition_plans_update
ON public.health_nutrition_plans FOR UPDATE TO authenticated
USING (public.health_can_write_athlete(athlete_id))
WITH CHECK (public.health_can_write_athlete(athlete_id));

CREATE POLICY health_nutrition_plan_versions_select
ON public.health_nutrition_plan_versions FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_nutrition_plan_versions_insert
ON public.health_nutrition_plan_versions FOR INSERT TO authenticated
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND status='draft'
  AND published_at IS NULL
  AND created_by_auth_user_id=auth.uid()
);

CREATE POLICY health_nutrition_plan_versions_update_draft
ON public.health_nutrition_plan_versions FOR UPDATE TO authenticated
USING (
  public.health_can_write_athlete(athlete_id)
  AND status='draft'
  AND published_at IS NULL
)
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND status='draft'
  AND published_at IS NULL
);

CREATE POLICY health_nutrition_targets_select
ON public.health_nutrition_targets FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_nutrition_targets_insert
ON public.health_nutrition_targets FOR INSERT TO authenticated
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_nutrition_plan_versions v
    WHERE v.id=plan_version_id AND v.athlete_id=athlete_id AND v.status='draft'
  )
);

CREATE POLICY health_nutrition_targets_update
ON public.health_nutrition_targets FOR UPDATE TO authenticated
USING (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_nutrition_plan_versions v
    WHERE v.id=plan_version_id AND v.athlete_id=athlete_id AND v.status='draft'
  )
)
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_nutrition_plan_versions v
    WHERE v.id=plan_version_id AND v.athlete_id=athlete_id AND v.status='draft'
  )
);

CREATE POLICY health_recipes_select
ON public.health_recipes FOR SELECT TO authenticated
USING (
  owner_scope='global'
  OR (athlete_id IS NOT NULL AND public.health_can_read_athlete(athlete_id))
);

CREATE POLICY health_recipes_insert_personal
ON public.health_recipes FOR INSERT TO authenticated
WITH CHECK (
  owner_scope='athlete'
  AND athlete_id IS NOT NULL
  AND status='draft'
  AND current_version_id IS NULL
  AND public.health_can_write_athlete(athlete_id)
  AND created_by_auth_user_id=auth.uid()
);

CREATE POLICY health_recipes_update_personal
ON public.health_recipes FOR UPDATE TO authenticated
USING (
  owner_scope='athlete'
  AND athlete_id IS NOT NULL
  AND public.health_can_write_athlete(athlete_id)
)
WITH CHECK (
  owner_scope='athlete'
  AND athlete_id IS NOT NULL
  AND public.health_can_write_athlete(athlete_id)
);

CREATE POLICY health_recipe_versions_select
ON public.health_recipe_versions FOR SELECT TO authenticated
USING (
  athlete_id IS NULL OR public.health_can_read_athlete(athlete_id)
);

CREATE POLICY health_recipe_versions_insert_personal
ON public.health_recipe_versions FOR INSERT TO authenticated
WITH CHECK (
  athlete_id IS NOT NULL
  AND public.health_can_write_athlete(athlete_id)
  AND status='draft'
  AND published_at IS NULL
  AND created_by_auth_user_id=auth.uid()
);

CREATE POLICY health_recipe_versions_update_personal_draft
ON public.health_recipe_versions FOR UPDATE TO authenticated
USING (
  athlete_id IS NOT NULL
  AND public.health_can_write_athlete(athlete_id)
  AND status='draft'
  AND published_at IS NULL
)
WITH CHECK (
  athlete_id IS NOT NULL
  AND public.health_can_write_athlete(athlete_id)
  AND status='draft'
  AND published_at IS NULL
);

CREATE POLICY health_recipe_ingredients_select
ON public.health_recipe_ingredients FOR SELECT TO authenticated
USING (
  athlete_id IS NULL OR public.health_can_read_athlete(athlete_id)
);

CREATE POLICY health_recipe_ingredients_insert_personal
ON public.health_recipe_ingredients FOR INSERT TO authenticated
WITH CHECK (
  athlete_id IS NOT NULL
  AND public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_recipe_versions v
    WHERE v.id=recipe_version_id AND v.athlete_id=athlete_id AND v.status='draft'
  )
);

CREATE POLICY health_recipe_ingredients_update_personal
ON public.health_recipe_ingredients FOR UPDATE TO authenticated
USING (
  athlete_id IS NOT NULL
  AND public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_recipe_versions v
    WHERE v.id=recipe_version_id AND v.athlete_id=athlete_id AND v.status='draft'
  )
)
WITH CHECK (
  athlete_id IS NOT NULL
  AND public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_recipe_versions v
    WHERE v.id=recipe_version_id AND v.athlete_id=athlete_id AND v.status='draft'
  )
);

CREATE POLICY health_recipe_ingredients_delete_personal
ON public.health_recipe_ingredients FOR DELETE TO authenticated
USING (
  athlete_id IS NOT NULL
  AND public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_recipe_versions v
    WHERE v.id=recipe_version_id AND v.athlete_id=athlete_id AND v.status='draft'
  )
);

CREATE POLICY health_food_log_days_select
ON public.health_food_log_days FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_food_log_days_insert
ON public.health_food_log_days FOR INSERT TO authenticated
WITH CHECK (public.health_can_write_athlete(athlete_id));

CREATE POLICY health_food_log_days_update
ON public.health_food_log_days FOR UPDATE TO authenticated
USING (public.health_can_write_athlete(athlete_id))
WITH CHECK (public.health_can_write_athlete(athlete_id));

CREATE POLICY health_meal_logs_select
ON public.health_meal_logs FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_meal_logs_insert
ON public.health_meal_logs FOR INSERT TO authenticated
WITH CHECK (public.health_can_write_athlete(athlete_id));

CREATE POLICY health_meal_logs_update
ON public.health_meal_logs FOR UPDATE TO authenticated
USING (public.health_can_write_athlete(athlete_id))
WITH CHECK (public.health_can_write_athlete(athlete_id));

CREATE POLICY health_meal_items_select
ON public.health_meal_items FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_meal_item_events_select
ON public.health_meal_item_events FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

REVOKE ALL ON FUNCTION public.health_m5_validate_current_nutrition_plan_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.health_m5_validate_recipe_version_scope() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.health_m5_validate_current_recipe_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.health_m5_guard_published_plan_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.health_m5_guard_published_targets() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.health_m5_guard_published_recipe_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.health_m5_validate_recipe_ingredient_scope() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.health_m5_guard_published_recipe_ingredients() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.health_m5_validate_meal_item_recipe_scope() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.health_m5_validate_nutrition_plan_goal_phase() FROM PUBLIC, anon, authenticated;
