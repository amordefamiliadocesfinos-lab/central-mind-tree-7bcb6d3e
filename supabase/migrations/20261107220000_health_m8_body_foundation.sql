-- M8 Health — Body Evolution foundation.
-- Objective facts, private photo metadata, and derived longitudinal state.
-- Body facts are append-only; corrections use supersession or voiding.

CREATE TABLE public.health_body_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  observed_at timestamptz NOT NULL,
  observed_on date NOT NULL,
  data_source text NOT NULL DEFAULT 'MEASURED' CHECK (
    data_source IN ('USER_REPORTED','MEASURED','IMPORTED','SYSTEM_DERIVED','PROFESSIONAL_RECORDED')
  ),
  confidence text NOT NULL DEFAULT 'high' CHECK (confidence IN ('low','moderate','high')),
  conditions jsonb NULL,
  notes text NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','superseded','voided')),
  supersedes_assessment_id uuid NULL REFERENCES public.health_body_assessments(id) ON DELETE RESTRICT,
  void_reason text NULL,
  status_changed_at timestamptz NULL,
  client_event_id uuid NULL,
  created_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, athlete_id),
  UNIQUE (athlete_id, client_event_id),
  CHECK (supersedes_assessment_id IS NULL OR supersedes_assessment_id <> id),
  CHECK ((status='voided' AND void_reason IS NOT NULL) OR status <> 'voided')
);

CREATE INDEX health_body_assessments_athlete_date_idx
ON public.health_body_assessments(athlete_id, observed_on DESC, observed_at DESC);

CREATE INDEX health_body_assessments_status_idx
ON public.health_body_assessments(athlete_id, status, observed_on DESC);

CREATE INDEX health_body_assessments_supersedes_idx
ON public.health_body_assessments(supersedes_assessment_id)
WHERE supersedes_assessment_id IS NOT NULL;

CREATE INDEX health_body_assessments_created_by_idx
ON public.health_body_assessments(created_by_auth_user_id)
WHERE created_by_auth_user_id IS NOT NULL;

CREATE TABLE public.health_body_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL,
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  metric_code text NOT NULL CHECK (
    metric_code IN (
      'weight_kg',
      'waist_cm',
      'hip_cm',
      'chest_cm',
      'neck_cm',
      'arm_left_cm',
      'arm_right_cm',
      'thigh_left_cm',
      'thigh_right_cm',
      'calf_left_cm',
      'calf_right_cm',
      'body_fat_pct',
      'lean_mass_kg',
      'skeletal_muscle_mass_kg'
    )
  ),
  value numeric(10,3) NOT NULL CHECK (value > 0),
  unit_code text NOT NULL CHECK (unit_code IN ('kg','cm','pct')),
  method text NOT NULL DEFAULT 'other' CHECK (
    method IN ('scale','tape','bioimpedance','caliper','dexa','estimated','professional','other')
  ),
  confidence text NOT NULL DEFAULT 'high' CHECK (confidence IN ('low','moderate','high')),
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT health_body_measurements_assessment_athlete_fkey
    FOREIGN KEY (assessment_id, athlete_id)
    REFERENCES public.health_body_assessments(id, athlete_id)
    ON DELETE RESTRICT,
  UNIQUE (assessment_id, metric_code),
  CHECK (
    (metric_code IN ('weight_kg','lean_mass_kg','skeletal_muscle_mass_kg') AND unit_code='kg')
    OR
    (metric_code IN ('waist_cm','hip_cm','chest_cm','neck_cm','arm_left_cm','arm_right_cm','thigh_left_cm','thigh_right_cm','calf_left_cm','calf_right_cm') AND unit_code='cm')
    OR
    (metric_code='body_fat_pct' AND unit_code='pct')
  )
);

CREATE INDEX health_body_measurements_athlete_metric_idx
ON public.health_body_measurements(athlete_id, metric_code, created_at DESC);

CREATE INDEX health_body_measurements_assessment_idx
ON public.health_body_measurements(assessment_id, athlete_id);

CREATE TABLE public.health_body_photo_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  assessment_id uuid NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  captured_on date NOT NULL,
  protocol_version text NOT NULL DEFAULT 'BODY_PHOTO_V1' CHECK (btrim(protocol_version) <> ''),
  conditions jsonb NULL,
  notes text NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','voided')),
  created_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, athlete_id),
  CONSTRAINT health_body_photo_sets_assessment_athlete_fkey
    FOREIGN KEY (assessment_id, athlete_id)
    REFERENCES public.health_body_assessments(id, athlete_id)
    ON DELETE RESTRICT
);

CREATE INDEX health_body_photo_sets_athlete_date_idx
ON public.health_body_photo_sets(athlete_id, captured_on DESC, captured_at DESC)
WHERE status='active';

CREATE INDEX health_body_photo_sets_assessment_idx
ON public.health_body_photo_sets(assessment_id, athlete_id)
WHERE assessment_id IS NOT NULL;

CREATE INDEX health_body_photo_sets_created_by_idx
ON public.health_body_photo_sets(created_by_auth_user_id)
WHERE created_by_auth_user_id IS NOT NULL;

CREATE TABLE public.health_body_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_set_id uuid NOT NULL,
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  angle_code text NOT NULL CHECK (
    angle_code IN ('front_relaxed','left_side_relaxed','back_relaxed','right_side_relaxed','custom')
  ),
  capture_order smallint NOT NULL CHECK (capture_order BETWEEN 1 AND 20),
  object_path text NOT NULL CHECK (btrim(object_path) <> ''),
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
  notes text NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','voided')),
  created_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT health_body_photos_set_athlete_fkey
    FOREIGN KEY (photo_set_id, athlete_id)
    REFERENCES public.health_body_photo_sets(id, athlete_id)
    ON DELETE RESTRICT,
  UNIQUE (photo_set_id, capture_order),
  UNIQUE (photo_set_id, angle_code),
  CHECK (object_path LIKE athlete_id::text || '/progress/%')
);

CREATE INDEX health_body_photos_athlete_idx
ON public.health_body_photos(athlete_id, created_at DESC)
WHERE status='active';

CREATE INDEX health_body_photos_photo_set_idx
ON public.health_body_photos(photo_set_id, athlete_id);

CREATE INDEX health_body_photos_created_by_idx
ON public.health_body_photos(created_by_auth_user_id)
WHERE created_by_auth_user_id IS NOT NULL;

CREATE TABLE public.health_body_rolling_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  as_of_date date NOT NULL,
  window_days integer NOT NULL CHECK (window_days IN (7,14,28)),
  window_start_date date NOT NULL,

  weight_observation_count integer NOT NULL DEFAULT 0 CHECK (weight_observation_count >= 0),
  weight_method_count integer NOT NULL DEFAULT 0 CHECK (weight_method_count >= 0),
  weight_first_kg numeric(10,3) NULL,
  weight_latest_kg numeric(10,3) NULL,
  weight_change_kg numeric(10,3) NULL,
  weight_trend_kg_per_week numeric(10,4) NULL,

  waist_observation_count integer NOT NULL DEFAULT 0 CHECK (waist_observation_count >= 0),
  waist_first_cm numeric(10,3) NULL,
  waist_latest_cm numeric(10,3) NULL,
  waist_change_cm numeric(10,3) NULL,

  body_fat_observation_count integer NOT NULL DEFAULT 0 CHECK (body_fat_observation_count >= 0),
  body_fat_first_pct numeric(10,3) NULL,
  body_fat_latest_pct numeric(10,3) NULL,
  body_fat_change_pct numeric(10,3) NULL,

  photo_set_count integer NOT NULL DEFAULT 0 CHECK (photo_set_count >= 0),
  latest_bmi numeric(8,3) NULL,

  coverage_status text NOT NULL CHECK (coverage_status IN ('unobserved','sparse','partial','complete')),
  confidence text NOT NULL CHECK (confidence IN ('low','moderate','high')),
  reason_codes text[] NOT NULL DEFAULT '{}'::text[],

  algorithm_version text NOT NULL DEFAULT 'M8_BODY_STATE_V1',
  computed_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (athlete_id, as_of_date, window_days)
);

CREATE INDEX health_body_rolling_states_athlete_date_idx
ON public.health_body_rolling_states(athlete_id, as_of_date DESC, window_days);
