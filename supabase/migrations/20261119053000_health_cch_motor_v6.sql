-- CCH V6: athlete-confirmed current recovery and symptom state.
-- No new programs, no automatic publication, no unsafe escalation from unconfirmed readiness.
CREATE OR REPLACE FUNCTION public.health_cch_generate_guided_cycle_v6(
  p_program_id uuid,p_goal text,p_strategy text,p_availability text,
  p_priority_muscle_id uuid DEFAULT NULL,
  p_allow_targeted_set_proposal boolean DEFAULT false,
  p_recovery_report text DEFAULT 'unknown',
  p_symptom_report text DEFAULT 'unknown'
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE
  v_program public.health_programs%ROWTYPE;
  v_draft uuid;
  v_guarded boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_recovery_report IS NULL OR p_recovery_report NOT IN ('good','poor','unknown')
     OR p_symptom_report IS NULL OR p_symptom_report NOT IN ('none','pain','unknown') THEN
    RAISE EXCEPTION 'invalid recovery/symptom responses';
  END IF;
  SELECT * INTO v_program FROM public.health_programs WHERE id=p_program_id FOR UPDATE;
  IF v_program.id IS NULL OR NOT public.health_can_write_athlete(v_program.athlete_id) THEN
    RAISE EXCEPTION 'program unavailable or unauthorized';
  END IF;
  v_guarded := p_recovery_report<>'good' OR p_symptom_report<>'none';
  IF v_guarded AND (p_strategy='continue_progression' OR coalesce(p_allow_targeted_set_proposal,false)) THEN
    RAISE EXCEPTION 'current recovery or symptoms require conservative strategy; choose consolidate/recovery review';
  END IF;
  -- Existing V5 owns program, queue, version and audit constraints; a guarded selection
  -- never calls the V2 automatic rep progression branch.
  v_draft:=public.health_cch_generate_guided_cycle_v5(
    p_program_id,p_goal,p_strategy,p_availability,p_priority_muscle_id,p_allow_targeted_set_proposal);
  UPDATE public.health_program_versions SET
    rationale=concat_ws(E'\n',rationale,'CCH V6: recuperação e sintomas atuais informados pelo atleta; sem inferência clínica.'),
    parameter_set=coalesce(parameter_set,'{}'::jsonb) ||
      jsonb_build_object('guided_cycle',
        coalesce(parameter_set->'guided_cycle','{}'::jsonb) ||
        jsonb_build_object('engine_version','cch-guided-v6',
          'athlete_recovery_report',p_recovery_report,
          'athlete_symptom_report',p_symptom_report,
          'reports_are_self_described',true,
          'review_required',true,'publication_requires_review',true))
  WHERE id=v_draft AND athlete_id=v_program.athlete_id AND status='draft';
  IF NOT FOUND THEN RAISE EXCEPTION 'draft not available for audit'; END IF;
  RETURN v_draft;
END;
$$;
REVOKE ALL ON FUNCTION public.health_cch_generate_guided_cycle_v6(uuid,text,text,text,uuid,boolean,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.health_cch_generate_guided_cycle_v6(uuid,text,text,text,uuid,boolean,text,text) TO authenticated;
