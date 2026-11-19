-- CCH E2C: guarded, audited draft-only prescription edits.
-- Complements E2B; no changes to frozen maps, published programs or M4 facts.
CREATE OR REPLACE FUNCTION public.health_cch_e2_update_draft_prescription(
  p_template_exercise_id uuid,
  p_expected_version_id uuid,
  p_expected jsonb,
  p_proposed jsonb,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE
  v_target public.health_session_template_exercises%ROWTYPE;
  v_template public.health_session_templates%ROWTYPE;
  v_version public.health_program_versions%ROWTYPE;
  v_before jsonb;
  v_new jsonb;
  v_keys text[]:=ARRAY['planned_sets_min','planned_sets_max',
    'reps_min','reps_max','rir_target','rest_seconds'];
  v_sets_min smallint;v_sets_max smallint;
  v_reps_min smallint;v_reps_max smallint;
  v_rir numeric(3,1);v_rest integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
 IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'a meaningful review reason (10-500 characters) is required'; END IF;
 IF p_expected IS NULL OR p_proposed IS NULL
    OR jsonb_typeof(p_expected)<>'object' OR jsonb_typeof(p_proposed)<>'object'
    OR NOT (p_expected ?& v_keys) OR NOT (p_proposed ?& v_keys)
    OR (p_expected - v_keys)<>'{}'::jsonb OR (p_proposed - v_keys)<>'{}'::jsonb THEN
    RAISE EXCEPTION 'expected and proposed snapshots must use the six permitted fields'; END IF;

 SELECT * INTO v_target FROM public.health_session_template_exercises
 WHERE id=p_template_exercise_id FOR UPDATE;
 IF v_target.id IS NULL OR NOT public.health_can_write_athlete(v_target.athlete_id) THEN
    RAISE EXCEPTION 'exercise unavailable or unauthorized'; END IF;
 SELECT * INTO v_template FROM public.health_session_templates
 WHERE id=v_target.session_template_id AND athlete_id=v_target.athlete_id FOR UPDATE;
 SELECT * INTO v_version FROM public.health_program_versions
 WHERE id=v_template.program_version_id AND athlete_id=v_target.athlete_id FOR UPDATE;
 IF v_template.id IS NULL OR v_version.id IS NULL OR v_version.id IS DISTINCT FROM p_expected_version_id
   OR v_version.status<>'draft' THEN
    RAISE EXCEPTION 'exercise does not belong to the expected active draft'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.health_programs p
   WHERE p.id=v_version.program_id AND p.athlete_id=v_target.athlete_id
     AND p.current_version_id IS DISTINCT FROM v_version.id) THEN
    RAISE EXCEPTION 'current published version cannot be edited'; END IF;

 v_before:=jsonb_build_object('planned_sets_min',v_target.planned_sets_min,
  'planned_sets_max',v_target.planned_sets_max,'reps_min',v_target.reps_min,
  'reps_max',v_target.reps_max,'rir_target',v_target.rir_target,
  'rest_seconds',v_target.rest_seconds);
 IF v_before IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'prescription changed since preview; reload and review before saving'; END IF;
 IF p_proposed IS NOT DISTINCT FROM v_before THEN
    RAISE EXCEPTION 'no prescription change to save'; END IF;

 -- Nullable draft fields remain allowed. Required completeness is checked at F22 publication.
 v_sets_min:=(p_proposed->>'planned_sets_min')::smallint;
 v_sets_max:=(p_proposed->>'planned_sets_max')::smallint;
 v_reps_min:=(p_proposed->>'reps_min')::smallint;
 v_reps_max:=(p_proposed->>'reps_max')::smallint;
 v_rir:=(p_proposed->>'rir_target')::numeric(3,1);
 v_rest:=(p_proposed->>'rest_seconds')::integer;
 IF (v_sets_min IS NOT NULL AND v_sets_min NOT BETWEEN 1 AND 20)
  OR (v_sets_max IS NOT NULL AND v_sets_max NOT BETWEEN 1 AND 20)
  OR (v_sets_min IS NOT NULL AND v_sets_max IS NOT NULL AND v_sets_max<v_sets_min)
  OR (v_reps_min IS NOT NULL AND v_reps_min NOT BETWEEN 1 AND 100)
  OR (v_reps_max IS NOT NULL AND v_reps_max NOT BETWEEN 1 AND 100)
  OR (v_reps_min IS NOT NULL AND v_reps_max IS NOT NULL AND v_reps_max<v_reps_min)
  OR (v_rir IS NOT NULL AND v_rir NOT BETWEEN 0 AND 10)
  OR (v_rest IS NOT NULL AND v_rest NOT BETWEEN 0 AND 1800) THEN
    RAISE EXCEPTION 'prescription values outside M3 field constraints'; END IF;
 v_new:=jsonb_build_object('planned_sets_min',v_sets_min,
  'planned_sets_max',v_sets_max,'reps_min',v_reps_min,'reps_max',v_reps_max,
  'rir_target',v_rir,'rest_seconds',v_rest);
 UPDATE public.health_session_template_exercises SET
  planned_sets_min=v_sets_min,planned_sets_max=v_sets_max,
  reps_min=v_reps_min,reps_max=v_reps_max,rir_target=v_rir,rest_seconds=v_rest,
  prescription_notes=concat_ws(E'\n',v_target.prescription_notes,
   'CCH E2C · revisão manual por '||auth.uid()::text
     ||' · antes='||v_before::text||' · depois='||v_new::text
     ||' · motivo='||btrim(p_reason))
 WHERE id=v_target.id AND athlete_id=v_target.athlete_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'draft edit not applied'; END IF;
 RETURN jsonb_build_object('draft_version_id',v_version.id,'template_exercise_id',v_target.id,
   'before',v_before,'after',v_new,'manual_review',true,'published',false);
END;
$$;
REVOKE ALL ON FUNCTION public.health_cch_e2_update_draft_prescription(uuid,uuid,jsonb,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.health_cch_e2_update_draft_prescription(uuid,uuid,jsonb,jsonb,text) TO authenticated;
