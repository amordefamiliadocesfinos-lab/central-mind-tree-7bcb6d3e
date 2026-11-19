-- Source F22 function is extracted from official migration during CI.
\set ON_ERROR_STOP on
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
-- Fixture has one active session for A's draft with two fully specified exercises.
DO $$
BEGIN
 PERFORM public.health_f22_assert_program_version_structure(
  'aaaaaaaa-2000-4000-8000-aaaaaaaaaaab');
END $$;
-- F22 must block absence of an active session and incomplete required prescriptions.
DO $$
DECLARE rejected boolean:=false;
BEGIN
 BEGIN
  UPDATE public.health_session_templates SET status='disabled'
   WHERE id='aaaaaaaa-3000-4000-8000-aaaaaaaaaaaa';
  UPDATE public.health_session_templates SET status='disabled'
   WHERE id='aaaaaaaa-3000-4000-8000-aaaaaaaaaaac';
  PERFORM public.health_f22_assert_program_version_structure(
   'aaaaaaaa-2000-4000-8000-aaaaaaaaaaab');
 EXCEPTION WHEN OTHERS THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'F22 allowed draft with no active sessions'; END IF;
END $$;
DO $$
DECLARE rejected boolean:=false;
BEGIN
 BEGIN
  UPDATE public.health_session_template_exercises
   SET planned_sets_min=NULL
   WHERE id='aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa';
  PERFORM public.health_f22_assert_program_version_structure(
   'aaaaaaaa-2000-4000-8000-aaaaaaaaaaab');
 EXCEPTION WHEN OTHERS THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'F22 allowed incomplete required exercise'; END IF;
END $$;
DO $$
DECLARE rejected boolean:=false;
BEGIN
 BEGIN
  UPDATE public.health_session_template_exercises
   SET rir_target=8
   WHERE id='aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa';
  PERFORM public.health_f22_assert_program_version_structure(
   'aaaaaaaa-2000-4000-8000-aaaaaaaaaaab');
 EXCEPTION WHEN OTHERS THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'F22 allowed invalid RIR'; END IF;
END $$;
-- Cross-athlete: owner A cannot gain visibility to B's draft (F22 assertion
-- by itself is not an authorization function, so test permissions on version).
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.health_program_versions
   WHERE id='bbbbbbbb-2000-4000-8000-bbbbbbbbbbbc') THEN
    RAISE EXCEPTION 'cross-athlete version readable'; END IF;
END $$;
RESET ROLE;
