-- M3 Health: athlete program, immutable versions, session templates and continuous CCH queue.
-- No live workout execution is created here. M4 will own execution facts.

-- M1 follow-up: allow athlete-scoped composite references to goal phases.
CREATE UNIQUE INDEX IF NOT EXISTS health_goal_phases_id_athlete_uidx
ON public.health_goal_phases(id, athlete_id);

CREATE TABLE public.health_programs (
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
  CONSTRAINT health_programs_goal_athlete_fkey
    FOREIGN KEY (goal_id, athlete_id)
    REFERENCES public.health_goals(id, athlete_id)
    ON DELETE RESTRICT,
  CONSTRAINT health_programs_goal_phase_athlete_fkey
    FOREIGN KEY (goal_phase_id, athlete_id)
    REFERENCES public.health_goal_phases(id, athlete_id)
    ON DELETE RESTRICT
);

CREATE TABLE public.health_program_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL,
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number >= 1),
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft','published')
  ),
  title text NOT NULL CHECK (btrim(title) <> ''),
  rationale text NULL,
  algorithm_version text NULL,
  parameter_set jsonb NULL,
  published_at timestamptz NULL,
  created_by_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, version_number),
  UNIQUE (id, program_id, athlete_id),
  CONSTRAINT health_program_versions_program_athlete_fkey
    FOREIGN KEY (program_id, athlete_id)
    REFERENCES public.health_programs(id, athlete_id)
    ON DELETE CASCADE,
  CHECK (
    (status='draft' AND published_at IS NULL)
    OR (status='published' AND published_at IS NOT NULL)
  )
);

ALTER TABLE public.health_programs
ADD CONSTRAINT health_programs_current_version_fkey
FOREIGN KEY (current_version_id, id, athlete_id)
REFERENCES public.health_program_versions(id, program_id, athlete_id)
ON DELETE RESTRICT;

CREATE TABLE public.health_program_muscle_priorities (
  program_version_id uuid NOT NULL,
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  muscle_group_id uuid NOT NULL REFERENCES public.health_muscle_groups(id) ON DELETE RESTRICT,
  priority_rank smallint NOT NULL CHECK (priority_rank BETWEEN 1 AND 5),
  emphasis text NOT NULL DEFAULT 'standard' CHECK (
    emphasis IN ('priority','standard','maintenance','deprioritized')
  ),
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (program_version_id, muscle_group_id),
  CONSTRAINT health_program_muscle_priorities_version_athlete_fkey
    FOREIGN KEY (program_version_id, athlete_id)
    REFERENCES public.health_program_versions(id, athlete_id)
    ON DELETE CASCADE
);

CREATE TABLE public.health_session_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_version_id uuid NOT NULL,
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (code ~ '^[A-Z0-9_-]+$'),
  name text NOT NULL CHECK (btrim(name) <> ''),
  sequence_order integer NOT NULL CHECK (sequence_order >= 1),
  session_kind text NOT NULL DEFAULT 'resistance' CHECK (
    session_kind IN ('resistance','cardio','mobility','mixed','recovery')
  ),
  status text NOT NULL DEFAULT 'active' CHECK (
    status IN ('active','disabled')
  ),
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_version_id, code),
  UNIQUE (program_version_id, sequence_order),
  UNIQUE (id, athlete_id),
  CONSTRAINT health_session_templates_version_athlete_fkey
    FOREIGN KEY (program_version_id, athlete_id)
    REFERENCES public.health_program_versions(id, athlete_id)
    ON DELETE CASCADE
);

CREATE TABLE public.health_session_template_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_template_id uuid NOT NULL,
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.health_exercises(id) ON DELETE RESTRICT,
  sequence_order integer NOT NULL CHECK (sequence_order >= 1),
  planned_sets_min smallint NULL CHECK (planned_sets_min IS NULL OR planned_sets_min BETWEEN 1 AND 20),
  planned_sets_max smallint NULL CHECK (planned_sets_max IS NULL OR planned_sets_max BETWEEN 1 AND 20),
  reps_min smallint NULL CHECK (reps_min IS NULL OR reps_min BETWEEN 1 AND 100),
  reps_max smallint NULL CHECK (reps_max IS NULL OR reps_max BETWEEN 1 AND 100),
  rir_target numeric(3,1) NULL CHECK (rir_target IS NULL OR (rir_target >= 0 AND rir_target <= 10)),
  rest_seconds integer NULL CHECK (rest_seconds IS NULL OR rest_seconds BETWEEN 0 AND 1800),
  is_optional boolean NOT NULL DEFAULT false,
  substitution_group text NULL,
  prescription_notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_template_id, sequence_order),
  CONSTRAINT health_session_template_exercises_template_athlete_fkey
    FOREIGN KEY (session_template_id, athlete_id)
    REFERENCES public.health_session_templates(id, athlete_id)
    ON DELETE CASCADE,
  CHECK (
    planned_sets_min IS NULL OR planned_sets_max IS NULL OR planned_sets_max >= planned_sets_min
  ),
  CHECK (
    reps_min IS NULL OR reps_max IS NULL OR reps_max >= reps_min
  )
);

CREATE TABLE public.health_cch_queue_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  program_version_id uuid NOT NULL,
  session_template_id uuid NOT NULL,
  queue_position bigint NOT NULL CHECK (queue_position >= 1),
  state text NOT NULL DEFAULT 'queued' CHECK (
    state IN ('queued','eligible','prioritized','blocked','completed','skipped','superseded')
  ),
  source text NOT NULL DEFAULT 'program_seed' CHECK (
    source IN ('program_seed','manual','reentry','engine')
  ),
  reason_codes text[] NOT NULL DEFAULT '{}'::text[],
  blocked_reason text NULL,
  eligible_after timestamptz NULL,
  predecessor_entry_id uuid NULL REFERENCES public.health_cch_queue_entries(id) ON DELETE SET NULL,
  created_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, queue_position),
  CONSTRAINT health_cch_queue_version_athlete_fkey
    FOREIGN KEY (program_version_id, athlete_id)
    REFERENCES public.health_program_versions(id, athlete_id)
    ON DELETE RESTRICT,
  CONSTRAINT health_cch_queue_template_athlete_fkey
    FOREIGN KEY (session_template_id, athlete_id)
    REFERENCES public.health_session_templates(id, athlete_id)
    ON DELETE RESTRICT,
  CHECK (
    (state='blocked' AND blocked_reason IS NOT NULL)
    OR (state<>'blocked')
  )
);

CREATE INDEX health_programs_athlete_status_idx
ON public.health_programs(athlete_id, status);

CREATE UNIQUE INDEX health_programs_one_active_per_athlete
ON public.health_programs(athlete_id)
WHERE status='active';

CREATE INDEX health_program_versions_program_idx
ON public.health_program_versions(program_id, version_number DESC);

CREATE INDEX health_program_muscle_priorities_athlete_idx
ON public.health_program_muscle_priorities(athlete_id, priority_rank);

CREATE INDEX health_session_templates_version_idx
ON public.health_session_templates(program_version_id, sequence_order)
WHERE status='active';

CREATE INDEX health_session_template_exercises_template_idx
ON public.health_session_template_exercises(session_template_id, sequence_order);

CREATE INDEX health_cch_queue_active_idx
ON public.health_cch_queue_entries(athlete_id, queue_position)
WHERE state IN ('queued','eligible','prioritized','blocked');

ALTER TABLE public.health_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_program_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_program_muscle_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_session_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_session_template_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_cch_queue_entries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
  public.health_programs,
  public.health_program_versions,
  public.health_program_muscle_priorities,
  public.health_session_templates,
  public.health_session_template_exercises,
  public.health_cch_queue_entries
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.health_programs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.health_program_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_program_muscle_priorities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_session_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_session_template_exercises TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.health_cch_queue_entries TO authenticated;

-- Program
CREATE POLICY health_programs_select
ON public.health_programs FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_programs_insert
ON public.health_programs FOR INSERT TO authenticated
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND created_by_auth_user_id = auth.uid()
);

CREATE POLICY health_programs_update
ON public.health_programs FOR UPDATE TO authenticated
USING (public.health_can_write_athlete(athlete_id))
WITH CHECK (public.health_can_write_athlete(athlete_id));

-- Program versions: drafts can be edited. Publishing is one-way for authenticated clients.
CREATE POLICY health_program_versions_select
ON public.health_program_versions FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_program_versions_insert
ON public.health_program_versions FOR INSERT TO authenticated
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND status='draft'
  AND published_at IS NULL
  AND created_by_auth_user_id = auth.uid()
);

CREATE POLICY health_program_versions_update_draft
ON public.health_program_versions FOR UPDATE TO authenticated
USING (
  public.health_can_write_athlete(athlete_id)
  AND status='draft'
)
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND status IN ('draft','published')
  AND (
    (status='draft' AND published_at IS NULL)
    OR (status='published' AND published_at IS NOT NULL)
  )
);

-- Child structures are editable only while their parent version is draft.
CREATE POLICY health_program_muscle_priorities_select
ON public.health_program_muscle_priorities FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_program_muscle_priorities_insert
ON public.health_program_muscle_priorities FOR INSERT TO authenticated
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_program_versions v
    WHERE v.id=program_version_id
      AND v.athlete_id=athlete_id
      AND v.status='draft'
  )
);

CREATE POLICY health_program_muscle_priorities_update
ON public.health_program_muscle_priorities FOR UPDATE TO authenticated
USING (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_program_versions v
    WHERE v.id=program_version_id
      AND v.athlete_id=athlete_id
      AND v.status='draft'
  )
)
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_program_versions v
    WHERE v.id=program_version_id
      AND v.athlete_id=athlete_id
      AND v.status='draft'
  )
);

CREATE POLICY health_program_muscle_priorities_delete
ON public.health_program_muscle_priorities FOR DELETE TO authenticated
USING (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_program_versions v
    WHERE v.id=program_version_id
      AND v.athlete_id=athlete_id
      AND v.status='draft'
  )
);

CREATE POLICY health_session_templates_select
ON public.health_session_templates FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_session_templates_insert
ON public.health_session_templates FOR INSERT TO authenticated
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_program_versions v
    WHERE v.id=program_version_id
      AND v.athlete_id=athlete_id
      AND v.status='draft'
  )
);

CREATE POLICY health_session_templates_update
ON public.health_session_templates FOR UPDATE TO authenticated
USING (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_program_versions v
    WHERE v.id=program_version_id
      AND v.athlete_id=athlete_id
      AND v.status='draft'
  )
)
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_program_versions v
    WHERE v.id=program_version_id
      AND v.athlete_id=athlete_id
      AND v.status='draft'
  )
);

CREATE POLICY health_session_templates_delete
ON public.health_session_templates FOR DELETE TO authenticated
USING (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1 FROM public.health_program_versions v
    WHERE v.id=program_version_id
      AND v.athlete_id=athlete_id
      AND v.status='draft'
  )
);

CREATE POLICY health_session_template_exercises_select
ON public.health_session_template_exercises FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_session_template_exercises_insert
ON public.health_session_template_exercises FOR INSERT TO authenticated
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1
    FROM public.health_session_templates t
    JOIN public.health_program_versions v ON v.id=t.program_version_id
    WHERE t.id=session_template_id
      AND t.athlete_id=athlete_id
      AND v.athlete_id=athlete_id
      AND v.status='draft'
  )
);

CREATE POLICY health_session_template_exercises_update
ON public.health_session_template_exercises FOR UPDATE TO authenticated
USING (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1
    FROM public.health_session_templates t
    JOIN public.health_program_versions v ON v.id=t.program_version_id
    WHERE t.id=session_template_id
      AND t.athlete_id=athlete_id
      AND v.athlete_id=athlete_id
      AND v.status='draft'
  )
)
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1
    FROM public.health_session_templates t
    JOIN public.health_program_versions v ON v.id=t.program_version_id
    WHERE t.id=session_template_id
      AND t.athlete_id=athlete_id
      AND v.athlete_id=athlete_id
      AND v.status='draft'
  )
);

CREATE POLICY health_session_template_exercises_delete
ON public.health_session_template_exercises FOR DELETE TO authenticated
USING (
  public.health_can_write_athlete(athlete_id)
  AND EXISTS (
    SELECT 1
    FROM public.health_session_templates t
    JOIN public.health_program_versions v ON v.id=t.program_version_id
    WHERE t.id=session_template_id
      AND t.athlete_id=athlete_id
      AND v.athlete_id=athlete_id
      AND v.status='draft'
  )
);

-- Queue is athlete-owned. M3 permits manual/system structural queue changes;
-- the deterministic engine will own recommendation semantics in M5.
CREATE POLICY health_cch_queue_select
ON public.health_cch_queue_entries FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_cch_queue_insert
ON public.health_cch_queue_entries FOR INSERT TO authenticated
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND source IN ('program_seed','manual','reentry')
);

CREATE POLICY health_cch_queue_update
ON public.health_cch_queue_entries FOR UPDATE TO authenticated
USING (public.health_can_write_athlete(athlete_id))
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND source IN ('program_seed','manual','reentry','engine')
);

CREATE TRIGGER health_programs_updated_at
BEFORE UPDATE ON public.health_programs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_program_versions_updated_at
BEFORE UPDATE ON public.health_program_versions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_program_muscle_priorities_updated_at
BEFORE UPDATE ON public.health_program_muscle_priorities
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_session_templates_updated_at
BEFORE UPDATE ON public.health_session_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_session_template_exercises_updated_at
BEFORE UPDATE ON public.health_session_template_exercises
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER health_cch_queue_entries_updated_at
BEFORE UPDATE ON public.health_cch_queue_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Program current_version_id must point to a published version.
CREATE OR REPLACE FUNCTION public.health_m3_validate_current_program_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.current_version_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.health_program_versions v
      WHERE v.id=NEW.current_version_id
        AND v.program_id=NEW.id
        AND v.athlete_id=NEW.athlete_id
        AND v.status='published'
    ) THEN
      RAISE EXCEPTION 'current_version_id must reference a published version of the same program and athlete';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.health_m3_validate_current_program_version() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER health_programs_validate_current_version
BEFORE INSERT OR UPDATE OF current_version_id ON public.health_programs
FOR EACH ROW EXECUTE FUNCTION public.health_m3_validate_current_program_version();
