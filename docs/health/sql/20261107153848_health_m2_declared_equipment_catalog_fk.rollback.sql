-- Rollback M2 declared equipment catalog link.
DROP INDEX IF EXISTS public.health_declared_equipment_catalog_equipment_idx;
ALTER TABLE public.health_declared_equipment
DROP CONSTRAINT IF EXISTS health_declared_equipment_catalog_equipment_fkey;
