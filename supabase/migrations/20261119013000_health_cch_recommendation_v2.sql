-- CCH Guided Recommendation V2: evidence first, athlete-led selection, no automatic publication.
-- SQL owns the authoritative assessment; UI only presents its evidence.
CREATE OR REPLACE FUNCTION public.health_cch_assess_cycle(p_program_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_program public.health_programs%ROWTYPE;
  v_profile jsonb;
  v_recovery jsonb;
  v_source uuid;
  v_completed integer;
  v_total_sets integer;
  v_measured_sets integer;
  v_e record;
  v_rows jsonb := '[]'::jsonb;
  v_load numeric;
  v_unit text;
  v_exposures integer;
  v_prior integer;
  v_latest integer;
  v_recent_rir numeric;
  v_missing integer;
  v_status text;
  v_reason text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT * INTO v_program FROM public.health_programs WHERE id=p_program_id;
  IF v_program.id IS NULL OR NOT public.health_can_read_athlete(v_program.athlete_id) THEN
    RAISE EXCEPTION 'program not found or not authorized';
  END IF;
  v_source := v_program.current_version_id;
  IF v_source IS NULL THEN RAISE EXCEPTION 'published program version is required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.health_program_versions
    WHERE id=v_source AND program_id=v_program.id AND athlete_id=v_program.athlete_id AND status='published') THEN
    RAISE EXCEPTION 'published version unavailable';
  END IF;

  SELECT count(*) INTO v_completed FROM public.health_workout_sessions s
  WHERE s.athlete_id=v_program.athlete_id AND s.program_version_id=v_source
    AND s.status='completed' AND s.record_status='active';
  SELECT count(*),count(*) FILTER (WHERE ws.load_value IS NOT NULL AND ws.load_unit IS NOT NULL
    AND ws.reps IS NOT NULL AND ws.rir IS NOT NULL)
  INTO v_total_sets,v_measured_sets
  FROM public.health_workout_sets ws
  JOIN public.health_workout_sessions s ON s.id=ws.session_id AND s.athlete_id=ws.athlete_id
  WHERE s.athlete_id=v_program.athlete_id AND s.program_version_id=v_source
    AND s.status='completed' AND s.record_status='active'
    AND ws.status='completed' AND ws.set_type='working';

  SELECT jsonb_build_object('training_level',training_level,'baseline_state',baseline_state,
    'overall_data_confidence',overall_data_confidence,'calibration_policy',calibration_policy)
    INTO v_profile FROM public.health_training_profiles WHERE athlete_id=v_program.athlete_id;
  SELECT jsonb_build_object('as_of_date',as_of_date,'confidence',confidence,
    'recovery_observed_days',recovery_observed_days,'fatigue_observed_days',fatigue_observed_days,
    'average_fatigue',average_fatigue,'average_recovery',average_recovery,
    'average_sleep_minutes',average_sleep_minutes)
    INTO v_recovery FROM public.health_sleep_recovery_rolling_states
  WHERE athlete_id=v_program.athlete_id AND window_days=28
    AND as_of_date BETWEEN current_date - 7 AND current_date
  ORDER BY as_of_date DESC LIMIT 1;

  FOR v_e IN
    SELECT e.id,e.exercise_id,e.reps_max,t.code
    FROM public.health_session_template_exercises e
    JOIN public.health_session_templates t ON t.id=e.session_template_id
    WHERE t.program_version_id=v_source AND t.athlete_id=v_program.athlete_id
      AND e.athlete_id=v_program.athlete_id AND t.status='active'
    ORDER BY t.sequence_order,e.sequence_order
  LOOP
    v_load := NULL; v_unit := NULL; v_exposures := 0;
    v_prior := NULL; v_latest := NULL; v_recent_rir := NULL; v_missing := 0;

    -- Select the most frequently observed exact load within one exercise, without mixing machines or units.
    SELECT ws.load_value,ws.load_unit,count(DISTINCT s.id)::integer
    INTO v_load,v_unit,v_exposures
    FROM public.health_workout_sessions s
    JOIN public.health_workout_exercises we ON we.session_id=s.id AND we.athlete_id=s.athlete_id
    JOIN public.health_workout_sets ws ON ws.workout_exercise_id=we.id AND ws.athlete_id=s.athlete_id
    WHERE s.athlete_id=v_program.athlete_id AND s.program_version_id=v_source
      AND s.record_status='active' AND s.status='completed'
      AND we.exercise_id=v_e.exercise_id AND ws.status='completed' AND ws.set_type='working'
      AND ws.load_value IS NOT NULL AND ws.load_unit IS NOT NULL
    GROUP BY ws.load_value,ws.load_unit
    ORDER BY count(DISTINCT s.id) DESC,count(*) DESC,ws.load_value DESC
    LIMIT 1;

    IF v_exposures >= 2 THEN
      WITH exposure AS (
        SELECT s.id,s.started_at,max(ws.reps) AS best_reps,min(ws.rir) AS minimum_rir,
          count(*) FILTER (WHERE ws.reps IS NULL OR ws.rir IS NULL) AS missing_fields
        FROM public.health_workout_sessions s
        JOIN public.health_workout_exercises we ON we.session_id=s.id AND we.athlete_id=s.athlete_id
        JOIN public.health_workout_sets ws ON ws.workout_exercise_id=we.id AND ws.athlete_id=s.athlete_id
        WHERE s.athlete_id=v_program.athlete_id AND s.program_version_id=v_source
          AND s.record_status='active' AND s.status='completed'
          AND we.exercise_id=v_e.exercise_id AND ws.status='completed' AND ws.set_type='working'
          AND ws.load_value=v_load AND ws.load_unit=v_unit
        GROUP BY s.id,s.started_at
        ORDER BY s.started_at DESC LIMIT 2
      ), ranked AS (
        SELECT *,row_number() OVER (ORDER BY started_at DESC) rn FROM exposure
      )
      SELECT max(best_reps) FILTER (WHERE rn=1),
             max(best_reps) FILTER (WHERE rn=2),
             min(minimum_rir) FILTER (WHERE rn=1),
             coalesce(sum(missing_fields),0)::integer
      INTO v_latest,v_prior,v_recent_rir,v_missing FROM ranked;
    END IF;

    v_status := 'insufficient';
    v_reason := 'Faltam duas execuções na mesma carga e unidade com RIR e repetições completos.';
    IF v_exposures >= 2 AND v_missing=0 AND v_latest IS NOT NULL AND v_prior IS NOT NULL THEN
      v_status := 'maintain';
      v_reason := 'Há duas exposições comparáveis; a prescrição permanece até revisão.';
      IF v_latest < v_prior THEN
        v_status := 'review';
        v_reason := 'A melhor repetição registrada caiu na mesma carga; revisar contexto, sem inferir causa.';
      ELSIF v_recent_rir IS NOT NULL AND v_recent_rir>=2 AND v_recent_rir<=6
        AND v_e.reps_max IS NOT NULL AND v_latest >= v_e.reps_max AND v_e.reps_max < 100 THEN
        v_status := 'progress_candidate';
        v_reason := 'Última exposição atingiu o teto da faixa sem queda no melhor resultado e com RIR registrado >=2. Propor apenas +1 ao teto de repetições para revisão.';
      END IF;
    END IF;

    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'template_exercise_id',v_e.id,'exercise_id',v_e.exercise_id,'session_code',v_e.code,
      'decision',v_status,'reason',v_reason,'exposures',coalesce(v_exposures,0),
      'load_value',v_load,'load_unit',v_unit,
      'previous_best_reps',v_prior,'latest_best_reps',v_latest,'latest_min_rir',v_recent_rir));
  END LOOP;

  RETURN jsonb_build_object('engine_version','cch-guided-v2',
    'source_version_id',v_source,'completed_sessions',v_completed,
    'completed_sets',v_total_sets,'measured_sets',v_measured_sets,
    'training_profile',v_profile,'recovery_context',v_recovery,
    'exercise_assessments',v_rows,
    'limitations',jsonb_build_array(
      'Comparação apenas por exercício e carga/unidade idênticas; não equivale máquinas.',
      'RIR autorrelatado e exposição limitada não comprovam recuperação ou prontidão.',
      'Sugestões são propostas para revisão, não progressões obrigatórias.'
    ));
END;
$$;
REVOKE ALL ON FUNCTION public.health_cch_assess_cycle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.health_cch_assess_cycle(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.health_cch_generate_guided_cycle(
  p_program_id uuid, p_goal text, p_strategy text, p_availability text DEFAULT 'flexible'
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_program public.health_programs%ROWTYPE;
  v_source uuid;
  v_draft uuid;
  v_report jsonb;
  v_item jsonb;
  v_adjusted integer := 0;
  v_updated integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_goal IS NULL OR p_goal NOT IN ('hypertrophy','strength','maintenance','fat_loss','muscle_priority')
    OR p_strategy IS NULL OR p_strategy NOT IN ('continue_progression','consolidate','recovery_review')
    OR p_availability IS DISTINCT FROM 'flexible' THEN
    RAISE EXCEPTION 'invalid goal, strategy or availability';
  END IF;
  SELECT * INTO v_program FROM public.health_programs WHERE id=p_program_id FOR UPDATE;
  IF v_program.id IS NULL OR NOT public.health_can_write_athlete(v_program.athlete_id) THEN
    RAISE EXCEPTION 'program not found or unauthorized';
  END IF;
  IF v_program.status<>'active' OR v_program.current_version_id IS NULL THEN
    RAISE EXCEPTION 'active published program is required';
  END IF;
  v_source:=v_program.current_version_id;
  IF EXISTS (SELECT 1 FROM public.health_program_versions
    WHERE program_id=v_program.id AND athlete_id=v_program.athlete_id AND status='draft') THEN
    RAISE EXCEPTION 'draft already exists: review it before requesting another';
  END IF;
  v_report:=public.health_cch_assess_cycle(v_program.id);
  IF (v_report->>'completed_sessions')::integer < 1 OR (v_report->>'completed_sets')::integer < 1 THEN
    RAISE EXCEPTION 'insufficient completed workout data';
  END IF;

  -- Existing invoker RPC owns the queue completion guard and copies the source version into a draft.
  SELECT public.health_cch_prepare_next_cycle(v_program.id) INTO v_draft;
  IF v_draft IS NULL THEN RAISE EXCEPTION 'could not create draft'; END IF;

  -- Deliberately narrow automated prescription: hypertrophy only; no load, set or RIR changes.
  IF p_goal='hypertrophy' AND p_strategy='continue_progression' THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_report->'exercise_assessments') LOOP
      IF v_item->>'decision'='progress_candidate' THEN
        UPDATE public.health_session_template_exercises target
        SET reps_max=least(100,target.reps_max+1),
          prescription_notes=concat_ws(E'\n',target.prescription_notes,
            'CCH V2: proposta de +1 no teto de repetições, baseada em exposição comparável. Revisar antes de publicar.')
        FROM public.health_session_templates target_t
        JOIN public.health_session_templates source_t ON source_t.code=target_t.code
          AND source_t.program_version_id=v_source AND source_t.athlete_id=v_program.athlete_id
        JOIN public.health_session_template_exercises source_e ON source_e.session_template_id=source_t.id
        WHERE target.session_template_id=target_t.id
          AND target_t.program_version_id=v_draft AND target_t.athlete_id=v_program.athlete_id
          AND target.athlete_id=v_program.athlete_id AND target.reps_max IS NOT NULL AND target.reps_max<100
          AND source_e.id=(v_item->>'template_exercise_id')::uuid
          AND source_e.athlete_id=v_program.athlete_id
          AND source_e.sequence_order=target.sequence_order
          AND source_e.exercise_id=target.exercise_id;
        GET DIAGNOSTICS v_updated=ROW_COUNT;
        v_adjusted:=v_adjusted+v_updated;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.health_program_versions
  SET rationale=format('CCH V2: objetivo %s; estratégia %s; disponibilidade flexível. Auditoria %s sessões, %s séries. %s ajustes de teto de repetições propostos. Revisão e publicação explícitas.',
      p_goal,p_strategy,v_report->>'completed_sessions',v_report->>'completed_sets',v_adjusted),
      parameter_set=coalesce(parameter_set,'{}'::jsonb) || jsonb_build_object(
        'guided_cycle',jsonb_build_object(
          'engine_version','cch-guided-v2','goal',p_goal,'strategy',p_strategy,
          'availability',p_availability,'source_version_id',v_source,
          'user_selection_confirmed',true,'publication_requires_review',true,
          'adjustments_proposed',v_adjusted,'assessment_snapshot',v_report))
  WHERE id=v_draft AND athlete_id=v_program.athlete_id AND status='draft';
  RETURN v_draft;
END;
$$;
REVOKE ALL ON FUNCTION public.health_cch_generate_guided_cycle(uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.health_cch_generate_guided_cycle(uuid,text,text,text) TO authenticated;