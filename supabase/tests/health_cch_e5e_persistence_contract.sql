-- E5-E persistent SQL contract executed exclusively on disposable PostgreSQL.
CREATE OR REPLACE FUNCTION public.e5_expect_failure(p_sql text,p_codes text[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE code text;
BEGIN
 BEGIN
  EXECUTE p_sql;
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS code=RETURNED_SQLSTATE;
  IF code=ANY(p_codes) THEN RETURN; END IF;
  RAISE EXCEPTION 'unexpected SQLSTATE % on %',code,p_sql;
 END;
 RAISE EXCEPTION 'expected failure but succeeded: %',p_sql;
END $$;
GRANT EXECUTE ON FUNCTION public.e5_expect_failure(text,text[]) TO authenticated;
-- Preserve the five M1 types and reject a hypothetical sixth unknown one.
DO $$
DECLARE n int;
BEGIN
 SELECT count(*) INTO n FROM pg_constraint WHERE conname='health_consents_consent_type_check'
  AND pg_get_constraintdef(oid) LIKE '%e5_personalized_review%';
 IF n<>1 THEN RAISE EXCEPTION 'M1 extended CHECK missing'; END IF;
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
-- Manager of athlete A may still record an existing generic M1 consent.
INSERT INTO public.health_consents(athlete_id,consent_type,decision,policy_version,details)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','health_data_processing',
 'granted','health-m1-v1','{"explicit_action":true}');
SELECT public.e5_expect_failure($q$
 INSERT INTO public.health_consents(athlete_id,consent_type,decision,policy_version,details)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e5_personalized_review',
 'granted','e5-lab-v1','{"contract":"cch-e5-consent-v1","explicit_action":true}')
$q$,ARRAY['42501']::text[]);
SELECT public.e5_expect_failure($q$
 INSERT INTO public.health_workout_events(athlete_id,session_id,event_type,source,client_event_id,payload,created_by_auth_user_id)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ffffffff-1000-4000-8000-ffffffffffff',
 'note','user','dddddddd-6000-4000-8000-ddddddddddda',
 '{"contract":"cch-e5-session-review-v1","explicit_confirmation":true,"recovery":"good","symptoms":"none"}',
 '33333333-3333-4333-8333-333333333333')
$q$,ARRAY['42501']::text[]);
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $$
BEGIN
 IF public.health_cch_e5_has_explicit_consent('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') THEN
  RAISE EXCEPTION 'generic M1 consent leaked to E5';
 END IF;
END $$;
SELECT public.e5_expect_failure($q$
 INSERT INTO public.health_consents(athlete_id,consent_type,decision,policy_version,details)
 VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','e5_personalized_review',
 'granted','e5-lab-v1','{"contract":"cch-e5-consent-v1","explicit_action":true}')
$q$,ARRAY['42501']::text[]);
SELECT public.e5_expect_failure($q$
 INSERT INTO public.health_consents(athlete_id,consent_type,decision,policy_version,details)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e5_personalized_review',
 'granted','e5-lab-v1',NULL)
$q$,ARRAY['23514']::text[]);
SELECT public.e5_expect_failure($q$
 INSERT INTO public.health_consents(athlete_id,consent_type,decision,policy_version,details)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e5_personalized_review',
 'granted','e5-lab-v1','{"contract":"cch-e5-consent-v1","explicit_action":"true"}')
$q$,ARRAY['23514']::text[]);

SELECT public.e5_expect_failure($q$
 INSERT INTO public.health_consents(athlete_id,consent_type,decision,policy_version,details)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','unknown_future_type',
 'granted','e5-lab-v1',NULL)
$q$,ARRAY['23514']::text[]);
-- Consent history is append-only and sensitive to the latest explicit decision.
INSERT INTO public.health_consents(athlete_id,consent_type,decision,policy_version,occurred_at,details)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e5_personalized_review',
 'granted','e5-lab-v1','2035-11-19T10:00:00Z',
 '{"contract":"cch-e5-consent-v1","explicit_action":true}');
-- The caller's future timestamp was ignored; chronology is server-owned.
DO $$BEGIN
 IF (SELECT count(*) FROM public.health_consents WHERE consent_type='e5_personalized_review'
   AND occurred_at >= '2035-01-01'::timestamptz)>0 OR
  (SELECT count(*) FROM public.health_consents WHERE consent_type='e5_personalized_review'
   AND occurred_at=created_at)<>1 THEN
   RAISE EXCEPTION 'E5 client timestamp spoofing was not prevented'; END IF;
END $$;
DO $$BEGIN
 IF NOT public.health_cch_e5_has_explicit_consent('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')

 OR public.health_cch_e5_has_explicit_consent('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
 THEN RAISE EXCEPTION 'consent version, access or grant failed'; END IF;
END $$;
INSERT INTO public.health_consents(athlete_id,consent_type,decision,policy_version,occurred_at,details)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e5_personalized_review',
 'denied','e5-lab-v1','2026-11-19T11:00:00Z',
 '{"contract":"cch-e5-consent-v1","explicit_action":true}');
DO $$BEGIN
 IF public.health_cch_e5_has_explicit_consent('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
 THEN RAISE EXCEPTION 'denial did not stop E5'; END IF; END $$;
INSERT INTO public.health_consents(athlete_id,consent_type,decision,policy_version,occurred_at,details)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e5_personalized_review',
 'granted','e5-lab-v1','2026-11-19T12:00:00Z',
 '{"contract":"cch-e5-consent-v1","explicit_action":true}');
INSERT INTO public.health_consents(athlete_id,consent_type,decision,policy_version,occurred_at,details)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e5_personalized_review',
 'revoked','e5-lab-v1','2026-11-19T13:00:00Z',
 '{"contract":"cch-e5-consent-v1","explicit_action":true}');
DO $$BEGIN
 IF public.health_cch_e5_has_explicit_consent('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
 THEN RAISE EXCEPTION 'revocation did not block E5'; END IF;
 IF (SELECT count(*) FROM public.health_consents WHERE consent_type='e5_personalized_review')<>4
 THEN RAISE EXCEPTION 'append-only history missing'; END IF; END $$;
-- Conflict on same timestamp is fail-closed, even if one row is granted.
INSERT INTO public.health_consents(athlete_id,consent_type,decision,policy_version,occurred_at,details)
 VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e5_personalized_review',
 'granted','e5-lab-v1','2026-11-19T14:00:00Z',
 '{"contract":"cch-e5-consent-v1","explicit_action":true}'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e5_personalized_review',
 'denied','e5-lab-v1','2026-11-19T14:00:00Z',
 '{"contract":"cch-e5-consent-v1","explicit_action":true}');
DO $$BEGIN
 IF public.health_cch_e5_has_explicit_consent('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
 THEN RAISE EXCEPTION 'ambiguous consent conflict accepted'; END IF; END $$;
-- Append-only table: no UPDATE/DELETE privileges to authenticated.
DO $$BEGIN
 IF has_table_privilege('authenticated','public.health_consents','UPDATE') OR
 has_table_privilege('authenticated','public.health_consents','DELETE') THEN
 RAISE EXCEPTION 'M1 append-only contract regressed'; END IF; END $$;

-- Valid M4 note for completed and non-voided A session.
INSERT INTO public.health_workout_events
 (athlete_id,session_id,event_type,source,client_event_id,created_by_auth_user_id,payload)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ffffffff-1000-4000-8000-ffffffffffff',
 'note','user','dddddddd-6000-4000-8000-ddddddddddda',
 '11111111-1111-4111-8111-111111111111',
 '{"contract":"cch-e5-session-review-v1","explicit_confirmation":true,"recovery":"good","symptoms":"none"}');
SELECT public.e5_expect_failure($q$
 INSERT INTO public.health_workout_events
 (athlete_id,session_id,event_type,source,client_event_id,created_by_auth_user_id,payload)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ffffffff-1000-4000-8000-ffffffffffff',
 'note','user','dddddddd-6000-4000-8000-dddddddddddb',
 '11111111-1111-4111-8111-111111111111',
 '{"contract":"cch-e5-session-review-v1","explicit_confirmation":true,"recovery":"poor","symptoms":"pain"}')
$q$,ARRAY['23505']::text[]);
SELECT public.e5_expect_failure($q$
 INSERT INTO public.health_workout_events
 (athlete_id,session_id,event_type,source,client_event_id,created_by_auth_user_id,payload)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ffffffff-1000-4000-8000-ffffffffffff',
 'note','user','dddddddd-6000-4000-8000-ddddddddddda',
 '11111111-1111-4111-8111-111111111111',
 '{"contract":"cch-e5-session-review-v1","explicit_confirmation":true,"recovery":"good","symptoms":"none"}')
$q$,ARRAY['23505']::text[]);
SELECT public.e5_expect_failure($q$
 INSERT INTO public.health_workout_events
 (athlete_id,session_id,event_type,source,client_event_id,created_by_auth_user_id,payload)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ffffffff-1000-4000-8000-fffffffffffc',
 'note','user','dddddddd-6000-4000-8000-dddddddddddc',
 '11111111-1111-4111-8111-111111111111',
 '{"contract":"cch-e5-session-review-v1","explicit_confirmation":true,"recovery":"good","symptoms":"none"}')
$q$,ARRAY['42501']::text[]);
SELECT public.e5_expect_failure($q$
 INSERT INTO public.health_workout_events
 (athlete_id,session_id,event_type,source,client_event_id,created_by_auth_user_id,payload)
 VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','ffffffff-1000-4000-8000-fffffffffffb',
 'note','user','dddddddd-6000-4000-8000-dddddddddddd',
 '11111111-1111-4111-8111-111111111111',
 '{"contract":"cch-e5-session-review-v1","explicit_confirmation":true,"recovery":"good","symptoms":"none"}')
$q$,ARRAY['42501']::text[]);
SELECT public.e5_expect_failure($q$
 INSERT INTO public.health_workout_events
 (athlete_id,session_id,event_type,source,client_event_id,created_by_auth_user_id,payload)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ffffffff-1000-4000-8000-fffffffffffc',
 'note','system','dddddddd-6000-4000-8000-ddddddddddde',
 NULL,'{"contract":"cch-e5-session-review-v1","explicit_confirmation":true,"recovery":"good","symptoms":"none"}')
$q$,ARRAY['23514','42501']::text[]);
SELECT public.e5_expect_failure($q$
 INSERT INTO public.health_workout_events
 (athlete_id,session_id,event_type,source,client_event_id,created_by_auth_user_id,payload)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ffffffff-1000-4000-8000-fffffffffffc',
 'note','user','dddddddd-6000-4000-8000-dddddddddddf',
 '11111111-1111-4111-8111-111111111111',
 '{"contract":"cch-e5-session-review-v1","explicit_confirmation":false,"recovery":"good","symptoms":"none"}')
$q$,ARRAY['23514']::text[]);
SELECT public.e5_expect_failure($q$
 INSERT INTO public.health_workout_events
 (athlete_id,session_id,event_type,source,client_event_id,created_by_auth_user_id,payload)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ffffffff-1000-4000-8000-fffffffffffc',
 'note','user','dddddddd-6000-4000-8000-ddddddddeeee',
 '11111111-1111-4111-8111-111111111111',
 '{"contract":"cch-e5-session-review-v1","explicit_confirmation":true,"recovery":null,"symptoms":"none"}')
$q$,ARRAY['23514']::text[]);
-- E5 correction uses a distinct append-only note, chaining the root UUID.
-- Reject repeated, cross-athlete, stale predecessor and invalid payload.
DO $
DECLARE root_id uuid; correction_id uuid; payload_json jsonb;
BEGIN
 SELECT id INTO root_id FROM public.health_workout_events
 WHERE session_id='ffffffff-1000-4000-8000-ffffffffffff'
 AND payload->>'contract'='cch-e5-session-review-v1'
 AND NOT (payload ? 'replaces_event_id');
 IF root_id IS NULL THEN RAISE EXCEPTION 'missing E5 root for correction'; END IF;
 payload_json:=jsonb_build_object('contract','cch-e5-session-review-v1',
  'explicit_confirmation',true,'recovery','poor','symptoms','pain',
  'replaces_event_id',root_id::text);
 INSERT INTO public.health_workout_events
 (athlete_id,session_id,event_type,source,client_event_id,created_by_auth_user_id,payload)
 VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ffffffff-1000-4000-8000-ffffffffffff',
  'note','user','dddddddd-6000-4000-8000-ddddddddaa01',
  '11111111-1111-4111-8111-111111111111',payload_json)
 RETURNING id INTO correction_id;
 IF correction_id IS NULL THEN RAISE EXCEPTION 'E5 correction not persisted'; END IF;
 IF (SELECT count(*) FROM public.health_workout_events
  WHERE session_id='ffffffff-1000-4000-8000-ffffffffffff'
   AND payload->>'contract'='cch-e5-session-review-v1')<>2 THEN
  RAISE EXCEPTION 'E5 correction overwrote original'; END IF;
 PERFORM public.e5_expect_failure(format($q$
  INSERT INTO public.health_workout_events
  (athlete_id,session_id,event_type,source,client_event_id,created_by_auth_user_id,payload)
  VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ffffffff-1000-4000-8000-ffffffffffff',
  'note','user','dddddddd-6000-4000-8000-ddddddddaa02',
  '11111111-1111-4111-8111-111111111111',%L::jsonb)
 $q$,payload_json::text),ARRAY['23514','23505']::text[]);
 -- A second correction from the newest revision succeeds, preserving all three.
 payload_json:=jsonb_build_object('contract','cch-e5-session-review-v1',
  'explicit_confirmation',true,'recovery','unknown','symptoms','unknown',
  'replaces_event_id',correction_id::text);
 INSERT INTO public.health_workout_events
 (athlete_id,session_id,event_type,source,client_event_id,created_by_auth_user_id,payload)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ffffffff-1000-4000-8000-ffffffffffff',
  'note','user','dddddddd-6000-4000-8000-ddddddddaa03',
  '11111111-1111-4111-8111-111111111111',payload_json);
 IF (SELECT count(*) FROM public.health_workout_events
  WHERE session_id='ffffffff-1000-4000-8000-ffffffffffff'
   AND payload->>'contract'='cch-e5-session-review-v1')<>3 THEN
  RAISE EXCEPTION 'E5 historical correction chain not preserved'; END IF;
END $;

-- Regular M4 event remains writable for the owner, with M4 existing contract.
INSERT INTO public.health_workout_events
 (athlete_id,session_id,event_type,source,client_event_id,created_by_auth_user_id,payload)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ffffffff-1000-4000-8000-ffffffffffff',
 'session_completed','user','dddddddd-6000-4000-8000-ddddddddffaa',
 '11111111-1111-4111-8111-111111111111','{}');
DO $$BEGIN
 IF (SELECT count(*) FROM public.health_workout_events WHERE event_type='note')<>3
 THEN RAISE EXCEPTION 'E5 note integrity regression'; END IF; END $$;
SELECT set_config('request.jwt.claim.sub','',false);
DO $$BEGIN
 IF public.health_cch_e5_has_explicit_consent('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
 THEN RAISE EXCEPTION 'anon consent bypass'; END IF; END $$;
RESET ROLE;
-- M3/F21/F22 unchanged in this candidate.
DO $$BEGIN
 IF (SELECT count(*) FROM public.health_program_versions)<>4 OR
    (SELECT count(*) FROM public.health_cch_queue_entries)<>1 THEN
  RAISE EXCEPTION 'M3/F21 fixtures changed by E5 candidate'; END IF;
END $$;
SELECT 'CCH_E5E_PERSISTENT_CONTRACT_PASS' AS result;
