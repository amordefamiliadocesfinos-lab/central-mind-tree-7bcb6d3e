-- M5B Health — RPC Privileges

REVOKE ALL ON FUNCTION public.health_m5_create_nutrition_plan_draft(uuid,text,uuid,uuid,text,text)
FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.health_m5_publish_nutrition_plan_version(uuid)
FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.health_m5_create_recipe_draft(uuid,text,text)
FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.health_m5_publish_recipe_version(uuid)
FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.health_m5_log_meal_item(
  uuid,uuid,text,numeric,text,uuid,uuid,text,text,text,text,text
)
FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.health_m5_correct_meal_item(
  uuid,uuid,text,numeric,text,uuid,uuid,text,text,text,text,text,text
)
FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.health_m5_void_meal_item(uuid,uuid,text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.health_m5_create_nutrition_plan_draft(uuid,text,uuid,uuid,text,text)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.health_m5_publish_nutrition_plan_version(uuid)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.health_m5_create_recipe_draft(uuid,text,text)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.health_m5_publish_recipe_version(uuid)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.health_m5_log_meal_item(
  uuid,uuid,text,numeric,text,uuid,uuid,text,text,text,text,text
)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.health_m5_correct_meal_item(
  uuid,uuid,text,numeric,text,uuid,uuid,text,text,text,text,text,text
)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.health_m5_void_meal_item(uuid,uuid,text)
TO authenticated;
