-- Manual rollback for Health M3 Program/CCH.
-- Use only after confirming no downstream execution data depends on these structures.

DROP TRIGGER IF EXISTS health_programs_validate_current_version ON public.health_programs;
DROP FUNCTION IF EXISTS public.health_m3_validate_current_program_version();

DROP TABLE IF EXISTS public.health_cch_queue_entries;
DROP TABLE IF EXISTS public.health_session_template_exercises;
DROP TABLE IF EXISTS public.health_session_templates;
DROP TABLE IF EXISTS public.health_program_muscle_priorities;

ALTER TABLE IF EXISTS public.health_programs
DROP CONSTRAINT IF EXISTS health_programs_current_version_fkey;

DROP TABLE IF EXISTS public.health_program_versions;
DROP TABLE IF EXISTS public.health_programs;

DROP INDEX IF EXISTS public.health_goal_phases_id_athlete_uidx;
