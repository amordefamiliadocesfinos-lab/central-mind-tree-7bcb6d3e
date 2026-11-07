-- Manual rollback for Health M3 program RPCs.
DROP FUNCTION IF EXISTS public.health_m3_publish_program_version(uuid);
DROP FUNCTION IF EXISTS public.health_m3_create_program_draft(uuid, text);
