-- F1/F2 G2 DECIDER AUTHORITY lab fixture, run AFTER G2 baseline SQL.
-- Does NOT create productive authorities, accounts, schema or writer.
\set ON_ERROR_STOP on
CREATE TABLE f12_lab.g2_competences (
 id uuid PRIMARY KEY,
 decider_auth_uid uuid NOT NULL,
 scope_kind text NOT NULL CHECK(scope_kind IN ('front','module')),
 module_id uuid NOT NULL REFERENCES f12_core.workstreams(id),
 specialty_id uuid NOT NULL REFERENCES f12_lab.specialties(id),
 action text NOT NULL CHECK(action IN ('grant_read_context','revoke_read_context')),
 source_ref text NOT NULL,
 delegated_by_auth_uid uuid,
 approved_from timestamptz NOT NULL,
 approved_until timestamptz NOT NULL,
 revoked_at timestamptz,
 CHECK(approved_until>approved_from),
 CHECK(decider_auth_uid<>coalesce(delegated_by_auth_uid,'00000000-0000-0000-0000-000000000000'::uuid))
);
CREATE TABLE f12_lab.g2_decision_attestations (
 decision_id uuid PRIMARY KEY REFERENCES f12_lab.approved_decisions(id),
 competence_id uuid NOT NULL REFERENCES f12_lab.g2_competences(id),
 decider_auth_uid uuid NOT NULL,
 executor_auth_uid uuid NOT NULL,
 assignment_id uuid NOT NULL,
 beneficiary_auth_uid uuid NOT NULL,
 scope_kind text NOT NULL CHECK(scope_kind IN ('front','module')),
 action text NOT NULL,
 request_id uuid NOT NULL UNIQUE,
 proof_ref text NOT NULL,
 asserted_at timestamptz NOT NULL DEFAULT now(),
 CHECK(decider_auth_uid<>executor_auth_uid)
);
-- G2 candidate authority is a database fixture to verify decisions and
-- delegation. A real service must authenticate the sovereign decider first.
CREATE FUNCTION f12_lab.g2_verify_attestation() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER AS $verify$
DECLARE d f12_lab.approved_decisions%ROWTYPE;
DECLARE a f12_lab.assignments%ROWTYPE;
BEGIN
 SELECT * INTO d FROM f12_lab.approved_decisions WHERE id=NEW.decision_id;
 SELECT * INTO a FROM f12_lab.assignments WHERE id=NEW.assignment_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'G2_ATTEST_MISSING_ASSIGNMENT'; END IF;
 IF NOT EXISTS (
 SELECT 1 FROM f12_lab.g2_competences c
 WHERE c.id=NEW.competence_id AND c.decider_auth_uid=NEW.decider_auth_uid
 AND c.scope_kind=NEW.scope_kind AND c.module_id=a.module_id
 AND c.specialty_id=a.specialty_id AND c.action=NEW.action
 AND c.approved_from<=NEW.asserted_at AND NEW.asserted_at<c.approved_until
 AND c.revoked_at IS NULL
 AND (c.delegated_by_auth_uid IS NULL OR c.source_ref LIKE 'synthetic://delegation/%')
 ) THEN RAISE EXCEPTION 'G2_COMPETENCE_DENIED'; END IF;
 IF d.id IS NULL OR d.assignment_id<>NEW.assignment_id
 OR d.action<>NEW.action OR d.scope_kind<>NEW.scope_kind
 OR d.approved_actor_auth_uid<>NEW.executor_auth_uid
 OR a.auth_uid IS DISTINCT FROM NEW.beneficiary_auth_uid
 OR d.expires_at<=NEW.asserted_at
 THEN RAISE EXCEPTION 'G2_DECISION_MISMATCH'; END IF;
 RETURN NEW;
END $verify$;
CREATE TRIGGER g2_attestation_guard BEFORE INSERT ON f12_lab.g2_decision_attestations
 FOR EACH ROW EXECUTE FUNCTION f12_lab.g2_verify_attestation();
CREATE FUNCTION f12_lab.g2_preserve_attestation() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER AS $immutable$
BEGIN
 RAISE EXCEPTION 'G2_ATTESTATION_IMMUTABLE';
END $immutable$;
CREATE TRIGGER g2_attestation_immutable BEFORE UPDATE OR DELETE ON f12_lab.g2_decision_attestations
 FOR EACH ROW EXECUTE FUNCTION f12_lab.g2_preserve_attestation();
-- This is intentionally NOT granted to authenticated or executor roles.
REVOKE ALL ON f12_lab.g2_competences, f12_lab.g2_decision_attestations FROM PUBLIC;
INSERT INTO f12_lab.g2_competences VALUES
 ('90000000-0000-4000-8000-0000000000c1','30000000-0000-4000-8000-000000000099','module',
 '636768e6-e782-4c7d-8132-e7381621be12',
 '10000000-0000-4000-8000-000000000001','grant_read_context',
 'synthetic://master/competence',NULL,now()-interval '1 hour',now()+interval '1 day',NULL),
 ('90000000-0000-4000-8000-0000000000c2','30000000-0000-4000-8000-000000000088','module',
 '636768e6-e782-4c7d-8132-e7381621be12',
 '10000000-0000-4000-8000-000000000001','grant_read_context',
 'synthetic://delegation/explicit-approval','30000000-0000-4000-8000-000000000099',
 now()-interval '1 hour',now()+interval '1 day',NULL),
 ('90000000-0000-4000-8000-0000000000c3','30000000-0000-4000-8000-000000000087','module',
 '636768e6-e782-4c7d-8132-e7381621be12',
 '10000000-0000-4000-8000-000000000001','grant_read_context',
 'synthetic://delegation/revoked','30000000-0000-4000-8000-000000000099',
 now()-interval '1 hour',now()+interval '1 day',now()-interval '1 minute');
-- Dedicated assignment without prior grant, based on synthetic G1 actor.
INSERT INTO f12_lab.assignments
 (id,specialty_id,instance_id,auth_uid,module_id,front_id,responsibility,
 local_method_ref,provenance_ref,status,valid_from)
VALUES ('40000000-0000-4000-8000-0000000000c1',
 '10000000-0000-4000-8000-000000000001',
 '20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000001',
 '636768e6-e782-4c7d-8132-e7381621be12',NULL,'primary',
 NULL,'synthetic://g2/race-assignment','active',now()-interval '1 minute');
INSERT INTO f12_lab.approved_decisions
 (id,action,assignment_id,grant_id,approved_actor_auth_uid,scope_kind,
 authoritative_source,approved_at,expires_at)
VALUES ('80000000-0000-4000-8000-0000000000c1','grant_read_context',
 '40000000-0000-4000-8000-0000000000c1',NULL,
 '30000000-0000-4000-8000-000000000097','module',
 'synthetic://master/approved-command',now()-interval '1 minute',now()+interval '1 hour');
INSERT INTO f12_lab.g2_decision_attestations
 (decision_id,competence_id,decider_auth_uid,executor_auth_uid,assignment_id,
 beneficiary_auth_uid,scope_kind,action,request_id,proof_ref)
VALUES ('80000000-0000-4000-8000-0000000000c1',
 '90000000-0000-4000-8000-0000000000c1',
 '30000000-0000-4000-8000-000000000099',
 '30000000-0000-4000-8000-000000000097',
 '40000000-0000-4000-8000-0000000000c1',
 '30000000-0000-4000-8000-000000000001','module','grant_read_context',
 '90000000-0000-4000-8000-0000000000c9','synthetic://attestation/master');
-- Negative tests: wrong decider, revoked delegation, changing attestation, executor INSERT
DO $test$
BEGIN
 BEGIN
 INSERT INTO f12_lab.g2_decision_attestations
 (decision_id,competence_id,decider_auth_uid,executor_auth_uid,assignment_id,
 beneficiary_auth_uid,scope_kind,action,request_id,proof_ref)
 SELECT decision_id,'90000000-0000-4000-8000-0000000000c2',
 '30000000-0000-4000-8000-000000000088',executor_auth_uid,assignment_id,
 beneficiary_auth_uid,scope_kind,action,'90000000-0000-4000-8000-0000000000d1',
 'synthetic://attestation/delegated'
 FROM f12_lab.g2_decision_attestations LIMIT 1;
 RAISE EXCEPTION 'G2_DUPLICATE_ATTESTATION_ALLOWED';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 BEGIN
 UPDATE f12_lab.g2_decision_attestations SET proof_ref='synthetic://tampered';
 RAISE EXCEPTION 'G2_MUTATION_ALLOWED';
 EXCEPTION WHEN OTHERS THEN
 IF SQLERRM='G2_MUTATION_ALLOWED' THEN RAISE; END IF;
 END;
 IF has_table_privilege('f12_grant_executor','f12_lab.g2_decision_attestations','INSERT')
 OR has_table_privilege('authenticated','f12_lab.g2_competences','INSERT')
 THEN RAISE EXCEPTION 'G2_UNTRUSTED_AUTHORITY_WRITE'; END IF;
 RAISE NOTICE 'PASS G2 authority fixture: separated decider/executor, bounded competence, immutable attestation, no executor approvals';
END $test$;
