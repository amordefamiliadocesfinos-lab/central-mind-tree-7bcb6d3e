-- F18 Health — Individual Meal Plan Prescription
-- Generated filename via Supabase CLI 3.1.0.
-- Git-only: do not infer production application from this file.

-- 1) DAY PATTERNS

CREATE TABLE public.health_nutrition_day_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id uuid NOT NULL,
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (code ~ '^[A-Z0-9_-]+$'),
  name text NOT NULL CHECK (btrim(name) <> ''),
  day_type text NOT NULL DEFAULT 'default' CHECK (
    day_type IN ('default','training','rest','custom')
  ),
  sequence_order integer NOT NULL CHECK (sequence_order >= 1),
  is_default boolean NOT NULL DEFAULT false,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_version_id, code),
  UNIQUE (plan_version_id, sequence_order),
  UNIQUE (id, athlete_id),
  UNIQUE (id, plan_version_id, athlete_id),
  CONSTRAINT health_nutrition_day_patterns_version_athlete_fkey
    FOREIGN KEY (plan_version_id, athlete_id)
    REFERENCES public.health_nutrition_plan_versions(id, athlete_id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX health_nutrition_day_patterns_one_default_idx
ON public.health_nutrition_day_patterns(plan_version_id)
WHERE is_default;

-- 2) PLANNED MEALS

CREATE TABLE public.health_nutrition_planned_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_pattern_id uuid NOT NULL,
  plan_version_id uuid NOT NULL,
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  meal_type text NOT NULL DEFAULT 'other' CHECK (
    meal_type IN ('breakfast','lunch','dinner','snack','pre_workout','post_workout','other')
  ),
  name text NOT NULL CHECK (btrim(name) <> ''),
  sequence_order integer NOT NULL CHECK (sequence_order >= 1),
  time_start time NULL,
  time_end time NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (day_pattern_id, sequence_order),
  UNIQUE (id, athlete_id),
  UNIQUE (id, plan_version_id, athlete_id),
  CONSTRAINT health_nutrition_planned_meals_pattern_fkey
    FOREIGN KEY (day_pattern_id, plan_version_id, athlete_id)
    REFERENCES public.health_nutrition_day_patterns(id, plan_version_id, athlete_id)
    ON DELETE CASCADE,
  CONSTRAINT health_nutrition_planned_meals_version_fkey
    FOREIGN KEY (plan_version_id, athlete_id)
    REFERENCES public.health_nutrition_plan_versions(id, athlete_id)
    ON DELETE CASCADE
);

-- 3) PLANNED ITEMS

CREATE TABLE public.health_nutrition_planned_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planned_meal_id uuid NOT NULL,
  plan_version_id uuid NOT NULL,
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  sequence_order integer NOT NULL CHECK (sequence_order >= 1),
  source_kind text NOT NULL CHECK (source_kind IN ('food','recipe')),
  food_id uuid NULL REFERENCES public.health_foods(id) ON DELETE RESTRICT,
  recipe_version_id uuid NULL REFERENCES public.health_recipe_versions(id) ON DELETE RESTRICT,
  item_name_snapshot text NOT NULL CHECK (btrim(item_name_snapshot) <> ''),
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  unit_code text NOT NULL CHECK (unit_code IN ('g','ml','unit','serving')),
  basis_amount_snapshot numeric(12,3) NULL CHECK (
    basis_amount_snapshot IS NULL OR basis_amount_snapshot > 0
  ),
  basis_unit_snapshot text NULL CHECK (
    basis_unit_snapshot IS NULL OR basis_unit_snapshot IN ('g','ml','unit','serving')
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
  source_version_snapshot text NULL,
  data_quality_snapshot text NULL,
  is_optional boolean NOT NULL DEFAULT false,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (planned_meal_id, sequence_order),
  UNIQUE (id, athlete_id),
  UNIQUE (id, plan_version_id, athlete_id),
  CONSTRAINT health_nutrition_planned_items_meal_fkey
    FOREIGN KEY (planned_meal_id, plan_version_id, athlete_id)
    REFERENCES public.health_nutrition_planned_meals(id, plan_version_id, athlete_id)
    ON DELETE CASCADE,
  CONSTRAINT health_nutrition_planned_items_version_fkey
    FOREIGN KEY (plan_version_id, athlete_id)
    REFERENCES public.health_nutrition_plan_versions(id, athlete_id)
    ON DELETE CASCADE,
  CHECK (
    (source_kind='food' AND food_id IS NOT NULL AND recipe_version_id IS NULL AND unit_code IN ('g','ml','unit'))
    OR
    (source_kind='recipe' AND recipe_version_id IS NOT NULL AND food_id IS NULL)
  ),
  CHECK (
    (basis_amount_snapshot IS NULL AND basis_unit_snapshot IS NULL)
    OR
    (basis_amount_snapshot IS NOT NULL AND basis_unit_snapshot IS NOT NULL)
  )
);

-- 4) ITEM ALTERNATIVES

CREATE TABLE public.health_nutrition_item_alternatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planned_item_id uuid NOT NULL,
  plan_version_id uuid NOT NULL,
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  sequence_order integer NOT NULL CHECK (sequence_order >= 1),
  source_kind text NOT NULL CHECK (source_kind IN ('food','recipe')),
  food_id uuid NULL REFERENCES public.health_foods(id) ON DELETE RESTRICT,
  recipe_version_id uuid NULL REFERENCES public.health_recipe_versions(id) ON DELETE RESTRICT,
  item_name_snapshot text NOT NULL CHECK (btrim(item_name_snapshot) <> ''),
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  unit_code text NOT NULL CHECK (unit_code IN ('g','ml','unit','serving')),
  basis_amount_snapshot numeric(12,3) NULL CHECK (
    basis_amount_snapshot IS NULL OR basis_amount_snapshot > 0
  ),
  basis_unit_snapshot text NULL CHECK (
    basis_unit_snapshot IS NULL OR basis_unit_snapshot IN ('g','ml','unit','serving')
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
  source_version_snapshot text NULL,
  data_quality_snapshot text NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (planned_item_id, sequence_order),
  UNIQUE (id, athlete_id),
  CONSTRAINT health_nutrition_item_alternatives_item_fkey
    FOREIGN KEY (planned_item_id, plan_version_id, athlete_id)
    REFERENCES public.health_nutrition_planned_items(id, plan_version_id, athlete_id)
    ON DELETE CASCADE,
  CONSTRAINT health_nutrition_item_alternatives_version_fkey
    FOREIGN KEY (plan_version_id, athlete_id)
    REFERENCES public.health_nutrition_plan_versions(id, athlete_id)
    ON DELETE CASCADE,
  CHECK (
    (source_kind='food' AND food_id IS NOT NULL AND recipe_version_id IS NULL AND unit_code IN ('g','ml','unit'))
    OR
    (source_kind='recipe' AND recipe_version_id IS NOT NULL AND food_id IS NULL)
  ),
  CHECK (
    (basis_amount_snapshot IS NULL AND basis_unit_snapshot IS NULL)
    OR
    (basis_amount_snapshot IS NOT NULL AND basis_unit_snapshot IS NOT NULL)
  )
);

-- 5) INDEXES

CREATE INDEX health_nutrition_day_patterns_athlete_version_idx
ON public.health_nutrition_day_patterns(athlete_id, plan_version_id, sequence_order);

CREATE INDEX health_nutrition_planned_meals_pattern_idx
ON public.health_nutrition_planned_meals(day_pattern_id, sequence_order);

CREATE INDEX health_nutrition_planned_items_meal_idx
ON public.health_nutrition_planned_items(planned_meal_id, sequence_order);

CREATE INDEX health_nutrition_item_alternatives_item_idx
ON public.health_nutrition_item_alternatives(planned_item_id, sequence_order);

-- 6) UNIVERSAL DRAFT GUARD

CREATE OR REPLACE FUNCTION public.health_f18_guard_draft_plan_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_plan_version_id uuid;
  v_athlete_id uuid;
  v_status text;
BEGIN
  IF TG_OP='DELETE' THEN
    v_plan_version_id := OLD.plan_version_id;
    v_athlete_id := OLD.athlete_id;
  ELSE
    v_plan_version_id := NEW.plan_version_id;
    v_athlete_id := NEW.athlete_id;
  END IF;

  SELECT v.status
  INTO v_status
  FROM public.health_nutrition_plan_versions v
  WHERE v.id=v_plan_version_id
    AND v.athlete_id=v_athlete_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'nutrition plan version not found';
  END IF;

  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'published nutrition prescription is immutable; create a new plan version';
  END IF;

  IF TG_OP='DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

-- 7) SERVER-SIDE SOURCE SNAPSHOT

CREATE OR REPLACE FUNCTION public.health_f18_fill_prescription_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text;
  v_basis_amount numeric;
  v_basis_unit text;
  v_energy numeric;
  v_protein numeric;
  v_carbs numeric;
  v_fat numeric;
  v_fiber numeric;
  v_source_version text;
  v_quality text;
  v_active boolean;
  v_recipe_status text;
  v_factor numeric;
BEGIN
  IF NEW.source_kind='food' THEN
    SELECT
      f.canonical_name,
      f.basis_amount,
      f.basis_unit,
      f.energy_kcal,
      f.protein_g,
      f.carbohydrate_g,
      f.fat_g,
      f.fiber_g,
      f.source_version,
      f.data_quality,
      f.is_active
    INTO
      v_name,
      v_basis_amount,
      v_basis_unit,
      v_energy,
      v_protein,
      v_carbs,
      v_fat,
      v_fiber,
      v_source_version,
      v_quality,
      v_active
    FROM public.health_foods f
    WHERE f.id=NEW.food_id;

    IF v_name IS NULL OR v_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'active food source not found';
    END IF;

    IF NEW.unit_code IS DISTINCT FROM v_basis_unit THEN
      RAISE EXCEPTION 'planned food unit must match food basis unit';
    END IF;

  ELSIF NEW.source_kind='recipe' THEN
    SELECT
      rv.title,
      rv.status,
      s.basis_amount,
      s.basis_unit,
      s.energy_kcal,
      s.protein_g,
      s.carbohydrate_g,
      s.fat_g,
      s.fiber_g,
      rv.id::text,
      s.confidence
    INTO
      v_name,
      v_recipe_status,
      v_basis_amount,
      v_basis_unit,
      v_energy,
      v_protein,
      v_carbs,
      v_fat,
      v_fiber,
      v_source_version,
      v_quality
    FROM public.health_recipe_versions rv
    JOIN public.health_recipe_nutrition_snapshots s
      ON s.recipe_version_id=rv.id
    WHERE rv.id=NEW.recipe_version_id;

    IF v_name IS NULL OR v_recipe_status <> 'published' THEN
      RAISE EXCEPTION 'published recipe version with nutrition snapshot not found';
    END IF;

    IF v_basis_amount IS NULL OR v_basis_unit IS NULL THEN
      RAISE EXCEPTION 'recipe nutrition basis is required for prescription';
    END IF;

    IF NEW.unit_code IS DISTINCT FROM v_basis_unit THEN
      RAISE EXCEPTION 'planned recipe unit must match recipe nutrition basis unit';
    END IF;

  ELSE
    RAISE EXCEPTION 'invalid prescription source kind';
  END IF;

  IF v_basis_amount IS NULL OR v_basis_amount <= 0 THEN
    RAISE EXCEPTION 'nutrition basis amount is required for prescription';
  END IF;

  v_factor := NEW.quantity / v_basis_amount;

  NEW.item_name_snapshot := v_name;
  NEW.basis_amount_snapshot := v_basis_amount;
  NEW.basis_unit_snapshot := v_basis_unit;
  NEW.energy_kcal_snapshot := CASE WHEN v_energy IS NULL THEN NULL ELSE v_energy * v_factor END;
  NEW.protein_g_snapshot := CASE WHEN v_protein IS NULL THEN NULL ELSE v_protein * v_factor END;
  NEW.carbohydrate_g_snapshot := CASE WHEN v_carbs IS NULL THEN NULL ELSE v_carbs * v_factor END;
  NEW.fat_g_snapshot := CASE WHEN v_fat IS NULL THEN NULL ELSE v_fat * v_factor END;
  NEW.fiber_g_snapshot := CASE WHEN v_fiber IS NULL THEN NULL ELSE v_fiber * v_factor END;
  NEW.source_version_snapshot := v_source_version;
  NEW.data_quality_snapshot := v_quality;

  RETURN NEW;
END;
$$;

-- Guard before snapshot to fail fast on published versions.
CREATE TRIGGER health_f18_10_day_patterns_draft_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.health_nutrition_day_patterns
FOR EACH ROW EXECUTE FUNCTION public.health_f18_guard_draft_plan_version();

CREATE TRIGGER health_f18_10_planned_meals_draft_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.health_nutrition_planned_meals
FOR EACH ROW EXECUTE FUNCTION public.health_f18_guard_draft_plan_version();

CREATE TRIGGER health_f18_10_planned_items_draft_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.health_nutrition_planned_items
FOR EACH ROW EXECUTE FUNCTION public.health_f18_guard_draft_plan_version();

CREATE TRIGGER health_f18_10_item_alternatives_draft_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.health_nutrition_item_alternatives
FOR EACH ROW EXECUTE FUNCTION public.health_f18_guard_draft_plan_version();

CREATE TRIGGER health_f18_20_planned_items_snapshot
BEFORE INSERT OR UPDATE ON public.health_nutrition_planned_items
FOR EACH ROW EXECUTE FUNCTION public.health_f18_fill_prescription_snapshot();

CREATE TRIGGER health_f18_20_item_alternatives_snapshot
BEFORE INSERT OR UPDATE ON public.health_nutrition_item_alternatives
FOR EACH ROW EXECUTE FUNCTION public.health_f18_fill_prescription_snapshot();

-- Updated-at timestamps.
CREATE TRIGGER health_nutrition_day_patterns_updated_at
BEFORE UPDATE ON public.health_nutrition_day_patterns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_nutrition_planned_meals_updated_at
BEFORE UPDATE ON public.health_nutrition_planned_meals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_nutrition_planned_items_updated_at
BEFORE UPDATE ON public.health_nutrition_planned_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_nutrition_item_alternatives_updated_at
BEFORE UPDATE ON public.health_nutrition_item_alternatives
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8) RLS + MINIMUM DATA API GRANTS

ALTER TABLE public.health_nutrition_day_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_nutrition_planned_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_nutrition_planned_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_nutrition_item_alternatives ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
  public.health_nutrition_day_patterns,
  public.health_nutrition_planned_meals,
  public.health_nutrition_planned_items,
  public.health_nutrition_item_alternatives
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.health_nutrition_day_patterns,
  public.health_nutrition_planned_meals,
  public.health_nutrition_planned_items,
  public.health_nutrition_item_alternatives
TO authenticated;

-- Day patterns
CREATE POLICY health_nutrition_day_patterns_select
ON public.health_nutrition_day_patterns FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_nutrition_day_patterns_insert
ON public.health_nutrition_day_patterns FOR INSERT TO authenticated
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1
    FROM public.health_nutrition_plan_versions v
    WHERE v.id=plan_version_id
      AND v.athlete_id=health_nutrition_day_patterns.athlete_id
      AND v.status='draft'
  )
);

CREATE POLICY health_nutrition_day_patterns_update
ON public.health_nutrition_day_patterns FOR UPDATE TO authenticated
USING (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_nutrition_plan_versions v
    WHERE v.id=plan_version_id
      AND v.athlete_id=health_nutrition_day_patterns.athlete_id
      AND v.status='draft'
  )
)
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_nutrition_plan_versions v
    WHERE v.id=plan_version_id
      AND v.athlete_id=health_nutrition_day_patterns.athlete_id
      AND v.status='draft'
  )
);

CREATE POLICY health_nutrition_day_patterns_delete
ON public.health_nutrition_day_patterns FOR DELETE TO authenticated
USING (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_nutrition_plan_versions v
    WHERE v.id=plan_version_id
      AND v.athlete_id=health_nutrition_day_patterns.athlete_id
      AND v.status='draft'
  )
);

-- Planned meals
CREATE POLICY health_nutrition_planned_meals_select
ON public.health_nutrition_planned_meals FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_nutrition_planned_meals_insert
ON public.health_nutrition_planned_meals FOR INSERT TO authenticated
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_nutrition_plan_versions v
    WHERE v.id=plan_version_id
      AND v.athlete_id=health_nutrition_planned_meals.athlete_id
      AND v.status='draft'
  )
);

CREATE POLICY health_nutrition_planned_meals_update
ON public.health_nutrition_planned_meals FOR UPDATE TO authenticated
USING (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_nutrition_plan_versions v
    WHERE v.id=plan_version_id
      AND v.athlete_id=health_nutrition_planned_meals.athlete_id
      AND v.status='draft'
  )
)
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_nutrition_plan_versions v
    WHERE v.id=plan_version_id
      AND v.athlete_id=health_nutrition_planned_meals.athlete_id
      AND v.status='draft'
  )
);

CREATE POLICY health_nutrition_planned_meals_delete
ON public.health_nutrition_planned_meals FOR DELETE TO authenticated
USING (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_nutrition_plan_versions v
    WHERE v.id=plan_version_id
      AND v.athlete_id=health_nutrition_planned_meals.athlete_id
      AND v.status='draft'
  )
);

-- Planned items
CREATE POLICY health_nutrition_planned_items_select
ON public.health_nutrition_planned_items FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_nutrition_planned_items_insert
ON public.health_nutrition_planned_items FOR INSERT TO authenticated
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_nutrition_plan_versions v
    WHERE v.id=plan_version_id
      AND v.athlete_id=health_nutrition_planned_items.athlete_id
      AND v.status='draft'
  )
);

CREATE POLICY health_nutrition_planned_items_update
ON public.health_nutrition_planned_items FOR UPDATE TO authenticated
USING (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_nutrition_plan_versions v
    WHERE v.id=plan_version_id
      AND v.athlete_id=health_nutrition_planned_items.athlete_id
      AND v.status='draft'
  )
)
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_nutrition_plan_versions v
    WHERE v.id=plan_version_id
      AND v.athlete_id=health_nutrition_planned_items.athlete_id
      AND v.status='draft'
  )
);

CREATE POLICY health_nutrition_planned_items_delete
ON public.health_nutrition_planned_items FOR DELETE TO authenticated
USING (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_nutrition_plan_versions v
    WHERE v.id=plan_version_id
      AND v.athlete_id=health_nutrition_planned_items.athlete_id
      AND v.status='draft'
  )
);

-- Alternatives
CREATE POLICY health_nutrition_item_alternatives_select
ON public.health_nutrition_item_alternatives FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_nutrition_item_alternatives_insert
ON public.health_nutrition_item_alternatives FOR INSERT TO authenticated
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_nutrition_plan_versions v
    WHERE v.id=plan_version_id
      AND v.athlete_id=health_nutrition_item_alternatives.athlete_id
      AND v.status='draft'
  )
);

CREATE POLICY health_nutrition_item_alternatives_update
ON public.health_nutrition_item_alternatives FOR UPDATE TO authenticated
USING (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_nutrition_plan_versions v
    WHERE v.id=plan_version_id
      AND v.athlete_id=health_nutrition_item_alternatives.athlete_id
      AND v.status='draft'
  )
)
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_nutrition_plan_versions v
    WHERE v.id=plan_version_id
      AND v.athlete_id=health_nutrition_item_alternatives.athlete_id
      AND v.status='draft'
  )
);

CREATE POLICY health_nutrition_item_alternatives_delete
ON public.health_nutrition_item_alternatives FOR DELETE TO authenticated
USING (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_nutrition_plan_versions v
    WHERE v.id=plan_version_id
      AND v.athlete_id=health_nutrition_item_alternatives.athlete_id
      AND v.status='draft'
  )
);

-- Trigger functions are internal implementation details, not public APIs.
REVOKE ALL ON FUNCTION public.health_f18_guard_draft_plan_version()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.health_f18_fill_prescription_snapshot()
FROM PUBLIC, anon, authenticated;

-- End F18 v1.
