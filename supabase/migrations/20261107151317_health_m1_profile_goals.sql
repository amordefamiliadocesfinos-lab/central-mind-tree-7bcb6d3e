-- M1 Health: profile, goals/phases, training context, preferences and consents.
-- Body weight/photos remain in the Body domain. Universal equipment catalog remains M2.

CREATE TABLE public.health_athlete_profiles (
  athlete_id uuid PRIMARY KEY REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  date_of_birth date NULL,
  height_cm numeric(5,2) NULL CHECK (height_cm IS NULL OR (height_cm >= 80 AND height_cm <= 260)),
  training_experience_level text NULL CHECK (
    training_experience_level IS NULL
    OR training_experience_level IN ('beginner','intermediate','advanced','returning','unknown')
  ),
  dominant_side text NULL CHECK (
    dominant_side IS NULL OR dominant_side IN ('right','left','mixed','unknown')
  ),
  profile_notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.health_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  goal_type text NOT NULL CHECK (
    goal_type IN (
      'hypertrophy','strength','fat_loss','recomposition',
      'health','performance','maintenance','custom'
    )
  ),
  title text NOT NULL CHECK (btrim(title) <> ''),
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft','active','paused','completed','cancelled')
  ),
  priority smallint NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  is_primary boolean NOT NULL DEFAULT false,
  started_on date NULL,
  target_date date NULL,
  notes text NULL,
  created_by_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (target_date IS NULL OR started_on IS NULL OR target_date >= started_on)
);

CREATE TABLE public.health_goal_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.health_goals(id) ON DELETE CASCADE,
  phase_type text NOT NULL CHECK (
    phase_type IN ('build','cut','recomp','maintenance','performance','reentry','custom')
  ),
  title text NOT NULL CHECK (btrim(title) <> ''),
  status text NOT NULL DEFAULT 'planned' CHECK (
    status IN ('planned','active','completed','cancelled')
  ),
  starts_on date NULL,
  ends_on date NULL,
  objective_notes text NULL,
  created_by_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE public.health_training_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (btrim(name) <> ''),
  location_type text NOT NULL DEFAULT 'gym' CHECK (
    location_type IN ('gym','home','outdoor','travel','other')
  ),
  is_primary boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  notes text NULL,
  created_by_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.health_declared_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  location_id uuid NULL REFERENCES public.health_training_locations(id) ON DELETE SET NULL,
  display_name text NOT NULL CHECK (btrim(display_name) <> ''),
  category text NULL,
  availability text NOT NULL DEFAULT 'available' CHECK (
    availability IN ('available','limited','unavailable','unknown')
  ),
  notes text NULL,
  catalog_equipment_id uuid NULL,
  created_by_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.health_athlete_preferences (
  athlete_id uuid PRIMARY KEY REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  preferred_session_minutes integer NULL CHECK (
    preferred_session_minutes IS NULL OR preferred_session_minutes BETWEEN 15 AND 240
  ),
  preferred_sessions_per_week integer NULL CHECK (
    preferred_sessions_per_week IS NULL OR preferred_sessions_per_week BETWEEN 1 AND 14
  ),
  unit_system text NOT NULL DEFAULT 'metric' CHECK (unit_system IN ('metric','imperial')),
  default_location_id uuid NULL REFERENCES public.health_training_locations(id) ON DELETE SET NULL,
  training_time_preference text NULL CHECK (
    training_time_preference IS NULL
    OR training_time_preference IN ('morning','afternoon','evening','variable')
  ),
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.health_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  consent_type text NOT NULL CHECK (
    consent_type IN (
      'health_data_processing',
      'private_media_storage',
      'media_analysis',
      'coach_sharing',
      'notifications'
    )
  ),
  decision text NOT NULL CHECK (decision IN ('granted','denied','revoked')),
  policy_version text NOT NULL CHECK (btrim(policy_version) <> ''),
  actor_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX health_goals_athlete_idx
  ON public.health_goals(athlete_id, status);

CREATE UNIQUE INDEX health_goals_one_active_primary
  ON public.health_goals(athlete_id)
  WHERE status='active' AND is_primary=true;

CREATE INDEX health_goal_phases_athlete_idx
  ON public.health_goal_phases(athlete_id, status);

CREATE INDEX health_goal_phases_goal_idx
  ON public.health_goal_phases(goal_id);

CREATE UNIQUE INDEX health_goal_phases_one_active_per_athlete
  ON public.health_goal_phases(athlete_id)
  WHERE status='active';

CREATE INDEX health_training_locations_athlete_idx
  ON public.health_training_locations(athlete_id, status);

CREATE UNIQUE INDEX health_training_locations_one_active_primary
  ON public.health_training_locations(athlete_id)
  WHERE status='active' AND is_primary=true;

CREATE INDEX health_declared_equipment_athlete_idx
  ON public.health_declared_equipment(athlete_id, availability);

CREATE INDEX health_declared_equipment_location_idx
  ON public.health_declared_equipment(location_id)
  WHERE location_id IS NOT NULL;

CREATE INDEX health_consents_athlete_idx
  ON public.health_consents(athlete_id, consent_type, occurred_at DESC);

ALTER TABLE public.health_athlete_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_goal_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_training_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_declared_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_athlete_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_consents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
  public.health_athlete_profiles,
  public.health_goals,
  public.health_goal_phases,
  public.health_training_locations,
  public.health_declared_equipment,
  public.health_athlete_preferences,
  public.health_consents
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.health_athlete_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.health_goals TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.health_goal_phases TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.health_training_locations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.health_declared_equipment TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.health_athlete_preferences TO authenticated;
GRANT SELECT, INSERT ON public.health_consents TO authenticated;

-- Profile
CREATE POLICY health_athlete_profiles_select
ON public.health_athlete_profiles FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_athlete_profiles_insert
ON public.health_athlete_profiles FOR INSERT TO authenticated
WITH CHECK (public.health_can_write_athlete(athlete_id));

CREATE POLICY health_athlete_profiles_update
ON public.health_athlete_profiles FOR UPDATE TO authenticated
USING (public.health_can_write_athlete(athlete_id))
WITH CHECK (public.health_can_write_athlete(athlete_id));

-- Goals
CREATE POLICY health_goals_select
ON public.health_goals FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_goals_insert
ON public.health_goals FOR INSERT TO authenticated
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND created_by_auth_user_id = auth.uid()
);

CREATE POLICY health_goals_update
ON public.health_goals FOR UPDATE TO authenticated
USING (public.health_can_write_athlete(athlete_id))
WITH CHECK (public.health_can_write_athlete(athlete_id));

-- Goal phases. Cross-check the referenced goal belongs to the same athlete.
CREATE POLICY health_goal_phases_select
ON public.health_goal_phases FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_goal_phases_insert
ON public.health_goal_phases FOR INSERT TO authenticated
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND created_by_auth_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.health_goals g
    WHERE g.id = goal_id
      AND g.athlete_id = athlete_id
      AND public.health_can_read_athlete(g.athlete_id)
  )
);

CREATE POLICY health_goal_phases_update
ON public.health_goal_phases FOR UPDATE TO authenticated
USING (public.health_can_write_athlete(athlete_id))
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_goals g
    WHERE g.id = goal_id
      AND g.athlete_id = athlete_id
      AND public.health_can_read_athlete(g.athlete_id)
  )
);

-- Locations
CREATE POLICY health_training_locations_select
ON public.health_training_locations FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_training_locations_insert
ON public.health_training_locations FOR INSERT TO authenticated
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND created_by_auth_user_id = auth.uid()
);

CREATE POLICY health_training_locations_update
ON public.health_training_locations FOR UPDATE TO authenticated
USING (public.health_can_write_athlete(athlete_id))
WITH CHECK (public.health_can_write_athlete(athlete_id));

-- Declared equipment
CREATE POLICY health_declared_equipment_select
ON public.health_declared_equipment FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_declared_equipment_insert
ON public.health_declared_equipment FOR INSERT TO authenticated
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND created_by_auth_user_id = auth.uid()
  AND (
    location_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.health_training_locations l
      WHERE l.id = location_id
        AND l.athlete_id = athlete_id
        AND public.health_can_read_athlete(l.athlete_id)
    )
  )
);

CREATE POLICY health_declared_equipment_update
ON public.health_declared_equipment FOR UPDATE TO authenticated
USING (public.health_can_write_athlete(athlete_id))
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND (
    location_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.health_training_locations l
      WHERE l.id = location_id
        AND l.athlete_id = athlete_id
        AND public.health_can_read_athlete(l.athlete_id)
    )
  )
);

-- Preferences
CREATE POLICY health_athlete_preferences_select
ON public.health_athlete_preferences FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_athlete_preferences_insert
ON public.health_athlete_preferences FOR INSERT TO authenticated
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND (
    default_location_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.health_training_locations l
      WHERE l.id = default_location_id
        AND l.athlete_id = athlete_id
        AND public.health_can_read_athlete(l.athlete_id)
    )
  )
);

CREATE POLICY health_athlete_preferences_update
ON public.health_athlete_preferences FOR UPDATE TO authenticated
USING (public.health_can_write_athlete(athlete_id))
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND (
    default_location_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.health_training_locations l
      WHERE l.id = default_location_id
        AND l.athlete_id = athlete_id
        AND public.health_can_read_athlete(l.athlete_id)
    )
  )
);

-- Consent is append-only for authenticated clients.
CREATE POLICY health_consents_select
ON public.health_consents FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_consents_insert
ON public.health_consents FOR INSERT TO authenticated
WITH CHECK (
  public.health_can_manage_athlete_access(athlete_id)
  AND actor_auth_user_id = auth.uid()
);

-- updated_at triggers
CREATE TRIGGER health_athlete_profiles_updated_at
BEFORE UPDATE ON public.health_athlete_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_goals_updated_at
BEFORE UPDATE ON public.health_goals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_goal_phases_updated_at
BEFORE UPDATE ON public.health_goal_phases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_training_locations_updated_at
BEFORE UPDATE ON public.health_training_locations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_declared_equipment_updated_at
BEFORE UPDATE ON public.health_declared_equipment
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_athlete_preferences_updated_at
BEFORE UPDATE ON public.health_athlete_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
