-- CCH F24 G1/G2: exercise exact existing F19 SQL in an ephemeral PostgreSQL service.
-- Facts: original published planned max=3 remains; work 4 and 5 require explicit finish_rest calls.
DO $test$
DECLARE
 v_work4 uuid;
 v_work5 uuid;
 v_none uuid;
 v_number integer;
 v_count integer;
BEGIN
 SELECT next_work_interval_id INTO v_work4
 FROM public.health_f19_finish_rest(
 '20000000-0000-0000-0000-000000000003',
 '40000000-0000-0000-0000-000000000003',
 true,'dddddddd-dddd-dddd-dddd-dddddddddddd');
 SELECT set_number INTO v_number FROM public.health_workout_timer_intervals WHERE id=v_work4;
 IF v_number<>4 THEN RAISE EXCEPTION 'after 3/3 expected work 4, got %',v_number;END IF;

 -- Repeating identical event must be idempotent.
 IF (SELECT next_work_interval_id FROM public.health_f19_finish_rest(
 '20000000-0000-0000-0000-000000000003',
 '40000000-0000-0000-0000-000000000003',true,
 'dddddddd-dddd-dddd-dddd-dddddddddddd')) IS DISTINCT FROM v_work4
 THEN RAISE EXCEPTION 'finish rest event replay was not idempotent';END IF;

 -- Simulate a completed fourth work set to focus on the real next-rest RPC.
 UPDATE public.health_workout_timer_intervals SET status='completed',ended_at=clock_timestamp()
 WHERE id=v_work4;
 INSERT INTO public.health_workout_sets(id,athlete_id,session_id,workout_exercise_id,set_number,status)
 VALUES ('10000000-0000-0000-0000-000000000004',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','cccccccc-cccc-cccc-cccc-cccccccccccc',
 'dddddddd-dddd-dddd-dddd-dddddddddddd',4,'completed');
 INSERT INTO public.health_workout_timer_intervals
 (id,athlete_id,session_id,workout_exercise_id,workout_set_id,interval_type,
 set_number,status,client_event_id,started_at,target_seconds)
 VALUES ('20000000-0000-0000-0000-000000000004',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'cccccccc-cccc-cccc-cccc-cccccccccccc',
 'dddddddd-dddd-dddd-dddd-dddddddddddd',
 '10000000-0000-0000-0000-000000000004',
 'rest',4,'running','30000000-0000-0000-0000-000000000004',
 clock_timestamp()-interval '100 seconds',90);

 SELECT next_work_interval_id INTO v_work5
 FROM public.health_f19_finish_rest(
 '20000000-0000-0000-0000-000000000004',
 '40000000-0000-0000-0000-000000000004',true,
 'dddddddd-dddd-dddd-dddd-dddddddddddd');
 SELECT set_number INTO v_number FROM public.health_workout_timer_intervals WHERE id=v_work5;
 IF v_number<>5 THEN RAISE EXCEPTION 'after 4/3 expected work 5, got %',v_number;END IF;
 UPDATE public.health_workout_timer_intervals SET status='completed',ended_at=clock_timestamp()
 WHERE id=v_work5;
 INSERT INTO public.health_workout_sets(id,athlete_id,session_id,workout_exercise_id,set_number,status)
 VALUES ('10000000-0000-0000-0000-000000000005',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','cccccccc-cccc-cccc-cccc-cccccccccccc',
 'dddddddd-dddd-dddd-dddd-dddddddddddd',5,'completed');
 INSERT INTO public.health_workout_timer_intervals
 (id,athlete_id,session_id,workout_exercise_id,workout_set_id,interval_type,
 set_number,status,client_event_id,started_at,target_seconds)
 VALUES ('20000000-0000-0000-0000-000000000005',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'cccccccc-cccc-cccc-cccc-cccccccccccc',
 'dddddddd-dddd-dddd-dddd-dddddddddddd',
 '10000000-0000-0000-0000-000000000005',
 'rest',5,'running','30000000-0000-0000-0000-000000000005',
 clock_timestamp()-interval '100 seconds',90);

 -- Declining to start more work must not auto-create a 6th series.
 SELECT next_work_interval_id INTO v_none
 FROM public.health_f19_finish_rest(
 '20000000-0000-0000-0000-000000000005',
 '40000000-0000-0000-0000-000000000005',false,null);
 IF v_none IS NOT NULL THEN RAISE EXCEPTION 'auto-advanced without athlete selection';END IF;
 SELECT count(*) INTO v_count FROM public.health_workout_timer_intervals
 WHERE workout_exercise_id='dddddddd-dddd-dddd-dddd-dddddddddddd'
 AND interval_type='work' AND set_number>5;
 IF v_count<>0 THEN RAISE EXCEPTION 'unexpected next set after rest 5';END IF;
 IF (SELECT planned_sets_max FROM public.health_workout_exercises
 WHERE id='dddddddd-dddd-dddd-dddd-dddddddddddd')<>3
 THEN RAISE EXCEPTION 'published plan mutated';END IF;
END;
$test$;
