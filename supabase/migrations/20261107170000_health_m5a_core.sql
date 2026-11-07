-- M5A Health — Nutrition Foundation Core

-- 1) PLAN IDENTITY + IMMUTABLE VERSIONS

CREATE TABLE public.health_nutrition_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  goal_id uuid NULL,
  goal_phase_id uuid NULL,
  current_version_id uuid NULL,
  name text NOT NULL CHECK (btrim(name) <> ''),
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft','active','paused','completed','archived')
  ),
  source text NOT NULL DEFAULT 'manual' CHECK (
    source IN ('manual','template','system')
  ),
  notes text NULL,
  created_by_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, athlete_id),
  CONSTRAINT health_nutrition_plans_goal_athlete_fkey
    FOREIGN KEY (goal_id, athlete_id)
    REFERENCES public.health_goals(id, athlete_id)
    ON DELETE RESTRICT,
  CONSTRAINT health_nutrition_plans_goal_phase_athlete_fkey
    FOREIGN KEY (goal_phase_id, athlete_id)
    REFERENCES public.health_goal_phases(id, athlete_id)
    ON DELETE RESTRICT
);

CREATE TABLE public.health_nutrition_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number >= 1),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  strategy_type text NOT NULL CHECK (
    strategy_type IN (
      'maintenance','energy_deficit','energy_surplus',
      'recomposition_support','performance_support','custom'
    )
  ),
  title text NOT NULL CHECK (btrim(title) <> ''),
  rationale text NULL,
  algorithm_version text NULL,
  parameter_set jsonb NULL,
  effective_from date NULL,
  effective_to date NULL,
  published_at timestamptz NULL,
  created_by_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, version_number),
  UNIQUE (id, athlete_id),
  UNIQUE (id, plan_id, athlete_id),
  CONSTRAINT health_nutrition_plan_versions_plan_athlete_fkey
    FOREIGN KEY (plan_id, athlete_id)
    REFERENCES public.health_nutrition_plans(id, athlete_id)
    ON DELETE CASCADE,
  CHECK (
    (status='draft' AND published_at IS NULL)
    OR (status='published' AND published_at IS NOT NULL)
  ),
  CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from)
);

ALTER TABLE public.health_nutrition_plans
ADD CONSTRAINT health_nutrition_plans_current_version_fkey
FOREIGN KEY (current_version_id, id, athlete_id)
REFERENCES public.health_nutrition_plan_versions(id, plan_id, athlete_id)
ON DELETE RESTRICT;

CREATE TABLE public.health_nutrition_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id uuid NOT NULL,
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  energy_kcal_min numeric(10,2) NULL CHECK (energy_kcal_min IS NULL OR energy_kcal_min >= 0),
  energy_kcal_max numeric(10,2) NULL CHECK (energy_kcal_max IS NULL OR energy_kcal_max >= 0),
  protein_g_min numeric(10,2) NULL CHECK (protein_g_min IS NULL OR protein_g_min >= 0),
  protein_g_max numeric(10,2) NULL CHECK (protein_g_max IS NULL OR protein_g_max >= 0),
  carbohydrate_g_min numeric(10,2) NULL CHECK (carbohydrate_g_min IS NULL OR carbohydrate_g_min >= 0),
  carbohydrate_g_max numeric(10,2) NULL CHECK (carbohydrate_g_max IS NULL OR carbohydrate_g_max >= 0),
  fat_g_min numeric(10,2) NULL CHECK (fat_g_min IS NULL OR fat_g_min >= 0),
  fat_g_max numeric(10,2) NULL CHECK (fat_g_max IS NULL OR fat_g_max >= 0),
  fiber_g_min numeric(10,2) NULL CHECK (fiber_g_min IS NULL OR fiber_g_min >= 0),
  fiber_g_max numeric(10,2) NULL CHECK (fiber_g_max IS NULL OR fiber_g_max >= 0),
  target_basis text NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_version_id, athlete_id),
  CONSTRAINT health_nutrition_targets_plan_version_athlete_fkey
    FOREIGN KEY (plan_version_id, athlete_id)
    REFERENCES public.health_nutrition_plan_versions(id, athlete_id)
    ON DELETE CASCADE,
  CHECK (energy_kcal_max IS NULL OR energy_kcal_min IS NULL OR energy_kcal_max >= energy_kcal_min),
  CHECK (protein_g_max IS NULL OR protein_g_min IS NULL OR protein_g_max >= protein_g_min),
  CHECK (carbohydrate_g_max IS NULL OR carbohydrate_g_min IS NULL OR carbohydrate_g_max >= carbohydrate_g_min),
  CHECK (fat_g_max IS NULL OR fat_g_min IS NULL OR fat_g_max >= fat_g_min),
  CHECK (fiber_g_max IS NULL OR fiber_g_min IS NULL OR fiber_g_max >= fiber_g_min),
  CHECK (
    energy_kcal_min IS NOT NULL OR energy_kcal_max IS NOT NULL
    OR protein_g_min IS NOT NULL OR protein_g_max IS NOT NULL
    OR carbohydrate_g_min IS NOT NULL OR carbohydrate_g_max IS NOT NULL
    OR fat_g_min IS NOT NULL OR fat_g_max IS NOT NULL
    OR fiber_g_min IS NOT NULL OR fiber_g_max IS NOT NULL
  )
);

-- 2) VERSIONED RECIPES

CREATE TABLE public.health_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  owner_scope text NOT NULL DEFAULT 'athlete' CHECK (owner_scope IN ('athlete','global')),
  current_version_id uuid NULL,
  name text NOT NULL CHECK (btrim(name) <> ''),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  created_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (owner_scope='global' AND athlete_id IS NULL)
    OR (owner_scope='athlete' AND athlete_id IS NOT NULL)
  )
);

CREATE TABLE public.health_recipe_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.health_recipes(id) ON DELETE CASCADE,
  athlete_id uuid NULL,
  version_number integer NOT NULL CHECK (version_number >= 1),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  title text NOT NULL CHECK (btrim(title) <> ''),
  preparation_notes text NULL,
  yield_amount numeric(12,3) NULL CHECK (yield_amount IS NULL OR yield_amount > 0),
  yield_unit text NULL CHECK (yield_unit IS NULL OR yield_unit IN ('g','ml','unit','serving')),
  servings numeric(10,3) NULL CHECK (servings IS NULL OR servings > 0),
  published_at timestamptz NULL,
  created_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipe_id, version_number),
  UNIQUE (id, athlete_id),
  CHECK (
    (status='draft' AND published_at IS NULL)
    OR (status='published' AND published_at IS NOT NULL)
  )
);

ALTER TABLE public.health_recipes
ADD CONSTRAINT health_recipes_current_version_fkey
FOREIGN KEY (current_version_id)
REFERENCES public.health_recipe_versions(id)
ON DELETE RESTRICT;

CREATE TABLE public.health_recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_version_id uuid NOT NULL REFERENCES public.health_recipe_versions(id) ON DELETE CASCADE,
  athlete_id uuid NULL,
  food_id uuid NOT NULL REFERENCES public.health_foods(id) ON DELETE RESTRICT,
  sequence_order integer NOT NULL CHECK (sequence_order >= 1),
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  unit_code text NOT NULL CHECK (unit_code IN ('g','ml','unit')),
  preparation_state text NOT NULL DEFAULT 'unknown' CHECK (
    preparation_state IN ('raw','cooked','drained','prepared','unknown','not_applicable')
  ),
  is_optional boolean NOT NULL DEFAULT false,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipe_version_id, sequence_order),
  UNIQUE (id, recipe_version_id)
);

-- 3) FOOD LOG EXECUTION FACTS

CREATE TABLE public.health_food_log_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  completeness_status text NOT NULL DEFAULT 'unknown' CHECK (
    completeness_status IN ('unknown','partial','complete')
  ),
  registration_level text NOT NULL DEFAULT 'minimal' CHECK (
    registration_level IN ('minimal','intermediate','complete')
  ),
  confidence text NOT NULL DEFAULT 'low' CHECK (
    confidence IN ('low','moderate','high')
  ),
  confidence_score numeric(5,4) NULL CHECK (
    confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)
  ),
  confidence_reason_codes text[] NOT NULL DEFAULT '{}'::text[],
  completion_confirmed_by text NULL CHECK (
    completion_confirmed_by IS NULL
    OR completion_confirmed_by IN ('user','professional','workflow')
  ),
  completed_at timestamptz NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, log_date),
  UNIQUE (id, athlete_id),
  CHECK (
    (completeness_status='complete' AND completed_at IS NOT NULL AND completion_confirmed_by IS NOT NULL)
    OR
    (completeness_status<>'complete' AND completed_at IS NULL AND completion_confirmed_by IS NULL)
  )
);

CREATE TABLE public.health_meal_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  food_log_day_id uuid NOT NULL,
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  meal_type text NOT NULL DEFAULT 'other' CHECK (
    meal_type IN ('breakfast','lunch','dinner','snack','pre_workout','post_workout','other')
  ),
  occurred_at timestamptz NULL,
  data_source text NOT NULL CHECK (
    data_source IN (
      'USER_REPORTED','MEASURED','IMPORTED',
      'SYSTEM_DERIVED','PROFESSIONAL_RECORDED'
    )
  ),
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, athlete_id),
  CONSTRAINT health_meal_logs_day_athlete_fkey
    FOREIGN KEY (food_log_day_id, athlete_id)
    REFERENCES public.health_food_log_days(id, athlete_id)
    ON DELETE CASCADE
);

CREATE TABLE public.health_meal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_log_id uuid NOT NULL,
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  food_id uuid NULL REFERENCES public.health_foods(id) ON DELETE RESTRICT,
  recipe_version_id uuid NULL REFERENCES public.health_recipe_versions(id) ON DELETE RESTRICT,
  item_name_snapshot text NOT NULL CHECK (btrim(item_name_snapshot) <> ''),
  quantity numeric(12,3) NULL CHECK (quantity IS NULL OR quantity > 0),
  unit_code text NULL CHECK (unit_code IS NULL OR unit_code IN ('g','ml','unit')),
  household_measure_text text NULL,
  preparation_state text NOT NULL DEFAULT 'unknown' CHECK (
    preparation_state IN ('raw','cooked','drained','prepared','unknown','not_applicable')
  ),
  estimation_method text NOT NULL CHECK (
    estimation_method IN (
      'weighed','label','declared_quantity',
      'household_measure','visual_estimate','approximate_description'
    )
  ),
  data_source text NOT NULL CHECK (
    data_source IN (
      'USER_REPORTED','MEASURED','IMPORTED',
      'SYSTEM_DERIVED','PROFESSIONAL_RECORDED'
    )
  ),
  confidence text NOT NULL DEFAULT 'low' CHECK (
    confidence IN ('low','moderate','high')
  ),
  confidence_score numeric(5,4) NULL CHECK (
    confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)
  ),
  confidence_reason_codes text[] NOT NULL DEFAULT '{}'::text[],
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
  sodium_mg_snapshot numeric(14,3) NULL CHECK (
    sodium_mg_snapshot IS NULL OR sodium_mg_snapshot >= 0
  ),
  food_source_id_snapshot uuid NULL,
  source_version_snapshot text NULL,
  data_quality_snapshot text NULL,
  status text NOT NULL DEFAULT 'active' CHECK (
    status IN ('active','superseded','voided')
  ),
  supersedes_item_id uuid NULL,
  correction_reason text NULL,
  created_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, athlete_id),
  CONSTRAINT health_meal_items_meal_athlete_fkey
    FOREIGN KEY (meal_log_id, athlete_id)
    REFERENCES public.health_meal_logs(id, athlete_id)
    ON DELETE CASCADE,
  CONSTRAINT health_meal_items_supersedes_athlete_fkey
    FOREIGN KEY (supersedes_item_id, athlete_id)
    REFERENCES public.health_meal_items(id, athlete_id)
    ON DELETE RESTRICT,
  CHECK (NOT (food_id IS NOT NULL AND recipe_version_id IS NOT NULL)),
  CHECK (supersedes_item_id IS NULL OR status='active')
);

CREATE TABLE public.health_meal_item_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  meal_item_id uuid NOT NULL,
  event_type text NOT NULL CHECK (
    event_type IN ('created','corrected','superseded','voided','note')
  ),
  payload jsonb NULL,
  client_event_id uuid NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  UNIQUE (athlete_id, client_event_id),
  CONSTRAINT health_meal_item_events_item_athlete_fkey
    FOREIGN KEY (meal_item_id, athlete_id)
    REFERENCES public.health_meal_items(id, athlete_id)
    ON DELETE RESTRICT
);

-- 4) INDEXES

CREATE INDEX health_nutrition_plans_athlete_status_idx
ON public.health_nutrition_plans(athlete_id, status);

CREATE UNIQUE INDEX health_nutrition_plans_one_active_per_athlete
ON public.health_nutrition_plans(athlete_id)
WHERE status='active';

CREATE INDEX health_nutrition_plan_versions_plan_idx
ON public.health_nutrition_plan_versions(plan_id, version_number DESC);

CREATE INDEX health_nutrition_targets_version_idx
ON public.health_nutrition_targets(plan_version_id);

CREATE INDEX health_recipes_athlete_status_idx
ON public.health_recipes(athlete_id, status)
WHERE athlete_id IS NOT NULL;

CREATE INDEX health_recipe_versions_recipe_idx
ON public.health_recipe_versions(recipe_id, version_number DESC);

CREATE INDEX health_recipe_ingredients_version_idx
ON public.health_recipe_ingredients(recipe_version_id, sequence_order);

CREATE INDEX health_food_log_days_athlete_date_idx
ON public.health_food_log_days(athlete_id, log_date DESC);

CREATE INDEX health_meal_logs_day_time_idx
ON public.health_meal_logs(food_log_day_id, occurred_at);

CREATE INDEX health_meal_items_meal_idx
ON public.health_meal_items(meal_log_id);

CREATE INDEX health_meal_items_food_idx
ON public.health_meal_items(food_id)
WHERE food_id IS NOT NULL;

CREATE INDEX health_meal_items_recipe_version_idx
ON public.health_meal_items(recipe_version_id)
WHERE recipe_version_id IS NOT NULL;

CREATE INDEX health_meal_item_events_item_time_idx
ON public.health_meal_item_events(meal_item_id, occurred_at);
