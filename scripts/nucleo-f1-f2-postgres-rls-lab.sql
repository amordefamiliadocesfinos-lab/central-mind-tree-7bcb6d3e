-- Núcleo 2.0 V1.3 + Continuidade V1.1 / F1+F2
-- PostgreSQL descartável, não aplicar em Lovable Cloud nem em migrations.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA auth;
CREATE SCHEMA lab;
DO $roles$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
END $roles$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
 AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
GRANT USAGE ON SCHEMA auth,lab TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

CREATE TABLE lab.modules (code text PRIMARY KEY);
CREATE TABLE lab.specialties (code text PRIMARY KEY, general_method_source text NOT NULL);
CREATE TABLE lab.specialist_instances (id uuid PRIMARY KEY, label text NOT NULL);
CREATE TABLE lab.owner_manage (
 auth_uid uuid PRIMARY KEY,
 active boolean NOT NULL,
 revoked_at timestamptz
);
CREATE TABLE lab.assignments (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 auth_uid uuid NOT NULL REFERENCES lab.specialist_instances(id),
 module_code text NOT NULL REFERENCES lab.modules(code),
 specialty_code text NOT NULL REFERENCES lab.specialties(code),
 role text NOT NULL CHECK(role IN ('primary','collaborator')),
 action text NOT NULL CHECK(action='read_context'),
 local_method_source text NOT NULL,
 active boolean NOT NULL DEFAULT true,
 valid_from timestamptz NOT NULL,
 valid_until timestamptz,
 revoked_at timestamptz,
 UNIQUE (auth_uid,module_code,specialty_code,role),
 CHECK(valid_until IS NULL OR valid_from<valid_until)
);
-- Projeção mínima consultiva; dados privados e corpos dos documentos ficam fora.
CREATE TABLE lab.context_read (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 module_code text NOT NULL REFERENCES lab.modules(code),
 specialty_code text NOT NULL REFERENCES lab.specialties(code),
 front_code text NOT NULL,
 checkpoint_label text NOT NULL,
 UNIQUE(module_code,specialty_code,front_code)
);
ALTER TABLE lab.owner_manage ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab.context_read ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON lab.owner_manage,lab.assignments,lab.context_read TO authenticated;
CREATE POLICY owner_own ON lab.owner_manage FOR SELECT TO authenticated
 USING(auth_uid=(SELECT auth.uid()));
CREATE POLICY assignments_own ON lab.assignments FOR SELECT TO authenticated
 USING(auth_uid=(SELECT auth.uid()));
CREATE POLICY context_scoped_read ON lab.context_read FOR SELECT TO authenticated USING (
 EXISTS(
  SELECT 1 FROM lab.owner_manage m
  WHERE m.auth_uid=(SELECT auth.uid()) AND m.active AND m.revoked_at IS NULL
 )
 OR EXISTS(
  SELECT 1 FROM lab.assignments a
  WHERE a.auth_uid=(SELECT auth.uid())
    AND a.module_code=context_read.module_code
    AND a.specialty_code=context_read.specialty_code
    AND a.action='read_context' AND a.active AND a.revoked_at IS NULL
    AND a.valid_from<=now() AND (a.valid_until IS NULL OR now()<a.valid_until)
 )
);
-- Fixture exclusivamente sintética; nenhuma pessoa ou permissão do projeto real.
INSERT INTO lab.modules VALUES ('NUC'),('CRM');
INSERT INTO lab.specialties VALUES
 ('gov-nuc','synthetic://method/general/governance'),
 ('security-review','synthetic://method/general/security'),
 ('ux-review','synthetic://method/general/ux');
INSERT INTO lab.specialist_instances VALUES
 ('00000000-0000-4000-8000-000000000001','actor-A'),
 ('00000000-0000-4000-8000-000000000002','actor-B'),
 ('00000000-0000-4000-8000-000000000003','actor-C'),
 ('00000000-0000-4000-8000-000000000004','actor-D'),
 ('00000000-0000-4000-8000-000000000005','actor-E'),
 ('00000000-0000-4000-8000-000000000099','owner-fixture');
INSERT INTO lab.owner_manage VALUES
 ('00000000-0000-4000-8000-000000000099',true,null);
INSERT INTO lab.assignments
 (auth_uid,module_code,specialty_code,role,action,local_method_source,active,valid_from,valid_until,revoked_at)
 VALUES
 ('00000000-0000-4000-8000-000000000001','NUC','gov-nuc','primary','read_context','synthetic://nuc/general-adapt',true,now()-interval '1 day',null,null),
 ('00000000-0000-4000-8000-000000000001','CRM','gov-nuc','primary','read_context','synthetic://crm/general-adapt',true,now()-interval '1 day',null,null),
 ('00000000-0000-4000-8000-000000000002','NUC','security-review','collaborator','read_context','synthetic://nuc/sec',true,now()-interval '1 day',null,null),
 ('00000000-0000-4000-8000-000000000003','NUC','ux-review','collaborator','read_context','synthetic://nuc/ux',true,now()-interval '1 day',null,null),
 ('00000000-0000-4000-8000-000000000004','NUC','gov-nuc','collaborator','read_context','synthetic://nuc/expired',true,now()-interval '4 day',now()-interval '1 day',null),
 ('00000000-0000-4000-8000-000000000005','CRM','gov-nuc','collaborator','read_context','synthetic://crm/revoked',true,now()-interval '2 day',null,now()-interval '1 day');
INSERT INTO lab.context_read(module_code,specialty_code,front_code,checkpoint_label) VALUES
 ('NUC','gov-nuc','NUC-M3','synthetic checkpoint governance'),
 ('NUC','security-review','NUC-M3','synthetic checkpoint security'),
 ('NUC','ux-review','NUC-M3','synthetic checkpoint ux'),
 ('CRM','gov-nuc','CRM-M3','synthetic checkpoint crm');
DO $$
DECLARE total integer; sharing integer; actors integer; methods integer;
BEGIN
 SELECT count(DISTINCT auth_uid) INTO actors FROM lab.assignments
  WHERE module_code='NUC' AND active AND revoked_at IS NULL AND valid_until IS NULL;
 IF actors<>3 THEN RAISE EXCEPTION 'F2: expected exactly 3 active synthetic instances in NUC, got %',actors; END IF;
 SELECT count(DISTINCT module_code) INTO sharing FROM lab.assignments WHERE specialty_code='gov-nuc' AND auth_uid='00000000-0000-4000-8000-000000000001';
 IF sharing<>2 THEN RAISE EXCEPTION 'F2: shared specialty must serve 2 modules'; END IF;
 SELECT count(DISTINCT local_method_source) INTO methods FROM lab.assignments WHERE specialty_code='gov-nuc' AND auth_uid='00000000-0000-4000-8000-000000000001';
 IF methods<>2 THEN RAISE EXCEPTION 'F2: contextual methods must be distinct'; END IF;
 SELECT count(*) INTO total FROM lab.specialties WHERE code='gov-nuc';
 IF total<>1 THEN RAISE EXCEPTION 'F2: a general method must not be duplicated'; END IF;
 IF has_table_privilege('authenticated','lab.specialties','SELECT') OR
    has_table_privilege('authenticated','lab.specialist_instances','SELECT') OR
    has_table_privilege('authenticated','lab.context_read','INSERT') OR
    has_table_privilege('authenticated','lab.context_read','UPDATE') OR
    has_table_privilege('authenticated','lab.context_read','DELETE') OR
    has_table_privilege('authenticated','lab.assignments','UPDATE') OR
    has_table_privilege('anon','lab.context_read','SELECT')
 THEN RAISE EXCEPTION 'F1: leaked privileged table permission'; END IF;
END $$;
COMMIT;
-- Each SET ROLE emulates *only* the database role of a separately verified
-- JWT user. The GUC is controlled by the fixture, not by a production caller.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
DO $$BEGIN
 IF (SELECT count(*) FROM lab.context_read)<>2 THEN RAISE EXCEPTION 'actor-A must see precisely two scoped checkpoints'; END IF;
 IF (SELECT count(*) FROM lab.context_read WHERE specialty_code='security-review')<>0 THEN RAISE EXCEPTION 'cross-specialty access'; END IF;
 IF (SELECT count(*) FROM lab.context_read WHERE module_code='CRM' AND specialty_code='gov-nuc')<>1 THEN RAISE EXCEPTION 'shared method CRM context invisible'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
DO $$BEGIN
 IF (SELECT count(*) FROM lab.context_read)<>1 THEN RAISE EXCEPTION 'actor-B should only see security NUC'; END IF;
 IF (SELECT count(*) FROM lab.context_read WHERE specialty_code='gov-nuc')<>0 THEN RAISE EXCEPTION 'actor-B leaked governance'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
DO $$BEGIN
 IF (SELECT count(*) FROM lab.context_read)<>1 THEN RAISE EXCEPTION 'actor-C should only see UX NUC'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',false);
DO $$BEGIN
 IF (SELECT count(*) FROM lab.context_read)<>0 THEN RAISE EXCEPTION 'expired assignment leaked'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',false);
DO $$BEGIN
 IF (SELECT count(*) FROM lab.context_read)<>0 THEN RAISE EXCEPTION 'revoked assignment leaked'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',false);
DO $$BEGIN
 IF (SELECT count(*) FROM lab.context_read)<>4 THEN RAISE EXCEPTION 'existing admin compatibility failed'; END IF;
END $$;
-- Explicit no-session user fails closed.
SELECT set_config('request.jwt.claim.sub','',false);
DO $$BEGIN
 IF (SELECT count(*) FROM lab.context_read)<>0 THEN RAISE EXCEPTION 'unauthenticated GUC must see no rows'; END IF;
END $$;
RESET ROLE;
-- Live revocation on the isolated fixture; subsequent reads must fail.
UPDATE lab.assignments SET revoked_at=now()
 WHERE auth_uid='00000000-0000-4000-8000-000000000001' AND module_code='NUC' AND specialty_code='gov-nuc';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
DO $$BEGIN
 IF (SELECT count(*) FROM lab.context_read)<>1 THEN RAISE EXCEPTION 'revocation must take effect on next read without changing CRM'; END IF;
 IF (SELECT count(*) FROM lab.context_read WHERE module_code='NUC')<>0 THEN RAISE EXCEPTION 'revoked NUC grant still active'; END IF;
END $$;
RESET ROLE;
DO $$BEGIN
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='lab' AND tablename='context_read')<>1 THEN RAISE EXCEPTION 'unexpected extra RLS policy'; END IF;
 RAISE NOTICE 'PASS F1/F2 isolated PostgreSQL: N:N, method separation, auth scope, cross-module, revoked/expired, admin compatibility, zero writes, no JWT reuse';
END $$;
