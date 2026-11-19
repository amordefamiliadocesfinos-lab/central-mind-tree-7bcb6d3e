-- CCH controlled continuation: prepare an editable draft; never publish or requeue automatically.
CREATE OR REPLACE FUNCTION public.health_cch_prepare_next_cycle(p_program_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_program public.health_programs%ROWTYPE;
  v_source public.health_program_versions%ROWTYPE;
  v_draft uuid;
  v_number integer;
  v_t record;
  v_new_t uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT * INTO v_program FROM public.health_programs WHERE id=p_program_id FOR UPDATE;
  IF v_program.id IS NULL OR NOT public.health_can_write_athlete(v_program.athlete_id) THEN
    RAISE EXCEPTION 'program not found or unauthorized'; END IF;
  IF v_program.status <> 'active' OR v_program.current_version_id IS NULL THEN
    RAISE EXCEPTION 'active published program required'; END IF;
  SELECT * INTO v_source FROM public.health_program_versions
    WHERE id=v_program.current_version_id AND program_id=v_program.id AND athlete_id=v_program.athlete_id AND status='published';
  IF v_source.id IS NULL THEN RAISE EXCEPTION 'published version not found'; END IF;
  SELECT id INTO v_draft FROM public.health_program_versions
    WHERE program_id=v_program.id AND athlete_id=v_program.athlete_id AND status='draft'
    ORDER BY version_number DESC LIMIT 1;
  IF v_draft IS NOT NULL THEN RETURN v_draft; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.health_cch_queue_entries WHERE athlete_id=v_program.athlete_id AND program_version_id=v_source.id)
    OR EXISTS (SELECT 1 FROM public.health_cch_queue_entries WHERE athlete_id=v_program.athlete_id AND state <> 'completed')
    OR EXISTS (SELECT 1 FROM public.health_workout_sessions WHERE athlete_id=v_program.athlete_id
      AND status IN ('active','paused') AND coalesce(record_status,'active')='active') THEN
    RAISE EXCEPTION 'unresolved queue entries or open workout'; END IF;
  SELECT coalesce(max(version_number),0)+1 INTO v_number FROM public.health_program_versions WHERE program_id=v_program.id;
  INSERT INTO public.health_program_versions
    (program_id,athlete_id,version_number,status,title,rationale,algorithm_version,parameter_set,created_by_auth_user_id)
  VALUES (v_program.id,v_program.athlete_id,v_number,'draft',v_program.name||' — versão '||v_number,
    'Continuidade a revisar: considerar desempenho, histórico e recuperação.',
    v_source.algorithm_version,coalesce(v_source.parameter_set,'{}'::jsonb) ||
      jsonb_build_object('cycle_source_version_id',v_source.id,'review_required',true),auth.uid())
  RETURNING id INTO v_draft;
  INSERT INTO public.health_program_muscle_priorities
    (program_version_id,athlete_id,muscle_group_id,priority_rank,emphasis,notes)
  SELECT v_draft,athlete_id,muscle_group_id,priority_rank,emphasis,notes
    FROM public.health_program_muscle_priorities
    WHERE program_version_id=v_source.id AND athlete_id=v_program.athlete_id;
  FOR v_t IN SELECT * FROM public.health_session_templates
    WHERE program_version_id=v_source.id AND athlete_id=v_program.athlete_id ORDER BY sequence_order LOOP
    INSERT INTO public.health_session_templates
      (program_version_id,athlete_id,code,name,sequence_order,session_kind,status,notes)
    VALUES (v_draft,v_program.athlete_id,v_t.code,v_t.name,v_t.sequence_order,v_t.session_kind,v_t.status,v_t.notes)
    RETURNING id INTO v_new_t;
    INSERT INTO public.health_session_template_exercises
      (session_template_id,athlete_id,exercise_id,sequence_order,planned_sets_min,planned_sets_max,
       reps_min,reps_max,rir_target,rest_seconds,is_optional,substitution_group,prescription_notes)
    SELECT v_new_t,athlete_id,exercise_id,sequence_order,planned_sets_min,planned_sets_max,
       reps_min,reps_max,rir_target,rest_seconds,is_optional,substitution_group,prescription_notes
    FROM public.health_session_template_exercises WHERE session_template_id=v_t.id AND athlete_id=v_program.athlete_id;
  END LOOP;
  RETURN v_draft;
END;
$$;
REVOKE ALL ON FUNCTION public.health_cch_prepare_next_cycle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.health_cch_prepare_next_cycle(uuid) TO authenticated;
