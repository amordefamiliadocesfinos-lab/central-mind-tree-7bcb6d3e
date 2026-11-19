-- CCH V5 - historical audit, confident proposals, guarded targeted volume.
-- Extends M3/M4/F13/F14/F22. All RPCs invoke as the authenticated athlete with RLS.
CREATE OR REPLACE FUNCTION public.health_cch_assess_cycle_v5(p_program_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE
  v_p public.health_programs%ROWTYPE;
  v_base jsonb;
  v_trends jsonb;
  v_sessions integer;
  v_sets integer;
  v_complete integer;
  v_ratio numeric;
  v_repeated integer;
  v_quality text;
  v_gaps jsonb:='[]'::jsonb;
  v_options jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT * INTO v_p FROM public.health_programs WHERE id=p_program_id;
  IF v_p.id IS NULL OR NOT public.health_can_read_athlete(v_p.athlete_id) THEN
    RAISE EXCEPTION 'program unavailable or unauthorized';
  END IF;
  v_base:=public.health_cch_assess_cycle_v4(p_program_id);

  -- A representative working set is ONE actual set, never max load from one
  -- set combined with max repetitions from another. Same catalog exercise only.
  WITH eligible AS (
    SELECT s.id AS session_id,s.program_version_id,s.started_at,
      we.exercise_id,ws.id AS set_id,ws.load_unit,ws.load_value,ws.reps,ws.rir,
      row_number() OVER (
        PARTITION BY s.id,we.exercise_id,ws.load_unit
        ORDER BY ws.load_value DESC,ws.reps DESC,ws.completed_at DESC,ws.id
      ) AS set_rank
    FROM public.health_workout_sessions s
    JOIN public.health_program_versions pv ON pv.id=s.program_version_id AND pv.athlete_id=s.athlete_id AND pv.program_id=v_p.id
    JOIN public.health_workout_exercises we ON we.session_id=s.id AND we.athlete_id=s.athlete_id
    JOIN public.health_workout_sets ws ON ws.workout_exercise_id=we.id AND ws.session_id=s.id AND ws.athlete_id=s.athlete_id
    WHERE s.athlete_id=v_p.athlete_id AND s.status='completed' AND s.record_status='active'
      AND ws.status='completed' AND ws.set_type='working'
      AND ws.load_value>0 AND ws.load_unit IS NOT NULL AND ws.reps>0
      AND ws.rir BETWEEN 0 AND 10
      AND s.started_at>=current_timestamp-interval '365 days'
  ), by_session AS (
    SELECT * FROM eligible WHERE set_rank=1
  ), ordered AS (
    SELECT *,row_number() OVER (
      PARTITION BY exercise_id,load_unit ORDER BY started_at DESC,session_id DESC
    ) AS exposure_rank,
    count(*) OVER (PARTITION BY exercise_id,load_unit) AS exposure_count
    FROM by_session
  ), compared AS (
    SELECT exercise_id,load_unit,max(exposure_count) AS exposures,
      max(load_value) FILTER (WHERE exposure_rank=1) AS recent_load,
      max(load_value) FILTER (WHERE exposure_rank=2) AS prior_load,
      max(reps) FILTER (WHERE exposure_rank=1) AS recent_reps,
      max(reps) FILTER (WHERE exposure_rank=2) AS prior_reps,
      max(rir) FILTER (WHERE exposure_rank=1) AS recent_rir,
      max(started_at) FILTER (WHERE exposure_rank=1) AS recent_at
    FROM ordered WHERE exposure_rank<=2 GROUP BY exercise_id,load_unit
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'exercise_id',exercise_id,'load_unit',load_unit,'exposures',exposures,
    'recent_peak_load',recent_load,'prior_peak_load',prior_load,
    'recent_best_reps',recent_reps,'prior_best_reps',prior_reps,
    'recent_rir',recent_rir,'recent_at',recent_at,
    'comparison_confidence', CASE WHEN exposures>=4 THEN 'medium' WHEN exposures>=2 THEN 'low' ELSE 'insufficient' END,
    'signal',CASE
      WHEN exposures<2 THEN 'insufficient'
      WHEN recent_load>prior_load THEN 'load_increased_observed'
      WHEN recent_load<prior_load THEN 'load_decreased_observed'
      WHEN recent_reps>prior_reps THEN 'reps_increased_observed'
      WHEN recent_reps<prior_reps THEN 'review'
      ELSE 'stable_observed' END,
    'reason','Each load/repetition pair comes from one recorded working set; review range, RIR, device and recovery before drawing conclusions.'
  ) ORDER BY exposures DESC,exercise_id,load_unit),'[]'::jsonb)
  INTO v_trends FROM compared;

  v_sessions:=coalesce((v_base->>'completed_sessions')::integer,0);
  v_sets:=coalesce((v_base->>'completed_sets')::integer,0);
  v_complete:=coalesce((v_base->>'measured_sets')::integer,0);
  v_ratio:=CASE WHEN v_sets>0 THEN round(v_complete::numeric/v_sets,3) ELSE 0 END;
  SELECT count(*) INTO v_repeated FROM jsonb_array_elements(coalesce(v_trends,'[]'::jsonb)) t
    WHERE (t->>'exposures')::integer>=2;
  v_quality:=CASE
    WHEN v_sessions>=4 AND v_sets>=12 AND v_ratio>=0.8 AND v_repeated>=2 THEN 'reviewable'
    WHEN v_sessions>=2 AND v_sets>=6 AND v_ratio>=0.5 THEN 'partial'
    ELSE 'limited' END;
  IF v_ratio<0.8 THEN v_gaps:=v_gaps || jsonb_build_array('Carga, repetições ou RIR incompletos em parte das séries.'); END IF;
  IF v_repeated<2 THEN v_gaps:=v_gaps || jsonb_build_array('Poucas exposições comparáveis para avaliação longitudinal.'); END IF;
  IF v_base->'recovery_context' IS NULL OR v_base->'recovery_context'='null'::jsonb
    THEN v_gaps:=v_gaps || jsonb_build_array('Faltam registros recentes de sono e recuperação.'); END IF;

  v_options:=jsonb_build_array(
    jsonb_build_object('goal','hypertrophy','strategy','continue_progression',
      'reason','Progressão seletiva de repetições apenas quando sustentada por registros comparáveis e revisão do atleta.'),
    jsonb_build_object('goal','strength','strategy','consolidate',
      'reason','Revisar progressão real da carga e técnica antes de propor kg; máquinas sem incrementos conhecidos não permitem ajuste numérico.'),
    jsonb_build_object('goal','muscle_priority','strategy','consolidate',
      'reason','Redirecionar prioridade de grupo muscular por escolha explícita, sem presumir necessidade de mais séries.'),
    jsonb_build_object('goal','maintenance','strategy','recovery_review',
      'reason','Manter estímulos enquanto revisa recuperação e capacidade de treinamento.'),
    jsonb_build_object('goal','fat_loss','strategy','consolidate',
      'reason','Preservar treinamento e definir objetivo corporal/nutricional com dados e vontade do atleta; não inferir por aparência.')
  );
  RETURN v_base || jsonb_build_object(
    'engine_version','cch-guided-v5',
    'load_trends',coalesce(v_trends,'[]'::jsonb),
    'data_quality',jsonb_build_object('status',v_quality,'observed_sessions',v_sessions,
      'completed_work_sets',v_sets,'fully_measured_sets',v_complete,
      'completeness_ratio',v_ratio,'comparable_exercise_units',v_repeated,
      'training_level_is_independent_of_quality',true),
    'data_gaps',v_gaps,'strategy_options',v_options,
    'next_review',jsonb_build_object('after_completed_sessions',3,
      'also_on','objective change, meaningful pain or recovery concern, or athlete-requested review',
      'schedule_mode','flexible_session_sequence'),
    'limitations',coalesce(v_base->'limitations','[]'::jsonb) ||
      jsonb_build_array('Observed trends are descriptive; high strength/volume response is individual, not predicted.',
        'The motor does not infer a percentage or absolute load increase.',
        'Incomplete data lower recommendation confidence, never the declared training level.')
  );
END;
$$;
REVOKE ALL ON FUNCTION public.health_cch_assess_cycle_v5(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.health_cch_assess_cycle_v5(uuid) TO authenticated;

-- The V5 writer remains a single transaction, using established M3 cloning and guards.
-- The V4 volume increase is intentionally not reused: it may have no eligible exercise.
CREATE OR REPLACE FUNCTION public.health_cch_generate_guided_cycle_v5(
  p_program_id uuid,p_goal text,p_strategy text,p_availability text,
  p_priority_muscle_id uuid DEFAULT NULL,
  p_allow_targeted_set_proposal boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE
  v_p public.health_programs%ROWTYPE;
  v_assessment jsonb;
  v_draft uuid;
  v_target uuid;
  v_adjusted integer:=0;
  v_recovery jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT * INTO v_p FROM public.health_programs WHERE id=p_program_id FOR UPDATE;
  IF v_p.id IS NULL OR NOT public.health_can_write_athlete(v_p.athlete_id) THEN
    RAISE EXCEPTION 'program unavailable or unauthorized';
  END IF;
  IF p_goal IS NULL OR p_goal NOT IN ('hypertrophy','strength','maintenance','fat_loss','muscle_priority')
    OR p_strategy IS NULL OR p_strategy NOT IN ('continue_progression','consolidate','recovery_review')
    OR p_availability IS DISTINCT FROM 'flexible' THEN RAISE EXCEPTION 'invalid selection'; END IF;
  IF coalesce(p_allow_targeted_set_proposal,false) AND
    (p_goal<>'muscle_priority' OR p_strategy<>'continue_progression' OR p_priority_muscle_id IS NULL)
    THEN RAISE EXCEPTION 'volume proposal requires explicit muscle-priority selection'; END IF;

  v_assessment:=public.health_cch_assess_cycle_v5(p_program_id);
  -- Existing V3 writer validates queue completed and publishes NOTHING.
  v_draft:=public.health_cch_generate_guided_cycle_v3(
    p_program_id,p_goal,p_strategy,p_availability,p_priority_muscle_id);
  v_recovery:=v_assessment->'recovery_context';
  -- A change in volume is an opt-in DRAFT proposal only; absent recovery evidence
  -- means no automatic increase. No eligible exercise is a valid no-op.
  IF coalesce(p_allow_targeted_set_proposal,false)
    AND (v_assessment->'data_quality'->>'status')='reviewable'
    AND v_recovery IS NOT NULL AND v_recovery<>'null'::jsonb
    AND coalesce((v_recovery->>'recovery_observed_days')::integer,0)>=4
    AND coalesce((v_recovery->>'fatigue_observed_days')::integer,0)>=4 THEN
    SELECT target.id INTO v_target
    FROM public.health_session_template_exercises target
    JOIN public.health_session_templates t ON t.id=target.session_template_id
    JOIN public.health_exercise_muscles em ON em.exercise_id=target.exercise_id AND em.role='primary'
    JOIN jsonb_to_recordset(coalesce(v_assessment->'exercise_assessments','[]'::jsonb))
      AS ev(exercise_id uuid,decision text,exposures integer) ON ev.exercise_id=target.exercise_id
    WHERE t.program_version_id=v_draft AND t.athlete_id=v_p.athlete_id
      AND target.athlete_id=v_p.athlete_id AND t.status='active'
      AND em.muscle_group_id=p_priority_muscle_id
      AND target.planned_sets_max BETWEEN 1 AND 19
      AND ev.exposures>=2 AND ev.decision IN ('maintain','progress_candidate')
    ORDER BY ev.exposures DESC,t.sequence_order,target.sequence_order
    LIMIT 1;
    IF v_target IS NOT NULL THEN
      UPDATE public.health_session_template_exercises
      SET planned_sets_max=planned_sets_max+1,
        prescription_notes=concat_ws(E'\n',prescription_notes,
          'CCH V5: opt-in +1 no teto de séries de um exercício prioritário; confirmar tolerância, descanso e objetivo antes da publicação.')
      WHERE id=v_target AND athlete_id=v_p.athlete_id;
      GET DIAGNOSTICS v_adjusted=ROW_COUNT;
    END IF;
  END IF;

  UPDATE public.health_program_versions
  SET rationale=concat_ws(E'\n',rationale,
    'CCH V5: auditoria longitudinal, confiança e checkpoints flexíveis. Progressão de carga sempre depende de revisão; nenhuma prescrição de kg foi inventada.'),
    parameter_set=coalesce(parameter_set,'{}'::jsonb) ||
      jsonb_build_object('guided_cycle',
        coalesce(parameter_set->'guided_cycle','{}'::jsonb) || jsonb_build_object(
          'engine_version','cch-guided-v5',
          'assessment_snapshot',v_assessment,
          'targeted_set_proposal_requested',coalesce(p_allow_targeted_set_proposal,false),
          'targeted_set_proposals_applied',v_adjusted,
          'review_checkpoint',v_assessment->'next_review',
          'review_required',true,'publication_requires_review',true))
  WHERE id=v_draft AND athlete_id=v_p.athlete_id AND status='draft';
  RETURN v_draft;
END;
$$;
REVOKE ALL ON FUNCTION public.health_cch_generate_guided_cycle_v5(uuid,text,text,text,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.health_cch_generate_guided_cycle_v5(uuid,text,text,text,uuid,boolean) TO authenticated;
