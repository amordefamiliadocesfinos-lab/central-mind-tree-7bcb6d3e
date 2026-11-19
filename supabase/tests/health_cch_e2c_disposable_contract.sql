-- Validate the exact E2C production RPC under the synthetic authenticated/RLS fixture.
\set ON_ERROR_STOP on
DO $$
BEGIN
 IF has_function_privilege('anon','public.health_cch_e2_update_draft_prescription(uuid,uuid,jsonb,jsonb,text)','EXECUTE') THEN
  RAISE EXCEPTION 'E2C anon unexpectedly allowed'; END IF;
 IF NOT has_function_privilege('authenticated','public.health_cch_e2_update_draft_prescription(uuid,uuid,jsonb,jsonb,text)','EXECUTE') THEN
  RAISE EXCEPTION 'E2C authenticated missing execute'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE proname='health_cch_e2_update_draft_prescription' AND prosecdef) THEN
  RAISE EXCEPTION 'E2C must be security invoker'; END IF;
END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
CREATE FUNCTION pg_temp.e2_snapshot(p_id uuid) RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('planned_sets_min',planned_sets_min,'planned_sets_max',planned_sets_max,
  'reps_min',reps_min,'reps_max',reps_max,'rir_target',rir_target,'rest_seconds',rest_seconds)
 FROM public.health_session_template_exercises WHERE id=p_id
$$;
DO $$
DECLARE v_old jsonb;v_new jsonb;v_out jsonb;
BEGIN
 v_old:=pg_temp.e2_snapshot('aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa');
 v_new:=jsonb_set(v_old,'{reps_max}','11'::jsonb);
 v_out:=public.health_cch_e2_update_draft_prescription(
  'aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa','aaaaaaaa-2000-4000-8000-aaaaaaaaaaab',
  v_old,v_new,'Progressão revisada manualmente');
 IF v_out->>'published'<>'false' OR v_out->'before'<>v_old OR v_out->'after'<>v_new THEN
  RAISE EXCEPTION 'E2C diff response invalid'; END IF;
 IF (SELECT reps_max FROM public.health_session_template_exercises
    WHERE id='aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa')<>11 THEN
  RAISE EXCEPTION 'E2C did not update expected draft'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.health_session_template_exercises
    WHERE id='aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa'
     AND prescription_notes LIKE '%antes=%'
     AND prescription_notes LIKE '%Progressão revisada%') THEN
  RAISE EXCEPTION 'E2C audit reason/diff not persisted'; END IF;
END $$;
CREATE FUNCTION pg_temp.expect_e2c_failure(p_id uuid,p_version uuid,p_before jsonb,p_after jsonb,p_reason text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE rejected boolean:=false;
BEGIN
 BEGIN
  PERFORM public.health_cch_e2_update_draft_prescription(p_id,p_version,p_before,p_after,p_reason);
 EXCEPTION WHEN OTHERS THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'E2C unexpectedly accepted invalid edit'; END IF;
END $$;
-- Source no longer matches, must never silently overwrite new review.
SELECT pg_temp.expect_e2c_failure('aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa',
 'aaaaaaaa-2000-4000-8000-aaaaaaaaaaab',
 jsonb_build_object('planned_sets_min',3,'planned_sets_max',4,'reps_min',6,'reps_max',10,'rir_target',2,'rest_seconds',120),
 jsonb_build_object('planned_sets_min',3,'planned_sets_max',4,'reps_min',6,'reps_max',12,'rir_target',2,'rest_seconds',120),
 'Attempt with stale snapshot');
-- Other athlete, published version, wrong draft ID.
SELECT pg_temp.expect_e2c_failure('bbbbbbbb-4000-4000-8000-bbbbbbbbbbbb',
 'bbbbbbbb-2000-4000-8000-bbbbbbbbbbbc',
 jsonb_build_object('planned_sets_min',3,'planned_sets_max',4,'reps_min',6,'reps_max',10,'rir_target',2,'rest_seconds',120),
 jsonb_build_object('planned_sets_min',3,'planned_sets_max',4,'reps_min',6,'reps_max',11,'rir_target',2,'rest_seconds',120),
 'Attempt another athlete prescription');
SELECT pg_temp.expect_e2c_failure('aaaaaaaa-4000-4000-8000-aaaaaaaaaaac',
 'aaaaaaaa-2000-4000-8000-aaaaaaaaaaaa',
 pg_temp.e2_snapshot('aaaaaaaa-4000-4000-8000-aaaaaaaaaaac'),
 jsonb_set(pg_temp.e2_snapshot('aaaaaaaa-4000-4000-8000-aaaaaaaaaaac'),'{reps_max}','11'::jsonb),
 'Published prescription cannot change');
SELECT pg_temp.expect_e2c_failure('aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa',
 'aaaaaaaa-2000-4000-8000-aaaaaaaaaaaa',
 pg_temp.e2_snapshot('aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa'),
 jsonb_set(pg_temp.e2_snapshot('aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa'),'{reps_max}','12'::jsonb),
 'Wrong version must be rejected');
-- Values outside M3, extra fields, inadequate rationale and unchanged diff.
SELECT pg_temp.expect_e2c_failure('aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa',
 'aaaaaaaa-2000-4000-8000-aaaaaaaaaaab',
 pg_temp.e2_snapshot('aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa'),
 jsonb_set(pg_temp.e2_snapshot('aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa'),'{reps_max}','101'::jsonb),
 'Excessive range must fail');
SELECT pg_temp.expect_e2c_failure('aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa',
 'aaaaaaaa-2000-4000-8000-aaaaaaaaaaab',
 pg_temp.e2_snapshot('aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa'),
 pg_temp.e2_snapshot('aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa')||'{"exercise_id":"fake"}'::jsonb,
 'Additional arbitrary field rejected');
SELECT pg_temp.expect_e2c_failure('aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa',
 'aaaaaaaa-2000-4000-8000-aaaaaaaaaaab',
 pg_temp.e2_snapshot('aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa'),
 pg_temp.e2_snapshot('aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa'),
 'No changes to save here');
SELECT pg_temp.expect_e2c_failure('aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa',
 'aaaaaaaa-2000-4000-8000-aaaaaaaaaaab',
 pg_temp.e2_snapshot('aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa'),
 jsonb_set(pg_temp.e2_snapshot('aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa'),'{reps_max}','12'::jsonb),
 'short');
DO $$
BEGIN
 IF (SELECT reps_max FROM public.health_session_template_exercises
    WHERE id='aaaaaaaa-4000-4000-8000-aaaaaaaaaaac')<>10 THEN
  RAISE EXCEPTION 'E2C modified published version'; END IF;
 IF (SELECT count(*) FROM public.health_workout_sessions)<>1 OR
    (SELECT count(*) FROM public.health_cch_queue_entries)<>1 THEN
  RAISE EXCEPTION 'E2C modified history or queue'; END IF;
END $$;
RESET ROLE;
