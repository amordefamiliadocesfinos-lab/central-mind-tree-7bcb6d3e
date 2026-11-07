-- M8 Health — Body integrity hardening.

ALTER TABLE public.health_body_measurements
ADD CONSTRAINT health_body_measurements_plausible_value_check
CHECK (
  (metric_code='body_fat_pct' AND value BETWEEN 1 AND 75)
  OR
  (metric_code IN ('weight_kg','lean_mass_kg','skeletal_muscle_mass_kg') AND value BETWEEN 5 AND 400)
  OR
  (
    metric_code IN (
      'waist_cm','hip_cm','chest_cm','neck_cm',
      'arm_left_cm','arm_right_cm',
      'thigh_left_cm','thigh_right_cm',
      'calf_left_cm','calf_right_cm'
    )
    AND value BETWEEN 10 AND 300
  )
);

ALTER TABLE public.health_body_photos
ADD CONSTRAINT health_body_photos_safe_object_path_check
CHECK (object_path !~ '(^|/)\.\.(/|$)');

ALTER TABLE public.health_body_photo_sets
ADD COLUMN void_reason text NULL,
ADD COLUMN status_changed_at timestamptz NULL;

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
      void_reason=btrim(p_reason),
      status_changed_at=now()
  WHERE id=p_photo_set_id;

  UPDATE public.health_body_photos
  SET status='voided'
  WHERE photo_set_id=p_photo_set_id
    AND athlete_id=v_athlete_id
    AND status='active';

  RETURN p_photo_set_id;
END;
$$;
