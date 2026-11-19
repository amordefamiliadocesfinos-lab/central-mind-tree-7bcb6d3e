-- CCH guided cycle V1: recommendation selected by athlete; audit-derived, reviewable M3 draft.
-- No new program system; reuses health_cch_prepare_next_cycle and F22 publication gate.
CREATE OR REPLACE FUNCTION public.health_cch_generate_guided_cycle(
  p_program_id uuid, p_goal text, p_strategy text, p_availability text DEFAULT 'flexible'
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_program public.health_programs%ROWTYPE;
  v_source public.health_program_versions%ROWTYPE;
  v_draft uuid;
  v_completed integer;
  v_sets integer;
  v_decisions integer := 0;
  v_existing uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_goal NOT IN ('hypertrophy','strength','maintenance','fat_loss','muscle_priority')
     OR p_strategy NOT IN ('continue_progression','consolidate','recovery_review')
     OR p_availability <> 'flexible' THEN
    RAISE EXCEPTION 'invalid goal, strategy or availability';
  END IF;
  SELECT * INTO v_program FROM public.health_programs WHERE id=p_program_id FOR UPDATE;
  IF v_program.id IS NULL OR NOT public.health_can_write_athlete(v_program.athlete_id) THEN
    RAISE EXCEPTION 'unauthorized program'; END IF;
  IF v_program.status <> 'active' OR v_program.current_version_id IS NULL THEN
    RAISE EXCEPTION 'active published source required'; END IF;
  SELECT * INTO v_source FROM public.health_program_versions
    WHERE id=v_program.current_version_id AND program_id=v_program.id AND athlete_id=v_program.athlete_id
    AND status='published';
  IF v_source.id IS NULL THEN RAISE EXCEPTION 'published version missing'; END IF;
  SELECT id INTO v_existing FROM public.health_program_versions
    WHERE program_id=v_program.id AND status='draft' LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'draft already exists: review it before generating another cycle';
  END IF;
  SELECT count(*) INTO v_completed FROM public.health_workout_sessions
    WHERE athlete_id=v_program.athlete_id AND program_version_id=v_source.id
      AND status='completed' AND record_status='active';
  IF v_completed < 1 THEN RAISE EXCEPTION 'no valid workouts to assess'; END IF;
  SELECT count(*) INTO v_sets FROM public.health_workout_sets ws
    JOIN public.health_workout_sessions s ON s.id=ws.session_id AND s.athlete_id=ws.athlete_id
    WHERE s.athlete_id=v_program.athlete_id AND s.program_version_id=v_source.id
      AND s.status='completed' AND s.record_status='active' AND ws.status='completed';
  IF v_sets < 1 THEN RAISE EXCEPTION 'no completed sets to assess'; END IF;
  -- Reuses audited queue completion and athlete RLS. Entire operation is atomic.
  SELECT public.health_cch_prepare_next_cycle(v_program.id) INTO v_draft;
  -- A conservative, evidence-gated progression: only a repeated, comparable exercise
  -- with recorded reps, load unit and RIR >= 2 across distinct valid sessions can receive
  -- a +1 upper rep-bound proposal. No load or set increase is inferred.
  IF p_strategy='continue_progression' AND p_goal='hypertrophy' THEN
    WITH evidence AS (
      SELECT we.exercise_id,
        count(DISTINCT ws.session_id) AS exposures,
        min(ws.reps) AS min_reps,
        min(ws.rir) AS min_rir,
        count(DISTINCT ws.load_unit) AS load_units,
        count(*) FILTER (WHERE ws.reps IS NULL OR ws.rir IS NULL OR ws.load_value IS NULL OR ws.load_unit IS NULL) AS missing
      FROM public.health_workout_sessions s
      JOIN public.health_workout_exercises we ON we.session_id=s.id AND we.athlete_id=s.athlete_id
      JOIN public.health_workout_sets ws ON ws.workout_exercise_id=we.id AND ws.athlete_id=s.athlete_id
      WHERE s.athlete_id=v_program.athlete_id AND s.program_version_id=v_source.id
        AND s.status='completed' AND s.record_status='active' AND ws.status='completed'
      GROUP BY we.exercise_id
    )
    UPDATE public.health_session_template_exercises e
    SET reps_max=least(100,e.reps_max+1),
      prescription_notes=concat_ws(E'\n',e.prescription_notes,
        'CCH V1: sugestão de +1 repetição no teto, baseada em pelo menos 2 sessões com o mesmo exercício/unidade, RIR >=2 e repetições compatíveis; confirmar antes de publicar.')
    FROM public.health_session_templates t, evidence ev
    WHERE e.session_template_id=t.id AND t.program_version_id=v_draft
      AND e.athlete_id=v_program.athlete_id AND t.athlete_id=v_program.athlete_id
      AND e.exercise_id=ev.exercise_id AND e.reps_max IS NOT NULL AND e.reps_max < 100
      AND ev.exposures >= 2 AND ev.load_units=1 AND ev.missing=0 AND ev.min_rir >= 2
      AND ev.min_reps >= e.reps_max;
    GET DIAGNOSTICS v_decisions=ROW_COUNT;
  END IF;
  UPDATE public.health_program_versions
    SET rationale=format('CCH orientado: objetivo=%s; estratégia=%s; disponibilidade flexível. %s sessões válidas e %s séries examinadas; %s prescrições receberam ajuste conservador. Todas as demais permanecem em revisão.',
      p_goal,p_strategy,v_completed,v_sets,v_decisions),
      parameter_set=coalesce(parameter_set,'{}'::jsonb) || jsonb_build_object(
        'guided_cycle',jsonb_build_object(
          'engine_version','cch-guided-v1','goal',p_goal,'strategy',p_strategy,
          'availability',p_availability,'source_version_id',v_source.id,
          'completed_sessions',v_completed,'completed_sets',v_sets,'rep_range_proposals',v_decisions,
          'created_at',now(),'user_selection_confirmed',true,
          'publication_requires_review',true))
  WHERE id=v_draft AND athlete_id=v_program.athlete_id AND status='draft';
  RETURN v_draft;
END;
$$;
REVOKE ALL ON FUNCTION public.health_cch_generate_guided_cycle(uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.health_cch_generate_guided_cycle(uuid,text,text,text) TO authenticated;
