-- Executes real E2B migration in a synthetic DB, with RLS enabled.
\set ON_ERROR_STOP on
DO $$ BEGIN
 IF has_function_privilege('anon','public.health_cch_e2_edit_draft_exercise(uuid,text,uuid,uuid,text)','EXECUTE')
 THEN RAISE EXCEPTION 'anon has execute'; END IF;
 IF NOT has_function_privilege('authenticated','public.health_cch_e2_edit_draft_exercise(uuid,text,uuid,uuid,text)','EXECUTE')
 THEN RAISE EXCEPTION 'authenticated cannot execute'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE proname='health_cch_e2_edit_draft_exercise' AND prosecdef)
 THEN RAISE EXCEPTION 'function must be security invoker'; END IF;
END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $$
DECLARE x jsonb; y integer; z integer;
BEGIN
 SELECT sequence_order INTO y FROM public.health_session_template_exercises WHERE id='aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa';
 SELECT sequence_order INTO z FROM public.health_session_template_exercises WHERE id='aaaaaaaa-4000-4000-8000-aaaaaaaaaaab';
 IF y<>1 OR z<>2 THEN RAISE EXCEPTION 'fixture order invalid'; END IF;
 x:=public.health_cch_e2_edit_draft_exercise(
   'aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa','swap',
   'aaaaaaaa-4000-4000-8000-aaaaaaaaaaab',NULL,'Ajuste explícito para testar troca');
 IF x->>'operation'<>'swap' OR x->>'published'<>'false' THEN RAISE EXCEPTION 'swap response invalid'; END IF;
 SELECT sequence_order INTO y FROM public.health_session_template_exercises WHERE id='aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa';
 SELECT sequence_order INTO z FROM public.health_session_template_exercises WHERE id='aaaaaaaa-4000-4000-8000-aaaaaaaaaaab';
 IF y<>2 OR z<>1 THEN RAISE EXCEPTION 'swap not atomic'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.health_session_template_exercises
   WHERE id='aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa'
   AND prescription_notes LIKE '%Ajuste explícito%') THEN
    RAISE EXCEPTION 'swap rationale missing'; END IF;
END $$;
DO $$
DECLARE x jsonb;
BEGIN
 x:=public.health_cch_e2_edit_draft_exercise(
  'aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa','replace',NULL,
  'cccccccc-2000-4000-8000-cccccccccccc','Troca consciente com equivalência provisória');
 IF x->>'equivalence_confidence'<>'provisional' THEN RAISE EXCEPTION 'provisional caveat lost'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.health_session_template_exercises
  WHERE id='aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa'
   AND exercise_id='cccccccc-2000-4000-8000-cccccccccccc'
   AND prescription_notes LIKE '%provisional%') THEN RAISE EXCEPTION 'replacement not audited'; END IF;
END $$;
-- Each negative must throw; catching does not make fixture tests pass on unexpected success.
CREATE FUNCTION pg_temp.expect_e2_failure(p_id uuid,p_op text,p_other uuid,p_replacement uuid,p_reason text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE rejected boolean:=false;
BEGIN
 BEGIN PERFORM public.health_cch_e2_edit_draft_exercise(p_id,p_op,p_other,p_replacement,p_reason);
 EXCEPTION WHEN OTHERS THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'unexpectedly accepted: %, %',p_id,p_op; END IF;
END $$;
SELECT pg_temp.expect_e2_failure('bbbbbbbb-4000-4000-8000-bbbbbbbbbbbb','replace',NULL,
 'cccccccc-2000-4000-8000-cccccccccccc','Cross athlete must be rejected');
SELECT pg_temp.expect_e2_failure('aaaaaaaa-4000-4000-8000-aaaaaaaaaaac','replace',NULL,
 'cccccccc-2000-4000-8000-cccccccccccc','Published version must be immutable');
SELECT pg_temp.expect_e2_failure('aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa','swap',
 'aaaaaaaa-4000-4000-8000-aaaaaaaaaaad',NULL,'Cannot swap different templates');
SELECT pg_temp.expect_e2_failure('aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa','replace',NULL,
 'cccccccc-3000-4000-8000-cccccccccccc','Different primary muscle');
SELECT pg_temp.expect_e2_failure('aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa','replace',NULL,
 'cccccccc-5000-4000-8000-cccccccccccc','Inactive catalog exercise');
SELECT pg_temp.expect_e2_failure('aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa','replace',NULL,
 'cccccccc-4000-4000-8000-cccccccccccc','No equivalence');
SELECT pg_temp.expect_e2_failure('aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa','replace',NULL,
 'cccccccc-1000-4000-8000-cccccccccccc','No reverse equivalence');
SELECT pg_temp.expect_e2_failure('aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa','swap',
 'aaaaaaaa-4000-4000-8000-aaaaaaaaaaab',NULL,'short');
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.health_session_template_exercises
  WHERE id='aaaaaaaa-4000-4000-8000-aaaaaaaaaaac'
  AND (exercise_id<>'cccccccc-1000-4000-8000-cccccccccccc' OR sequence_order<>1)) THEN
  RAISE EXCEPTION 'published prescription changed'; END IF;
 IF (SELECT count(*) FROM public.health_workout_sessions)<>1 OR
    (SELECT count(*) FROM public.health_cch_queue_entries)<>1 THEN
  RAISE EXCEPTION 'historical session/queue unexpectedly changed'; END IF;
END $$;
RESET ROLE;
