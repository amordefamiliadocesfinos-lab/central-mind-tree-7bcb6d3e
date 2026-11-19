-- Real M0/M1/M2/M3/M4/F19/F20/F21/F22 schema + E5 candidate only.
-- This script is NEVER executed against Supabase or any real athlete.
-- Synthetic athlete rows already inserted BEFORE F22 owner-confirmed DML.
INSERT INTO public.health_athlete_access(athlete_id,principal_auth_user_id,
 access_role,can_read,can_write,can_manage_access,granted_by_auth_user_id)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '33333333-3333-4333-8333-333333333333','coach',true,true,true,
 '11111111-1111-4111-8111-111111111111');
INSERT INTO public.health_workout_sessions(id,athlete_id,source,status,
 started_at,ended_at,start_client_event_id,created_by_auth_user_id)
 VALUES('ffffffff-1000-4000-8000-ffffffffffff',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','manual','completed',now()-interval '1 day',
 now(), 'cccccccc-0000-4000-8000-000000000001',
 '11111111-1111-4111-8111-111111111111'),
 ('ffffffff-1000-4000-8000-fffffffffffb',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','manual','completed',now()-interval '1 day',
 now(),'cccccccc-0000-4000-8000-000000000002',
 '22222222-2222-4222-8222-222222222222');
INSERT INTO public.health_cch_e5_policy_registry
 (policy_version,status,approved_at,effective_at,approved_by_auth_user_id,
 approval_reference,policy_document,policy_digest)
 VALUES('e5-integral-fixture','active',now()-interval '1 minute',now()-interval '1 minute',
 '11111111-1111-4111-8111-111111111111','SYNTHETIC-ONLY',
 'isolated E5 policy only',encode(sha256(convert_to('isolated E5 policy only','UTF8')),'hex'));
CREATE FUNCTION public.e5e_expect_denied(p_sql text) RETURNS void
 LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
 BEGIN EXECUTE p_sql;
 EXCEPTION WHEN insufficient_privilege OR check_violation OR unique_violation
 THEN RETURN;
 END;
 RAISE EXCEPTION 'unexpected authorization for %',p_sql;
END $$;
GRANT EXECUTE ON FUNCTION public.e5e_expect_denied(text) TO authenticated;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
DO $$ BEGIN
 IF NOT public.health_can_read_athlete('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
 OR NOT public.health_can_write_athlete('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
 OR public.health_can_read_athlete('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
 THEN RAISE EXCEPTION 'original M0 delegated access failed'; END IF;
END $$;
SELECT public.e5e_expect_denied($q$
 INSERT INTO public.health_consents(athlete_id,consent_type,decision,policy_version,details)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e5_personalized_review',
 'granted','e5-integral-fixture',
 '{"contract":"cch-e5-consent-v1","explicit_action":true}')$q$);
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
INSERT INTO public.health_consents(athlete_id,consent_type,decision,policy_version,details)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e5_personalized_review',
 'granted','e5-integral-fixture',
 '{"contract":"cch-e5-consent-v1","explicit_action":true}');
INSERT INTO public.health_workout_events
 (athlete_id,session_id,event_type,source,client_event_id,payload,created_by_auth_user_id)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'ffffffff-1000-4000-8000-ffffffffffff','note','user',
 'dddddddd-0000-4000-8000-000000000001',
 '{"contract":"cch-e5-session-review-v1","explicit_confirmation":true,"recovery":"good","symptoms":"none"}',
 '11111111-1111-4111-8111-111111111111');
INSERT INTO public.health_workout_events
 (athlete_id,session_id,event_type,source,client_event_id,payload,created_by_auth_user_id)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'ffffffff-1000-4000-8000-ffffffffffff','session_completed','user',
 'dddddddd-0000-4000-8000-000000000002','{}',
 '11111111-1111-4111-8111-111111111111');
DO $$ BEGIN
 IF (SELECT count(*) FROM public.health_cch_e5_current_session_review(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'ffffffff-1000-4000-8000-ffffffffffff'))<>1 THEN
 RAISE EXCEPTION 'official schema E5 reader failed'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.health_workout_events
 WHERE event_type='note' AND payload->>'contract'='cch-e5-session-review-v1')<>0
 OR (SELECT count(*) FROM public.health_workout_events
 WHERE event_type='session_completed')<>1 THEN
 RAISE EXCEPTION 'official M4 coach SELECT leak or regression'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.health_workout_events)<>0 THEN
 RAISE EXCEPTION 'official M4 cross-athlete leak'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
INSERT INTO public.health_consents(athlete_id,consent_type,decision,policy_version,details)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e5_personalized_review',
 'revoked','e5-integral-fixture',
 '{"contract":"cch-e5-consent-v1","explicit_action":true}');
DO $$ BEGIN
 IF (SELECT count(*) FROM public.health_workout_events
 WHERE event_type='note' AND payload->>'contract'='cch-e5-session-review-v1')<>0
 OR EXISTS(SELECT 1 FROM public.health_cch_e5_current_session_review(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'ffffffff-1000-4000-8000-ffffffffffff')) THEN
 RAISE EXCEPTION 'revoked consent still exposed E5'; END IF;
END $$;
SELECT public.e5e_expect_denied($q$
 INSERT INTO public.health_workout_events
 (athlete_id,session_id,event_type,source,client_event_id,payload,created_by_auth_user_id)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'ffffffff-1000-4000-8000-ffffffffffff','note','user',
 'dddddddd-0000-4000-8000-000000000003',
 '{"contract":"cch-e5-session-review-v1","explicit_confirmation":true,"recovery":"poor","symptoms":"pain"}',
 '11111111-1111-4111-8111-111111111111')$q$);
RESET ROLE;
-- F21 actual RPC on the migrated schema: voiding a completed workout
-- after revocation preserves common voiding events and hides old E5 notes.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
SELECT public.health_f21_void_workout_session(
 'ffffffff-1000-4000-8000-ffffffffffff',
 'dddddddd-0000-4000-8000-000000000099','Synthetic history correction');
DO $$ BEGIN
 IF (SELECT record_status FROM public.health_workout_sessions
 WHERE id='ffffffff-1000-4000-8000-ffffffffffff')<>'voided'
 OR (SELECT count(*) FROM public.health_workout_events
 WHERE event_type='session_voided')<>1
 OR (SELECT count(*) FROM public.health_workout_events
 WHERE payload->>'contract'='cch-e5-session-review-v1')<>0 THEN
 RAISE EXCEPTION 'official F21 voiding or E5 concealment failed'; END IF;
END $$;
RESET ROLE;

-- Manual F22 publish through its *actual* migrated SECURITY INVOKER RPC.
-- No production version or client identity participates.
INSERT INTO public.health_program_versions(
 id,program_id,athlete_id,version_number,status,title,created_by_auth_user_id)
 VALUES('eeeeeeee-2000-4000-8000-000000000002',
 'eeeeeeee-1000-4000-8000-000000000001',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',2,'draft',
 'Synthetic F22 manual publish', '22222222-2222-4222-8222-222222222222');
INSERT INTO public.health_session_templates(id,program_version_id,athlete_id,
 code,name,sequence_order,status)
 VALUES('eeeeeeee-3000-4000-8000-000000000002',
 'eeeeeeee-2000-4000-8000-000000000002',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','A2','Synthetic publication',1,'active');
INSERT INTO public.health_session_template_exercises(
 session_template_id,athlete_id,exercise_id,sequence_order,
 planned_sets_min,planned_sets_max,reps_min,reps_max,rir_target,rest_seconds)
 VALUES('eeeeeeee-3000-4000-8000-000000000002',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'eeeeeeee-0000-4000-8000-000000000001',1,3,3,8,12,2,180);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
DO $$
DECLARE published_count integer;
BEGIN
 SELECT queued_count INTO published_count FROM public.health_m3_publish_program_version(
 'eeeeeeee-2000-4000-8000-000000000002');
 IF published_count<>1 OR
 (SELECT status FROM public.health_program_versions
 WHERE id='eeeeeeee-2000-4000-8000-000000000002')<>'published' OR
 (SELECT current_version_id FROM public.health_programs
 WHERE id='eeeeeeee-1000-4000-8000-000000000001')
 IS DISTINCT FROM 'eeeeeeee-2000-4000-8000-000000000002'::uuid
 THEN RAISE EXCEPTION 'official F22 manual publish regression'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.health_cch_queue_entries
 WHERE program_version_id='eeeeeeee-2000-4000-8000-000000000002') THEN
 RAISE EXCEPTION 'cross-athlete official F22 queue leakage'; END IF;
END $$;
RESET ROLE;

-- F19 definer RPC must still reject cross-athlete timer actions even when
-- executed under its definer role (SQLERRM must indicate authorization).
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
DO $$
DECLARE v_denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.health_f19_pause_workout(
   'ffffffff-1000-4000-8000-ffffffffffff',
   'dddddddd-0000-4000-8000-000000000077');
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%not authorized%' OR SQLERRM LIKE '%not found%' THEN
   v_denied:=true;
  ELSE RAISE; END IF;
 END;
 IF NOT v_denied THEN
  RAISE EXCEPTION 'F19 definer RPC allowed a cross-athlete session operation';
 END IF;
END $$;
RESET ROLE;
-- Alternative SQL access audit: no published view directly exposing M4 events,
-- and no authenticated SECURITY DEFINER routine whose body reads their content.
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_views
  WHERE schemaname='public' AND definition ILIKE '%health_workout_events%') THEN
  RAISE EXCEPTION 'view referencing workout events requires human security review';
 END IF;
 -- F19 official RPCs use SECURITY DEFINER for timer operations and refer
 -- to M4 events for idempotency; their output is timer/set UUIDs, not E5 notes.
 -- An *additional/unreviewed* definer touching events is a regression gate.
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosecdef
   AND pg_get_functiondef(p.oid) ILIKE '%health_workout_events%'
   AND has_function_privilege('authenticated',p.oid,'EXECUTE')
   AND p.proname NOT IN (
    'health_f19_pause_workout','health_f19_resume_workout',
    'health_f19_start_work_interval','health_f19_finish_work_start_rest',
    'health_f19_finish_rest','health_f19_cancel_interval',
    'health_f19_close_open_timers_with_session')) THEN
  RAISE EXCEPTION 'unreviewed SECURITY DEFINER M4-access RPC exposed';
 END IF;
END $$;
-- Enumerate alternative SQL objects that could affect evidence exposure;
-- existence alone does not establish an exploit, and auth HTTP is not emulated.
SELECT routine_name,security_type FROM information_schema.routines
 WHERE specific_schema='public' AND routine_name LIKE 'health_%'
 ORDER BY routine_name;
SELECT schemaname,viewname FROM pg_views
 WHERE schemaname='public' AND definition ILIKE '%health_workout_events%';
-- Explicit migration-chain gate on the final schema, roles and active triggers.
DO $
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname='health_workout_events' AND c.relrowsecurity)
 OR NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname='health_consents' AND c.relrowsecurity)
 OR NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname='health_cch_e5_policy_registry' AND c.relrowsecurity)
 THEN RAISE EXCEPTION 'RLS disabled on official M1/M4/E5 schema'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public'
  AND tablename='health_workout_events' AND cmd='SELECT')<>1
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='public'
  AND tablename='health_workout_events' AND cmd='INSERT')<>1
 THEN RAISE EXCEPTION 'M4 event policies have unexpected OR-expanded count'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
  WHERE c.relname='health_workout_events'
  AND t.tgname='health_cch_e5_session_note_guard' AND t.tgenabled='O')
 OR NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
  WHERE c.relname='health_consents'
  AND t.tgname='health_cch_e5_consent_time_guard' AND t.tgenabled='O')
 THEN RAISE EXCEPTION 'E5 persistent integrity trigger missing or disabled'; END IF;
 IF has_table_privilege('authenticated','public.health_workout_events','UPDATE')
 OR has_table_privilege('authenticated','public.health_workout_events','DELETE')
 OR has_table_privilege('authenticated','public.health_consents','UPDATE')
 OR has_table_privilege('authenticated','public.health_consents','DELETE')
 OR has_table_privilege('authenticated','public.health_cch_e5_policy_registry','INSERT')
 OR has_table_privilege('authenticated','public.health_cch_e5_policy_registry','UPDATE')
 OR has_table_privilege('authenticated','public.health_cch_e5_policy_registry','DELETE')
 THEN RAISE EXCEPTION 'E5/M4/M1 append-only or registry grants regressed'; END IF;
END $;
SELECT 'CCH_E5E_OFFICIAL_CHAIN_PASS' AS result;
