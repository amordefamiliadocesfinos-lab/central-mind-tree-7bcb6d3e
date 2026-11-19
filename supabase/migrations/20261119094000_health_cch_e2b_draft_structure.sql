-- CCH E2B — draft-only, atomic exercise replacement and sequence swap.
-- Sovereign scope: CCH v5.4 FROZEN + E2 v1.0 FROZEN. No published mutations.
CREATE OR REPLACE FUNCTION public.health_cch_e2_edit_draft_exercise(
  p_template_exercise_id uuid,
  p_operation text,
  p_other_template_exercise_id uuid DEFAULT NULL,
  p_replacement_exercise_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE
 v_target public.health_session_template_exercises%ROWTYPE;
 v_other public.health_session_template_exercises%ROWTYPE;
 v_template public.health_session_templates%ROWTYPE;
 v_version public.health_program_versions%ROWTYPE;
 v_equivalence text;
 v_confidence text;
 v_temp integer;
 v_note text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
 IF p_operation IS NULL OR p_operation NOT IN ('replace','swap')
   OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 10 AND 500 THEN
   RAISE EXCEPTION 'invalid operation or reason'; END IF;
 SELECT * INTO v_target FROM public.health_session_template_exercises
 WHERE id=p_template_exercise_id FOR UPDATE;
 IF v_target.id IS NULL OR NOT public.health_can_write_athlete(v_target.athlete_id) THEN
   RAISE EXCEPTION 'exercise not accessible'; END IF;
 SELECT * INTO v_template FROM public.health_session_templates
 WHERE id=v_target.session_template_id AND athlete_id=v_target.athlete_id FOR UPDATE;
 SELECT * INTO v_version FROM public.health_program_versions
 WHERE id=v_template.program_version_id AND athlete_id=v_target.athlete_id FOR UPDATE;
 IF v_template.id IS NULL OR v_version.id IS NULL OR v_version.status<>'draft' THEN
   RAISE EXCEPTION 'only current draft can be changed'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.health_programs p
   WHERE p.id=v_version.program_id AND p.athlete_id=v_target.athlete_id
    AND (p.current_version_id IS DISTINCT FROM v_version.id)
 ) THEN
   -- No automatic replacement of a currently published version or an invalid draft.
   RAISE EXCEPTION 'draft must be separate from published version'; END IF;
 IF p_operation='replace' THEN
   IF p_replacement_exercise_id IS NULL OR
     p_replacement_exercise_id=v_target.exercise_id THEN
     RAISE EXCEPTION 'replacement exercise must be different'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.health_exercises e
     WHERE e.id=p_replacement_exercise_id AND e.is_active) THEN
     RAISE EXCEPTION 'replacement exercise unavailable'; END IF;
   SELECT eq.equivalence_type,eq.confidence INTO v_equivalence,v_confidence
   FROM public.health_exercise_equivalences eq
   WHERE eq.source_exercise_id=v_target.exercise_id AND eq.target_exercise_id=p_replacement_exercise_id
   ORDER BY eq.id LIMIT 1;
   IF v_equivalence IS NULL THEN
     RAISE EXCEPTION 'replacement not listed as an equivalence in catalog'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.health_exercise_muscles a
     JOIN public.health_exercise_muscles b ON a.muscle_group_id=b.muscle_group_id
     WHERE a.exercise_id=v_target.exercise_id AND b.exercise_id=p_replacement_exercise_id
       AND a.role='primary' AND b.role='primary') THEN
     RAISE EXCEPTION 'replacement has no confirmed common primary muscle'; END IF;
   v_note=concat_ws(E'\n',v_target.prescription_notes,
     format('CCH E2B: troca confirmada %s -> %s; equivalencia %s (%s). Motivo: %s',
       v_target.exercise_id,p_replacement_exercise_id,v_equivalence,v_confidence,btrim(p_reason)));
   UPDATE public.health_session_template_exercises
   SET exercise_id=p_replacement_exercise_id,prescription_notes=v_note
   WHERE id=v_target.id AND athlete_id=v_target.athlete_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'replacement not applied'; END IF;
   RETURN jsonb_build_object('operation','replace','draft_id',v_version.id,
     'from_exercise_id',v_target.exercise_id,'to_exercise_id',p_replacement_exercise_id,
     'equivalence_confidence',v_confidence,'published',false);
 END IF;

 IF p_other_template_exercise_id IS NULL OR p_other_template_exercise_id=v_target.id THEN
   RAISE EXCEPTION 'other exercise must be different'; END IF;
 SELECT * INTO v_other FROM public.health_session_template_exercises
 WHERE id=p_other_template_exercise_id AND
   session_template_id=v_target.session_template_id AND athlete_id=v_target.athlete_id FOR UPDATE;
 IF v_other.id IS NULL THEN RAISE EXCEPTION 'other exercise not in this template'; END IF;
 IF abs(v_other.sequence_order-v_target.sequence_order)<>1 THEN
   RAISE EXCEPTION 'only adjacent positions can be swapped'; END IF;
 SELECT coalesce(max(sequence_order),0)+1 INTO v_temp
 FROM public.health_session_template_exercises
 WHERE session_template_id=v_target.session_template_id;
 -- Unique(session_template_id,sequence_order) remains valid after EACH step.
 UPDATE public.health_session_template_exercises
 SET sequence_order=v_temp WHERE id=v_target.id AND athlete_id=v_target.athlete_id;
 UPDATE public.health_session_template_exercises
 SET sequence_order=v_target.sequence_order WHERE id=v_other.id AND athlete_id=v_target.athlete_id;
 UPDATE public.health_session_template_exercises
 SET sequence_order=v_other.sequence_order,
   prescription_notes=concat_ws(E'\n',v_target.prescription_notes,
   format('CCH E2B: ordem revista %s -> %s. Motivo: %s',
     v_target.sequence_order,v_other.sequence_order,btrim(p_reason)))
 WHERE id=v_target.id AND athlete_id=v_target.athlete_id;
 RETURN jsonb_build_object('operation','swap','draft_id',v_version.id,
   'from_position',v_target.sequence_order,'to_position',v_other.sequence_order,
   'published',false);
END;
$$;
REVOKE ALL ON FUNCTION public.health_cch_e2_edit_draft_exercise(uuid,text,uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.health_cch_e2_edit_draft_exercise(uuid,text,uuid,uuid,text) TO authenticated;
