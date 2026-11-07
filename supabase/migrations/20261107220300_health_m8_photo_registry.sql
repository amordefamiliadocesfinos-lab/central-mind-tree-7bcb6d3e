-- M8 Health — Private body photo metadata registration.
-- Binary objects are uploaded/deleted via Supabase Storage API only.

CREATE OR REPLACE FUNCTION public.health_m8_register_body_photo_set(
  p_athlete_id uuid,
  p_photo_set_id uuid,
  p_captured_at timestamptz,
  p_captured_on date,
  p_photos jsonb,
  p_conditions jsonb DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_assessment_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_latest_consent text;
  v_existing_id uuid;
BEGIN
  IF NOT public.health_can_write_athlete(p_athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF p_photo_set_id IS NULL OR p_captured_at IS NULL OR p_captured_on IS NULL THEN
    RAISE EXCEPTION 'photo_set_id, captured_at, and captured_on are required';
  END IF;

  IF p_photos IS NULL
     OR jsonb_typeof(p_photos) <> 'array'
     OR jsonb_array_length(p_photos) = 0 THEN
    RAISE EXCEPTION 'photos must be a non-empty JSON array';
  END IF;

  SELECT c.decision
  INTO v_latest_consent
  FROM public.health_consents c
  WHERE c.athlete_id=p_athlete_id
    AND c.consent_type='private_media_storage'
  ORDER BY c.occurred_at DESC,c.created_at DESC
  LIMIT 1;

  IF v_latest_consent IS DISTINCT FROM 'granted' THEN
    RAISE EXCEPTION 'private media storage consent is required';
  END IF;

  SELECT s.id
  INTO v_existing_id
  FROM public.health_body_photo_sets s
  WHERE s.id=p_photo_set_id
    AND s.athlete_id=p_athlete_id;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  IF p_assessment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.health_body_assessments a
    WHERE a.id=p_assessment_id
      AND a.athlete_id=p_athlete_id
      AND a.status='active'
  ) THEN
    RAISE EXCEPTION 'active assessment not found for photo set';
  END IF;

  INSERT INTO public.health_body_photo_sets (
    id,
    athlete_id,
    assessment_id,
    captured_at,
    captured_on,
    protocol_version,
    conditions,
    notes,
    status
  ) VALUES (
    p_photo_set_id,
    p_athlete_id,
    p_assessment_id,
    p_captured_at,
    p_captured_on,
    'BODY_PHOTO_V1',
    p_conditions,
    NULLIF(btrim(p_notes),''),
    'active'
  );

  INSERT INTO public.health_body_photos (
    id,
    photo_set_id,
    athlete_id,
    angle_code,
    capture_order,
    object_path,
    mime_type,
    notes,
    status
  )
  SELECT
    COALESCE(p.id,gen_random_uuid()),
    p_photo_set_id,
    p_athlete_id,
    p.angle_code,
    p.capture_order,
    p.object_path,
    p.mime_type,
    NULLIF(btrim(p.notes),''),
    'active'
  FROM jsonb_to_recordset(p_photos) AS p(
    id uuid,
    angle_code text,
    capture_order smallint,
    object_path text,
    mime_type text,
    notes text
  );

  RETURN p_photo_set_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m8_void_body_photo_set(
  p_photo_set_id uuid,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_athlete_id uuid;
  v_status text;
BEGIN
  SELECT s.athlete_id,s.status
  INTO v_athlete_id,v_status
  FROM public.health_body_photo_sets s
  WHERE s.id=p_photo_set_id
  FOR UPDATE;

  IF v_athlete_id IS NULL THEN
    RAISE EXCEPTION 'photo set not found';
  END IF;

  IF NOT public.health_can_write_athlete(v_athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF v_status <> 'active' THEN
    RETURN p_photo_set_id;
  END IF;

  IF NULLIF(btrim(p_reason),'') IS NULL THEN
    RAISE EXCEPTION 'void reason is required';
  END IF;

  UPDATE public.health_body_photo_sets
  SET status='voided',
      notes=concat_ws(E'\n',notes,'Voided: ' || btrim(p_reason))
  WHERE id=p_photo_set_id;

  UPDATE public.health_body_photos
  SET status='voided'
  WHERE photo_set_id=p_photo_set_id
    AND athlete_id=v_athlete_id
    AND status='active';

  RETURN p_photo_set_id;
END;
$$;

-- M8 photo metadata is RPC-only. Storage binaries remain Storage API-only.
DROP POLICY IF EXISTS health_body_photo_sets_insert ON public.health_body_photo_sets;
DROP POLICY IF EXISTS health_body_photos_insert ON public.health_body_photos;

REVOKE INSERT ON public.health_body_photo_sets FROM authenticated;
REVOKE INSERT ON public.health_body_photos FROM authenticated;

REVOKE ALL ON FUNCTION public.health_m8_register_body_photo_set(
  uuid,uuid,timestamptz,date,jsonb,jsonb,text,uuid
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.health_m8_void_body_photo_set(uuid,text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.health_m8_register_body_photo_set(
  uuid,uuid,timestamptz,date,jsonb,jsonb,text,uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.health_m8_void_body_photo_set(uuid,text)
TO authenticated;
