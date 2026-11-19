-- CCH V7; verified equipment increments, historical volume and multi-cycle planning.
CREATE TABLE IF NOT EXISTS public.health_cch_load_increments(
 athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
 exercise_id uuid NOT NULL REFERENCES public.health_exercises(id) ON DELETE RESTRICT,
 equipment_label text NOT NULL CHECK(length(btrim(equipment_label)) BETWEEN 2 AND 100),
 load_unit text NOT NULL CHECK(load_unit IN ('kg','lb')),
 increment_value numeric(8,3) NOT NULL CHECK(increment_value>0 AND increment_value<=100),
 confirmed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(athlete_id,exercise_id)
);
ALTER TABLE public.health_cch_load_increments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cch_increments_read ON public.health_cch_load_increments;
CREATE POLICY cch_increments_read ON public.health_cch_load_increments
 FOR SELECT TO authenticated USING(public.health_can_read_athlete(athlete_id));
DROP POLICY IF EXISTS cch_increments_write ON public.health_cch_load_increments;
CREATE POLICY cch_increments_write ON public.health_cch_load_increments
 FOR INSERT TO authenticated WITH CHECK(public.health_can_write_athlete(athlete_id));
DROP POLICY IF EXISTS cch_increments_update ON public.health_cch_load_increments;
CREATE POLICY cch_increments_update ON public.health_cch_load_increments
 FOR UPDATE TO authenticated USING(public.health_can_write_athlete(athlete_id))
 WITH CHECK(public.health_can_write_athlete(athlete_id));
REVOKE ALL ON public.health_cch_load_increments FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE ON public.health_cch_load_increments TO authenticated;

CREATE OR REPLACE FUNCTION public.health_cch_save_load_increment(
 p_athlete_id uuid,p_exercise_id uuid,p_equipment_label text,p_load_unit text,p_increment numeric
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.health_can_write_athlete(p_athlete_id) THEN
  RAISE EXCEPTION 'unauthorized athlete';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.health_exercises WHERE id=p_exercise_id AND is_active) THEN
  RAISE EXCEPTION 'unknown exercise';
 END IF;
 IF p_equipment_label IS NULL OR length(btrim(p_equipment_label)) NOT BETWEEN 2 AND 100
 OR p_load_unit IS NULL OR p_load_unit NOT IN ('kg','lb')
 OR p_increment IS NULL OR p_increment<=0 OR p_increment>100 THEN
  RAISE EXCEPTION 'invalid confirmed increment';
 END IF;
 INSERT INTO public.health_cch_load_increments(athlete_id,exercise_id,equipment_label,load_unit,increment_value)
 VALUES(p_athlete_id,p_exercise_id,btrim(p_equipment_label),p_load_unit,p_increment)
 ON CONFLICT(athlete_id,exercise_id) DO UPDATE SET
 equipment_label=EXCLUDED.equipment_label,load_unit=EXCLUDED.load_unit,
 increment_value=EXCLUDED.increment_value,confirmed_at=now();
END;
$$;
REVOKE ALL ON FUNCTION public.health_cch_save_load_increment(uuid,uuid,text,text,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.health_cch_save_load_increment(uuid,uuid,text,text,numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.health_cch_assess_cycle_v7(p_program_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE
 v_p public.health_programs%ROWTYPE;
 v_base jsonb;
 v_loads jsonb;
 v_versions jsonb;
 v_volumes jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
 SELECT * INTO v_p FROM public.health_programs WHERE id=p_program_id;
 IF v_p.id IS NULL OR NOT public.health_can_read_athlete(v_p.athlete_id) THEN
  RAISE EXCEPTION 'program unavailable';
 END IF;
 v_base:=public.health_cch_assess_cycle_v5(p_program_id);
 WITH trend AS (
  SELECT value AS t,(value->>'exercise_id')::uuid AS exercise_id,value->>'load_unit' AS unit
  FROM jsonb_array_elements(coalesce(v_base->'load_trends','[]'::jsonb))
 ), units AS (
  SELECT we.exercise_id,count(DISTINCT ws.load_unit) AS count_units
  FROM public.health_workout_sessions s
  JOIN public.health_program_versions pv ON pv.id=s.program_version_id AND pv.program_id=v_p.id
  JOIN public.health_workout_exercises we ON we.session_id=s.id AND we.athlete_id=s.athlete_id
  JOIN public.health_workout_sets ws ON ws.workout_exercise_id=we.id AND ws.athlete_id=s.athlete_id
  WHERE s.athlete_id=v_p.athlete_id AND s.record_status='active' AND s.status='completed'
  AND ws.status='completed' AND ws.set_type='working'
  GROUP BY we.exercise_id
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'exercise_id',trend.exercise_id,'equipment_label',config.equipment_label,
  'unit',trend.unit,'increment',config.increment_value,
  'observed_load',(trend.t->>'recent_peak_load')::numeric,
  'candidate_load',CASE WHEN config.exercise_id IS NOT NULL
   AND config.load_unit=trend.unit AND units.count_units=1
   AND (trend.t->>'exposures')::integer>=3 AND
    trend.t->>'signal' IN ('reps_increased_observed','stable_observed')
   AND (trend.t->>'recent_rir')::numeric BETWEEN 2 AND 6
   THEN (trend.t->>'recent_peak_load')::numeric+config.increment_value ELSE NULL END,
  'reason','Candidato consultivo: confirmar a mesma maquina, tecnica e recuperacao; nunca aplicar kg automaticamente')
  ORDER BY trend.exercise_id,trend.unit),'[]'::jsonb) INTO v_loads
 FROM trend LEFT JOIN public.health_cch_load_increments config
 ON config.athlete_id=v_p.athlete_id AND config.exercise_id=trend.exercise_id
 LEFT JOIN units ON units.exercise_id=trend.exercise_id;

 WITH x AS (
 SELECT pv.id,pv.version_number,count(DISTINCT s.id) FILTER
 (WHERE s.status='completed' AND s.record_status='active') AS completed_sessions
 FROM public.health_program_versions pv
 LEFT JOIN public.health_workout_sessions s ON s.program_version_id=pv.id AND s.athlete_id=pv.athlete_id
 WHERE pv.program_id=v_p.id AND pv.athlete_id=v_p.athlete_id AND pv.status='published'
 GROUP BY pv.id,pv.version_number
 ) SELECT coalesce(jsonb_agg(jsonb_build_object(
 'version_id',id,'version_number',version_number,'sessions',completed_sessions)
 ORDER BY version_number),'[]'::jsonb) INTO v_versions FROM x;

 WITH x AS (
 SELECT pv.version_number,mg.id muscle_id,mg.name muscle_name,
  count(DISTINCT ws.id) AS work_sets,count(DISTINCT s.id) AS sessions,
  min(s.started_at) first_at,max(s.started_at) last_at
 FROM public.health_program_versions pv
 JOIN public.health_workout_sessions s ON s.program_version_id=pv.id AND s.athlete_id=pv.athlete_id
 JOIN public.health_workout_exercises we ON we.session_id=s.id AND we.athlete_id=s.athlete_id
 JOIN public.health_workout_sets ws ON ws.workout_exercise_id=we.id AND ws.athlete_id=s.athlete_id
 JOIN public.health_exercise_muscles em ON em.exercise_id=we.exercise_id AND em.role='primary'
 JOIN public.health_muscle_groups mg ON mg.id=em.muscle_group_id
 WHERE pv.program_id=v_p.id AND pv.athlete_id=v_p.athlete_id AND pv.status='published'
 AND s.status='completed' AND s.record_status='active' AND ws.status='completed' AND ws.set_type='working'
 GROUP BY pv.version_number,mg.id,mg.name
 ) SELECT coalesce(jsonb_agg(jsonb_build_object(
 'version_number',version_number,'muscle_id',muscle_id,'muscle_name',muscle_name,
 'work_sets',work_sets,'sessions',sessions,
 'observed_per_7_days',CASE WHEN sessions>=4 AND last_at-first_at>=interval '14 days'
 THEN round(work_sets*7.0/greatest(1,extract(epoch FROM(last_at-first_at))/86400),1) ELSE NULL END,
 'note','Volume observado nao equivale a tolerancia demonstrada') ORDER BY version_number,muscle_name),'[]'::jsonb)
 INTO v_volumes FROM x;
 RETURN v_base || jsonb_build_object('engine_version','cch-guided-v7',
 'equipment_load_candidates',v_loads,'multi_cycle_versions',v_versions,'multi_cycle_volume',v_volumes,
 'periodization_mode',CASE WHEN jsonb_array_length(v_versions)>=2 THEN 'multi_cycle_review' ELSE 'collect_more_cycles' END,
 'periodization_review_after_sessions',3,
 'limitations',coalesce(v_base->'limitations','[]'::jsonb) || jsonb_build_array(
 'Cadastro de incremento e por exercicio: se duas maquinas compartilham ID, revisar manualmente.',
 'Nenhuma carga candidata substitui prescricao; volume observado sozinho nao comprova tolerancia.'));
END;
$$;
REVOKE ALL ON FUNCTION public.health_cch_assess_cycle_v7(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.health_cch_assess_cycle_v7(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.health_cch_generate_guided_cycle_v7(
 p_program_id uuid,p_goal text,p_strategy text,p_availability text,
 p_priority_muscle_id uuid DEFAULT NULL,p_allow_targeted_set_proposal boolean DEFAULT false,
 p_recovery_report text DEFAULT 'unknown',p_symptom_report text DEFAULT 'unknown'
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_p public.health_programs%ROWTYPE;v_report jsonb;v_draft uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
 SELECT * INTO v_p FROM public.health_programs WHERE id=p_program_id FOR UPDATE;
 IF v_p.id IS NULL OR NOT public.health_can_write_athlete(v_p.athlete_id) THEN RAISE EXCEPTION 'unauthorized'; END IF;
 v_report:=public.health_cch_assess_cycle_v7(p_program_id);
 v_draft:=public.health_cch_generate_guided_cycle_v6(p_program_id,p_goal,p_strategy,p_availability,
 p_priority_muscle_id,p_allow_targeted_set_proposal,p_recovery_report,p_symptom_report);
 UPDATE public.health_program_versions SET
 parameter_set=coalesce(parameter_set,'{}'::jsonb) || jsonb_build_object('guided_cycle',
 coalesce(parameter_set->'guided_cycle','{}'::jsonb) ||
 jsonb_build_object('engine_version','cch-guided-v7','assessment_snapshot',v_report,
 'review_required',true,'publication_requires_review',true,'equipment_load_suggestions_only',true))
 WHERE id=v_draft AND athlete_id=v_p.athlete_id AND status='draft';
 IF NOT FOUND THEN RAISE EXCEPTION 'draft unavailable'; END IF;
 RETURN v_draft;
END;
$$;
REVOKE ALL ON FUNCTION public.health_cch_generate_guided_cycle_v7(uuid,text,text,text,uuid,boolean,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.health_cch_generate_guided_cycle_v7(uuid,text,text,text,uuid,boolean,text,text) TO authenticated;