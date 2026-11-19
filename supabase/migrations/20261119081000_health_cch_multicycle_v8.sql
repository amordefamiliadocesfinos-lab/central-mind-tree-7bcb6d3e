-- CCH V8B: transparent observed volume and recovery review across program versions.
CREATE OR REPLACE FUNCTION public.health_cch_assess_cycle_v8(p_program_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_p public.health_programs%ROWTYPE;v_base jsonb;v_equipment jsonb;
 v_volumes jsonb;v_phase text;v_recovery_available boolean;v_negative integer;
 v_completed_versions integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
 SELECT * INTO v_p FROM public.health_programs WHERE id=p_program_id;
 IF v_p.id IS NULL OR NOT public.health_can_read_athlete(v_p.athlete_id) THEN
   RAISE EXCEPTION 'unauthorized program';
 END IF;
 v_base:=public.health_cch_assess_cycle_v7(p_program_id);
 v_equipment:=public.health_cch_assess_equipment_history(p_program_id);
 v_recovery_available:=coalesce((v_base->'recovery_context'->>'recovery_observed_days')::integer,0)>=4
   AND coalesce((v_base->'recovery_context'->>'fatigue_observed_days')::integer,0)>=4;
 SELECT count(*) INTO v_negative
 FROM jsonb_array_elements(coalesce(v_base->'load_trends','[]'::jsonb)) x
 WHERE x->>'signal' IN ('review','load_decreased_observed');
 SELECT count(*) INTO v_completed_versions
 FROM jsonb_array_elements(coalesce(v_base->'multi_cycle_versions','[]'::jsonb)) x
 WHERE coalesce((x->>'sessions')::integer,0)>0;

 WITH eligible AS (
   SELECT x.value->>'muscle_id' AS muscle_id,
     x.value->>'muscle_name' AS muscle_name,
     (x.value->>'version_number')::integer AS version_number,
     (x.value->>'observed_per_7_days')::numeric AS sets_per_7
   FROM jsonb_array_elements(coalesce(v_base->'multi_cycle_volume','[]'::jsonb)) x
   WHERE x.value->>'observed_per_7_days' IS NOT NULL
 ), ranked AS (
   SELECT *,row_number() OVER(PARTITION BY muscle_id ORDER BY version_number DESC) AS rank,
     count(*) OVER(PARTITION BY muscle_id) AS comparable_versions
   FROM eligible
 ), pairs AS (
   SELECT muscle_id,max(muscle_name) muscle_name,max(comparable_versions) comparable_versions,
     max(sets_per_7) FILTER(WHERE rank=1) recent_sets,
     max(sets_per_7) FILTER(WHERE rank=2) previous_sets
   FROM ranked WHERE rank<=2 GROUP BY muscle_id
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'muscle_id',muscle_id,'muscle_name',muscle_name,
   'comparable_versions',comparable_versions,
   'recent_observed_sets_per_7_days',recent_sets,
   'previous_observed_sets_per_7_days',previous_sets,
   'observation',CASE WHEN comparable_versions<2 THEN 'insufficient'
     WHEN recent_sets>previous_sets THEN 'volume_observed_higher'
     WHEN recent_sets<previous_sets THEN 'volume_observed_lower'
     ELSE 'volume_observed_stable' END,
   'inference','Volume comparisons do not prove tolerance, muscle growth or causality. Performance and recovery need individual review.'
 ) ORDER BY muscle_name),'[]'::jsonb) INTO v_volumes FROM pairs;

 v_phase:=CASE
   WHEN v_completed_versions<2 THEN 'collect_more_cycles'
   WHEN v_base->'data_quality'->>'status' IS DISTINCT FROM 'reviewable'
      THEN 'consolidate_measurement'
   WHEN NOT v_recovery_available THEN 'confirm_recovery_context'
   WHEN v_negative>0 THEN 'review_performance'
   ELSE 'selective_progression_review' END;
 RETURN v_base || jsonb_build_object(
   'engine_version','cch-guided-v8',
   'equipment_provenance',v_equipment,
   'equipment_load_candidates','[]'::jsonb,
   'muscle_volume_response_review',v_volumes,
   'periodization_decision',jsonb_build_object(
     'phase',v_phase,'completed_versions',v_completed_versions,
     'recovery_context_sufficient',v_recovery_available,
     'negative_performance_signals',v_negative,
     'review_after_completed_sessions',3,
     'flexible_availability',true,
     'numeric_loads_only_on_verified_equipment',true,
     'auto_publish',false),
   'limitations',coalesce(v_base->'limitations','[]'::jsonb) ||
      jsonb_build_array('Volume response report is descriptive, not proof of individual tolerance.',
        'Global performance flags cannot be attributed to a specific muscle without further data.'));
END;
$$;
REVOKE ALL ON FUNCTION public.health_cch_assess_cycle_v8(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.health_cch_assess_cycle_v8(uuid) TO authenticated;

-- Keep the existing V8 writer signature, but snapshot the unified V8 audit.
CREATE OR REPLACE FUNCTION public.health_cch_generate_guided_cycle_v8(
 p_program_id uuid,p_goal text,p_strategy text,p_availability text,
 p_priority_muscle_id uuid DEFAULT NULL,p_allow_targeted_set_proposal boolean DEFAULT false,
 p_recovery_report text DEFAULT 'unknown',p_symptom_report text DEFAULT 'unknown'
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_p public.health_programs%ROWTYPE;v_audit jsonb;v_draft uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
 SELECT * INTO v_p FROM public.health_programs WHERE id=p_program_id FOR UPDATE;
 IF v_p.id IS NULL OR NOT public.health_can_write_athlete(v_p.athlete_id) THEN
   RAISE EXCEPTION 'unauthorized';
 END IF;
 v_audit:=public.health_cch_assess_cycle_v8(p_program_id);
 v_draft:=public.health_cch_generate_guided_cycle_v7(p_program_id,p_goal,p_strategy,p_availability,
   p_priority_muscle_id,p_allow_targeted_set_proposal,p_recovery_report,p_symptom_report);
 UPDATE public.health_program_versions SET
  parameter_set=coalesce(parameter_set,'{}'::jsonb) ||
  jsonb_build_object('guided_cycle',coalesce(parameter_set->'guided_cycle','{}'::jsonb) ||
  jsonb_build_object('engine_version','cch-guided-v8',
    'assessment_snapshot',v_audit,'periodization_decision',v_audit->'periodization_decision',
    'verified_equipment_snapshot',v_audit->'equipment_provenance',
    'numeric_loads_are_advisory_only',true,'publication_requires_review',true))
 WHERE id=v_draft AND athlete_id=v_p.athlete_id AND status='draft';
 IF NOT FOUND THEN RAISE EXCEPTION 'draft unavailable'; END IF;
 RETURN v_draft;
END;
$$;
REVOKE ALL ON FUNCTION public.health_cch_generate_guided_cycle_v8(uuid,text,text,text,uuid,boolean,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.health_cch_generate_guided_cycle_v8(uuid,text,text,text,uuid,boolean,text,text) TO authenticated;
