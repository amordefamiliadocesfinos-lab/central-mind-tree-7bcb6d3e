-- Manual rollback for Health M1 profile/goals foundation.
-- Use only after confirming no M1 Health data must be retained.

DROP TABLE IF EXISTS public.health_consents;
DROP TABLE IF EXISTS public.health_athlete_preferences;
DROP TABLE IF EXISTS public.health_declared_equipment;
DROP TABLE IF EXISTS public.health_training_locations;
DROP TABLE IF EXISTS public.health_goal_phases;
DROP TABLE IF EXISTS public.health_goals;
DROP TABLE IF EXISTS public.health_athlete_profiles;
