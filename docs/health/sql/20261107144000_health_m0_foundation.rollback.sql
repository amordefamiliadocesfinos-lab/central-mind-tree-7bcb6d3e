-- Manual rollback for M0 Health foundation.
-- Use only after confirming no Health data must be retained.

DROP POLICY IF EXISTS health_private_storage_delete ON storage.objects;
DROP POLICY IF EXISTS health_private_storage_update ON storage.objects;
DROP POLICY IF EXISTS health_private_storage_insert ON storage.objects;
DROP POLICY IF EXISTS health_private_storage_select ON storage.objects;

DELETE FROM storage.buckets WHERE id = 'health-private';

DROP POLICY IF EXISTS health_athlete_access_delete_manager ON public.health_athlete_access;
DROP POLICY IF EXISTS health_athlete_access_update_manager ON public.health_athlete_access;
DROP POLICY IF EXISTS health_athlete_access_insert_manager ON public.health_athlete_access;
DROP POLICY IF EXISTS health_athlete_access_select_authorized ON public.health_athlete_access;

DROP POLICY IF EXISTS health_athletes_update_owner_or_subject ON public.health_athletes;
DROP POLICY IF EXISTS health_athletes_select_authorized ON public.health_athletes;
DROP POLICY IF EXISTS health_athletes_insert_owned ON public.health_athletes;

DROP FUNCTION IF EXISTS public.health_can_manage_athlete_access(uuid);
DROP FUNCTION IF EXISTS public.health_can_write_athlete(uuid);
DROP FUNCTION IF EXISTS public.health_can_read_athlete(uuid);

DROP TABLE IF EXISTS public.health_athlete_access;
DROP TABLE IF EXISTS public.health_athletes;
