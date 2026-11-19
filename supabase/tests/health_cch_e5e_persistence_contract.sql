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
 IF (SELECT count(*) FROM public.health_cch_e5_current_session_review(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'ffffffff-1000-4000-8000-ffffffffffff'))<>0 THEN
  RAISE EXCEPTION 'revoked E5 session review still exposed'; END IF;
END $$;
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
DO $$
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
END $$;

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
-- Canonical document digest is checked by PostgreSQL, not just its length.
DO $$BEGIN
 IF (SELECT policy_digest <> encode(sha256(convert_to(policy_document,'UTF8')),'hex')
     FROM public.health_cch_e5_policy_registry WHERE status='active') THEN
   RAISE EXCEPTION 'policy digest does not match canonical bytes';
 END IF;
END $$;
SELECT public.e5_expect_failure($q$
 UPDATE public.health_cch_e5_policy_registry
 SET policy_document='tampered' WHERE status='active'
$q$,ARRAY['23514']::text[]);
-- Fail closed for voided sessions and an orphan correction injected *only*
-- by fixture administrator to represent legacy corruption (not via E5 trigger).
RESET ROLE;
UPDATE public.health_workout_sessions SET record_status='voided'
 WHERE id='ffffffff-1000-4000-8000-ffffffffffff';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $$BEGIN
 IF EXISTS (SELECT 1 FROM public.health_cch_e5_current_session_review(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'ffffffff-1000-4000-8000-ffffffffffff')) THEN
  RAISE EXCEPTION 'voided session exposed E5 recovery'; END IF;
END $$;
RESET ROLE;
UPDATE public.health_workout_sessions SET record_status='active'
 WHERE id='ffffffff-1000-4000-8000-ffffffffffff';
-- Isolated forensic injection: cannot be entered using approved E5 API.
ALTER TABLE public.health_workout_events DISABLE TRIGGER health_cch_e5_session_note_guard;
INSERT INTO public.health_workout_events
 (id,athlete_id,session_id,event_type,source,client_event_id,
 created_by_auth_user_id,payload)
 VALUES('eeeeeeee-0000-4000-8000-000000000001',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'ffffffff-1000-4000-8000-ffffffffffff',
 'note','user','eeeeeeee-0000-4000-8000-000000000002',
 '11111111-1111-4111-8111-111111111111',
 '{"contract":"cch-e5-session-review-v1","explicit_confirmation":true,
 "recovery":"good","symptoms":"none",
 "replaces_event_id":"eeeeeeee-0000-4000-8000-000000000003"}');
ALTER TABLE public.health_workout_events ENABLE TRIGGER health_cch_e5_session_note_guard;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $$BEGIN
 IF EXISTS (SELECT 1 FROM public.health_cch_e5_current_session_review(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'ffffffff-1000-4000-8000-ffffffffffff')) THEN
  RAISE EXCEPTION 'orphan E5 correction did not fail closed'; END IF;
END $$;
RESET ROLE;
DELETE FROM public.health_workout_events
 WHERE id='eeeeeeee-0000-4000-8000-000000000001';
-- Forensic checks did not overwrite or delete the legitimate E5 chain.
DO $$BEGIN
 IF (SELECT count(*) FROM public.health_workout_events
 WHERE athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
 AND session_id='ffffffff-1000-4000-8000-ffffffffffff'
 AND event_type='note' AND payload->>'contract'='cch-e5-session-review-v1')<>3
 THEN RAISE EXCEPTION 'valid E5 chain not preserved after forensic checks'; END IF;
END $$;

-- Governance version switch is a privileged fixture-only action, never client-selectable.
-- First override any conflicting synthetic history with a fresh explicit grant.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
INSERT INTO public.health_consents(athlete_id,consent_type,decision,policy_version,details)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e5_personalized_review',
 'granted','e5-lab-v1','{"contract":"cch-e5-consent-v1","explicit_action":true}');
DO $$BEGIN
 IF NOT public.health_cch_e5_has_explicit_consent('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') THEN
 RAISE EXCEPTION 'fresh current-policy grant not recognized'; END IF;
END $$;
-- Query-only projection selects the final *unknown* recovery, preserving all 3 events.
DO $$
DECLARE x record;
BEGIN
 SELECT * INTO x FROM public.health_cch_e5_current_session_review(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'ffffffff-1000-4000-8000-ffffffffffff');
 IF x.event_id IS NULL OR x.recovery IS DISTINCT FROM 'unknown'
 OR x.symptoms IS DISTINCT FROM 'unknown' OR x.revision_count<>3 THEN
  RAISE EXCEPTION 'E5 did not read the latest valid revision';
 END IF;
 IF (SELECT count(*) FROM public.health_cch_e5_current_session_review(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'ffffffff-1000-4000-8000-ffffffffffff'))<>0 THEN
  RAISE EXCEPTION 'cross-athlete session reader leaked';
 END IF;
END $$;
SELECT public.e5_expect_failure($q$
 INSERT INTO public.health_cch_e5_policy_registry
 (policy_version,status,approved_at,effective_at,approved_by_auth_user_id,approval_reference,policy_document,policy_digest)
 VALUES('malicious-v1','active',now(),now(),
 '11111111-1111-4111-8111-111111111111','INVALID','Fake',repeat('b',64))
$q$,ARRAY['42501']::text[]);
RESET ROLE;
UPDATE public.health_cch_e5_policy_registry SET status='retired' WHERE status='active';
INSERT INTO public.health_cch_e5_policy_registry
 (policy_version,status,approved_at,effective_at,approved_by_auth_user_id,approval_reference,policy_document,policy_digest)
 VALUES('e5-lab-v2','active',clock_timestamp(),clock_timestamp(),
 '11111111-1111-4111-8111-111111111111','CI-SYNTHETIC-ONLY',
 'Synthetic policy lab 2',encode(sha256(convert_to('Synthetic policy lab 2','UTF8')),'hex'));
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $$BEGIN
 IF public.health_cch_e5_has_explicit_consent('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') THEN
 RAISE EXCEPTION 'old version consent still accepted after governance switch'; END IF;
END $$;
SELECT public.e5_expect_failure($q$
 INSERT INTO public.health_consents(athlete_id,consent_type,decision,policy_version,details)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e5_personalized_review',
 'granted','e5-lab-v1','{"contract":"cch-e5-consent-v1","explicit_action":true}')
$q$,ARRAY['23514','42501']::text[]);
-- Only the *new* active version can become effective after a fresh explicit action.
INSERT INTO public.health_consents(athlete_id,consent_type,decision,policy_version,details)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e5_personalized_review',
 'granted','e5-lab-v2','{"contract":"cch-e5-consent-v1","explicit_action":true}');
DO $$BEGIN
 IF NOT public.health_cch_e5_has_explicit_consent('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') THEN
 RAISE EXCEPTION 'new official version not recognized'; END IF;
END $$;
RESET ROLE;
-- Absence of an auth_user_id is never inferred from owner/coach privileges.
UPDATE public.health_athletes SET auth_user_id=NULL
 WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
DO $$BEGIN
 IF public.health_cch_e5_has_explicit_consent('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') THEN
 RAISE EXCEPTION 'unlinked athlete got E5 authorization'; END IF;
END $$;
SELECT public.e5_expect_failure($q$
 INSERT INTO public.health_consents(athlete_id,consent_type,decision,policy_version,details)
 VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','e5_personalized_review',
 'granted','e5-lab-v2','{"contract":"cch-e5-consent-v1","explicit_action":true}')
$q$,ARRAY['42501']::text[]);
RESET ROLE;
-- M3/F21/F22 unchanged in this candidate.
DO $$BEGIN
 IF (SELECT count(*) FROM public.health_program_versions)<>4 OR
    (SELECT count(*) FROM public.health_cch_queue_entries)<>1 THEN
  RAISE EXCEPTION 'M3/F21 fixtures changed by E5 candidate'; END IF;
END $$;
SELECT 'CCH_E5E_PERSISTENT_CONTRACT_PASS' AS result;
