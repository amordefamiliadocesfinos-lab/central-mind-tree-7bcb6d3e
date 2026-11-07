-- M8 Health — Body Evolution security.
-- Explicit Data API grants + RLS. Photos use the existing private Health bucket.

ALTER TABLE public.health_body_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_body_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_body_photo_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_body_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_body_rolling_states ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
  public.health_body_assessments,
  public.health_body_measurements,
  public.health_body_photo_sets,
  public.health_body_photos,
  public.health_body_rolling_states
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON
  public.health_body_assessments,
  public.health_body_measurements,
  public.health_body_photo_sets,
  public.health_body_photos,
  public.health_body_rolling_states
TO authenticated;

-- Photo metadata is created from the authenticated frontend only after
-- Storage API upload succeeds. Facts and derived states remain RPC-only writes.
GRANT INSERT ON public.health_body_photo_sets TO authenticated;
GRANT INSERT ON public.health_body_photos TO authenticated;

CREATE POLICY health_body_assessments_select
ON public.health_body_assessments
FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_body_measurements_select
ON public.health_body_measurements
FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_body_photo_sets_select
ON public.health_body_photo_sets
FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_body_photo_sets_insert
ON public.health_body_photo_sets
FOR INSERT TO authenticated
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND created_by_auth_user_id = (select auth.uid())
  AND (
    assessment_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.health_body_assessments a
      WHERE a.id=assessment_id
        AND a.athlete_id=athlete_id
        AND a.status='active'
    )
  )
);

CREATE POLICY health_body_photos_select
ON public.health_body_photos
FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_body_photos_insert
ON public.health_body_photos
FOR INSERT TO authenticated
WITH CHECK (
  public.health_can_write_athlete(athlete_id)
  AND created_by_auth_user_id = (select auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.health_body_photo_sets s
    WHERE s.id=photo_set_id
      AND s.athlete_id=athlete_id
      AND s.status='active'
  )
);

CREATE POLICY health_body_rolling_states_select
ON public.health_body_rolling_states
FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

REVOKE ALL ON FUNCTION public.health_m8_record_body_assessment(
  uuid,timestamptz,date,uuid,jsonb,jsonb,text,text,text,uuid
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.health_m8_void_body_assessment(uuid,text)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.health_m8_refresh_body_state(uuid,date,integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.health_m8_record_body_assessment(
  uuid,timestamptz,date,uuid,jsonb,jsonb,text,text,text,uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.health_m8_void_body_assessment(uuid,text)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.health_m8_refresh_body_state(uuid,date,integer)
TO authenticated;
