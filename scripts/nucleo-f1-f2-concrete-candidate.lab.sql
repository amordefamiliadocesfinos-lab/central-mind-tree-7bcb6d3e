-- Núcleo 2.0 F1/F2 — CANDIDATA APENAS PARA LAB POSTGRESQL DESCARTÁVEL
-- NÃO É migration. Nunca executar em xkskyutmtlhivvpfxkjg.
-- FKs apontam para um clone mínimo da assinatura M3 (f12_core.workstreams).
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA auth;
CREATE SCHEMA f12_core;
CREATE SCHEMA f12_lab;
DO $roles$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
END $roles$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
 AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth,f12_lab TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

-- A assinatura do M3 é derivada de information_schema/pg_constraint do Core.
CREATE TABLE f12_core.workstreams (
 id uuid PRIMARY KEY,
 code text NOT NULL UNIQUE,
 kind text NOT NULL CHECK(kind IN ('modulo','frente','subfrente')),
 parent_id uuid REFERENCES f12_core.workstreams(id) ON DELETE RESTRICT,
 CHECK((kind='modulo' AND parent_id IS NULL) OR (kind<>'modulo' AND parent_id IS NOT NULL))
);
-- Capacidade admin: fixture apenas para preservar contrato atual sem copiar concessões reais.
CREATE TABLE f12_core.admin_caps(
 auth_user_id uuid NOT NULL,
 capability text NOT NULL CHECK(capability='nucleo_manage'),
 active boolean NOT NULL,
 revoked_at timestamptz,
 UNIQUE(auth_user_id,capability)
);
ALTER TABLE f12_core.admin_caps ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_caps_own ON f12_core.admin_caps FOR SELECT TO authenticated
 USING(auth_user_id=(SELECT auth.uid()));
GRANT USAGE ON SCHEMA f12_core TO authenticated;
GRANT SELECT ON f12_core.admin_caps TO authenticated;

CREATE TABLE f12_lab.specialties (
 id uuid PRIMARY KEY,
 stable_code text NOT NULL UNIQUE CHECK(stable_code ~ '^[a-z][a-z0-9-]{2,63}$'),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 3 AND 180),
 general_method_ref text NOT NULL CHECK(length(btrim(general_method_ref))>=8),
 method_state text NOT NULL DEFAULT 'proposta' CHECK(method_state IN ('proposta','em_evolucao')),
 provenance_ref text NOT NULL
);
CREATE TABLE f12_lab.instances (
 id uuid PRIMARY KEY,
 auth_uid uuid UNIQUE,
 identity_source text NOT NULL CHECK(length(btrim(identity_source))>0),
 functional_label text NOT NULL,
 UNIQUE(id,auth_uid)
);
-- Assignment history is not rewritten by users. Closed entries remain visible to auditor;
-- read access is evaluated only against active state and validity.
CREATE TABLE f12_lab.assignments (
 id uuid PRIMARY KEY,
 specialty_id uuid NOT NULL REFERENCES f12_lab.specialties(id) ON DELETE RESTRICT,
 instance_id uuid NOT NULL REFERENCES f12_lab.instances(id) ON DELETE RESTRICT,
 auth_uid uuid,
 module_id uuid REFERENCES f12_core.workstreams(id) ON DELETE RESTRICT,
 front_id uuid REFERENCES f12_core.workstreams(id) ON DELETE RESTRICT,
 responsibility text NOT NULL CHECK(responsibility IN ('primary','collaborator')),
 local_method_ref text,
 provenance_ref text NOT NULL,
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed')),
 valid_from timestamptz NOT NULL,
 valid_until timestamptz,
 closed_at timestamptz,
 CHECK(front_id IS NULL OR module_id IS NOT NULL),
 CHECK(valid_until IS NULL OR valid_until>valid_from),
 CHECK((status='closed')=(closed_at IS NOT NULL)),
 FOREIGN KEY(instance_id,auth_uid) REFERENCES f12_lab.instances(id,auth_uid) ON DELETE RESTRICT,
 UNIQUE(id,auth_uid)
);
-- Only one *active* assignment per exact context; historical rows are preserved.
CREATE UNIQUE INDEX f12_assignment_live_identity ON f12_lab.assignments
  (specialty_id,instance_id,module_id,front_id,responsibility) NULLS NOT DISTINCT
  WHERE status='active';

CREATE FUNCTION f12_lab.validate_context() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE root_kind text; front_kind text; reached boolean;
BEGIN
 IF NEW.module_id IS NOT NULL THEN
  SELECT kind INTO root_kind FROM f12_core.workstreams WHERE id=NEW.module_id FOR SHARE;
  IF root_kind IS DISTINCT FROM 'modulo' THEN RAISE EXCEPTION 'module must be an existing M3 root'; END IF;
 END IF;
 IF NEW.front_id IS NOT NULL THEN
  -- Lock every ancestor so a concurrent reparent cannot slip between validation
  -- and the insert, even for nested subfronts.
  PERFORM id FROM f12_core.workstreams
   WHERE id IN (
     WITH RECURSIVE ancestors AS (
       SELECT id,parent_id FROM f12_core.workstreams WHERE id=NEW.front_id
       UNION ALL SELECT p.id,p.parent_id FROM f12_core.workstreams p
         JOIN ancestors a ON p.id=a.parent_id
     ) SELECT id FROM ancestors
   ) ORDER BY id FOR SHARE;
  SELECT kind INTO front_kind FROM f12_core.workstreams WHERE id=NEW.front_id;
  IF front_kind NOT IN ('frente','subfrente') OR front_kind IS NULL THEN
    RAISE EXCEPTION 'front must be M3 frente/subfrente';
  END IF;
  WITH RECURSIVE ancestors AS (
   SELECT id,parent_id FROM f12_core.workstreams WHERE id=NEW.front_id
   UNION ALL
   SELECT p.id,p.parent_id FROM f12_core.workstreams p JOIN ancestors a ON p.id=a.parent_id
  )
  SELECT EXISTS(SELECT 1 FROM ancestors WHERE id=NEW.module_id) INTO reached;
  IF NOT reached THEN RAISE EXCEPTION 'front belongs to a different module'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER assignments_context BEFORE INSERT OR UPDATE OF module_id,front_id
 ON f12_lab.assignments FOR EACH ROW EXECUTE FUNCTION f12_lab.validate_context();

-- Close only: historical identity, method, context, role, source and validity are immutable.
CREATE FUNCTION f12_lab.guard_assignment_history() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $guard$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.specialty_id IS DISTINCT FROM OLD.specialty_id
    OR NEW.instance_id IS DISTINCT FROM OLD.instance_id OR NEW.auth_uid IS DISTINCT FROM OLD.auth_uid
    OR NEW.module_id IS DISTINCT FROM OLD.module_id OR NEW.front_id IS DISTINCT FROM OLD.front_id
    OR NEW.responsibility IS DISTINCT FROM OLD.responsibility
    OR NEW.local_method_ref IS DISTINCT FROM OLD.local_method_ref
    OR NEW.provenance_ref IS DISTINCT FROM OLD.provenance_ref
    OR NEW.valid_from IS DISTINCT FROM OLD.valid_from
    OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
    OR OLD.status <> 'active' OR NEW.status <> 'closed'
    OR OLD.closed_at IS NOT NULL OR NEW.closed_at IS NULL THEN
  RAISE EXCEPTION 'assignment history immutable except first closure';
 END IF;
 RETURN NEW;
END $guard$;
CREATE TRIGGER assignment_history_guard BEFORE UPDATE ON f12_lab.assignments
 FOR EACH ROW EXECUTE FUNCTION f12_lab.guard_assignment_history();

-- Grant is independent from mandate. No escalation to nucleo_manage.
CREATE TABLE f12_lab.read_grants (
 id uuid PRIMARY KEY,
 assignment_id uuid NOT NULL,
 auth_uid uuid NOT NULL,
 permission text NOT NULL DEFAULT 'read_context' CHECK(permission='read_context'),
 granted_at timestamptz NOT NULL,
 valid_from timestamptz NOT NULL,
 valid_until timestamptz,
 revoked_at timestamptz,
 revoked_by_actor_ref text,
 revocation_decision_ref text,
 decision_ref text NOT NULL CHECK(length(btrim(decision_ref))>=8),
 granting_actor_ref text NOT NULL CHECK(length(btrim(granting_actor_ref))>=8),
 CHECK(valid_until IS NULL OR valid_until>valid_from),
 CHECK(revoked_at IS NULL OR revoked_at>=granted_at),
 CHECK((revoked_at IS NULL AND revoked_by_actor_ref IS NULL AND revocation_decision_ref IS NULL)
    OR (revoked_at IS NOT NULL AND length(btrim(coalesce(revoked_by_actor_ref,'')))>=8
         AND length(btrim(coalesce(revocation_decision_ref,'')))>=8)),
 FOREIGN KEY(assignment_id,auth_uid) REFERENCES f12_lab.assignments(id,auth_uid) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX f12_one_unrevoked_read_grant ON f12_lab.read_grants
 (assignment_id) WHERE revoked_at IS NULL;
-- An approved grant decision is single-use, including after revocation.
CREATE UNIQUE INDEX f12_grant_decision_once ON f12_lab.read_grants (decision_ref);

-- Append-only trail: signed decision ref + actor ref; writer credentials/authorizations
-- must be defined and reviewed in a separate gate, NOT by authenticated SQL.
CREATE TABLE f12_lab.grant_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 grant_id uuid NOT NULL REFERENCES f12_lab.read_grants(id),
 event_kind text NOT NULL CHECK(event_kind IN ('granted','revoked')),
 event_at timestamptz NOT NULL DEFAULT now(),
 decision_ref text NOT NULL,
 actor_ref text NOT NULL
);
CREATE FUNCTION f12_lab.record_grant_event() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO f12_lab.grant_history(grant_id,event_kind,decision_ref,actor_ref)
   VALUES(NEW.id,'granted',NEW.decision_ref,NEW.granting_actor_ref);
 ELSE
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
     OR NEW.auth_uid IS DISTINCT FROM OLD.auth_uid OR NEW.permission IS DISTINCT FROM OLD.permission
     OR NEW.valid_from IS DISTINCT FROM OLD.valid_from OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
     OR NEW.granted_at IS DISTINCT FROM OLD.granted_at
     OR (OLD.revoked_by_actor_ref IS NOT NULL OR OLD.revocation_decision_ref IS NOT NULL)
     OR NEW.decision_ref IS DISTINCT FROM OLD.decision_ref OR NEW.granting_actor_ref IS DISTINCT FROM OLD.granting_actor_ref
     OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL THEN
   RAISE EXCEPTION 'grant is immutable except first revocation';
  END IF;
  INSERT INTO f12_lab.grant_history(grant_id,event_kind,decision_ref,actor_ref)
   VALUES(NEW.id,'revoked',NEW.revocation_decision_ref,NEW.revoked_by_actor_ref);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER grant_insert AFTER INSERT ON f12_lab.read_grants FOR EACH ROW EXECUTE FUNCTION f12_lab.record_grant_event();
CREATE TRIGGER grant_revoke BEFORE UPDATE ON f12_lab.read_grants FOR EACH ROW EXECUTE FUNCTION f12_lab.record_grant_event();

-- Only an approved, verified, metadata-only source may generate a consultive
-- card. Source/content approval belongs to a separate competent human process.
CREATE TABLE f12_lab.approved_card_sources (
 source_ref text PRIMARY KEY,
 specialty_id uuid NOT NULL REFERENCES f12_lab.specialties(id) ON DELETE RESTRICT,
 module_id uuid NOT NULL REFERENCES f12_core.workstreams(id) ON DELETE RESTRICT,
 front_id uuid REFERENCES f12_core.workstreams(id) ON DELETE RESTRICT,
 public_label text NOT NULL CHECK(length(public_label) BETWEEN 3 AND 200),
 origin_kind text NOT NULL CHECK(origin_kind IN ('github_reference','m3_event_reference','drive_metadata')),
 verified boolean NOT NULL CHECK(verified=true),
 private_payload_included boolean NOT NULL CHECK(private_payload_included=false),
 authorization_ref text NOT NULL CHECK(length(btrim(authorization_ref))>=8)
);
-- Only sanitized, explicitly projected metadata, not original M3/M4/AC-01/FM rows.
CREATE TABLE f12_lab.context_cards (
 id uuid PRIMARY KEY,
 specialty_id uuid NOT NULL REFERENCES f12_lab.specialties(id) ON DELETE RESTRICT,
 module_id uuid NOT NULL REFERENCES f12_core.workstreams(id) ON DELETE RESTRICT,
 front_id uuid REFERENCES f12_core.workstreams(id) ON DELETE RESTRICT,
 card_type text NOT NULL CHECK(card_type IN ('checkpoint','method_ref','next_action')),
 public_label text NOT NULL CHECK(length(public_label) BETWEEN 3 AND 200),
 public_source_ref text NOT NULL,
 CHECK(front_id IS NULL OR module_id IS NOT NULL),
 UNIQUE NULLS NOT DISTINCT (specialty_id,module_id,front_id,card_type)
);
CREATE TRIGGER context_cards_scope BEFORE INSERT OR UPDATE OF module_id,front_id
 ON f12_lab.context_cards FOR EACH ROW EXECUTE FUNCTION f12_lab.validate_context();
-- An actual card must byte-match a curated/public metadata projection, rather
-- than copying raw document text or trusting user-entered descriptions.
CREATE FUNCTION f12_lab.guard_card_provenance() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $sourceguard$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM f12_lab.approved_card_sources src
  WHERE src.source_ref=NEW.public_source_ref AND src.specialty_id=NEW.specialty_id
    AND src.module_id=NEW.module_id AND src.front_id IS NOT DISTINCT FROM NEW.front_id
    AND src.public_label=NEW.public_label AND src.verified AND NOT src.private_payload_included
 ) THEN
  RAISE EXCEPTION 'context card requires matching reviewed metadata-only source';
 END IF;
 RETURN NEW;
END $sourceguard$;
CREATE TRIGGER card_provenance BEFORE INSERT OR UPDATE ON f12_lab.context_cards
 FOR EACH ROW EXECUTE FUNCTION f12_lab.guard_card_provenance();


-- M3 hierarchy hardening: conservatively refuse a reparent/kind change while any
-- descendant or root is referenced by an assignment or consultive card.
-- This is laboratory-only; productive M3 trigger integration needs separate approval.
CREATE FUNCTION f12_lab.prevent_reparent_with_live_references()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $m3guard$
BEGIN
 IF NEW.parent_id IS NOT DISTINCT FROM OLD.parent_id AND NEW.kind=OLD.kind THEN RETURN NEW; END IF;
 IF EXISTS (
   WITH RECURSIVE subtree AS (
     SELECT id FROM f12_core.workstreams WHERE id=OLD.id
     UNION ALL
     SELECT w.id FROM f12_core.workstreams w JOIN subtree s ON w.parent_id=s.id
   )
   SELECT 1 FROM subtree s
   WHERE EXISTS(SELECT 1 FROM f12_lab.assignments a
                WHERE a.module_id=s.id OR a.front_id=s.id)
      OR EXISTS(SELECT 1 FROM f12_lab.context_cards c
                WHERE c.module_id=s.id OR c.front_id=s.id)
 ) THEN
   RAISE EXCEPTION 'M3 hierarchy protected: referenced subtree cannot be reparented';
 END IF;
 RETURN NEW;
END $m3guard$;
CREATE TRIGGER m3_reparent_reference_guard BEFORE UPDATE OF parent_id,kind
 ON f12_core.workstreams FOR EACH ROW EXECUTE FUNCTION f12_lab.prevent_reparent_with_live_references();

-- Approved decisions are imported by a distinct competent authority. The writer
-- role cannot forge/create/modify these rows. All identities below are synthetic.
CREATE TABLE f12_lab.approved_decisions (
 id uuid PRIMARY KEY,
 action text NOT NULL CHECK(action IN ('grant_read_context','revoke_read_context')),
 assignment_id uuid NOT NULL REFERENCES f12_lab.assignments(id) ON DELETE RESTRICT,
 grant_id uuid REFERENCES f12_lab.read_grants(id) ON DELETE RESTRICT,
 approved_actor_auth_uid uuid NOT NULL,
 authoritative_source text NOT NULL CHECK(length(btrim(authoritative_source))>=8),
 approved_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 CHECK(expires_at>approved_at),
 CHECK((action='grant_read_context' AND grant_id IS NULL)
    OR (action='revoke_read_context' AND grant_id IS NOT NULL)),
 UNIQUE(id,action)
);
-- A writer must be a separately provisioned server-side executor. Never grant
-- this role to 'authenticated' or expose it to the client.
DO $writer_role$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='f12_grant_executor')
 THEN CREATE ROLE f12_grant_executor NOLOGIN; END IF;
END $writer_role$;
GRANT USAGE ON SCHEMA f12_lab,auth TO f12_grant_executor;
GRANT EXECUTE ON FUNCTION auth.uid() TO f12_grant_executor;
GRANT SELECT ON f12_lab.assignments, f12_lab.approved_decisions TO f12_grant_executor;
GRANT SELECT,INSERT,UPDATE (revoked_at,revoked_by_actor_ref,revocation_decision_ref)
 ON f12_lab.read_grants TO f12_grant_executor;
-- Invoker triggers require INSERT on the append-only audit table; RLS permits it
-- only from a trigger and only for matching, authoritative decision provenance.
GRANT INSERT ON f12_lab.grant_history TO f12_grant_executor;
GRANT USAGE ON SEQUENCE f12_lab.grant_history_id_seq TO f12_grant_executor;
ALTER TABLE f12_lab.approved_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY decision_for_executor ON f12_lab.approved_decisions FOR SELECT TO f12_grant_executor
 USING(approved_actor_auth_uid=(SELECT auth.uid())
   AND approved_at<=now() AND now()<expires_at);
CREATE POLICY assignments_for_executor ON f12_lab.assignments FOR SELECT TO f12_grant_executor
 USING(EXISTS(SELECT 1 FROM f12_lab.approved_decisions d
     WHERE d.assignment_id=assignments.id AND d.approved_actor_auth_uid=(SELECT auth.uid())
       AND d.approved_at<=now() AND now()<d.expires_at));
CREATE POLICY writer_grant_select ON f12_lab.read_grants FOR SELECT TO f12_grant_executor
 USING(EXISTS(SELECT 1 FROM f12_lab.approved_decisions d
  WHERE d.assignment_id=read_grants.assignment_id
    AND d.approved_actor_auth_uid=(SELECT auth.uid())
    AND d.approved_at<=now() AND now()<d.expires_at));
CREATE POLICY writer_grant_insert ON f12_lab.read_grants FOR INSERT TO f12_grant_executor
 WITH CHECK(
   EXISTS(SELECT 1 FROM f12_lab.approved_decisions d
     JOIN f12_lab.assignments a ON a.id=d.assignment_id
     WHERE d.action='grant_read_context' AND d.assignment_id=read_grants.assignment_id
       AND d.id::text=read_grants.decision_ref
       AND a.auth_uid=read_grants.auth_uid AND a.status='active'
       AND a.closed_at IS NULL AND a.valid_from<=now()
       AND (a.valid_until IS NULL OR now()<a.valid_until)
       AND read_grants.valid_from>=a.valid_from
       AND (a.valid_until IS NULL OR (read_grants.valid_until IS NOT NULL AND read_grants.valid_until<=a.valid_until))
       AND d.approved_actor_auth_uid=(SELECT auth.uid())
       AND d.approved_at<=now() AND now()<d.expires_at
       AND read_grants.granting_actor_ref=d.approved_actor_auth_uid::text)
 );
CREATE POLICY writer_grant_update ON f12_lab.read_grants FOR UPDATE TO f12_grant_executor
 USING(
   revoked_at IS NULL AND EXISTS(
     SELECT 1 FROM f12_lab.approved_decisions d
     WHERE d.action='revoke_read_context' AND d.grant_id=read_grants.id
       AND d.assignment_id=read_grants.assignment_id
       AND d.approved_actor_auth_uid=(SELECT auth.uid())
       AND d.approved_at<=now() AND now()<d.expires_at)
 )
 WITH CHECK(
   revoked_at IS NOT NULL AND revoked_by_actor_ref=(SELECT auth.uid())::text
   AND EXISTS(SELECT 1 FROM f12_lab.approved_decisions d
     WHERE d.action='revoke_read_context' AND d.grant_id=read_grants.id
       AND d.assignment_id=read_grants.assignment_id
       AND d.id::text=read_grants.revocation_decision_ref
       AND d.approved_actor_auth_uid=(SELECT auth.uid())
       AND d.approved_at<=now() AND now()<d.expires_at)
 );
CREATE POLICY trigger_only_history ON f12_lab.grant_history FOR INSERT TO f12_grant_executor
 WITH CHECK(pg_trigger_depth()>0 AND actor_ref=(SELECT auth.uid())::text
   AND EXISTS(SELECT 1 FROM f12_lab.approved_decisions d
      WHERE d.id::text=grant_history.decision_ref AND d.approved_actor_auth_uid=(SELECT auth.uid())
        AND d.approved_at<=now() AND now()<d.expires_at
        AND ((d.action='grant_read_context' AND event_kind='granted')
          OR (d.action='revoke_read_context' AND event_kind='revoked'))));


ALTER TABLE f12_lab.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE f12_lab.read_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE f12_lab.context_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE f12_lab.grant_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY assignment_self ON f12_lab.assignments FOR SELECT TO authenticated
 USING(auth_uid=(SELECT auth.uid()));
CREATE POLICY read_grants_self ON f12_lab.read_grants FOR SELECT TO authenticated
 USING(auth_uid=(SELECT auth.uid()));
CREATE POLICY scoped_context ON f12_lab.context_cards FOR SELECT TO authenticated
 USING(
  EXISTS(
   SELECT 1 FROM f12_core.admin_caps c
   WHERE c.auth_user_id=(SELECT auth.uid()) AND c.capability='nucleo_manage'
      AND c.active AND c.revoked_at IS NULL
  )
  OR EXISTS(
   SELECT 1 FROM f12_lab.read_grants g
   JOIN f12_lab.assignments a ON a.id=g.assignment_id AND a.auth_uid=g.auth_uid
   WHERE g.auth_uid=(SELECT auth.uid())
    AND a.specialty_id=context_cards.specialty_id AND a.module_id=context_cards.module_id
    AND (a.front_id IS NULL OR a.front_id=context_cards.front_id)
    AND a.status='active' AND a.closed_at IS NULL
    AND a.valid_from<=now() AND (a.valid_until IS NULL OR now()<a.valid_until)
    AND g.permission='read_context' AND g.revoked_at IS NULL
    AND g.valid_from<=now() AND (g.valid_until IS NULL OR now()<g.valid_until)
  )
 );
GRANT SELECT ON f12_lab.assignments,f12_lab.read_grants,f12_lab.context_cards TO authenticated;
-- No GRANT on specialties, instances, history, base M3/AC-01/FM/document tables.
COMMIT;
