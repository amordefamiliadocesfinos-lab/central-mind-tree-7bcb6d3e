-- TEST ONLY: isolated F22/M3 end-to-end publication fixture (never production).
ALTER TABLE public.health_cch_queue_entries ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.health_programs ADD COLUMN status text NOT NULL DEFAULT 'active';
ALTER TABLE public.health_program_versions ADD COLUMN published_at timestamptz;
ALTER TABLE public.health_cch_queue_entries
 ADD COLUMN program_version_id uuid REFERENCES public.health_program_versions(id),
 ADD COLUMN session_template_id uuid REFERENCES public.health_session_templates(id),
 ADD COLUMN queue_position bigint,
 ADD COLUMN state text,
 ADD COLUMN source text,
 ADD COLUMN reason_codes text[],
 ADD COLUMN created_by_auth_user_id uuid;
UPDATE public.health_cch_queue_entries SET
 program_version_id='aaaaaaaa-2000-4000-8000-aaaaaaaaaaaa',
 session_template_id='aaaaaaaa-3000-4000-8000-aaaaaaaaaaab',
 queue_position=1,state='completed',source='fixture',
 reason_codes=ARRAY['HISTORICAL_SYNTHETIC']::text[];

GRANT SELECT,UPDATE ON public.health_programs TO authenticated;
GRANT INSERT ON public.health_cch_queue_entries TO authenticated;
ALTER TABLE public.health_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY e2_read_program ON public.health_programs FOR SELECT TO authenticated
 USING(public.health_can_write_athlete(athlete_id));
CREATE POLICY e2_update_program ON public.health_programs FOR UPDATE TO authenticated
 USING(public.health_can_write_athlete(athlete_id))
 WITH CHECK(public.health_can_write_athlete(athlete_id));

-- The published transition is intentionally permitted only for an owned draft.
DROP POLICY write_version_e2 ON public.health_program_versions;
CREATE POLICY write_version_e2 ON public.health_program_versions
 FOR UPDATE TO authenticated USING (
  public.health_can_write_athlete(athlete_id) AND status='draft')
 WITH CHECK (public.health_can_write_athlete(athlete_id)
  AND status IN ('draft','published'));

ALTER TABLE public.health_cch_queue_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY e2_read_queue ON public.health_cch_queue_entries FOR SELECT TO authenticated
 USING(public.health_can_write_athlete(athlete_id));
CREATE POLICY e2_insert_queue ON public.health_cch_queue_entries FOR INSERT TO authenticated
 WITH CHECK (
  public.health_can_write_athlete(athlete_id) AND
  EXISTS (SELECT 1 FROM public.health_program_versions v
   WHERE v.id=program_version_id AND v.athlete_id=athlete_id AND v.status='published')
 );
CREATE UNIQUE INDEX e2_queue_once ON public.health_cch_queue_entries(program_version_id,session_template_id);
