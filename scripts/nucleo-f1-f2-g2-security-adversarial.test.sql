-- F1/F2 G2 regression: both previously demonstrated bypasses must now fail.
-- Run ONLY in disposable PG16/Supabase local after g2 atomic receipt test.
\set ON_ERROR_STOP on
BEGIN;
-- Two fresh, fully synthetic assignments to isolate the two candidate paths.
INSERT INTO f12_lab.instances(id,auth_uid,identity_source,functional_label) VALUES
 ('20000000-0000-4000-8000-0000000000e3','30000000-0000-4000-8000-0000000000e3','synthetic://attack/legacy','legacy-bypass-fixture'),
 ('20000000-0000-4000-8000-0000000000e4','30000000-0000-4000-8000-0000000000e4','synthetic://attack/atomic','atomic-no-receipt-fixture');
INSERT INTO f12_lab.assignments
 (id,specialty_id,instance_id,auth_uid,module_id,front_id,responsibility,local_method_ref,provenance_ref,status,valid_from)
VALUES
 ('40000000-0000-4000-8000-0000000000e3','10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-0000000000e3','30000000-0000-4000-8000-0000000000e3',
  '636768e6-e782-4c7d-8132-e7381621be12',NULL,'collaborator',NULL,'synthetic://attack/legacy','active',now()-interval '1 minute'),
 ('40000000-0000-4000-8000-0000000000e4','10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-0000000000e4','30000000-0000-4000-8000-0000000000e4',
  '636768e6-e782-4c7d-8132-e7381621be12',NULL,'collaborator',NULL,'synthetic://attack/atomic','active',now()-interval '1 minute');
INSERT INTO f12_lab.approved_decisions
 (id,action,assignment_id,grant_id,approved_actor_auth_uid,scope_kind,authoritative_source,approved_at,expires_at)
VALUES
 ('80000000-0000-4000-8000-0000000000e3','grant_read_context','40000000-0000-4000-8000-0000000000e3',NULL,
  '30000000-0000-4000-8000-000000000097','module','synthetic://legacy-approval-bypasses-g2-attestation',now()-interval '1 minute',now()+interval '1 hour'),
 ('80000000-0000-4000-8000-0000000000e4','grant_read_context','40000000-0000-4000-8000-0000000000e4',NULL,
  '30000000-0000-4000-8000-000000000097','module','synthetic://g2/atomic/adversarial-no-receipt',now()-interval '1 minute',now()+interval '1 hour');
-- For the atomic family: a normal attestation exists, but no receipt is inserted.
INSERT INTO f12_lab.g2_decision_attestations
 (decision_id,competence_id,decider_auth_uid,executor_auth_uid,assignment_id,beneficiary_auth_uid,scope_kind,action,request_id,proof_ref)
VALUES
 ('80000000-0000-4000-8000-0000000000e4',
  '90000000-0000-4000-8000-0000000000c1',
  '30000000-0000-4000-8000-000000000099',
  '30000000-0000-4000-8000-000000000097',
  '40000000-0000-4000-8000-0000000000e4',
  '30000000-0000-4000-8000-0000000000e4',
  'module','grant_read_context','90000000-0000-4000-8000-0000000000e4','synthetic://verified/adversarial');
SET LOCAL ROLE f12_grant_executor;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000097',true);
-- Catch only the intended gate rejection, not unrelated SQL failures.
DO $legacy_denied$
BEGIN
 BEGIN
 INSERT INTO f12_lab.read_grants
 (id,assignment_id,auth_uid,permission,scope_kind,granted_at,valid_from,valid_until,decision_ref,granting_actor_ref)
VALUES ('50000000-0000-4000-8000-0000000000e3','40000000-0000-4000-8000-0000000000e3',
 '30000000-0000-4000-8000-0000000000e3','read_context','module',now(),now()-interval '1 minute',
 now()+interval '10 minutes','80000000-0000-4000-8000-0000000000e3','30000000-0000-4000-8000-000000000097');
 RAISE EXCEPTION 'G2_LEGACY_BYPASS_STILL_OPEN';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'G2_UNATTESTED_OR_UNAUTHORIZED_DECISION' THEN RAISE; END IF;
 END;
END $legacy_denied$;
DO $receipt_denied$
BEGIN
 BEGIN
 INSERT INTO f12_lab.read_grants
 (id,assignment_id,auth_uid,permission,scope_kind,granted_at,valid_from,valid_until,decision_ref,granting_actor_ref)
VALUES ('50000000-0000-4000-8000-0000000000e4','40000000-0000-4000-8000-0000000000e4',
 '30000000-0000-4000-8000-0000000000e4','read_context','module',now(),now()-interval '1 minute',
 now()+interval '10 minutes','80000000-0000-4000-8000-0000000000e4','30000000-0000-4000-8000-000000000097');
 SET CONSTRAINTS f12_lab.g2_grant_receipt_required IMMEDIATE;
 RAISE EXCEPTION 'G2_NO_RECEIPT_BYPASS_STILL_OPEN';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'G2_EXECUTION_RECEIPT_REQUIRED' THEN RAISE; END IF;
 END;
END $receipt_denied$;
RESET ROLE;
DO $check$
BEGIN
 IF EXISTS(SELECT 1 FROM f12_lab.read_grants WHERE id IN
 ('50000000-0000-4000-8000-0000000000e3','50000000-0000-4000-8000-0000000000e4'))
 OR EXISTS(SELECT 1 FROM f12_lab.grant_history WHERE grant_id IN
 ('50000000-0000-4000-8000-0000000000e3','50000000-0000-4000-8000-0000000000e4'))
 OR EXISTS(SELECT 1 FROM f12_lab.g2_execution_receipts WHERE grant_id IN
 ('50000000-0000-4000-8000-0000000000e3','50000000-0000-4000-8000-0000000000e4'))
 THEN RAISE EXCEPTION 'G2_DENIED_OPERATION_LEFT_DURABLE_RESULT'; END IF;
 RAISE NOTICE 'PASS G2: legacy grant without attestation and grant without receipt both denied';
END $check$;
ROLLBACK;
-- Post-rollback verification is independent of the attack transaction.
DO $clean$
BEGIN
 IF EXISTS(SELECT 1 FROM f12_lab.read_grants WHERE id IN
 ('50000000-0000-4000-8000-0000000000e3','50000000-0000-4000-8000-0000000000e4'))
 OR EXISTS(SELECT 1 FROM f12_lab.grant_history WHERE grant_id IN
 ('50000000-0000-4000-8000-0000000000e3','50000000-0000-4000-8000-0000000000e4'))
 OR EXISTS(SELECT 1 FROM f12_lab.approved_decisions WHERE id IN
 ('80000000-0000-4000-8000-0000000000e3','80000000-0000-4000-8000-0000000000e4'))
 THEN RAISE EXCEPTION 'G2_ADVERSARIAL_ROLLBACK_LEAK'; END IF;
 RAISE NOTICE 'PASS G2 adversarial test hygiene: no grant/decision/history persisted';
END $clean$;
