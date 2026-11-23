-- F1/F2 G1->G2: audit / execution contract laboratory ONLY. Run after G1 scope test.
-- NEVER RUN ON CORE OR ANY HOSTED DATABASE.  This script uses a disposable fixture.
\set ON_ERROR_STOP on

-- The source of approvals must be separate from the executor. Fixture postgres
-- inserts an approved command; f12_grant_executor has no INSERT on decisions.
INSERT INTO f12_lab.approved_decisions
 (id, action, assignment_id, grant_id, approved_actor_auth_uid, scope_kind,
  authoritative_source, approved_at, expires_at)
VALUES
 ('80000000-0000-4000-8000-0000000000b1', 'grant_read_context',
  '40000000-0000-4000-8000-0000000000a1', NULL,
  '30000000-0000-4000-8000-000000000097', 'module',
  'synthetic://master/g2-grant', now()-interval '1 minute', now()+interval '1 day');

-- No effect in a rolled-back executor transaction, INCLUDING trigger-driven
-- audit. This deliberately makes an error in a PL/pgSQL subtransaction.
SET ROLE f12_grant_executor;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000097',false);
DO $rollback$
BEGIN
  BEGIN
    INSERT INTO f12_lab.read_grants
      (id, assignment_id, auth_uid, permission, scope_kind, granted_at,
       valid_from, valid_until, decision_ref, granting_actor_ref)
    VALUES
      ('50000000-0000-4000-8000-0000000000b0',
       '40000000-0000-4000-8000-0000000000a1',
       '30000000-0000-4000-8000-000000000001',
       'read_context','module',now(),now()-interval '1 minute',now()+interval '2 hours',
       '80000000-0000-4000-8000-0000000000b1',
       '30000000-0000-4000-8000-000000000097');
    RAISE EXCEPTION 'G2_FORCED_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'G2_FORCED_ROLLBACK' THEN RAISE; END IF;
  END;
END $rollback$;
RESET ROLE;
DO $verify0$
BEGIN
 IF EXISTS(SELECT 1 FROM f12_lab.read_grants WHERE id='50000000-0000-4000-8000-0000000000b0')
 OR EXISTS(SELECT 1 FROM f12_lab.grant_history WHERE grant_id='50000000-0000-4000-8000-0000000000b0')
 THEN RAISE EXCEPTION 'G2 failed transaction left grant or audit'; END IF;
END $verify0$;

-- Wrong executor cannot consume the approval.
SET ROLE f12_grant_executor;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000098',false);
DO $reject$
BEGIN
 BEGIN
   INSERT INTO f12_lab.read_grants
     (id,assignment_id,auth_uid,permission,scope_kind,granted_at,valid_from,
      valid_until,decision_ref,granting_actor_ref)
   VALUES ('50000000-0000-4000-8000-0000000000b1',
     '40000000-0000-4000-8000-0000000000a1',
     '30000000-0000-4000-8000-000000000001','read_context','module',
     now(),now()-interval '1 minute',now()+interval '2 hours',
     '80000000-0000-4000-8000-0000000000b1',
     '30000000-0000-4000-8000-000000000098');
   RAISE EXCEPTION 'G2_WRONG_EXECUTOR_ALLOWED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM='G2_WRONG_EXECUTOR_ALLOWED' THEN RAISE; END IF;
 END;
END $reject$;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000097',false);
INSERT INTO f12_lab.read_grants
  (id,assignment_id,auth_uid,permission,scope_kind,granted_at,valid_from,
   valid_until,decision_ref,granting_actor_ref)
VALUES ('50000000-0000-4000-8000-0000000000b1',
  '40000000-0000-4000-8000-0000000000a1',
  '30000000-0000-4000-8000-000000000001','read_context','module',
  now(),now()-interval '1 minute',now()+interval '2 hours',
  '80000000-0000-4000-8000-0000000000b1',
  '30000000-0000-4000-8000-000000000097');
-- Replays of the same approved decision must fail, even for different grant IDs.
DO $replay$
BEGIN
 BEGIN
   INSERT INTO f12_lab.read_grants
     (id,assignment_id,auth_uid,permission,scope_kind,granted_at,valid_from,
      valid_until,decision_ref,granting_actor_ref)
   VALUES ('50000000-0000-4000-8000-0000000000b2',
     '40000000-0000-4000-8000-0000000000a1',
     '30000000-0000-4000-8000-000000000001','read_context','module',
     now(),now()-interval '1 minute',now()+interval '2 hours',
     '80000000-0000-4000-8000-0000000000b1',
     '30000000-0000-4000-8000-000000000097');
   RAISE EXCEPTION 'G2_REPLAY_ALLOWED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM='G2_REPLAY_ALLOWED' THEN RAISE; END IF;
 END;
END $replay$;
RESET ROLE;

DO $inspect$
BEGIN
 IF (SELECT count(*) FROM f12_lab.read_grants
     WHERE decision_ref='80000000-0000-4000-8000-0000000000b1')<>1
 OR (SELECT count(*) FROM f12_lab.grant_history
     WHERE grant_id='50000000-0000-4000-8000-0000000000b1')<>1
 THEN RAISE EXCEPTION 'G2 grant or audit not exactly once'; END IF;
 IF has_table_privilege('f12_grant_executor','f12_lab.approved_decisions','INSERT')
 OR has_table_privilege('authenticated','f12_lab.read_grants','INSERT')
 THEN RAISE EXCEPTION 'G2 authority segregation violated'; END IF;
END $inspect$;

-- Independent competent revocation, same executor, atomic event.
INSERT INTO f12_lab.approved_decisions
 (id,action,assignment_id,grant_id,approved_actor_auth_uid,scope_kind,
  authoritative_source,approved_at,expires_at)
VALUES ('80000000-0000-4000-8000-0000000000b2','revoke_read_context',
 '40000000-0000-4000-8000-0000000000a1',
 '50000000-0000-4000-8000-0000000000b1',
 '30000000-0000-4000-8000-000000000097','module',
 'synthetic://master/g2-revoke',now()-interval '1 minute',now()+interval '1 day');
SET ROLE f12_grant_executor;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000097',false);
UPDATE f12_lab.read_grants SET revoked_at=now(),
 revoked_by_actor_ref='30000000-0000-4000-8000-000000000097',
 revocation_decision_ref='80000000-0000-4000-8000-0000000000b2'
WHERE id='50000000-0000-4000-8000-0000000000b1';
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',false);
DO $deny$
BEGIN
 IF (SELECT count(*) FROM f12_lab.context_cards
 WHERE module_id='636768e6-e782-4c7d-8132-e7381621be12')<>0
 THEN RAISE EXCEPTION 'G2 revocation did not close access'; END IF;
END $deny$;
RESET ROLE;
DO $done$
BEGIN
 IF (SELECT count(*) FROM f12_lab.grant_history
     WHERE grant_id='50000000-0000-4000-8000-0000000000b1')<>2
 THEN RAISE EXCEPTION 'G2 revocation audit missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM f12_lab.grant_history
  WHERE grant_id='50000000-0000-4000-8000-0000000000b1'
    AND event_kind='revoked'
    AND decision_ref='80000000-0000-4000-8000-0000000000b2')
 THEN RAISE EXCEPTION 'G2 incorrect revocation provenance'; END IF;
 RAISE NOTICE 'PASS G2 laboratory writer: independent decision, wrong executor denied, atomic rollback, once-only grant, separate revocation and audit';
END $done$;
