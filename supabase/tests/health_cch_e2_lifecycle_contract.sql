-- E2 isolated full lifecycle, real E2B/E2C and original F22/M3 publication RPC.
\set ON_ERROR_STOP on
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $$
DECLARE v_a uuid:='aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa';
 v_version uuid:='aaaaaaaa-2000-4000-8000-aaaaaaaaaaab';
 v_before jsonb;v_after jsonb;v_out jsonb;
BEGIN
 SELECT jsonb_build_object('planned_sets_min',planned_sets_min,
   'planned_sets_max',planned_sets_max,'reps_min',reps_min,'reps_max',reps_max,
   'rir_target',rir_target,'rest_seconds',rest_seconds)
 INTO v_before FROM public.health_session_template_exercises WHERE id=v_a;
 v_after:=jsonb_set(v_before,'{reps_max}','11'::jsonb);
 v_out:=public.health_cch_e2_update_draft_prescription(v_a,v_version,v_before,v_after,
   'Ajuste manual em cenário autenticado isolado');
 IF v_out->'before'<>v_before OR v_out->'after'<>v_after THEN RAISE EXCEPTION 'diff mismatch'; END IF;
 PERFORM public.health_cch_e2_edit_draft_exercise(v_a,'swap',
   'aaaaaaaa-4000-4000-8000-aaaaaaaaaaab',NULL,'Ordem revisada exclusivamente no draft');
 PERFORM public.health_cch_e2_edit_draft_exercise(v_a,'replace',NULL,
   'cccccccc-2000-4000-8000-cccccccccccc','Equivalência provisória confirmada pelo teste');
 PERFORM public.health_f22_assert_program_version_structure(v_version);
 IF (SELECT reps_max FROM public.health_session_template_exercises WHERE id=v_a)<>11
    OR (SELECT exercise_id FROM public.health_session_template_exercises WHERE id=v_a)
      <> 'cccccccc-2000-4000-8000-cccccccccccc'::uuid
    OR (SELECT sequence_order FROM public.health_session_template_exercises WHERE id=v_a)<>2
    OR NOT EXISTS (SELECT 1 FROM public.health_session_template_exercises WHERE id=v_a
       AND prescription_notes LIKE '%antes=%'
       AND prescription_notes LIKE '%Ordem revisada%'
       AND prescription_notes LIKE '%Equivalência provisória%')
 THEN RAISE EXCEPTION 'edit, order, replacement or audit broken'; END IF;
 IF (SELECT status FROM public.health_program_versions
     WHERE id='aaaaaaaa-2000-4000-8000-aaaaaaaaaaaa')<>'published' THEN
   RAISE EXCEPTION 'previous published version changed'; END IF;
END $$;

-- Try to publish B draft with A's authenticated session: must reject.
DO $$DECLARE v_fail boolean:=false;
BEGIN
 BEGIN
  PERFORM public.health_m3_publish_program_version('bbbbbbbb-2000-4000-8000-bbbbbbbbbbbc');
 EXCEPTION WHEN OTHERS THEN v_fail:=true; END;
 IF NOT v_fail THEN RAISE EXCEPTION 'cross-athlete publication incorrectly allowed'; END IF;
END $$;

-- The production RPC publishes only in this disposable database.
SELECT * FROM public.health_m3_publish_program_version('aaaaaaaa-2000-4000-8000-aaaaaaaaaaab');
DO $$
DECLARE v_fail boolean:=false;
BEGIN
 IF (SELECT status FROM public.health_program_versions
   WHERE id='aaaaaaaa-2000-4000-8000-aaaaaaaaaaab') <> 'published' THEN
   RAISE EXCEPTION 'draft not published'; END IF;
 IF (SELECT current_version_id FROM public.health_programs
   WHERE id='aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa')
     <> 'aaaaaaaa-2000-4000-8000-aaaaaaaaaaab'::uuid THEN
   RAISE EXCEPTION 'current version pointer wrong'; END IF;
 IF (SELECT count(*) FROM public.health_cch_queue_entries
   WHERE program_version_id='aaaaaaaa-2000-4000-8000-aaaaaaaaaaab')<>2 THEN
   RAISE EXCEPTION 'wrong number of new queue entries'; END IF;
 IF (SELECT count(*) FROM public.health_cch_queue_entries
   WHERE program_version_id='aaaaaaaa-2000-4000-8000-aaaaaaaaaaaa')<>1 THEN
   RAISE EXCEPTION 'previous queue altered'; END IF;
 IF (SELECT status FROM public.health_program_versions
   WHERE id='aaaaaaaa-2000-4000-8000-aaaaaaaaaaaa') <> 'published' THEN
   RAISE EXCEPTION 'previous version mutated'; END IF;
 IF (SELECT count(*) FROM public.health_workout_sessions)<>1 THEN
   RAISE EXCEPTION 'workout history changed'; END IF;
 BEGIN
  PERFORM public.health_m3_publish_program_version('aaaaaaaa-2000-4000-8000-aaaaaaaaaaab');
 EXCEPTION WHEN OTHERS THEN v_fail:=true; END;
 IF NOT v_fail THEN RAISE EXCEPTION 'duplicate publication accepted'; END IF;
 IF (SELECT count(*) FROM public.health_cch_queue_entries
   WHERE program_version_id='aaaaaaaa-2000-4000-8000-aaaaaaaaaaab')<>2 THEN
   RAISE EXCEPTION 'idempotency failure changed queue'; END IF;
END $$;
RESET ROLE;
