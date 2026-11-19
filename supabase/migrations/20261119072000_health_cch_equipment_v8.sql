-- V8 equipment provenance for future CCH decisions, not retrospective inference.
CREATE TABLE IF NOT EXISTS public.health_cch_workout_equipment (
 workout_exercise_id uuid PRIMARY KEY REFERENCES public.health_workout_exercises(id) ON DELETE CASCADE,
 session_id uuid NOT NULL REFERENCES public.health_workout_sessions(id) ON DELETE CASCADE,
 athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
 exercise_id uuid NOT NULL REFERENCES public.health_exercises(id),
 equipment_label text NOT NULL CHECK(length(btrim(equipment_label)) BETWEEN 2 AND 100),
 confirmed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.health_cch_workout_equipment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cch_workout_equipment_select ON public.health_cch_workout_equipment;
CREATE POLICY cch_workout_equipment_select ON public.health_cch_workout_equipment
 FOR SELECT TO authenticated USING (public.health_can_read_athlete(athlete_id));
-- No direct updates/deletes. RPC validates matching exercise, athlete, and active session.
REVOKE ALL ON public.health_cch_workout_equipment FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.health_cch_workout_equipment TO authenticated;

CREATE OR REPLACE FUNCTION public.health_cch_confirm_workout_equipment(
 p_workout_exercise_id uuid,p_equipment_label text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_ex public.health_workout_exercises%ROWTYPE;
 v_session public.health_workout_sessions%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
 SELECT * INTO v_ex FROM public.health_workout_exercises WHERE id=p_workout_exercise_id FOR UPDATE;
 IF v_ex.id IS NULL OR NOT public.health_can_write_athlete(v_ex.athlete_id) THEN
  RAISE EXCEPTION 'unauthorized workout exercise'; END IF;
 SELECT * INTO v_session FROM public.health_workout_sessions
  WHERE id=v_ex.session_id AND athlete_id=v_ex.athlete_id FOR UPDATE;
 IF v_session.id IS NULL OR v_session.status NOT IN ('active','paused')
  OR v_session.record_status IS DISTINCT FROM 'active' THEN
  RAISE EXCEPTION 'workout is not open and active'; END IF;
 IF p_equipment_label IS NULL OR length(btrim(p_equipment_label)) NOT BETWEEN 2 AND 100 THEN
  RAISE EXCEPTION 'invalid equipment label'; END IF;
 IF EXISTS(SELECT 1 FROM public.health_workout_sets WHERE workout_exercise_id=v_ex.id) THEN
  RAISE EXCEPTION 'confirm equipment before recording any sets'; END IF;
 IF EXISTS(SELECT 1 FROM public.health_cch_workout_equipment WHERE workout_exercise_id=v_ex.id) THEN
  RAISE EXCEPTION 'equipment already confirmed for this workout exercise'; END IF;
 INSERT INTO public.health_cch_workout_equipment
  (workout_exercise_id,session_id,athlete_id,exercise_id,equipment_label)
 VALUES(v_ex.id,v_ex.session_id,v_ex.athlete_id,v_ex.exercise_id,btrim(p_equipment_label));
END;
$$;
REVOKE ALL ON FUNCTION public.health_cch_confirm_workout_equipment(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.health_cch_confirm_workout_equipment(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.health_cch_assess_equipment_history(p_program_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_p public.health_programs%ROWTYPE;v_evidence jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
 SELECT * INTO v_p FROM public.health_programs WHERE id=p_program_id;
 IF v_p.id IS NULL OR NOT public.health_can_read_athlete(v_p.athlete_id) THEN
  RAISE EXCEPTION 'program not available'; END IF;
 WITH ranked AS (
  SELECT eq.exercise_id,eq.equipment_label,ws.load_unit,s.id session_id,
   s.started_at,ws.load_value,ws.reps,ws.rir,
   row_number() OVER(PARTITION BY s.id,eq.exercise_id,eq.equipment_label,ws.load_unit
    ORDER BY ws.load_value DESC,ws.reps DESC,ws.completed_at DESC,ws.id) set_rank
  FROM public.health_cch_workout_equipment eq
  JOIN public.health_workout_sessions s ON s.id=eq.session_id AND s.athlete_id=eq.athlete_id
  JOIN public.health_program_versions pv ON pv.id=s.program_version_id
   AND pv.program_id=v_p.id AND pv.athlete_id=eq.athlete_id
  JOIN public.health_workout_sets ws ON ws.workout_exercise_id=eq.workout_exercise_id
   AND ws.athlete_id=eq.athlete_id AND ws.session_id=s.id
  WHERE eq.athlete_id=v_p.athlete_id AND s.status='completed' AND s.record_status='active'
   AND ws.status='completed' AND ws.set_type='working' AND ws.load_value>0
   AND ws.load_unit IN ('kg','lb') AND ws.reps>0 AND ws.rir BETWEEN 0 AND 10
 ), distinct_sessions AS (
  SELECT *,row_number() OVER(PARTITION BY exercise_id,equipment_label,load_unit
   ORDER BY started_at DESC,session_id DESC) rn,
   count(*) OVER(PARTITION BY exercise_id,equipment_label,load_unit) exposures
  FROM ranked WHERE set_rank=1
 ), pairs AS (
  SELECT exercise_id,equipment_label,load_unit,max(exposures) exposures,
   max(load_value) FILTER(WHERE rn=1) recent_load,
   max(load_value) FILTER(WHERE rn=2) prior_load,
   max(reps) FILTER(WHERE rn=1) recent_reps,
   max(reps) FILTER(WHERE rn=2) prior_reps,
   max(rir) FILTER(WHERE rn=1) recent_rir
  FROM distinct_sessions WHERE rn<=2
  GROUP BY exercise_id,equipment_label,load_unit
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'exercise_id',p.exercise_id,'equipment_label',p.equipment_label,
   'load_unit',p.load_unit,'exposures',p.exposures,
   'recent_load',p.recent_load,'recent_reps',p.recent_reps,
   'candidate_load',CASE WHEN p.exposures>=3
    AND cfg.equipment_label=p.equipment_label AND cfg.load_unit=p.load_unit
    AND p.recent_load=p.prior_load AND p.recent_reps>=p.prior_reps
    AND p.recent_rir BETWEEN 2 AND 6
   THEN p.recent_load+cfg.increment_value ELSE NULL END,
   'reason','Advisory candidate only, same confirmed machine and load unit; athlete reviews technique and recovery.'
  ) ORDER BY p.exercise_id,p.equipment_label,p.load_unit),'[]'::jsonb)
 INTO v_evidence
 FROM pairs p LEFT JOIN public.health_cch_load_increments cfg
  ON cfg.athlete_id=v_p.athlete_id AND cfg.exercise_id=p.exercise_id;
 RETURN jsonb_build_object('engine_version','cch-equipment-v8','evidence',v_evidence,
  'historical_unidentified_sessions_are_ineligible',true,'automatic_load_changes',false);
END;
$$;
REVOKE ALL ON FUNCTION public.health_cch_assess_equipment_history(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.health_cch_assess_equipment_history(uuid) TO authenticated;
