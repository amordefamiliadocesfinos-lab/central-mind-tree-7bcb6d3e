-- M3 Health RPCs.
-- SECURITY INVOKER is intentional: RLS remains authoritative.

CREATE OR REPLACE FUNCTION public.health_m3_create_program_draft(
  p_athlete_id uuid,
  p_name text
)
RETURNS TABLE (
  program_id uuid,
  program_version_id uuid
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_program_id uuid;
  v_version_id uuid;
  v_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NOT public.health_can_write_athlete(p_athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  v_name := btrim(p_name);
  IF v_name IS NULL OR v_name = '' THEN
    RAISE EXCEPTION 'program name is required';
  END IF;

  INSERT INTO public.health_programs (
    athlete_id,
    name,
    status,
    source,
    created_by_auth_user_id
  )
  VALUES (
    p_athlete_id,
    v_name,
    'draft',
    'manual',
    auth.uid()
  )
  RETURNING id INTO v_program_id;

  INSERT INTO public.health_program_versions (
    program_id,
    athlete_id,
    version_number,
    status,
    title,
    created_by_auth_user_id
  )
  VALUES (
    v_program_id,
    p_athlete_id,
    1,
    'draft',
    v_name || ' — versão 1',
    auth.uid()
  )
  RETURNING id INTO v_version_id;

  RETURN QUERY SELECT v_program_id, v_version_id;
END;
$$;

REVOKE ALL ON FUNCTION public.health_m3_create_program_draft(uuid, text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.health_m3_create_program_draft(uuid, text)
TO authenticated;

CREATE OR REPLACE FUNCTION public.health_m3_publish_program_version(
  p_program_version_id uuid
)
RETURNS TABLE (
  program_id uuid,
  queued_count integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_program_id uuid;
  v_athlete_id uuid;
  v_template_count integer;
  v_start_position bigint;
  v_queued_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT v.program_id, v.athlete_id
  INTO v_program_id, v_athlete_id
  FROM public.health_program_versions v
  WHERE v.id = p_program_version_id
    AND v.status = 'draft';

  IF v_program_id IS NULL THEN
    RAISE EXCEPTION 'draft program version not found or not visible';
  END IF;

  IF NOT public.health_can_write_athlete(v_athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  SELECT count(*)
  INTO v_template_count
  FROM public.health_session_templates t
  WHERE t.program_version_id = p_program_version_id
    AND t.athlete_id = v_athlete_id
    AND t.status = 'active';

  IF v_template_count < 1 THEN
    RAISE EXCEPTION 'at least one active session template is required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.health_session_templates t
    WHERE t.program_version_id = p_program_version_id
      AND t.athlete_id = v_athlete_id
      AND t.status = 'active'
      AND NOT EXISTS (
        SELECT 1
        FROM public.health_session_template_exercises e
        WHERE e.session_template_id = t.id
          AND e.athlete_id = v_athlete_id
      )
  ) THEN
    RAISE EXCEPTION 'every active session template must contain at least one exercise';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.health_cch_queue_entries q
    WHERE q.program_version_id = p_program_version_id
      AND q.athlete_id = v_athlete_id
  ) THEN
    RAISE EXCEPTION 'queue already seeded for this program version';
  END IF;

  SELECT coalesce(max(q.queue_position), 0)
  INTO v_start_position
  FROM public.health_cch_queue_entries q
  WHERE q.athlete_id = v_athlete_id;

  UPDATE public.health_program_versions
  SET
    status = 'published',
    published_at = now()
  WHERE id = p_program_version_id
    AND athlete_id = v_athlete_id
    AND status = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'program version could not be published';
  END IF;

  UPDATE public.health_programs
  SET
    current_version_id = p_program_version_id,
    status = 'active'
  WHERE id = v_program_id
    AND athlete_id = v_athlete_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'program could not be activated';
  END IF;

  INSERT INTO public.health_cch_queue_entries (
    athlete_id,
    program_version_id,
    session_template_id,
    queue_position,
    state,
    source,
    reason_codes,
    created_by_auth_user_id
  )
  SELECT
    v_athlete_id,
    p_program_version_id,
    t.id,
    v_start_position + row_number() OVER (ORDER BY t.sequence_order),
    'queued',
    'program_seed',
    ARRAY['PROGRAM_VERSION_PUBLISHED']::text[],
    auth.uid()
  FROM public.health_session_templates t
  WHERE t.program_version_id = p_program_version_id
    AND t.athlete_id = v_athlete_id
    AND t.status = 'active'
  ORDER BY t.sequence_order;

  GET DIAGNOSTICS v_queued_count = ROW_COUNT;

  RETURN QUERY SELECT v_program_id, v_queued_count;
END;
$$;

REVOKE ALL ON FUNCTION public.health_m3_publish_program_version(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.health_m3_publish_program_version(uuid)
TO authenticated;
