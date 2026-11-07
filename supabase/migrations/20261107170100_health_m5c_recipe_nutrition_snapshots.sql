-- M5C Health — Frozen Recipe Nutrition Snapshots
-- Requires M5A schema and complements M5B RPCs.

-- 1) RECIPE VERSION NUTRITION SNAPSHOT

CREATE TABLE public.health_recipe_nutrition_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  recipe_version_id uuid NOT NULL
    REFERENCES public.health_recipe_versions(id) ON DELETE RESTRICT,

  athlete_id uuid NULL,

  basis_amount numeric(12,3) NULL CHECK (
    basis_amount IS NULL OR basis_amount > 0
  ),

  basis_unit text NULL CHECK (
    basis_unit IS NULL OR basis_unit IN ('g','ml','unit','serving')
  ),

  energy_kcal numeric(12,3) NULL CHECK (
    energy_kcal IS NULL OR energy_kcal >= 0
  ),

  protein_g numeric(12,3) NULL CHECK (
    protein_g IS NULL OR protein_g >= 0
  ),

  carbohydrate_g numeric(12,3) NULL CHECK (
    carbohydrate_g IS NULL OR carbohydrate_g >= 0
  ),

  fat_g numeric(12,3) NULL CHECK (
    fat_g IS NULL OR fat_g >= 0
  ),

  fiber_g numeric(12,3) NULL CHECK (
    fiber_g IS NULL OR fiber_g >= 0
  ),

  sodium_mg numeric(14,3) NULL CHECK (
    sodium_mg IS NULL OR sodium_mg >= 0
  ),

  calculation_method text NOT NULL DEFAULT 'ingredient_snapshot_sum' CHECK (
    calculation_method IN (
      'ingredient_snapshot_sum',
      'manual_curated',
      'laboratory',
      'manufacturer_label',
      'provisional'
    )
  ),

  confidence text NOT NULL DEFAULT 'moderate' CHECK (
    confidence IN ('low','moderate','high')
  ),

  confidence_reason_codes text[] NOT NULL DEFAULT '{}'::text[],

  algorithm_version text NULL,
  parameter_set jsonb NULL,

  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (recipe_version_id)
);

-- 2) INGREDIENT-LEVEL FROZEN CONTRIBUTIONS

CREATE TABLE public.health_recipe_ingredient_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  recipe_version_id uuid NOT NULL
    REFERENCES public.health_recipe_versions(id) ON DELETE RESTRICT,

  recipe_ingredient_id uuid NOT NULL
    REFERENCES public.health_recipe_ingredients(id) ON DELETE RESTRICT,

  athlete_id uuid NULL,

  food_id uuid NOT NULL
    REFERENCES public.health_foods(id) ON DELETE RESTRICT,

  food_name_snapshot text NOT NULL CHECK (btrim(food_name_snapshot) <> ''),

  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),

  unit_code text NOT NULL CHECK (
    unit_code IN ('g','ml','unit')
  ),

  basis_amount_snapshot numeric(12,3) NULL CHECK (
    basis_amount_snapshot IS NULL OR basis_amount_snapshot > 0
  ),

  basis_unit_snapshot text NULL CHECK (
    basis_unit_snapshot IS NULL OR basis_unit_snapshot IN ('g','ml','unit')
  ),

  energy_kcal_snapshot numeric(12,3) NULL CHECK (
    energy_kcal_snapshot IS NULL OR energy_kcal_snapshot >= 0
  ),

  protein_g_snapshot numeric(12,3) NULL CHECK (
    protein_g_snapshot IS NULL OR protein_g_snapshot >= 0
  ),

  carbohydrate_g_snapshot numeric(12,3) NULL CHECK (
    carbohydrate_g_snapshot IS NULL OR carbohydrate_g_snapshot >= 0
  ),

  fat_g_snapshot numeric(12,3) NULL CHECK (
    fat_g_snapshot IS NULL OR fat_g_snapshot >= 0
  ),

  fiber_g_snapshot numeric(12,3) NULL CHECK (
    fiber_g_snapshot IS NULL OR fiber_g_snapshot >= 0
  ),

  sodium_mg_snapshot numeric(14,3) NULL CHECK (
    sodium_mg_snapshot IS NULL OR sodium_mg_snapshot >= 0
  ),

  food_source_id_snapshot uuid NULL,
  source_version_snapshot text NULL,
  data_quality_snapshot text NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (recipe_version_id, recipe_ingredient_id),

  CONSTRAINT health_recipe_ingredient_snapshots_version_ingredient_fkey
    FOREIGN KEY (recipe_ingredient_id, recipe_version_id)
    REFERENCES public.health_recipe_ingredients(id, recipe_version_id)
    ON DELETE RESTRICT
);

-- 3) INDEXES

CREATE INDEX health_recipe_nutrition_snapshots_recipe_version_idx
ON public.health_recipe_nutrition_snapshots(recipe_version_id);

CREATE INDEX health_recipe_ingredient_snapshots_recipe_version_idx
ON public.health_recipe_ingredient_snapshots(recipe_version_id);

-- 4) SCOPE VALIDATION

CREATE OR REPLACE FUNCTION public.health_m5_validate_recipe_snapshot_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
    RAISE EXCEPTION 'global recipe snapshot must have null athlete_id';
  END IF;

  IF v_scope='athlete' AND NEW.athlete_id IS DISTINCT FROM v_recipe_athlete THEN
    RAISE EXCEPTION 'recipe snapshot athlete_id must match recipe athlete_id';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER health_recipe_nutrition_snapshots_validate_scope
BEFORE INSERT ON public.health_recipe_nutrition_snapshots
FOR EACH ROW EXECUTE FUNCTION public.health_m5_validate_recipe_snapshot_scope();

CREATE TRIGGER health_recipe_ingredient_snapshots_validate_scope
BEFORE INSERT ON public.health_recipe_ingredient_snapshots
FOR EACH ROW EXECUTE FUNCTION public.health_m5_validate_recipe_snapshot_scope();

-- 5) IMMUTABILITY

CREATE OR REPLACE FUNCTION public.health_m5_guard_recipe_snapshot_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'recipe nutrition snapshots are immutable';
END;
$$;

CREATE TRIGGER health_recipe_nutrition_snapshots_immutable
BEFORE UPDATE OR DELETE ON public.health_recipe_nutrition_snapshots
FOR EACH ROW EXECUTE FUNCTION public.health_m5_guard_recipe_snapshot_immutable();

CREATE TRIGGER health_recipe_ingredient_snapshots_immutable
BEFORE UPDATE OR DELETE ON public.health_recipe_ingredient_snapshots
FOR EACH ROW EXECUTE FUNCTION public.health_m5_guard_recipe_snapshot_immutable();

-- 6) RLS + GRANTS

ALTER TABLE public.health_recipe_nutrition_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_recipe_ingredient_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
  public.health_recipe_nutrition_snapshots,
  public.health_recipe_ingredient_snapshots
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON
  public.health_recipe_nutrition_snapshots,
  public.health_recipe_ingredient_snapshots
TO authenticated;

CREATE POLICY health_recipe_nutrition_snapshots_select
ON public.health_recipe_nutrition_snapshots FOR SELECT TO authenticated
USING (
  athlete_id IS NULL
  OR public.health_can_read_athlete(athlete_id)
);

CREATE POLICY health_recipe_ingredient_snapshots_select
ON public.health_recipe_ingredient_snapshots FOR SELECT TO authenticated
USING (
  athlete_id IS NULL
  OR public.health_can_read_athlete(athlete_id)
);

-- No direct INSERT/UPDATE/DELETE grant to authenticated.
-- Snapshot creation must happen only inside trusted publish RPCs.

REVOKE ALL ON FUNCTION public.health_m5_validate_recipe_snapshot_scope()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.health_m5_guard_recipe_snapshot_immutable()
FROM PUBLIC, anon, authenticated;

-- End M5C review candidate.
