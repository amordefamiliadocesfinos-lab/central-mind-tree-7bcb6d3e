-- CCH V4: evidence-based load/volume recommendations and flexible periodization outline.
-- Source of truth remains M3/M4/F13/F14/F22; only draft changes after athlete selection.
CREATE OR REPLACE FUNCTION public.health_cch_assess_cycle_v4(p_program_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_program public.health_programs%ROWTYPE;
  v_base jsonb;
  v_exercises jsonb;
  v_distribution jsonb;
  v_span integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT * INTO v_program FROM public.health_programs WHERE id=p_program_id;
  IF v_program.id IS NULL OR NOT public.health_can_read_athlete(v_program.athlete_id) THEN
    RAISE EXCEPTION 'program not visible';
  END IF;
  v_base:=public.health_cch_assess_cycle_v3(p_program_id);
  -- Repeatable measures for a single exercise, never cross-exercise or cross-equipment comparisons.
  WITH by_session AS (
    SELECT we.exercise_id,s.id AS session_id,s.started_at,ws.load_unit,
      max(ws.load_value) AS peak_load,
      max(ws.reps) FILTER (WHERE ws.load_value IS NOT NULL) AS best_reps,
      min(ws.rir) AS lowest_rir,
      count(*) FILTER (WHERE ws.load_value IS NULL OR ws.load_unit IS NULL OR ws.reps IS NULL OR ws.rir IS NULL) AS missing_fields
    FROM public.health_workout_sessions s
    JOIN public.health_workout_exercises we ON we.session_id=s.id AND we.athlete_id=s.athlete_id
    JOIN public.health_workout_sets ws ON ws.workout_exercise_id=we.id AND ws.athlete_id=s.athlete_id
    WHERE s.athlete_id=v_program.athlete_id AND s.program_version_id=v_program.current_version_id
      AND s.status='completed' AND s.record_status='active'
      AND ws.status='completed' AND ws.set_type='working'
    GROUP BY we.exercise_id,s.id,s.started_at,ws.load_unit
  ), complete AS (
    SELECT *, row_number() OVER (PARTITION BY exercise_id,load_unit ORDER BY started_at DESC,session_id DESC) AS rn,
      count(*) OVER (PARTITION BY exercise_id,load_unit) AS exposures
    FROM by_session
    WHERE load_unit IS NOT NULL AND missing_fields=0
  ), candidates AS (
    SELECT c.exercise_id,c.load_unit,max(c.exposures) AS exposures,
      max(c.peak_load) FILTER (WHERE rn=1) AS recent_peak_load,
      max(c.peak_load) FILTER (WHERE rn=2) AS prior_peak_load,
      max(c.best_reps) FILTER (WHERE rn=1) AS recent_best_reps,
      max(c.best_reps) FILTER (WHERE rn=2) AS prior_best_reps,
      min(c.lowest_rir) FILTER (WHERE rn=1) AS recent_rir
    FROM complete c WHERE c.rn<=2
    GROUP BY c.exercise_id,c.load_unit
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'exercise_id',exercise_id,'load_unit',load_unit,'exposures',exposures,
    'recent_peak_load',recent_peak_load,'prior_peak_load',prior_peak_load,
    'recent_best_reps',recent_best_reps,'prior_best_reps',prior_best_reps,'recent_rir',recent_rir,
    'signal',CASE WHEN exposures<2 THEN 'insufficient'
      WHEN recent_peak_load>prior_peak_load THEN 'load_increased_observed'
      WHEN recent_peak_load=prior_peak_load AND recent_best_reps>prior_best_reps THEN 'reps_increased_observed'
      WHEN recent_peak_load=prior_peak_load AND recent_best_reps<prior_best_reps THEN 'review'
      ELSE 'stable_observed' END,
    'reason','Observações das duas execuções completas mais recentes para o mesmo exercício e unidade; não equivalem a prescrição de carga.'
  ) ORDER BY exposures DESC,exercise_id),'[]'::jsonb)
  INTO v_exercises FROM candidates;

  v_span:=nullif((v_base->'frequency_context'->>'span_days')::integer,0);
  SELECT coalesce(jsonb_agg(
    grp.value || jsonb_build_object(
      'observed_sets_per_7_days',
        CASE WHEN v_span>=14 AND (v_base->>'completed_sessions')::integer>=4
          THEN round((grp.value->>'recorded_work_sets')::numeric*7/v_span,1)
          ELSE NULL END,
      'normalization_available',v_span>=14 AND (v_base->>'completed_sessions')::integer>=4)
    ORDER BY grp.ordinality),'[]'::jsonb)
  INTO v_distribution FROM jsonb_array_elements(coalesce(v_base->'muscle_distribution','[]'::jsonb))
    WITH ORDINALITY grp(value,ordinality);

  RETURN v_base || jsonb_build_object(
    'engine_version','cch-guided-v4',
    'load_trends',coalesce(v_exercises,'[]'::jsonb),
    'muscle_distribution',coalesce(v_distribution,'[]'::jsonb),
    'periodization_options',jsonb_build_array(
      jsonb_build_object('stage','consolidate','description','Início: manter padrões de execução e identificar exposições comparáveis.'),
      jsonb_build_object('stage','progress_when_supported','description','Durante a sequência: progredir somente exercícios com evidência e recuperação compatível.'),
      jsonb_build_object('stage','review','description','Ao final: comparar tendências, confirmar objetivo e reavaliar próximos estímulos.')),
    'limitations',(coalesce(v_base->'limitations','[]'::jsonb) ||
      jsonb_build_array('A carga dos equipamentos não tem incremento cadastrado; portanto o CCH não impõe kg ou porcentagem automáticos.',
      'Séries por sete dias são observacionais quando a janela permite, não uma dose-alvo.',
      'Periodização V4 é um roteiro flexível com checkpoints, não uma prescrição automática de blocos fixos.')));
END;
$$;
REVOKE ALL ON FUNCTION public.health_cch_assess_cycle_v4(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.health_cch_assess_cycle_v4(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.health_cch_generate_guided_cycle_v4(
  p_program_id uuid,p_goal text,p_strategy text,p_availability text,
  p_priority_muscle_id uuid DEFAULT NULL,
  p_allow_targeted_set_proposal boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_program public.health_programs%ROWTYPE;
  v_draft uuid;
  v_assessment jsonb;
  v_row record;
  v_proposed_sets integer:=0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT * INTO v_program FROM public.health_programs WHERE id=p_program_id FOR UPDATE;
  IF v_program.id IS NULL OR NOT public.health_can_write_athlete(v_program.athlete_id) THEN
    RAISE EXCEPTION 'program not visible';
  END IF;
  IF coalesce(p_allow_targeted_set_proposal,false) AND (
    p_goal IS DISTINCT FROM 'muscle_priority' OR p_strategy IS DISTINCT FROM 'continue_progression'
    OR p_priority_muscle_id IS NULL) THEN
    RAISE EXCEPTION 'targeted sets require explicit muscle-priority progression selection';
  END IF;
  v_assessment:=public.health_cch_assess_cycle_v4(v_program.id);
  -- V3 owns all existing access, completion, idempotency and versioning requirements.
  v_draft:=public.health_cch_generate_guided_cycle_v3(
    p_program_id,p_goal,p_strategy,p_availability,p_priority_muscle_id);

  IF coalesce(p_allow_targeted_set_proposal,false) THEN
    -- Opt-in: at most one set-range upper-bound proposal, for one existing target exercise.
    -- Requires repeated compatible exercise exposure and no observed negative signal.
    SELECT target.id,target.planned_sets_max INTO v_row
    FROM public.health_session_template_exercises target
    JOIN public.health_session_templates t ON t.id=target.session_template_id
    JOIN public.health_exercise_muscles em ON em.exercise_id=target.exercise_id AND em.role='primary'
    JOIN jsonb_to_recordset(coalesce(v_assessment->'exercise_assessments','[]'::jsonb))
      AS ev(exercise_id uuid,decision text,exposures integer)
      ON ev.exercise_id=target.exercise_id
    WHERE t.program_version_id=v_draft AND t.athlete_id=v_program.athlete_id
      AND target.athlete_id=v_program.athlete_id AND t.status='active'
      AND em.muscle_group_id=p_priority_muscle_id
      AND target.planned_sets_max BETWEEN 1 AND 19
      AND ev.exposures>=2 AND ev.decision IN ('maintain','progress_candidate')
    ORDER BY ev.exposures DESC,t.sequence_order,target.sequence_order
    LIMIT 1;
    IF v_row.id IS NOT NULL THEN
      UPDATE public.health_session_template_exercises
      SET planned_sets_max=planned_sets_max+1,
        prescription_notes=concat_ws(E'\n',prescription_notes,
          'CCH V4: +1 no máximo de séries para um exercício prioritário, solicitado pelo atleta. Revisar tolerância, recuperação e agenda antes de publicar.')
      WHERE id=v_row.id AND athlete_id=v_program.athlete_id;
      v_proposed_sets:=1;
    END IF;
  END IF;

  UPDATE public.health_program_versions
  SET rationale=concat_ws(E'\n',rationale,
    'CCH V4: proposta auditada de força, volume e checkpoints flexíveis. Aumentos de carga ficam apenas como orientação, nunca kg inferidos.'),
    parameter_set=coalesce(parameter_set,'{}'::jsonb) ||
      jsonb_build_object('guided_cycle',
        coalesce(parameter_set->'guided_cycle','{}'::jsonb) ||
        jsonb_build_object(
          'engine_version','cch-guided-v4',
          'assessment_snapshot',v_assessment,
          'targeted_set_proposal_requested',coalesce(p_allow_targeted_set_proposal,false),
          'targeted_set_proposals_applied',v_proposed_sets,
          'periodization_plan',v_assessment->'periodization_options',
          'review_required',true,'publication_requires_review',true))
  WHERE id=v_draft AND athlete_id=v_program.athlete_id AND status='draft';
  RETURN v_draft;
END;
$$;
REVOKE ALL ON FUNCTION public.health_cch_generate_guided_cycle_v4(uuid,text,text,text,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.health_cch_generate_guided_cycle_v4(uuid,text,text,text,uuid,boolean) TO authenticated;
