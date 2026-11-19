-- CCH V3: strengthen existing M3/M4/F13/F14/F22 guided recommendation without another program system.
-- Uses V2's evidence by identical exercise/load, adds observed distribution, strength context and recovery coverage.
CREATE OR REPLACE FUNCTION public.health_cch_assess_cycle_v3(p_program_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_program public.health_programs%ROWTYPE;
  v_report jsonb;
  v_distribution jsonb := '[]'::jsonb;
  v_training jsonb;
  v_recovery jsonb;
  v_signal text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT * INTO v_program FROM public.health_programs WHERE id=p_program_id;
  IF v_program.id IS NULL OR NOT public.health_can_read_athlete(v_program.athlete_id) THEN
    RAISE EXCEPTION 'program unavailable or unauthorized';
  END IF;
  v_report := public.health_cch_assess_cycle(p_program_id);
  -- Primary exercise-muscle association only; count sets rather than summing incomparable loads.
  WITH planned AS (
    SELECT em.muscle_group_id, sum(e.planned_sets_min)::integer AS minimum_sets,
      count(DISTINCT e.id)::integer AS exercises
    FROM public.health_session_template_exercises e
    JOIN public.health_session_templates t ON t.id=e.session_template_id AND t.athlete_id=e.athlete_id
    JOIN public.health_exercise_muscles em ON em.exercise_id=e.exercise_id AND em.role='primary'
    WHERE e.athlete_id=v_program.athlete_id AND t.program_version_id=v_program.current_version_id
      AND t.status='active'
    GROUP BY em.muscle_group_id
  ), observed AS (
    SELECT em.muscle_group_id,count(DISTINCT ws.id)::integer AS sets_performed
    FROM public.health_workout_sessions s
    JOIN public.health_workout_exercises we ON we.session_id=s.id AND we.athlete_id=s.athlete_id
    JOIN public.health_workout_sets ws ON ws.workout_exercise_id=we.id AND ws.athlete_id=s.athlete_id
    JOIN public.health_exercise_muscles em ON em.exercise_id=we.exercise_id AND em.role='primary'
    WHERE s.athlete_id=v_program.athlete_id AND s.program_version_id=v_program.current_version_id
      AND s.status='completed' AND s.record_status='active'
      AND ws.status='completed' AND ws.set_type='working'
    GROUP BY em.muscle_group_id
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'muscle_group_id',m.id,'muscle_name',m.name,
    'planned_min_sets_per_sequence',coalesce(p.minimum_sets,0),
    'recorded_work_sets',coalesce(o.sets_performed,0),
    'planned_exercises',coalesce(p.exercises,0),
    'note','Counts are sequence totals, not a normalized weekly volume recommendation.')
    ORDER BY coalesce(o.sets_performed,0) DESC,m.name),'[]'::jsonb)
    INTO v_distribution
  FROM public.health_muscle_groups m
  JOIN planned p ON p.muscle_group_id=m.id
  LEFT JOIN observed o ON o.muscle_group_id=m.id;

  SELECT jsonb_build_object('completed_sessions',count(*),
    'first_completed_at',min(s.started_at),'last_completed_at',max(s.started_at),
    'span_days',CASE WHEN count(*)>1 THEN
      greatest(1,ceil(extract(epoch FROM (max(s.started_at)-min(s.started_at)))/86400)::integer)
      ELSE NULL END)
  INTO v_training
  FROM public.health_workout_sessions s
  WHERE s.athlete_id=v_program.athlete_id AND s.program_version_id=v_program.current_version_id
    AND s.status='completed' AND s.record_status='active';

  v_recovery := v_report->'recovery_context';
  v_signal := 'unknown';
  IF v_recovery IS NOT NULL AND v_recovery <> 'null'::jsonb THEN
    IF coalesce((v_recovery->>'fatigue_observed_days')::integer,0)>=4
       AND coalesce((v_recovery->>'recovery_observed_days')::integer,0)>=4 THEN
      v_signal:='observed_needs_interpretation';
    ELSE v_signal:='limited_coverage'; END IF;
  END IF;
  RETURN v_report || jsonb_build_object(
    'engine_version','cch-guided-v3',
    'muscle_distribution',v_distribution,
    'frequency_context',v_training,
    'recovery_evidence_state',v_signal,
    'goal_specific_guidance',jsonb_build_object(
      'strength','Compare identical exercise and load; load increase must be chosen explicitly after technique and recovery review.',
      'hypertrophy','Only repeatable exercise-level evidence may suggest a +1 repetition upper bound.',
      'muscle_priority','Choose a target muscle group; redistribute emphasis in draft metadata without changing set counts automatically.',
      'fat_loss','Training continuity alone cannot establish fat-loss need; nutrition/body goals require separate athlete decision.',
      'maintenance','Preserve the program unless evidence and athlete preferences support a change.'),
    'limitations',(v_report->'limitations') || jsonb_build_array(
      'Muscle group set totals describe this sequence, not a normative weekly volume target.',
      'Recovery observations are context, not a clinical diagnosis or automatic deload trigger.',
      'Strength and muscle-priority targets require athlete selection before prescription changes.'));
END;
$$;
REVOKE ALL ON FUNCTION public.health_cch_assess_cycle_v3(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.health_cch_assess_cycle_v3(uuid) TO authenticated;

-- A new extension entrypoint keeps V2 intact, guarantees explicit goal confirmation
-- and leverages V2's atomic clone, row locks, RLS and publication gate.
CREATE OR REPLACE FUNCTION public.health_cch_generate_guided_cycle_v3(
  p_program_id uuid, p_goal text, p_strategy text, p_availability text,
  p_priority_muscle_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_program public.health_programs%ROWTYPE;
  v_assessment jsonb;
  v_draft uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT * INTO v_program FROM public.health_programs WHERE id=p_program_id FOR UPDATE;
  IF v_program.id IS NULL OR NOT public.health_can_write_athlete(v_program.athlete_id) THEN
    RAISE EXCEPTION 'program unavailable or unauthorized';
  END IF;
  IF p_goal IS NULL OR p_goal NOT IN ('hypertrophy','strength','maintenance','fat_loss','muscle_priority')
    OR p_strategy IS NULL OR p_strategy NOT IN ('continue_progression','consolidate','recovery_review')
    OR p_availability IS DISTINCT FROM 'flexible' THEN RAISE EXCEPTION 'invalid selection'; END IF;
  IF p_goal='muscle_priority' AND (
    p_priority_muscle_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.health_session_template_exercises e
      JOIN public.health_session_templates t ON t.id=e.session_template_id AND t.athlete_id=e.athlete_id
      JOIN public.health_exercise_muscles em ON em.exercise_id=e.exercise_id AND em.role='primary'
      WHERE t.athlete_id=v_program.athlete_id AND t.program_version_id=v_program.current_version_id
        AND em.muscle_group_id=p_priority_muscle_id)) THEN
    RAISE EXCEPTION 'choose a muscle group represented in the current program';
  END IF;
  v_assessment:=public.health_cch_assess_cycle_v3(v_program.id);
  v_draft:=public.health_cch_generate_guided_cycle(
    p_program_id,p_goal,p_strategy,p_availability);
  -- Explicitly selected priority is recorded in the existing M3 draft priority table.
  IF p_goal='muscle_priority' THEN
    INSERT INTO public.health_program_muscle_priorities
      (program_version_id,athlete_id,muscle_group_id,priority_rank,emphasis,
       notes)
    VALUES(v_draft,v_program.athlete_id,p_priority_muscle_id,1,'priority',
      'CCH V3: preferência expressa pelo atleta; revisar distribuição de séries antes de publicar.')
    ON CONFLICT(program_version_id,muscle_group_id) DO UPDATE SET
      priority_rank=1,emphasis='priority',
      notes=EXCLUDED.notes;
  END IF;
  UPDATE public.health_program_versions SET
    rationale=concat_ws(E'\n',rationale,
      'CCH V3: auditoria de distribuição, força e recuperação; estratégia escolhida pelo atleta. Nenhum aumento automático de carga ou volume.'),
    parameter_set=coalesce(parameter_set,'{}'::jsonb) || jsonb_build_object(
      'guided_cycle',(coalesce(parameter_set->'guided_cycle','{}'::jsonb) ||
        jsonb_build_object('engine_version','cch-guided-v3',
          'muscle_priority_id',p_priority_muscle_id,
          'assessment_snapshot',v_assessment,'publication_requires_review',true)))
  WHERE id=v_draft AND athlete_id=v_program.athlete_id AND status='draft';
  RETURN v_draft;
END;
$$;
REVOKE ALL ON FUNCTION public.health_cch_generate_guided_cycle_v3(uuid,text,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.health_cch_generate_guided_cycle_v3(uuid,text,text,text,uuid) TO authenticated;
