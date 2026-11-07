-- Manual rollback for Health M2 catalogs.
-- Use only after confirming downstream modules do not depend on these catalogs.

DROP TABLE IF EXISTS public.health_foods;
DROP TABLE IF EXISTS public.health_food_sources;
DROP TABLE IF EXISTS public.health_exercise_equivalences;
DROP TABLE IF EXISTS public.health_exercise_equipment;
DROP TABLE IF EXISTS public.health_exercise_muscles;
DROP TABLE IF EXISTS public.health_exercises;
DROP TABLE IF EXISTS public.health_equipment_catalog;
DROP TABLE IF EXISTS public.health_muscle_groups;
