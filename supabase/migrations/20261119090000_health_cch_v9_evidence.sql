-- CCH V9: versioned recommendation and explicit athlete intent.
-- Review-first. Previous V2/V5 exercise-aggregated automatic rep/set adjustments
-- are not allowed to silently carry into V9's equipment-specific planning.
CREATE OR REPLACE FUNCTION public.health_cch_generate_guided_cycle_v9(
 p_program_id uuid,p_goal text,p_strategy text,p_availability text,
 p_priority_muscle_id uuid DEFAULT NULL,p_allow_targeted_set_proposal boolean DEFAULT false,
 p_recovery_report text DEFAULT 'unknown',p_symptom_report text DEFAULT 'unknown'
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_p public.health_programs%ROWTYPE;v_audit jsonb;v_draft uuid;
  v_effective_strategy text;v_reason text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
 SELECT * INTO v_p FROM public.health_programs WHERE id=p_program_id FOR UPDATE;
 IF v_p.id IS NULL OR NOT public.health_can_write_athlete(v_p.athlete_id) THEN
  RAISE EXCEPTION 'unauthorized program'; END IF;
 IF p_goal IS NULL OR p_goal NOT IN ('hypertrophy','strength','maintenance','fat_loss','muscle_priority')
    OR p_strategy IS NULL OR p_strategy NOT IN ('continue_progression','consolidate','recovery_review')
    OR p_availability IS DISTINCT FROM 'flexible' THEN
  RAISE EXCEPTION 'invalid objective, strategy or availability'; END IF;
 IF p_goal='muscle_priority' AND p_priority_muscle_id IS NULL THEN
  RAISE EXCEPTION 'muscle priority must be selected'; END IF;
 IF coalesce(p_allow_targeted_set_proposal,false) AND
   (p_goal<>'muscle_priority' OR p_strategy<>'continue_progression') THEN
  RAISE EXCEPTION 'set proposal requires muscle-priority selection'; END IF;
 IF p_recovery_report IS NULL OR p_recovery_report NOT IN ('good','poor','unknown')
   OR p_symptom_report IS NULL OR p_symptom_report NOT IN ('none','pain','unknown') THEN
  RAISE EXCEPTION 'invalid current recovery/symptom report'; END IF;
 IF p_strategy='continue_progression' AND
    (p_recovery_report<>'good' OR p_symptom_report<>'none') THEN
  RAISE EXCEPTION 'recovery and symptoms require review before progression'; END IF;

 v_audit:=public.health_cch_assess_cycle_v8(p_program_id);
 -- Intent is recorded; automated exercise-aggregated increases from older RPCs
 -- are disabled in this V9 path. This prevents machine-mixing while retaining
 -- the M3 draft copy, objectives and versioning.
 v_effective_strategy:=CASE WHEN p_strategy='continue_progression' THEN 'consolidate' ELSE p_strategy END;
 v_reason:=CASE WHEN p_strategy='continue_progression'
    THEN 'Requested progression requires per-machine and per-exercise review; V9 generated a conservative draft.'
    ELSE 'Selected strategy cloned into a reviewable draft without new unverified load changes.' END;
 v_draft:=public.health_cch_generate_guided_cycle_v8(
   p_program_id,p_goal,v_effective_strategy,p_availability,
   p_priority_muscle_id,false,p_recovery_report,p_symptom_report);
 UPDATE public.health_program_versions SET
  rationale=concat_ws(E'\n',rationale,v_reason),
  parameter_set=coalesce(parameter_set,'{}'::jsonb) ||
    jsonb_build_object('guided_cycle',
      coalesce(parameter_set->'guided_cycle','{}'::jsonb) ||
      jsonb_build_object('engine_version','cch-guided-v9',
        'requested_strategy',p_strategy,'effective_draft_strategy',v_effective_strategy,
        'targeted_set_proposal_requested',coalesce(p_allow_targeted_set_proposal,false),
        'targeted_set_proposal_applied',false,'assessment_snapshot',v_audit,
        'decision_reason',v_reason,
        'review_after_completed_sessions',3,
        'availability','flexible','automatic_load_change',false,
        'automatic_publication',false,'publication_requires_review',true))
 WHERE id=v_draft AND athlete_id=v_p.athlete_id AND status='draft';
 IF NOT FOUND THEN RAISE EXCEPTION 'draft not available'; END IF;
 RETURN v_draft;
END;
$$;
REVOKE ALL ON FUNCTION public.health_cch_generate_guided_cycle_v9(uuid,text,text,text,uuid,boolean,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.health_cch_generate_guided_cycle_v9(uuid,text,text,text,uuid,boolean,text,text) TO authenticated;
