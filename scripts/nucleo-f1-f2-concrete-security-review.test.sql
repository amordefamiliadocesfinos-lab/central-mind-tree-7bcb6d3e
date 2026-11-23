-- Security follow-up F1/F2: executes AFTER the original baseline tests.
\set ON_ERROR_STOP on
-- Hierarchy drift: a referenced M4 cannot silently move from NUC to CRM.
DO $$
BEGIN
 BEGIN
 UPDATE f12_core.workstreams SET parent_id='00000000-0000-4000-8000-000000000010'
 WHERE id='95833fbd-38b5-4a0a-abea-45f74214d533';
 RAISE EXCEPTION 'M3_REPARENT_UNEXPECTED_SUCCESS';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='M3_REPARENT_UNEXPECTED_SUCCESS' THEN RAISE; END IF; END;
 IF (SELECT parent_id FROM f12_core.workstreams WHERE id='95833fbd-38b5-4a0a-abea-45f74214d533')
  <>'636768e6-e782-4c7d-8132-e7381621be12' THEN RAISE EXCEPTION 'M3 ownership drift'; END IF;
END $$;
-- Subfront descendant guards parent changes, not just the directly referenced node.
INSERT INTO f12_core.workstreams VALUES
 ('00000000-0000-4000-8000-000000000020','NUC-M5','frente','636768e6-e782-4c7d-8132-e7381621be12'),
 ('00000000-0000-4000-8000-000000000021','NUC-M5-S1','subfrente','00000000-0000-4000-8000-000000000020'),
 ('00000000-0000-4000-8000-000000000022','NUC-UNUSED','frente','636768e6-e782-4c7d-8132-e7381621be12');
INSERT INTO f12_lab.assignments
 (id,specialty_id,instance_id,auth_uid,module_id,front_id,responsibility,
  local_method_ref,provenance_ref,status,valid_from,valid_until,closed_at)
VALUES
 ('40000000-0000-4000-8000-000000000090','10000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003',
  '636768e6-e782-4c7d-8132-e7381621be12','00000000-0000-4000-8000-000000000021',
  'primary',NULL,'synthetic://prov/descendant','active',now()-interval '1 day',NULL,NULL);
DO $$
BEGIN
 BEGIN
 UPDATE f12_core.workstreams SET parent_id='00000000-0000-4000-8000-000000000010'
 WHERE id='00000000-0000-4000-8000-000000000020';
 RAISE EXCEPTION 'DESCENDANT_UNEXPECTED_SUCCESS';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='DESCENDANT_UNEXPECTED_SUCCESS' THEN RAISE; END IF; END;
END $$;
-- The REAL M3 contract does not allow even an unreferenced front to move:
-- identity/kind/parent_id are immutable. Do not silently relax this.
DO $identityguard$
BEGIN
 BEGIN
  UPDATE f12_core.workstreams SET parent_id='00000000-0000-4000-8000-000000000010'
  WHERE id='00000000-0000-4000-8000-000000000022';
  RAISE EXCEPTION 'UNREFERENCED_REPARENT_ALLOWED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='UNREFERENCED_REPARENT_ALLOWED' THEN RAISE; END IF; END;
 IF (SELECT parent_id FROM f12_core.workstreams WHERE id='00000000-0000-4000-8000-000000000022')
   <>'636768e6-e782-4c7d-8132-e7381621be12' THEN
   RAISE EXCEPTION 'official M3 immutability violated'; END IF;
END $identityguard$;

-- Provenance: raw private text and unapproved source must never become a card.
DO $$
BEGIN
 BEGIN
 INSERT INTO f12_lab.context_cards VALUES
 ('60000000-0000-4000-8000-000000000090','10000000-0000-4000-8000-000000000001',
  '636768e6-e782-4c7d-8132-e7381621be12',NULL,'next_action',
  'synthetic not approved','synthetic://unapproved');
 RAISE EXCEPTION 'UNREVIEWED_CARD_ALLOWED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='UNREVIEWED_CARD_ALLOWED' THEN RAISE; END IF; END;
 BEGIN
 INSERT INTO f12_lab.context_cards VALUES
 ('60000000-0000-4000-8000-000000000091','10000000-0000-4000-8000-000000000001',
  '636768e6-e782-4c7d-8132-e7381621be12',NULL,'method_ref',
  'synthetic private body','synthetic://source/nuc');
 RAISE EXCEPTION 'MISMATCHED_LABEL_ALLOWED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='MISMATCHED_LABEL_ALLOWED' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM f12_lab.context_cards)<>4 THEN RAISE EXCEPTION 'unreviewed cards persisted'; END IF;
END $$;
DO $sourceimmut$
BEGIN
 BEGIN
  UPDATE f12_lab.approved_card_sources
   SET public_label='synthetic unauthorized replacement' WHERE source_ref='synthetic://source/nuc';
  RAISE EXCEPTION 'APPROVED_SOURCE_MUTATED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='APPROVED_SOURCE_MUTATED' THEN RAISE; END IF; END;
 BEGIN
  DELETE FROM f12_lab.approved_card_sources WHERE source_ref='synthetic://source/nuc';
  RAISE EXCEPTION 'APPROVED_SOURCE_DELETED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='APPROVED_SOURCE_DELETED' THEN RAISE; END IF; END;
END $sourceimmut$;
-- Read-only callers cannot modify approved source registry or grant decisions.
DO $$ BEGIN
 IF has_table_privilege('authenticated','f12_lab.approved_card_sources','SELECT')
 OR has_table_privilege('authenticated','f12_lab.approved_decisions','SELECT')
 OR has_table_privilege('f12_grant_executor','f12_lab.approved_decisions','INSERT')
 OR has_table_privilege('f12_grant_executor','f12_lab.approved_card_sources','INSERT')
 OR has_table_privilege('authenticated','f12_lab.grant_history','INSERT') THEN
 RAISE EXCEPTION 'untrusted actor can author approvals/history'; END IF;
END $$;

-- A trusted, previously approved decision is distinct from the executor of the
-- operation. In this lab, only the decision's approved executor may use role.
INSERT INTO f12_lab.approved_decisions
 (id,action,assignment_id,grant_id,approved_actor_auth_uid,authoritative_source,approved_at,expires_at)
VALUES
 ('80000000-0000-4000-8000-000000000001','grant_read_context',
  '40000000-0000-4000-8000-000000000001',NULL,'30000000-0000-4000-8000-000000000097',
  'synthetic://master/decision-1',now()-interval '1 hour',now()+interval '1 day');
-- Revocation decision is recorded only after the targeted grant exists.

SET ROLE f12_grant_executor;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000098',false);
DO $$
BEGIN
 BEGIN
  INSERT INTO f12_lab.read_grants
  (id,assignment_id,auth_uid,permission,granted_at,valid_from,valid_until,decision_ref,granting_actor_ref)
  VALUES('50000000-0000-4000-8000-000000000011','40000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001','read_context',now(),now(),NULL,
  '80000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000098');
  RAISE EXCEPTION 'WRITER_FORGERY_ALLOWED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='WRITER_FORGERY_ALLOWED' THEN RAISE; END IF;
 END;
END $$;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000097',false);
INSERT INTO f12_lab.read_grants
 (id,assignment_id,auth_uid,permission,granted_at,valid_from,valid_until,decision_ref,granting_actor_ref)
VALUES('50000000-0000-4000-8000-000000000011','40000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000001','read_context',now(),now(),NULL,
 '80000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000097');
RESET ROLE;
INSERT INTO f12_lab.approved_decisions
 (id,action,assignment_id,grant_id,approved_actor_auth_uid,authoritative_source,approved_at,expires_at)
VALUES ('80000000-0000-4000-8000-000000000002','revoke_read_context',
 '40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000011',
 '30000000-0000-4000-8000-000000000097',
 'synthetic://master/decision-2',now()-interval '1 hour',now()+interval '1 day');
SET ROLE f12_grant_executor;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000098',false);
DO $revcheck$ BEGIN
 BEGIN
 UPDATE f12_lab.read_grants SET revoked_at=now(),
  revoked_by_actor_ref='30000000-0000-4000-8000-000000000098',
  revocation_decision_ref='80000000-0000-4000-8000-000000000002'
 WHERE id='50000000-0000-4000-8000-000000000011';
 IF FOUND THEN RAISE EXCEPTION 'UNAUTHORIZED_REVOKER_ALLOWED'; END IF;
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='UNAUTHORIZED_REVOKER_ALLOWED' THEN RAISE; END IF;
 END;
END $revcheck$;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000097',false);
UPDATE f12_lab.read_grants SET revoked_at=now(),
 revoked_by_actor_ref='30000000-0000-4000-8000-000000000097',
 revocation_decision_ref='80000000-0000-4000-8000-000000000002'
WHERE id='50000000-0000-4000-8000-000000000011';
RESET ROLE;
DO $$
BEGIN
 IF (SELECT count(*) FROM f12_lab.grant_history
 WHERE grant_id='50000000-0000-4000-8000-000000000011')<>2 THEN RAISE EXCEPTION 'writer history not preserved'; END IF;
 IF NOT EXISTS(SELECT 1 FROM f12_lab.grant_history WHERE event_kind='revoked'
  AND decision_ref='80000000-0000-4000-8000-000000000002'
  AND actor_ref='30000000-0000-4000-8000-000000000097') THEN RAISE EXCEPTION 'revocation actor provenance mismatch'; END IF;
END $$;

-- Expired assignment is closed (original row retained), then a new, unique
-- association of the same actor/specialty/context may be issued with a NEW ID.
UPDATE f12_lab.assignments SET status='closed',closed_at=now()
 WHERE id='40000000-0000-4000-8000-000000000005';
INSERT INTO f12_lab.assignments
 (id,specialty_id,instance_id,auth_uid,module_id,front_id,responsibility,
  local_method_ref,provenance_ref,status,valid_from,valid_until,closed_at)
SELECT '40000000-0000-4000-8000-000000000095',specialty_id,instance_id,auth_uid,
 module_id,front_id,responsibility,local_method_ref,
 'synthetic://prov/renewed','active',now(),NULL,NULL
FROM f12_lab.assignments WHERE id='40000000-0000-4000-8000-000000000005';
-- A new approval is required when an expired assignment is re-issued;
-- its old grant is retained, never reused or retroactively extended.
INSERT INTO f12_lab.approved_decisions
 (id,action,assignment_id,grant_id,approved_actor_auth_uid,authoritative_source,approved_at,expires_at)
VALUES
 ('80000000-0000-4000-8000-000000000003','grant_read_context',
  '40000000-0000-4000-8000-000000000095',NULL,'30000000-0000-4000-8000-000000000097',
  'synthetic://master/decision-3',now()-interval '1 hour',now()+interval '1 day');
SET ROLE f12_grant_executor;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000097',false);
INSERT INTO f12_lab.read_grants
 (id,assignment_id,auth_uid,permission,granted_at,valid_from,valid_until,decision_ref,granting_actor_ref)
VALUES
 ('50000000-0000-4000-8000-000000000012','40000000-0000-4000-8000-000000000095',
  '30000000-0000-4000-8000-000000000004','read_context',now(),now(),NULL,
  '80000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000097');
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000004',false);
DO $renewcheck$ BEGIN
 IF (SELECT count(*) FROM f12_lab.context_cards)<>1 THEN
 RAISE EXCEPTION 'renewed identity must only see newly approved NUC scope'; END IF;
END $renewcheck$;
RESET ROLE;
DO $replaycheck$
BEGIN
 IF (SELECT count(*) FROM f12_lab.read_grants
  WHERE auth_uid='30000000-0000-4000-8000-000000000004')<>2 THEN
  RAISE EXCEPTION 'expired grant history not retained on reissue'; END IF;
 IF (SELECT count(*) FROM f12_lab.grant_history
  WHERE grant_id='50000000-0000-4000-8000-000000000012' AND event_kind='granted')<>1 THEN
  RAISE EXCEPTION 'new grant has no independent audit event'; END IF;
 BEGIN
  INSERT INTO f12_lab.read_grants
  (id,assignment_id,auth_uid,permission,granted_at,valid_from,valid_until,decision_ref,granting_actor_ref)
  VALUES('50000000-0000-4000-8000-000000000013',
   '40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',
   'read_context',now(),now(),NULL,'80000000-0000-4000-8000-000000000001',
   '30000000-0000-4000-8000-000000000097');
  RAISE EXCEPTION 'REPLAYED_DECISION_ALLOWED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='REPLAYED_DECISION_ALLOWED' THEN RAISE; END IF; END;
END $replaycheck$;
DO $historycheck$
BEGIN
 IF (SELECT count(*) FROM f12_lab.assignments
  WHERE instance_id='20000000-0000-4000-8000-000000000004')<>2 THEN RAISE EXCEPTION 'assignment history lost'; END IF;
 IF (SELECT count(*) FROM f12_lab.assignments
  WHERE instance_id='20000000-0000-4000-8000-000000000004' AND status='active')<>1 THEN RAISE EXCEPTION 'renewal status invalid'; END IF;
 IF (SELECT count(*) FROM f12_lab.grant_history WHERE grant_id='50000000-0000-4000-8000-000000000005')<>1 THEN RAISE EXCEPTION 'expired grant history disappeared'; END IF;
 RAISE NOTICE 'PASS security followup F1/F2: M3 reparent fail-closed, trusted executor, source approval, revocation, renewal, immutable history';
END $historycheck$;
