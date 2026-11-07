-- M2 follow-up: bind declared equipment from M1 to the canonical equipment catalog.
-- A declared item may remain unmatched (NULL) until the user/system resolves it.

ALTER TABLE public.health_declared_equipment
ADD CONSTRAINT health_declared_equipment_catalog_equipment_fkey
FOREIGN KEY (catalog_equipment_id)
REFERENCES public.health_equipment_catalog(id)
ON DELETE SET NULL;

CREATE INDEX health_declared_equipment_catalog_equipment_idx
ON public.health_declared_equipment(catalog_equipment_id)
WHERE catalog_equipment_id IS NOT NULL;
