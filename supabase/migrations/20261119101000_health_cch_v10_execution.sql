-- CCH V10 - execution and effort coverage from existing M4 history.
-- All conclusions are descriptive and do not create or alter workout sessions.
CREATE OR REPLACE FUNCTION public.health_cch_assess_execution_v10(p_program_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_p public.health_programs%ROWTYPE;v_rows jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
 SELECT * INTO v_p FROM public.health_programs WHERE id=p_program_id;
 IF v_p.id IS NULL OR NOT public.health_can_read_athlete(v_p.athlete_id) THEN
  RAISE EXCEPTION 'program unavailable'; END IF;
 WITH rows AS (
  SELECT we.exercise_id,s.id AS session_id,ws.id AS set_id,ws.reps,ws.rir,
    ws.load_value,ws.load_unit,ws.rest_seconds,
    we.planned_reps_min,we.planned_reps_max,we.planned_rir_target,
    (we.planned_reps_min IS NOT NULL AND we.planned_reps_max IS NOT NULL
       AND we.planned_reps_min<=we.planned_reps_max) AS has_rep_target,
    (ws.reps IS NOT NULL AND ws.reps>0) AS has_reps
  FROM public.health_program_versions pv
  JOIN public.health_workout_sessions s
    ON s.program_version_id=pv.id AND s.athlete_id=pv.athlete_id
  JOIN public.health_workout_exercises we
    ON we.session_id=s.id AND we.athlete_id=s.athlete_id
  JOIN public.health_workout_sets ws
    ON ws.workout_exercise_id=we.id AND ws.session_id=s.id AND ws.athlete_id=s.athlete_id
  WHERE pv.program_id=v_p.id AND pv.athlete_id=v_p.athlete_id AND pv.status='published'
    AND s.record_status='active' AND s.status='completed'
    AND ws.status='completed' AND ws.set_type='working'
 ), aggregated AS (
  SELECT exercise_id,count(DISTINCT session_id)::integer AS exposures,
    count(*)::integer AS completed_sets,
    count(*) FILTER(WHERE has_reps)::integer AS sets_with_reps,
    count(*) FILTER(WHERE rir BETWEEN 0 AND 10)::integer AS sets_with_rir,
    count(*) FILTER(WHERE load_value>0 AND load_unit IS NOT NULL)::integer AS sets_with_load,
    count(*) FILTER(WHERE rest_seconds IS NOT NULL AND rest_seconds>=0)::integer AS sets_with_rest,
    count(*) FILTER(WHERE has_rep_target AND has_reps)::integer AS reps_comparable,
    count(*) FILTER(WHERE has_rep_target AND has_reps
       AND reps BETWEEN planned_reps_min AND planned_reps_max)::integer AS reps_in_range,
    count(*) FILTER(WHERE has_rep_target AND has_reps
       AND reps<planned_reps_min)::integer AS reps_below_range,
    count(*) FILTER(WHERE has_rep_target AND has_reps
       AND reps>planned_reps_max)::integer AS reps_above_range,
    count(*) FILTER(WHERE planned_rir_target IS NOT NULL
      AND rir BETWEEN 0 AND 10)::integer AS rir_comparable,
    count(*) FILTER(WHERE planned_rir_target IS NOT NULL AND rir BETWEEN 0 AND 10
      AND rir<planned_rir_target)::integer AS rir_below_plan,
    count(*) FILTER(WHERE planned_rir_target IS NOT NULL AND rir BETWEEN 0 AND 10
      AND rir>=planned_rir_target)::integer AS rir_at_or_above_plan
  FROM rows GROUP BY exercise_id
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'exercise_id',exercise_id,'exposures',exposures,'completed_sets',completed_sets,
  'sets_with_reps',sets_with_reps,'sets_with_rir',sets_with_rir,
  'sets_with_load',sets_with_load,'sets_with_rest',sets_with_rest,
  'reps_comparable',reps_comparable,'reps_in_range',reps_in_range,
  'reps_below_range',reps_below_range,'reps_above_range',reps_above_range,
  'rir_comparable',rir_comparable,'rir_below_plan',rir_below_plan,
  'rir_at_or_above_plan',rir_at_or_above_plan,
  'interpretation',CASE WHEN exposures<2 OR reps_comparable<4 THEN 'limited'
    WHEN reps_below_range>reps_in_range THEN 'review_prescription'
    ELSE 'reviewable_execution' END,
  'note','The range comparison is descriptive; it does not prove technique, overload tolerance or suitability.'
 ) ORDER BY completed_sets DESC,exercise_id),'[]'::jsonb)
 INTO v_rows FROM aggregated;
 RETURN jsonb_build_object('engine_version','cch-execution-v10',
   'exercise_metrics',v_rows,'only_completed_valid_workouts',true,
   'automated_prescription_changes',false);
END;
$$;
REVOKE ALL ON FUNCTION public.health_cch_assess_execution_v10(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.health_cch_assess_execution_v10(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.health_cch_assess_cycle_v10(p_program_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_base jsonb;v_execution jsonb;
BEGIN
 v_base:=public.health_cch_assess_cycle_v8(p_program_id);
 v_execution:=public.health_cch_assess_execution_v10(p_program_id);
 RETURN v_base || jsonb_build_object('engine_version','cch-guided-v10',
  'execution_coverage',v_execution,
  'limitations',coalesce(v_base->'limitations','[]'::jsonb) ||
    jsonb_build_array('RIR and planned repetition comparisons are descriptive and self-reported.',
      'No machine-specific load progression is inferred from exercise-level adherence.'));
END;
$$;
REVOKE ALL ON FUNCTION public.health_cch_assess_cycle_v10(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.health_cch_assess_cycle_v10(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.health_cch_generate_guided_cycle_v10(
 p_program_id uuid,p_goal text,p_strategy text,p_availability text,
 p_priority_muscle_id uuid DEFAULT NULL,p_allow_targeted_set_proposal boolean DEFAULT false,
 p_recovery_report text DEFAULT 'unknown',p_symptom_report text DEFAULT 'unknown'
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_audit jsonb;v_draft uuid;v_p public.health_programs%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
 SELECT * INTO v_p FROM public.health_programs WHERE id=p_program_id FOR UPDATE;
 IF v_p.id IS NULL OR NOT public.health_can_write_athlete(v_p.athlete_id) THEN
  RAISE EXCEPTION 'unauthorized program'; END IF;
 v_audit:=public.health_cch_assess_cycle_v10(p_program_id);
 v_draft:=public.health_cch_generate_guided_cycle_v9(p_program_id,p_goal,p_strategy,p_availability,
    p_priority_muscle_id,p_allow_targeted_set_proposal,p_recovery_report,p_symptom_report);
 UPDATE public.health_program_versions SET
 parameter_set=coalesce(parameter_set,'{}'::jsonb) ||
 jsonb_build_object('guided_cycle',coalesce(parameter_set->'guided_cycle','{}'::jsonb) ||
  jsonb_build_object('engine_version','cch-guided-v10',
    'assessment_snapshot',v_audit,
    'execution_coverage_snapshot',v_audit->'execution_coverage',
    'automatic_reps_sets_loads',false,
    'publication_requires_review',true))
 WHERE id=v_draft AND athlete_id=v_p.athlete_id AND status='draft';
 IF NOT FOUND THEN RAISE EXCEPTION 'draft unavailable'; END IF;
 RETURN v_draft;
END;
$$;
REVOKE ALL ON FUNCTION public.health_cch_generate_guided_cycle_v10(uuid,text,text,text,uuid,boolean,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.health_cch_generate_guided_cycle_v10(uuid,text,text,text,uuid,boolean,text,text) TO authenticated;
