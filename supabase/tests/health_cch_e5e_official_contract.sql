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
-- Enumerate alternative SQL objects that could affect evidence exposure;
-- existence alone does not establish an exploit, and auth HTTP is not emulated.
SELECT routine_name,security_type FROM information_schema.routines
 WHERE specific_schema='public' AND routine_name LIKE 'health_%'
 ORDER BY routine_name;
SELECT schemaname,viewname FROM pg_views
 WHERE schemaname='public' AND definition ILIKE '%health_workout_events%';
SELECT 'CCH_E5E_OFFICIAL_CHAIN_PASS' AS result;
