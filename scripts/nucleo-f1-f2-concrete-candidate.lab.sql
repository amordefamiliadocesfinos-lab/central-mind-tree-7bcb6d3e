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
  SELECT kind INTO front_kind FROM f12_core.workstreams WHERE id=NEW.front_id FOR SHARE;
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
 decision_ref text NOT NULL CHECK(length(btrim(decision_ref))>=8),
 granting_actor_ref text NOT NULL CHECK(length(btrim(granting_actor_ref))>=8),
 CHECK(valid_until IS NULL OR valid_until>valid_from),
 CHECK(revoked_at IS NULL OR revoked_at>=granted_at),
 FOREIGN KEY(assignment_id,auth_uid) REFERENCES f12_lab.assignments(id,auth_uid) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX f12_one_unrevoked_read_grant ON f12_lab.read_grants
 (assignment_id) WHERE revoked_at IS NULL;

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
     OR NEW.decision_ref IS DISTINCT FROM OLD.decision_ref OR NEW.granting_actor_ref IS DISTINCT FROM OLD.granting_actor_ref
     OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL THEN
   RAISE EXCEPTION 'grant is immutable except first revocation';
  END IF;
  INSERT INTO f12_lab.grant_history(grant_id,event_kind,decision_ref,actor_ref)
   VALUES(NEW.id,'revoked',NEW.decision_ref,NEW.granting_actor_ref);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER grant_insert AFTER INSERT ON f12_lab.read_grants FOR EACH ROW EXECUTE FUNCTION f12_lab.record_grant_event();
CREATE TRIGGER grant_revoke BEFORE UPDATE ON f12_lab.read_grants FOR EACH ROW EXECUTE FUNCTION f12_lab.record_grant_event();

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
