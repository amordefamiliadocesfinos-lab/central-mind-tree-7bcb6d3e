-- M2 Health: global training catalogs + initial nutrition source/food catalog.
-- Global catalogs are read-only to authenticated frontend users in M2.
-- Scientific/technical catalog maintenance remains a trusted administrative operation.

CREATE TABLE public.health_muscle_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_]+$'),
  name text NOT NULL CHECK (btrim(name) <> ''),
  region text NOT NULL CHECK (
    region IN ('upper_body','lower_body','core')
  ),
  parent_id uuid NULL REFERENCES public.health_muscle_groups(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.health_equipment_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_]+$'),
  name text NOT NULL CHECK (btrim(name) <> ''),
  equipment_type text NOT NULL CHECK (
    equipment_type IN (
      'bodyweight','free_weight','cable','selectorized_machine',
      'plate_loaded_machine','rack','bench','bar','accessory','cardio','other'
    )
  ),
  increment_profile jsonb NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.health_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_]+$'),
  name text NOT NULL CHECK (btrim(name) <> ''),
  movement_pattern text NOT NULL CHECK (
    movement_pattern IN (
      'horizontal_press','vertical_press','horizontal_pull','vertical_pull',
      'squat','hinge','lunge','knee_extension','knee_flexion',
      'hip_extension','hip_abduction','hip_adduction',
      'calf_raise','elbow_flexion','elbow_extension',
      'shoulder_abduction','shoulder_extension','core_flexion',
      'core_anti_extension','core_anti_rotation','carry','other'
    )
  ),
  laterality text NOT NULL DEFAULT 'bilateral' CHECK (
    laterality IN ('bilateral','unilateral','alternating','variable')
  ),
  stability_demand text NULL CHECK (
    stability_demand IS NULL OR stability_demand IN ('low','moderate','high')
  ),
  fatigue_cost text NULL CHECK (
    fatigue_cost IS NULL OR fatigue_cost IN ('low','moderate','high')
  ),
  instructions text NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.health_exercise_muscles (
  exercise_id uuid NOT NULL REFERENCES public.health_exercises(id) ON DELETE CASCADE,
  muscle_group_id uuid NOT NULL REFERENCES public.health_muscle_groups(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('primary','secondary','stabilizer')),
  contribution_weight numeric(4,3) NULL CHECK (
    contribution_weight IS NULL OR (contribution_weight >= 0 AND contribution_weight <= 1)
  ),
  evidence_status text NOT NULL DEFAULT 'curated' CHECK (
    evidence_status IN ('curated','provisional','reviewed')
  ),
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (exercise_id, muscle_group_id)
);

CREATE TABLE public.health_exercise_equipment (
  exercise_id uuid NOT NULL REFERENCES public.health_exercises(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES public.health_equipment_catalog(id) ON DELETE CASCADE,
  requirement_type text NOT NULL DEFAULT 'required' CHECK (
    requirement_type IN ('required','optional','alternative')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (exercise_id, equipment_id)
);

CREATE TABLE public.health_exercise_equivalences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_exercise_id uuid NOT NULL REFERENCES public.health_exercises(id) ON DELETE CASCADE,
  target_exercise_id uuid NOT NULL REFERENCES public.health_exercises(id) ON DELETE CASCADE,
  equivalence_type text NOT NULL CHECK (
    equivalence_type IN ('same_pattern','same_primary_muscle','equipment_alternative','regression','progression')
  ),
  confidence text NOT NULL DEFAULT 'provisional' CHECK (
    confidence IN ('provisional','moderate','high')
  ),
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_exercise_id <> target_exercise_id),
  UNIQUE (source_exercise_id, target_exercise_id, equivalence_type)
);

CREATE TABLE public.health_food_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_code text NOT NULL UNIQUE CHECK (source_code ~ '^[A-Z0-9_]+$'),
  name text NOT NULL CHECK (btrim(name) <> ''),
  provider_type text NOT NULL CHECK (
    provider_type IN ('official_database','manufacturer','laboratory','manual_curated','other')
  ),
  country_code text NULL CHECK (country_code IS NULL OR char_length(country_code)=2),
  reference_url text NULL,
  license_label text NULL,
  release_label text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.health_foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.health_food_sources(id) ON DELETE RESTRICT,
  source_food_key text NOT NULL,
  canonical_name text NOT NULL CHECK (btrim(canonical_name) <> ''),
  brand text NULL,
  country_code text NULL CHECK (country_code IS NULL OR char_length(country_code)=2),
  data_type text NULL,
  basis_amount numeric(10,3) NOT NULL DEFAULT 100 CHECK (basis_amount > 0),
  basis_unit text NOT NULL DEFAULT 'g' CHECK (basis_unit IN ('g','ml','unit')),
  energy_kcal numeric(10,3) NULL CHECK (energy_kcal IS NULL OR energy_kcal >= 0),
  protein_g numeric(10,3) NULL CHECK (protein_g IS NULL OR protein_g >= 0),
  carbohydrate_g numeric(10,3) NULL CHECK (carbohydrate_g IS NULL OR carbohydrate_g >= 0),
  fat_g numeric(10,3) NULL CHECK (fat_g IS NULL OR fat_g >= 0),
  fiber_g numeric(10,3) NULL CHECK (fiber_g IS NULL OR fiber_g >= 0),
  sodium_mg numeric(12,3) NULL CHECK (sodium_mg IS NULL OR sodium_mg >= 0),
  data_quality text NOT NULL DEFAULT 'source_reported' CHECK (
    data_quality IN ('source_reported','analytical','label','calculated','provisional')
  ),
  source_version text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, source_food_key)
);

CREATE INDEX health_muscle_groups_region_idx
  ON public.health_muscle_groups(region, sort_order)
  WHERE is_active=true;

CREATE INDEX health_equipment_catalog_type_idx
  ON public.health_equipment_catalog(equipment_type, sort_order)
  WHERE is_active=true;

CREATE INDEX health_exercises_pattern_idx
  ON public.health_exercises(movement_pattern, sort_order)
  WHERE is_active=true;

CREATE INDEX health_exercise_muscles_muscle_idx
  ON public.health_exercise_muscles(muscle_group_id, role);

CREATE INDEX health_exercise_equipment_equipment_idx
  ON public.health_exercise_equipment(equipment_id);

CREATE INDEX health_exercise_equivalences_source_idx
  ON public.health_exercise_equivalences(source_exercise_id, equivalence_type);

CREATE INDEX health_exercise_equivalences_target_idx
  ON public.health_exercise_equivalences(target_exercise_id, equivalence_type);

CREATE INDEX health_foods_name_idx
  ON public.health_foods(canonical_name)
  WHERE is_active=true;

CREATE INDEX health_foods_source_idx
  ON public.health_foods(source_id, source_food_key)
  WHERE is_active=true;

ALTER TABLE public.health_muscle_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_equipment_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_exercise_muscles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_exercise_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_exercise_equivalences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_food_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_foods ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
  public.health_muscle_groups,
  public.health_equipment_catalog,
  public.health_exercises,
  public.health_exercise_muscles,
  public.health_exercise_equipment,
  public.health_exercise_equivalences,
  public.health_food_sources,
  public.health_foods
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON
  public.health_muscle_groups,
  public.health_equipment_catalog,
  public.health_exercises,
  public.health_exercise_muscles,
  public.health_exercise_equipment,
  public.health_exercise_equivalences,
  public.health_food_sources,
  public.health_foods
TO authenticated;

CREATE POLICY health_muscle_groups_select_authenticated
ON public.health_muscle_groups FOR SELECT TO authenticated
USING (true);

CREATE POLICY health_equipment_catalog_select_authenticated
ON public.health_equipment_catalog FOR SELECT TO authenticated
USING (true);

CREATE POLICY health_exercises_select_authenticated
ON public.health_exercises FOR SELECT TO authenticated
USING (true);

CREATE POLICY health_exercise_muscles_select_authenticated
ON public.health_exercise_muscles FOR SELECT TO authenticated
USING (true);

CREATE POLICY health_exercise_equipment_select_authenticated
ON public.health_exercise_equipment FOR SELECT TO authenticated
USING (true);

CREATE POLICY health_exercise_equivalences_select_authenticated
ON public.health_exercise_equivalences FOR SELECT TO authenticated
USING (true);

CREATE POLICY health_food_sources_select_authenticated
ON public.health_food_sources FOR SELECT TO authenticated
USING (true);

CREATE POLICY health_foods_select_authenticated
ON public.health_foods FOR SELECT TO authenticated
USING (true);

CREATE TRIGGER health_muscle_groups_updated_at
BEFORE UPDATE ON public.health_muscle_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_equipment_catalog_updated_at
BEFORE UPDATE ON public.health_equipment_catalog
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_exercises_updated_at
BEFORE UPDATE ON public.health_exercises
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_food_sources_updated_at
BEFORE UPDATE ON public.health_food_sources
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_foods_updated_at
BEFORE UPDATE ON public.health_foods
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: canonical muscle groups.
INSERT INTO public.health_muscle_groups (code,name,region,sort_order) VALUES
('CHEST','Peitoral','upper_body',10),
('FRONT_DELTOID','Deltoide anterior','upper_body',20),
('LATERAL_DELTOID','Deltoide lateral','upper_body',21),
('REAR_DELTOID','Deltoide posterior','upper_body',22),
('LATS','Latíssimos do dorso','upper_body',30),
('UPPER_BACK','Dorsal superior / romboides','upper_body',31),
('TRAPS','Trapézio','upper_body',32),
('BICEPS','Bíceps','upper_body',40),
('TRICEPS','Tríceps','upper_body',41),
('FOREARMS','Antebraços','upper_body',42),
('QUADS','Quadríceps','lower_body',50),
('HAMSTRINGS','Posteriores de coxa','lower_body',51),
('GLUTES','Glúteos','lower_body',52),
('ADDUCTORS','Adutores','lower_body',53),
('CALVES','Panturrilhas','lower_body',54),
('ABS','Abdômen / core anterior','core',60);

-- Seed: equipment primitives used by the initial exercise library.
INSERT INTO public.health_equipment_catalog (code,name,equipment_type,sort_order) VALUES
('BODYWEIGHT','Peso corporal','bodyweight',10),
('BARBELL','Barra livre','free_weight',20),
('DUMBBELL','Halteres','free_weight',21),
('EZ_BAR','Barra EZ','bar',22),
('CABLE','Polia / cabo','cable',30),
('BENCH','Banco','bench',31),
('PULLUP_BAR','Barra fixa','bar',32),
('LEG_PRESS_45','Leg press 45°','plate_loaded_machine',40),
('LEG_EXTENSION_MACHINE','Cadeira extensora','selectorized_machine',41),
('SEATED_LEG_CURL_MACHINE','Cadeira flexora','selectorized_machine',42),
('HACK_SQUAT_MACHINE','Hack squat','plate_loaded_machine',43),
('HIP_ABDUCTION_MACHINE','Cadeira abdutora','selectorized_machine',44),
('HIP_ADDUCTION_MACHINE','Cadeira adutora','selectorized_machine',45),
('SMITH_MACHINE','Smith machine','plate_loaded_machine',46),
('SEATED_CALF_MACHINE','Panturrilha sentada','plate_loaded_machine',47),
('LAT_PULLDOWN_MACHINE','Puxada alta','selectorized_machine',48),
('SEATED_ROW_MACHINE','Remada baixa','selectorized_machine',49);

-- Seed: foundational exercise library. No numeric muscle contribution is asserted in M2.
INSERT INTO public.health_exercises
  (code,name,movement_pattern,laterality,stability_demand,fatigue_cost,sort_order)
VALUES
('BARBELL_BENCH_PRESS','Supino reto com barra','horizontal_press','bilateral','moderate','moderate',10),
('LAT_PULLDOWN','Puxada alta','vertical_pull','bilateral','low','moderate',20),
('SEATED_ROW','Remada baixa','horizontal_pull','bilateral','low','moderate',21),
('PULLUP','Barra fixa','vertical_pull','bilateral','high','high',22),
('ONE_ARM_DUMBBELL_ROW','Remada serrote','horizontal_pull','unilateral','moderate','moderate',23),
('STRAIGHT_ARM_PULLDOWN','Pulldown braços estendidos','shoulder_extension','bilateral','low','low',24),
('DUMBBELL_LATERAL_RAISE','Elevação lateral com halteres','shoulder_abduction','bilateral','moderate','low',30),
('LEG_PRESS_45','Leg press 45°','squat','bilateral','low','high',40),
('LEG_EXTENSION','Cadeira extensora','knee_extension','bilateral','low','moderate',41),
('HACK_SQUAT','Hack squat','squat','bilateral','low','high',42),
('BACK_SQUAT','Agachamento com barra','squat','bilateral','high','high',43),
('ROMANIAN_DEADLIFT','Stiff / levantamento romeno','hinge','bilateral','moderate','high',50),
('SEATED_LEG_CURL','Cadeira flexora','knee_flexion','bilateral','low','moderate',51),
('HIP_THRUST','Elevação pélvica','hip_extension','bilateral','low','high',52),
('BULGARIAN_SPLIT_SQUAT','Afundo búlgaro','lunge','unilateral','high','high',53),
('HIP_ABDUCTION_MACHINE','Cadeira abdutora','hip_abduction','bilateral','low','low',54),
('HIP_ADDUCTION_MACHINE','Cadeira adutora','hip_adduction','bilateral','low','low',55),
('SEATED_CALF_RAISE','Panturrilha sentada','calf_raise','bilateral','low','moderate',56);

-- Exercise -> muscle categorical relationships.
INSERT INTO public.health_exercise_muscles (exercise_id,muscle_group_id,role)
SELECT e.id,m.id,x.role
FROM (VALUES
  ('BARBELL_BENCH_PRESS','CHEST','primary'),
  ('BARBELL_BENCH_PRESS','FRONT_DELTOID','secondary'),
  ('BARBELL_BENCH_PRESS','TRICEPS','secondary'),
  ('LAT_PULLDOWN','LATS','primary'),
  ('LAT_PULLDOWN','BICEPS','secondary'),
  ('SEATED_ROW','UPPER_BACK','primary'),
  ('SEATED_ROW','LATS','secondary'),
  ('SEATED_ROW','BICEPS','secondary'),
  ('PULLUP','LATS','primary'),
  ('PULLUP','BICEPS','secondary'),
  ('ONE_ARM_DUMBBELL_ROW','LATS','primary'),
  ('ONE_ARM_DUMBBELL_ROW','UPPER_BACK','secondary'),
  ('ONE_ARM_DUMBBELL_ROW','BICEPS','secondary'),
  ('STRAIGHT_ARM_PULLDOWN','LATS','primary'),
  ('DUMBBELL_LATERAL_RAISE','LATERAL_DELTOID','primary'),
  ('LEG_PRESS_45','QUADS','primary'),
  ('LEG_PRESS_45','GLUTES','secondary'),
  ('LEG_EXTENSION','QUADS','primary'),
  ('HACK_SQUAT','QUADS','primary'),
  ('HACK_SQUAT','GLUTES','secondary'),
  ('BACK_SQUAT','QUADS','primary'),
  ('BACK_SQUAT','GLUTES','secondary'),
  ('BACK_SQUAT','ADDUCTORS','secondary'),
  ('ROMANIAN_DEADLIFT','HAMSTRINGS','primary'),
  ('ROMANIAN_DEADLIFT','GLUTES','secondary'),
  ('SEATED_LEG_CURL','HAMSTRINGS','primary'),
  ('HIP_THRUST','GLUTES','primary'),
  ('BULGARIAN_SPLIT_SQUAT','QUADS','primary'),
  ('BULGARIAN_SPLIT_SQUAT','GLUTES','secondary'),
  ('HIP_ABDUCTION_MACHINE','GLUTES','primary'),
  ('HIP_ADDUCTION_MACHINE','ADDUCTORS','primary'),
  ('SEATED_CALF_RAISE','CALVES','primary')
) AS x(exercise_code,muscle_code,role)
JOIN public.health_exercises e ON e.code=x.exercise_code
JOIN public.health_muscle_groups m ON m.code=x.muscle_code;

-- Exercise -> equipment.
INSERT INTO public.health_exercise_equipment (exercise_id,equipment_id,requirement_type)
SELECT e.id,q.id,x.requirement_type
FROM (VALUES
  ('BARBELL_BENCH_PRESS','BARBELL','required'),
  ('BARBELL_BENCH_PRESS','BENCH','required'),
  ('LAT_PULLDOWN','LAT_PULLDOWN_MACHINE','required'),
  ('SEATED_ROW','SEATED_ROW_MACHINE','required'),
  ('PULLUP','PULLUP_BAR','required'),
  ('ONE_ARM_DUMBBELL_ROW','DUMBBELL','required'),
  ('ONE_ARM_DUMBBELL_ROW','BENCH','optional'),
  ('STRAIGHT_ARM_PULLDOWN','CABLE','required'),
  ('DUMBBELL_LATERAL_RAISE','DUMBBELL','required'),
  ('LEG_PRESS_45','LEG_PRESS_45','required'),
  ('LEG_EXTENSION','LEG_EXTENSION_MACHINE','required'),
  ('HACK_SQUAT','HACK_SQUAT_MACHINE','required'),
  ('BACK_SQUAT','BARBELL','required'),
  ('ROMANIAN_DEADLIFT','BARBELL','required'),
  ('ROMANIAN_DEADLIFT','DUMBBELL','alternative'),
  ('SEATED_LEG_CURL','SEATED_LEG_CURL_MACHINE','required'),
  ('HIP_THRUST','BARBELL','required'),
  ('HIP_THRUST','BENCH','required'),
  ('BULGARIAN_SPLIT_SQUAT','DUMBBELL','optional'),
  ('BULGARIAN_SPLIT_SQUAT','BENCH','required'),
  ('HIP_ABDUCTION_MACHINE','HIP_ABDUCTION_MACHINE','required'),
  ('HIP_ADDUCTION_MACHINE','HIP_ADDUCTION_MACHINE','required'),
  ('SEATED_CALF_RAISE','SEATED_CALF_MACHINE','required')
) AS x(exercise_code,equipment_code,requirement_type)
JOIN public.health_exercises e ON e.code=x.exercise_code
JOIN public.health_equipment_catalog q ON q.code=x.equipment_code;

-- Provisional equivalence edges. These are catalog candidates, not Motor decisions.
INSERT INTO public.health_exercise_equivalences
  (source_exercise_id,target_exercise_id,equivalence_type,confidence,notes)
SELECT s.id,t.id,x.equivalence_type,'provisional',x.notes
FROM (VALUES
  ('LAT_PULLDOWN','PULLUP','same_pattern','Vertical pull alternatives; athlete capability decides later.'),
  ('PULLUP','LAT_PULLDOWN','regression','Potential regression path; decision engine must evaluate capability.'),
  ('LEG_PRESS_45','HACK_SQUAT','same_pattern','Squat-pattern machine alternatives.'),
  ('HACK_SQUAT','LEG_PRESS_45','same_pattern','Squat-pattern machine alternatives.'),
  ('BACK_SQUAT','HACK_SQUAT','equipment_alternative','Different stability/equipment demands.'),
  ('ROMANIAN_DEADLIFT','SEATED_LEG_CURL','same_primary_muscle','Hamstring emphasis but different movement patterns; not interchangeable by default.')
) AS x(source_code,target_code,equivalence_type,notes)
JOIN public.health_exercises s ON s.code=x.source_code
JOIN public.health_exercises t ON t.code=x.target_code;

-- Nutrition source registry. Food rows are not seeded until source-specific import is reviewed.
INSERT INTO public.health_food_sources
  (source_code,name,provider_type,country_code,reference_url,license_label,release_label)
VALUES
(
  'TBCA',
  'Tabela Brasileira de Composição de Alimentos (TBCA)',
  'official_database',
  'BR',
  'https://www.tbca.net.br/',
  NULL,
  'catalog source registry 2026-11'
),
(
  'USDA_FDC',
  'USDA FoodData Central',
  'official_database',
  'US',
  'https://fdc.nal.usda.gov/',
  'CC0 1.0 / public domain',
  'Foundation Foods 2026-10'
);
