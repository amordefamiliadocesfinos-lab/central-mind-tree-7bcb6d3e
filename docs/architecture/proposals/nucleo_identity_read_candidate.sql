-- CANDIDATA NÃO APLICAR EM PRODUÇÃO. Fora de supabase/migrations.
-- Extração read-only de #1004 (28aade88): N:N, escopo explícito, prazo,
-- revogação, proveniência. Nenhum writer G2, backfill ou grant produtivo.
-- Executar somente em PostgreSQL descartável após bootstrap dos contratos Core.
BEGIN;
DO $$BEGIN
 IF current_setting('nucleo.identity_candidate_disposable',true) IS DISTINCT FROM 'on' THEN
  RAISE EXCEPTION 'DISPOSABLE_ONLY: explicit laboratory guard required'; END IF;
END $$;
CREATE SCHEMA nucleo_identity;
REVOKE ALL ON SCHEMA nucleo_identity FROM PUBLIC;
GRANT USAGE ON SCHEMA nucleo_identity TO authenticated;
CREATE TABLE nucleo_identity.specialties (
 id uuid PRIMARY KEY, stable_code text NOT NULL UNIQUE
 CHECK(stable_code ~ '^[a-z][a-z0-9-]{2,63}$'),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 3 AND 180),
 general_method_ref text NOT NULL CHECK(length(btrim(general_method_ref))>=8),
 provenance_ref text NOT NULL CHECK(length(btrim(provenance_ref))>=8)
);
CREATE TABLE nucleo_identity.instances (
 id uuid PRIMARY KEY, auth_uid uuid NOT NULL,
 functional_label text NOT NULL, identity_source text NOT NULL,
 UNIQUE(id,auth_uid)
);
CREATE TABLE nucleo_identity.assignments (
 id uuid PRIMARY KEY,
 specialty_id uuid NOT NULL REFERENCES nucleo_identity.specialties(id),
 instance_id uuid NOT NULL, auth_uid uuid NOT NULL,
 module_id uuid NOT NULL REFERENCES public.nucleo_development_workstreams(id),
 front_id uuid REFERENCES public.nucleo_development_workstreams(id),
 responsibility text NOT NULL CHECK(responsibility IN ('primary','collaborator')),
 local_method_ref text, provenance_ref text NOT NULL CHECK(length(btrim(provenance_ref))>=8),
 valid_from timestamptz NOT NULL, valid_until timestamptz,
 closed_at timestamptz,
 CHECK(valid_until IS NULL OR valid_until>valid_from),
 FOREIGN KEY(instance_id,auth_uid) REFERENCES nucleo_identity.instances(id,auth_uid),
 UNIQUE(id,auth_uid)
);
CREATE UNIQUE INDEX identity_active_assignment ON nucleo_identity.assignments
 (specialty_id,instance_id,module_id,front_id,responsibility) NULLS NOT DISTINCT
 WHERE closed_at IS NULL;
CREATE TABLE nucleo_identity.read_grants (
 id uuid PRIMARY KEY, assignment_id uuid NOT NULL, auth_uid uuid NOT NULL,
 scope_kind text NOT NULL CHECK(scope_kind IN ('front','module')),
 valid_from timestamptz NOT NULL, valid_until timestamptz NOT NULL,
 decision_ref text NOT NULL UNIQUE CHECK(length(btrim(decision_ref))>=8),
 actor_ref text NOT NULL CHECK(length(btrim(actor_ref))>=8),
 revoked_at timestamptz, revocation_ref text, revoked_by_actor_ref text,
 CHECK(valid_until>valid_from),
 CHECK((revoked_at IS NULL)=(revocation_ref IS NULL)),
 CHECK((revoked_at IS NULL AND revoked_by_actor_ref IS NULL) OR
  (revoked_at IS NOT NULL AND length(btrim(coalesce(revoked_by_actor_ref,'')))>=8)),
 FOREIGN KEY(assignment_id,auth_uid) REFERENCES nucleo_identity.assignments(id,auth_uid)
);
CREATE UNIQUE INDEX identity_one_live_grant ON nucleo_identity.read_grants(assignment_id)
 WHERE revoked_at IS NULL;
-- References point to existing writers/records. This is NOT a knowledge library.
-- Only reviewed labels are projected; original bodies/authorship stay in Core.
CREATE TABLE nucleo_identity.references (
 id uuid PRIMARY KEY,
 assignment_id uuid NOT NULL REFERENCES nucleo_identity.assignments(id),
 contribution_id uuid REFERENCES public.nucleo_specialist_contributions(id),
 fm_id uuid REFERENCES public.nucleo_module_knowledge_revisions(id),
 evidence_id uuid REFERENCES public.nucleo_development_evidence(id),
 event_id uuid REFERENCES public.nucleo_development_events(id),
 label text NOT NULL CHECK(length(btrim(label)) BETWEEN 3 AND 200),
 source_ref text NOT NULL CHECK(length(btrim(source_ref))>=8),
 review_ref text NOT NULL CHECK(length(btrim(review_ref))>=8),
 reviewed_by_auth_uid uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
 CHECK(num_nonnulls(contribution_id,fm_id,evidence_id,event_id)=1)
);
CREATE UNIQUE INDEX identity_reference_once ON nucleo_identity.references
 (assignment_id,contribution_id,fm_id,evidence_id,event_id) NULLS NOT DISTINCT;
CREATE FUNCTION nucleo_identity.check_assignment() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.nucleo_development_workstreams
   WHERE id=NEW.module_id AND kind='modulo') THEN
  RAISE EXCEPTION 'IDENTITY_MODULE_REQUIRED'; END IF;
 IF NEW.front_id IS NOT NULL AND NOT EXISTS(
  WITH RECURSIVE ancestors AS (
   SELECT id,parent_id,kind FROM public.nucleo_development_workstreams WHERE id=NEW.front_id
   UNION SELECT w.id,w.parent_id,w.kind FROM public.nucleo_development_workstreams w
    JOIN ancestors a ON w.id=a.parent_id
  ) SELECT 1 FROM ancestors WHERE id=NEW.module_id
 ) THEN RAISE EXCEPTION 'IDENTITY_CONTEXT_MISMATCH'; END IF;
 IF NEW.front_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.nucleo_development_workstreams
  WHERE id=NEW.front_id AND kind IN ('frente','subfrente')) THEN
  RAISE EXCEPTION 'IDENTITY_FRONT_REQUIRED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER identity_context BEFORE INSERT ON nucleo_identity.assignments
 FOR EACH ROW EXECUTE FUNCTION nucleo_identity.check_assignment();
CREATE FUNCTION nucleo_identity.check_grant() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM nucleo_identity.assignments a
  WHERE a.id=NEW.assignment_id AND a.auth_uid=NEW.auth_uid AND a.closed_at IS NULL
   AND NEW.valid_from>=a.valid_from AND (a.valid_until IS NULL OR NEW.valid_until<=a.valid_until)
   AND ((NEW.scope_kind='front' AND a.front_id IS NOT NULL)
     OR (NEW.scope_kind='module' AND a.front_id IS NULL))) THEN
  RAISE EXCEPTION 'IDENTITY_GRANT_SCOPE_OR_PERIOD'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER identity_grant_context BEFORE INSERT ON nucleo_identity.read_grants
 FOR EACH ROW EXECUTE FUNCTION nucleo_identity.check_grant();
CREATE FUNCTION nucleo_identity.check_reference() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a nucleo_identity.assignments; matching boolean;
BEGIN
 SELECT * INTO STRICT a FROM nucleo_identity.assignments WHERE id=NEW.assignment_id;
 IF NEW.contribution_id IS NOT NULL THEN
  SELECT module_id=a.module_id AND workstream_id IS NOT DISTINCT FROM a.front_id
   INTO matching FROM public.nucleo_specialist_contributions WHERE id=NEW.contribution_id;
 ELSIF NEW.fm_id IS NOT NULL THEN
  -- FM is module-wide: never project it into a front-only grant implicitly.
  SELECT module_id=a.module_id AND a.front_id IS NULL INTO matching
   FROM public.nucleo_module_knowledge_revisions WHERE id=NEW.fm_id;
 ELSIF NEW.evidence_id IS NOT NULL THEN
  SELECT workstream_id=coalesce(a.front_id,a.module_id) INTO matching
   FROM public.nucleo_development_evidence WHERE id=NEW.evidence_id;
 ELSE
  SELECT workstream_id=coalesce(a.front_id,a.module_id) INTO matching
   FROM public.nucleo_development_events WHERE id=NEW.event_id;
 END IF;
 IF matching IS DISTINCT FROM true THEN RAISE EXCEPTION 'IDENTITY_REFERENCE_CONTEXT_MISMATCH'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER identity_reference_context BEFORE INSERT ON nucleo_identity.references
 FOR EACH ROW EXECUTE FUNCTION nucleo_identity.check_reference();
-- All records append-only except a first closure/revocation, which preserves origin.
CREATE FUNCTION nucleo_identity.history_guard() RETURNS trigger LANGUAGE plpgsql
 SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND TG_TABLE_NAME='assignments' THEN
  IF OLD.closed_at IS NULL AND NEW.closed_at IS NOT NULL
   AND (to_jsonb(NEW)-'closed_at')=(to_jsonb(OLD)-'closed_at') THEN RETURN NEW; END IF;
 ELSIF TG_OP='UPDATE' AND TG_TABLE_NAME='read_grants' THEN
  IF OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL
   AND length(btrim(NEW.revocation_ref))>=8
   AND (to_jsonb(NEW)-ARRAY['revoked_at','revocation_ref','revoked_by_actor_ref'])=
       (to_jsonb(OLD)-ARRAY['revoked_at','revocation_ref','revoked_by_actor_ref']) THEN RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'IDENTITY_HISTORY_IMMUTABLE';
END $$;
DO $$DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['specialties','instances','assignments','read_grants','references'] LOOP
  EXECUTE format('ALTER TABLE nucleo_identity.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON nucleo_identity.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT SELECT ON nucleo_identity.%I TO authenticated',t);
  EXECUTE format('CREATE TRIGGER identity_history BEFORE UPDATE OR DELETE ON nucleo_identity.%I
   FOR EACH ROW EXECUTE FUNCTION nucleo_identity.history_guard()',t);
 END LOOP;
END $$;
CREATE POLICY identity_assignment_self ON nucleo_identity.assignments FOR SELECT TO authenticated
 USING(auth_uid=(SELECT auth.uid()) AND closed_at IS NULL
  AND valid_from<=now() AND (valid_until IS NULL OR now()<valid_until)
  AND EXISTS(SELECT 1 FROM nucleo_identity.read_grants g
   WHERE g.assignment_id=assignments.id AND g.auth_uid=assignments.auth_uid
    AND g.revoked_at IS NULL AND g.valid_from<=now() AND now()<g.valid_until
    AND ((g.scope_kind='front' AND assignments.front_id IS NOT NULL)
      OR (g.scope_kind='module' AND assignments.front_id IS NULL))));
CREATE POLICY identity_instance_self ON nucleo_identity.instances FOR SELECT TO authenticated
 USING(auth_uid=(SELECT auth.uid()));
CREATE POLICY identity_grant_self ON nucleo_identity.read_grants FOR SELECT TO authenticated
 USING(auth_uid=(SELECT auth.uid()));
CREATE FUNCTION nucleo_identity.may_read(assignment uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(
  SELECT 1 FROM nucleo_identity.assignments a JOIN nucleo_identity.read_grants g
   ON g.assignment_id=a.id AND g.auth_uid=a.auth_uid
  WHERE a.id=assignment AND a.auth_uid=auth.uid() AND a.closed_at IS NULL
   AND a.valid_from<=now() AND (a.valid_until IS NULL OR now()<a.valid_until)
   AND g.revoked_at IS NULL AND g.valid_from<=now() AND now()<g.valid_until
   AND ((g.scope_kind='front' AND a.front_id IS NOT NULL)
     OR (g.scope_kind='module' AND a.front_id IS NULL)))
$$;
CREATE POLICY identity_specialty_scoped ON nucleo_identity.specialties FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM nucleo_identity.assignments a
   WHERE a.specialty_id=specialties.id AND nucleo_identity.may_read(a.id)));
CREATE POLICY identity_reference_scoped ON nucleo_identity.references FOR SELECT TO authenticated
 USING(nucleo_identity.may_read(assignment_id));
-- Invoker RPC: PostgREST verifies JWT; RLS remains effective. No global manage.
CREATE FUNCTION public.nucleo_identity_context_read(assignment_id uuid) RETURNS jsonb
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('contract','nucleo_identity_context_v1',
  'checked_at',now(),'valid_until',least(g.valid_until,coalesce(a.valid_until,g.valid_until)),
  'assignment_id',a.id,'auth_uid',a.auth_uid,'instance_id',a.instance_id,
  'specialty_id',s.id,'specialty_code',s.stable_code,'specialty_title',s.title,
  'module_id',a.module_id,'front_id',a.front_id,'responsibility',a.responsibility,
  'general_method_ref',s.general_method_ref,'local_method_ref',a.local_method_ref,
  'provenance_ref',a.provenance_ref,'authority','consultivo_sem_mandato',
  'references',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id',r.id,'contribution_id',r.contribution_id,'fm_id',r.fm_id,
    'evidence_id',r.evidence_id,'event_id',r.event_id,'label',r.label,'source_ref',r.source_ref))
   FROM nucleo_identity.references r WHERE r.assignment_id=a.id),'[]'::jsonb))
 FROM nucleo_identity.assignments a JOIN nucleo_identity.specialties s ON s.id=a.specialty_id
 JOIN nucleo_identity.read_grants g ON g.assignment_id=a.id AND g.auth_uid=a.auth_uid
 WHERE a.id=$1 AND nucleo_identity.may_read(a.id) AND g.revoked_at IS NULL
  AND g.valid_from<=now() AND now()<g.valid_until
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA nucleo_identity FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION nucleo_identity.may_read(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.nucleo_identity_context_read(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.nucleo_identity_context_read(uuid) TO authenticated;
CREATE FUNCTION public.nucleo_identity_assignments_read(module_id uuid) RETURNS jsonb
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('assignment_id',a.id,
  'specialty_title',s.title,'front_id',a.front_id,'responsibility',a.responsibility)), '[]'::jsonb)
 FROM nucleo_identity.assignments a JOIN nucleo_identity.specialties s ON s.id=a.specialty_id
 WHERE a.module_id=$1 AND nucleo_identity.may_read(a.id)
$$;
REVOKE ALL ON FUNCTION public.nucleo_identity_assignments_read(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.nucleo_identity_assignments_read(uuid) TO authenticated;
COMMIT;
