-- NUCLEO F1/F2 G2: ONLY disposable PostgreSQL, after authority+race fixture.
-- Gate is limited to decisions whose source begins synthetic://g2/atomic/.
-- No hosted Auth, no production schema changes; auth.uid() is lab-only here.
\set ON_ERROR_STOP on

-- Extend laboratory decision contract, not prior G2 fixture or G1 behavior.
-- Executor can read attestations scoped to itself, but cannot create or edit them.
-- This fixture intentionally uses a synthetic session GUC for the executor;
-- it is NOT a productive substitute for verified JWT/GoTrue identity.
GRANT SELECT ON f12_lab.g2_decision_attestations,f12_lab.g2_competences TO f12_grant_executor;
ALTER TABLE f12_lab.g2_decision_attestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE f12_lab.g2_competences ENABLE ROW LEVEL SECURITY;
CREATE POLICY g2_attestation_executor_read ON f12_lab.g2_decision_attestations
 FOR SELECT TO f12_grant_executor
 USING(executor_auth_uid=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid);
CREATE POLICY g2_competence_executor_read ON f12_lab.g2_competences
 FOR SELECT TO f12_grant_executor
 USING(EXISTS(SELECT 1 FROM f12_lab.g2_decision_attestations a
   WHERE a.competence_id=g2_competences.id
     AND a.executor_auth_uid=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid));

CREATE TABLE f12_lab.g2_execution_receipts (
 request_id uuid PRIMARY KEY,
 decision_id uuid NOT NULL UNIQUE REFERENCES f12_lab.approved_decisions(id),
 grant_id uuid NOT NULL UNIQUE REFERENCES f12_lab.read_grants(id),
 params_fingerprint text NOT NULL CHECK(length(params_fingerprint)>=12),
 result_kind text NOT NULL CHECK(result_kind='granted'),
 committed_actor_uid uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE f12_lab.g2_execution_receipts ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT ON f12_lab.g2_execution_receipts TO f12_grant_executor;
CREATE POLICY g2_receipt_executor_read ON f12_lab.g2_execution_receipts
 FOR SELECT TO f12_grant_executor
 USING(committed_actor_uid=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid);
CREATE POLICY g2_receipt_executor_insert ON f12_lab.g2_execution_receipts
 FOR INSERT TO f12_grant_executor
 WITH CHECK(committed_actor_uid=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
 AND EXISTS(
  SELECT 1 FROM f12_lab.g2_decision_attestations a
  JOIN f12_lab.approved_decisions d ON d.id=a.decision_id
  JOIN f12_lab.read_grants g ON g.id=g2_execution_receipts.grant_id
  WHERE a.decision_id=g2_execution_receipts.decision_id
   AND a.request_id=g2_execution_receipts.request_id
   AND a.executor_auth_uid=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
   AND d.id=g.decision_ref::uuid
   AND d.assignment_id=g.assignment_id
   AND g.auth_uid=a.beneficiary_auth_uid
   AND a.scope_kind=g.scope_kind
   AND g.revoked_at IS NULL
 ));
CREATE FUNCTION f12_lab.g2_guard_receipt_immutable() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER AS $body$
BEGIN
 RAISE EXCEPTION 'G2_EXECUTION_RECEIPT_IMMUTABLE';
END $body$;
CREATE TRIGGER g2_receipt_immutable BEFORE UPDATE OR DELETE
 ON f12_lab.g2_execution_receipts FOR EACH ROW
 EXECUTE FUNCTION f12_lab.g2_guard_receipt_immutable();

-- The approval must be independently recorded and attributed BEFORE execution.
-- Missing attestation, expired/revoked competence, role/actor or scope mismatch fail closed.
-- Applied only to the explicitly-versioned new G2 atomic lab source; old G1/G2
-- contracts remain unmodified and their earlier regressions are not reinterpreted.
CREATE FUNCTION f12_lab.g2_guard_atomic_grant() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER AS $body$
DECLARE d f12_lab.approved_decisions%ROWTYPE;
BEGIN
 SELECT * INTO d FROM f12_lab.approved_decisions WHERE id::text=NEW.decision_ref;
 IF NOT FOUND THEN RETURN NEW; END IF;
 IF d.authoritative_source NOT LIKE 'synthetic://g2/atomic/%' THEN RETURN NEW; END IF;
 IF NOT EXISTS (
  SELECT 1
  FROM f12_lab.g2_decision_attestations a
  JOIN f12_lab.g2_competences c ON c.id=a.competence_id
  JOIN f12_lab.assignments ass ON ass.id=a.assignment_id
  WHERE a.decision_id=d.id
    AND a.executor_auth_uid=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    AND a.decider_auth_uid<>a.executor_auth_uid
    AND a.assignment_id=NEW.assignment_id
    AND a.beneficiary_auth_uid=NEW.auth_uid
    AND a.scope_kind=NEW.scope_kind
    AND a.action='grant_read_context'
    AND a.proof_ref LIKE 'synthetic://verified/%'
    AND c.decider_auth_uid=a.decider_auth_uid
    AND c.scope_kind=a.scope_kind
    AND c.module_id=ass.module_id
    AND c.specialty_id=ass.specialty_id
    AND c.action='grant_read_context'
    AND c.approved_from<=now() AND now()<c.approved_until
    AND c.revoked_at IS NULL
    AND c.source_ref LIKE 'synthetic://master/%'
 ) THEN RAISE EXCEPTION 'G2_UNATTESTED_OR_UNAUTHORIZED_DECISION'; END IF;
 RETURN NEW;
END $body$;
CREATE TRIGGER g2_atomic_grant_gate BEFORE INSERT ON f12_lab.read_grants
 FOR EACH ROW EXECUTE FUNCTION f12_lab.g2_guard_atomic_grant();

-- Dedicated beneficiary and assignment, not shared with the prior G2 race.
INSERT INTO f12_lab.instances(id,auth_uid,identity_source,functional_label)
VALUES ('20000000-0000-4000-8000-0000000000f2',
 '30000000-0000-4000-8000-0000000000f2',
 'synthetic://g2/atomic-new-instance','atomic-grant-fixture');
INSERT INTO f12_lab.assignments
 (id,specialty_id,instance_id,auth_uid,module_id,front_id,responsibility,
 local_method_ref,provenance_ref,status,valid_from)
VALUES ('40000000-0000-4000-8000-0000000000f2',
 '10000000-0000-4000-8000-000000000001',
 '20000000-0000-4000-8000-0000000000f2',
 '30000000-0000-4000-8000-0000000000f2',
 '636768e6-e782-4c7d-8132-e7381621be12',NULL,'collaborator',NULL,
 'synthetic://g2/atomic-assignment','active',now()-interval '1 minute');

-- New fixture: distinct immutable sovereign author, distinct technical executor.
-- Lab postgres is the synthetic upstream authority; not a real human approval.
INSERT INTO f12_lab.approved_decisions
 (id,action,assignment_id,grant_id,approved_actor_auth_uid,scope_kind,
 authoritative_source,approved_at,expires_at)
VALUES ('80000000-0000-4000-8000-0000000000f1','grant_read_context',
 '40000000-0000-4000-8000-0000000000f2',NULL,
 '30000000-0000-4000-8000-000000000097','module',
 'synthetic://g2/atomic/master-approved',now()-interval '1 minute',now()+interval '1 hour');

-- Wrong executor can never create approval/attestation/receipt.
DO $priv$
BEGIN
 IF has_table_privilege('f12_grant_executor','f12_lab.g2_decision_attestations','INSERT')
 OR has_table_privilege('f12_grant_executor','f12_lab.g2_competences','INSERT')
 OR has_table_privilege('authenticated','f12_lab.g2_execution_receipts','INSERT')
 THEN RAISE EXCEPTION 'G2_PRIVILEGE_EXPANSION'; END IF;
END $priv$;

-- First attempt without attestation must fail: no grant/event/receipt.
SET ROLE f12_grant_executor;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000097',false);
DO $denied$
BEGIN
 BEGIN
 INSERT INTO f12_lab.read_grants
 (id,assignment_id,auth_uid,permission,scope_kind,granted_at,valid_from,
 valid_until,decision_ref,granting_actor_ref)
 VALUES ('50000000-0000-4000-8000-0000000000f1',
 '40000000-0000-4000-8000-0000000000f2',
 '30000000-0000-4000-8000-0000000000f2','read_context','module',
 now(),now()-interval '1 minute',now()+interval '15 minutes',
 '80000000-0000-4000-8000-0000000000f1',
 '30000000-0000-4000-8000-000000000097');
 RAISE EXCEPTION 'G2_UNATTESTED_ALLOWED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='G2_UNATTESTED_ALLOWED' THEN RAISE; END IF;
 END;
END $denied$;
RESET ROLE;
DO $zero$
BEGIN
 IF EXISTS(SELECT 1 FROM f12_lab.read_grants WHERE decision_ref='80000000-0000-4000-8000-0000000000f1')
 THEN RAISE EXCEPTION 'G2_UNATTESTED_GRANT_PERSISTED'; END IF;
END $zero$;

-- Authority fixture writes one attestation, referencing a valid scoped competence.
-- The request identity and fingerprint MUST match the receipt for future retries.
INSERT INTO f12_lab.g2_decision_attestations
 (decision_id,competence_id,decider_auth_uid,executor_auth_uid,
  assignment_id,beneficiary_auth_uid,scope_kind,action,request_id,proof_ref)
VALUES ('80000000-0000-4000-8000-0000000000f1',
 '90000000-0000-4000-8000-0000000000c1',
 '30000000-0000-4000-8000-000000000099',
 '30000000-0000-4000-8000-000000000097',
 '40000000-0000-4000-8000-0000000000f2',
 '30000000-0000-4000-8000-0000000000f2','module','grant_read_context',
 '90000000-0000-4000-8000-0000000000f1','synthetic://verified/lab-master');

-- Operation is one SQL transaction. A failed second statement would
-- roll back grant+trigger audit too (not two autocommit statements).
BEGIN;
SET LOCAL ROLE f12_grant_executor;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000097',true);
INSERT INTO f12_lab.read_grants
 (id,assignment_id,auth_uid,permission,scope_kind,granted_at,valid_from,
 valid_until,decision_ref,granting_actor_ref)
VALUES ('50000000-0000-4000-8000-0000000000f1',
 '40000000-0000-4000-8000-0000000000f2',
 '30000000-0000-4000-8000-0000000000f2','read_context','module',
 now(),now()-interval '1 minute',now()+interval '15 minutes',
 '80000000-0000-4000-8000-0000000000f1',
 '30000000-0000-4000-8000-000000000097');
INSERT INTO f12_lab.g2_execution_receipts
 (request_id,decision_id,grant_id,params_fingerprint,result_kind,committed_actor_uid)
VALUES ('90000000-0000-4000-8000-0000000000f1',
 '80000000-0000-4000-8000-0000000000f1',
 '50000000-0000-4000-8000-0000000000f1',
 'sha256-synthetic-verified-request','granted',
 '30000000-0000-4000-8000-000000000097');
COMMIT;

-- Replay is read-only: inspect persisted receipt, and compare request fingerprint.
SET ROLE f12_grant_executor;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000097',false);
DO $receipt$
DECLARE saved text;
BEGIN
 SELECT params_fingerprint INTO saved FROM f12_lab.g2_execution_receipts
 WHERE request_id='90000000-0000-4000-8000-0000000000f1';
 IF saved<>'sha256-synthetic-verified-request' THEN
  RAISE EXCEPTION 'G2_RECEIPT_NOT_VISIBLE_OR_MUTATED'; END IF;
 BEGIN
  INSERT INTO f12_lab.g2_execution_receipts
   (request_id,decision_id,grant_id,params_fingerprint,result_kind,committed_actor_uid)
  VALUES ('90000000-0000-4000-8000-0000000000f1',
  '80000000-0000-4000-8000-0000000000f1',
  '50000000-0000-4000-8000-0000000000f1',
  'sha256-different-request','granted',
  '30000000-0000-4000-8000-000000000097');
  RAISE EXCEPTION 'G2_CHANGED_PARAMS_ALLOWED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='G2_CHANGED_PARAMS_ALLOWED' THEN RAISE; END IF;
 END;
END $receipt$;
RESET ROLE;

DO $final$
BEGIN
 IF (SELECT count(*) FROM f12_lab.read_grants
     WHERE decision_ref='80000000-0000-4000-8000-0000000000f1')<>1
 OR (SELECT count(*) FROM f12_lab.grant_history
     WHERE grant_id='50000000-0000-4000-8000-0000000000f1' AND event_kind='granted')<>1
 OR (SELECT count(*) FROM f12_lab.g2_execution_receipts
     WHERE decision_id='80000000-0000-4000-8000-0000000000f1')<>1
 THEN RAISE EXCEPTION 'G2_ATOMIC_RESULT_NOT_EXACTLY_ONCE'; END IF;
 RAISE NOTICE 'PASS G2 attested atomic grant+audit+receipt, unapproved denied, request replay denied';
END $final$;
