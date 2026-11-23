-- G1: executed AFTER cross-front fixture, PostgreSQL disposable only.
\set ON_ERROR_STOP on
-- Synthetic actor A retains CRM grant, but NUC grant was revoked in baseline.
-- New NULL-front assignment is not sufficient to read any NUC card.
INSERT INTO f12_lab.assignments
 (id,specialty_id,instance_id,auth_uid,module_id,front_id,responsibility,
  local_method_ref,provenance_ref,status,valid_from,valid_until,closed_at)
VALUES ('40000000-0000-4000-8000-0000000000a1',
 '10000000-0000-4000-8000-000000000001',
 '20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000001',
 '636768e6-e782-4c7d-8132-e7381621be12',NULL,'collaborator',
 NULL,'synthetic://g1/module-assignment','active',now()-interval '1 minute',NULL,NULL);
-- A test grant with omitted scope defaults to front: even on NULL-front assignment,
-- it MUST NOT read any NUC card. No decision is created by this test.
INSERT INTO f12_lab.read_grants
 (id,assignment_id,auth_uid,permission,granted_at,valid_from,decision_ref,granting_actor_ref)
VALUES ('50000000-0000-4000-8000-0000000000a1',
 '40000000-0000-4000-8000-0000000000a1',
 '30000000-0000-4000-8000-000000000001','read_context',now(),
 now()-interval '1 minute','synthetic://g1/no-module-decision','synthetic://g1/fixture-admin');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',false);
DO $none$
BEGIN
 IF (SELECT count(*) FROM f12_lab.context_cards WHERE module_id='636768e6-e782-4c7d-8132-e7381621be12')<>0
 THEN RAISE EXCEPTION 'G1 FAIL: NULL front implicitly unlocked NUC'; END IF;
END $none$;
RESET ROLE;
-- Expiring the first grant allows a second explicitly approved scope.
UPDATE f12_lab.read_grants SET revoked_at=now(),
 revoked_by_actor_ref='synthetic://g1/revoker',
 revocation_decision_ref='synthetic://g1/revoke-default'
WHERE id='50000000-0000-4000-8000-0000000000a1';
-- A module grant MUST have finite expiration even when inserted by privileged fixture.
DO $deny$
BEGIN
 BEGIN
 INSERT INTO f12_lab.read_grants
 (id,assignment_id,auth_uid,permission,scope_kind,granted_at,valid_from,decision_ref,granting_actor_ref)
 VALUES ('50000000-0000-4000-8000-0000000000a2',
  '40000000-0000-4000-8000-0000000000a1',
  '30000000-0000-4000-8000-000000000001','read_context','module',
  now(),now()-interval '1 minute','synthetic://g1/no-expiry','synthetic://g1/admin');
 RAISE EXCEPTION 'G1_UNBOUNDED_MODULE_ALLOWED';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $deny$;
-- Distinct competent decision explicitly declares module; writer must consume it.
INSERT INTO f12_lab.approved_decisions
 (id,action,assignment_id,grant_id,approved_actor_auth_uid,scope_kind,authoritative_source,approved_at,expires_at)
VALUES ('80000000-0000-4000-8000-0000000000a1','grant_read_context',
 '40000000-0000-4000-8000-0000000000a1',NULL,
 '30000000-0000-4000-8000-000000000097','module',
 'synthetic://master/g1-explicit-module',now()-interval '1 minute',now()+interval '1 day');
SET ROLE f12_grant_executor;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000097',false);
-- A forged front-scope cannot consume an approved module decision.
DO $mismatch$
BEGIN
 BEGIN
 INSERT INTO f12_lab.read_grants
 (id,assignment_id,auth_uid,permission,scope_kind,granted_at,valid_from,valid_until,decision_ref,granting_actor_ref)
 VALUES ('50000000-0000-4000-8000-0000000000a2',
  '40000000-0000-4000-8000-0000000000a1',
  '30000000-0000-4000-8000-000000000001','read_context','front',
  now(),now()-interval '1 minute',now()+interval '2 hours',
  '80000000-0000-4000-8000-0000000000a1','30000000-0000-4000-8000-000000000097');
 RAISE EXCEPTION 'G1_SCOPE_MISMATCH_ALLOWED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM='G1_SCOPE_MISMATCH_ALLOWED' THEN RAISE; END IF;
 END;
END $mismatch$;
INSERT INTO f12_lab.read_grants
 (id,assignment_id,auth_uid,permission,scope_kind,granted_at,valid_from,valid_until,decision_ref,granting_actor_ref)
VALUES ('50000000-0000-4000-8000-0000000000a2',
 '40000000-0000-4000-8000-0000000000a1',
 '30000000-0000-4000-8000-000000000001','read_context','module',
 now(),now()-interval '1 minute',now()+interval '2 hours',
 '80000000-0000-4000-8000-0000000000a1','30000000-0000-4000-8000-000000000097');
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',false);
DO $allow$
BEGIN
 IF (SELECT count(*) FROM f12_lab.context_cards
     WHERE module_id='636768e6-e782-4c7d-8132-e7381621be12'
       AND specialty_id='10000000-0000-4000-8000-000000000001')<>2
 THEN RAISE EXCEPTION 'G1 explicit module must see exactly M4 and M5'; END IF;
 IF (SELECT count(*) FROM f12_lab.context_cards
     WHERE module_id='636768e6-e782-4c7d-8132-e7381621be12'
       AND specialty_id<>'10000000-0000-4000-8000-000000000001')<>0
 THEN RAISE EXCEPTION 'G1 cross-specialty leak'; END IF;
 IF (SELECT count(*) FROM f12_core.workstreams)<>0
 THEN RAISE EXCEPTION 'G1 raw M3 leak'; END IF;
END $allow$;
RESET ROLE;
UPDATE f12_lab.read_grants SET revoked_at=now(),
 revoked_by_actor_ref='synthetic://g1/revoker',
 revocation_decision_ref='synthetic://g1/revoke-module'
 WHERE id='50000000-0000-4000-8000-0000000000a2';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',false);
DO $revoked$
BEGIN
 IF (SELECT count(*) FROM f12_lab.context_cards
     WHERE module_id='636768e6-e782-4c7d-8132-e7381621be12')<>0
 THEN RAISE EXCEPTION 'G1 revoked module grant leaked'; END IF;
END $revoked$;
RESET ROLE;
DO $history$
BEGIN
 IF (SELECT count(*) FROM f12_lab.grant_history
     WHERE grant_id='50000000-0000-4000-8000-0000000000a2')<>2
 THEN RAISE EXCEPTION 'G1 module grant/revocation audit missing'; END IF;
 RAISE NOTICE 'PASS G1 explicit front/module scope, NULL-front deny, expiry, decision match, cross-front, revoke';
END $history$;
