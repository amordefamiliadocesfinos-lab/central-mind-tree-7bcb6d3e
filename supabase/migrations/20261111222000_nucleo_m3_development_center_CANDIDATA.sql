-- Núcleo 2.0 M3 — Central Visual de Desenvolvimento (proposta aditiva)
-- Mapa Mestre V1.0: hierarquia, responsável, status, prioridades, histórico e dependências.
-- Não cria segundo Núcleo, não altera documentos existentes ou fontes externas.
BEGIN;
DO $gate$
BEGIN
 IF to_regclass('public.nucleo_source_references') IS NULL OR
  to_regprocedure('public.nucleo_reject_delete_guard()') IS NULL THEN
   RAISE EXCEPTION 'M3 requires approved M1 and M2 foundation';
 END IF;
END $gate$;

CREATE TABLE public.nucleo_development_workstreams (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z][A-Z0-9]{0,11}(-[A-Z0-9]{1,12})*$'),
 parent_id uuid REFERENCES public.nucleo_development_workstreams(id) ON DELETE RESTRICT,
 title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 180),
 description text NOT NULL DEFAULT '',
 kind text NOT NULL CHECK (kind IN ('modulo','frente','subfrente')),
 status text NOT NULL DEFAULT 'planejado' CHECK (status IN
   ('planejado','em_andamento','bloqueado','em_validacao','concluido')),
 priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('baixa','normal','alta','critica')),
 specialist text NOT NULL DEFAULT '',
 next_action text NOT NULL DEFAULT '',
 acceptance_criteria text NOT NULL DEFAULT '',
 blocker text NOT NULL DEFAULT '',
 evidence_state text NOT NULL DEFAULT 'sem_evidencia' CHECK (evidence_state IN
   ('sem_evidencia','relatada','comprovada')),
 evidence_note text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 created_by_auth_uid uuid,
 updated_by_auth_uid uuid,
 CONSTRAINT nucleo_no_self_parent CHECK (parent_id IS NULL OR id <> parent_id),
 CONSTRAINT nucleo_kind_parent_shape CHECK (
   (kind='modulo' AND parent_id IS NULL)
   OR (kind IN ('frente','subfrente') AND parent_id IS NOT NULL)
 ),
 CONSTRAINT nucleo_concluded_requires_evidence CHECK (
   status <> 'concluido' OR (evidence_state='comprovada' AND length(trim(evidence_note)) > 0)
 ),
 CONSTRAINT nucleo_blocked_requires_reason CHECK (
   status <> 'bloqueado' OR length(trim(blocker)) > 0
 )
);
CREATE INDEX nucleo_development_parent_idx ON public.nucleo_development_workstreams(parent_id,code);

CREATE TABLE public.nucleo_development_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workstream_id uuid NOT NULL REFERENCES public.nucleo_development_workstreams(id) ON DELETE RESTRICT,
 event_type text NOT NULL CHECK(event_type IN ('criado','alterado')),
 before_state jsonb,
 after_state jsonb NOT NULL,
 actor_auth_uid uuid,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX nucleo_development_events_item_idx ON public.nucleo_development_events(workstream_id,recorded_at DESC);

CREATE TABLE public.nucleo_development_dependencies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workstream_id uuid NOT NULL REFERENCES public.nucleo_development_workstreams(id) ON DELETE RESTRICT,
 depends_on_id uuid NOT NULL REFERENCES public.nucleo_development_workstreams(id) ON DELETE RESTRICT,
 description text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 created_by_auth_uid uuid,
 CHECK(workstream_id<>depends_on_id),
 UNIQUE(workstream_id,depends_on_id)
);

CREATE FUNCTION public.nucleo_m3_workstream_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE parent_kind text;
BEGIN
 IF TG_OP='UPDATE' THEN
   IF NEW.id IS DISTINCT FROM OLD.id OR NEW.code IS DISTINCT FROM OLD.code
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.created_by_auth_uid IS DISTINCT FROM OLD.created_by_auth_uid
    OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
     RAISE EXCEPTION 'M3 identity fields immutable';
   END IF;
 END IF;
 IF NEW.parent_id IS NOT NULL THEN
   SELECT kind INTO parent_kind FROM public.nucleo_development_workstreams WHERE id=NEW.parent_id;
   IF parent_kind IS NULL
     OR (NEW.kind='frente' AND parent_kind<>'modulo')
     OR (NEW.kind='subfrente' AND parent_kind<>'frente') THEN
      RAISE EXCEPTION 'M3 invalid parent hierarchy';
   END IF;
 END IF;
 NEW.updated_at=now();
 NEW.updated_by_auth_uid=auth.uid();
 IF TG_OP='INSERT' THEN NEW.created_by_auth_uid=auth.uid(); END IF;
 RETURN NEW;
END $fn$;

CREATE FUNCTION public.nucleo_m3_workstream_event()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
BEGIN
 INSERT INTO public.nucleo_development_events(workstream_id,event_type,before_state,after_state,actor_auth_uid)
 VALUES(NEW.id, CASE WHEN TG_OP='INSERT' THEN 'criado' ELSE 'alterado' END,
        CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END, to_jsonb(NEW), auth.uid());
 RETURN NULL;
END $fn$;

-- Dependências podem ser declaradas, mas um ciclo A -> B -> A não representa
-- um caminho executável. O grafo é preservado, sem reescrever registros.
CREATE FUNCTION public.nucleo_m3_dependency_cycle_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $cycle$
BEGIN
 IF NEW.workstream_id=NEW.depends_on_id THEN RAISE EXCEPTION 'M3 self dependency forbidden'; END IF;
 IF EXISTS (
   WITH RECURSIVE reachable(id) AS (
     SELECT d.depends_on_id FROM public.nucleo_development_dependencies d
      WHERE d.workstream_id=NEW.depends_on_id
     UNION
     SELECT d.depends_on_id FROM public.nucleo_development_dependencies d
      JOIN reachable r ON d.workstream_id=r.id
   )
   SELECT 1 FROM reachable WHERE id=NEW.workstream_id
 ) THEN RAISE EXCEPTION 'M3 dependency cycle forbidden'; END IF;
 RETURN NEW;
END $cycle$;

CREATE TRIGGER nucleo_m3_dependency_acyclic BEFORE INSERT
 ON public.nucleo_development_dependencies FOR EACH ROW
 EXECUTE FUNCTION public.nucleo_m3_dependency_cycle_guard();

CREATE TRIGGER nucleo_m3_workstream_before BEFORE INSERT OR UPDATE
 ON public.nucleo_development_workstreams FOR EACH ROW EXECUTE FUNCTION public.nucleo_m3_workstream_audit();
CREATE TRIGGER nucleo_m3_workstream_history AFTER INSERT OR UPDATE
 ON public.nucleo_development_workstreams FOR EACH ROW EXECUTE FUNCTION public.nucleo_m3_workstream_event();
CREATE TRIGGER nucleo_m3_workstream_no_delete BEFORE DELETE
 ON public.nucleo_development_workstreams FOR EACH ROW EXECUTE FUNCTION public.nucleo_reject_delete_guard();
CREATE TRIGGER nucleo_m3_events_no_change BEFORE UPDATE OR DELETE
 ON public.nucleo_development_events FOR EACH ROW EXECUTE FUNCTION public.nucleo_revisions_immutable_guard();
CREATE TRIGGER nucleo_m3_dependencies_no_delete BEFORE DELETE
 ON public.nucleo_development_dependencies FOR EACH ROW EXECUTE FUNCTION public.nucleo_reject_delete_guard();

ALTER TABLE public.nucleo_development_workstreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nucleo_development_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nucleo_development_dependencies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nucleo_development_workstreams,public.nucleo_development_events,
 public.nucleo_development_dependencies FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.nucleo_development_workstreams TO authenticated,service_role;
GRANT SELECT,INSERT ON public.nucleo_development_events,public.nucleo_development_dependencies
 TO authenticated,service_role;

CREATE POLICY nucleo_m3_workstreams_read ON public.nucleo_development_workstreams
FOR SELECT TO authenticated USING (EXISTS (
 SELECT 1 FROM public.app_admin_capabilities c WHERE c.auth_user_id=(SELECT auth.uid())
 AND c.capability='nucleo_manage' AND c.active AND c.revoked_at IS NULL));
CREATE POLICY nucleo_m3_workstreams_create ON public.nucleo_development_workstreams
FOR INSERT TO authenticated WITH CHECK (EXISTS (
 SELECT 1 FROM public.app_admin_capabilities c WHERE c.auth_user_id=(SELECT auth.uid())
 AND c.capability='nucleo_manage' AND c.active AND c.revoked_at IS NULL));
CREATE POLICY nucleo_m3_workstreams_edit ON public.nucleo_development_workstreams
FOR UPDATE TO authenticated USING (EXISTS (
 SELECT 1 FROM public.app_admin_capabilities c WHERE c.auth_user_id=(SELECT auth.uid())
 AND c.capability='nucleo_manage' AND c.active AND c.revoked_at IS NULL))
WITH CHECK (EXISTS (
 SELECT 1 FROM public.app_admin_capabilities c WHERE c.auth_user_id=(SELECT auth.uid())
 AND c.capability='nucleo_manage' AND c.active AND c.revoked_at IS NULL));

CREATE POLICY nucleo_m3_events_read ON public.nucleo_development_events
FOR SELECT TO authenticated USING (EXISTS (
 SELECT 1 FROM public.app_admin_capabilities c WHERE c.auth_user_id=(SELECT auth.uid())
 AND c.capability='nucleo_manage' AND c.active AND c.revoked_at IS NULL));
CREATE POLICY nucleo_m3_events_insert ON public.nucleo_development_events
FOR INSERT TO authenticated WITH CHECK (
 pg_trigger_depth() > 0
 AND actor_auth_uid=(SELECT auth.uid())
 AND EXISTS (
 SELECT 1 FROM public.app_admin_capabilities c WHERE c.auth_user_id=(SELECT auth.uid())
 AND c.capability='nucleo_manage' AND c.active AND c.revoked_at IS NULL));

CREATE POLICY nucleo_m3_dependencies_read ON public.nucleo_development_dependencies
FOR SELECT TO authenticated USING (EXISTS (
 SELECT 1 FROM public.app_admin_capabilities c WHERE c.auth_user_id=(SELECT auth.uid())
 AND c.capability='nucleo_manage' AND c.active AND c.revoked_at IS NULL));
CREATE POLICY nucleo_m3_dependencies_insert ON public.nucleo_development_dependencies
FOR INSERT TO authenticated WITH CHECK (EXISTS (
 SELECT 1 FROM public.app_admin_capabilities c WHERE c.auth_user_id=(SELECT auth.uid())
 AND c.capability='nucleo_manage' AND c.active AND c.revoked_at IS NULL));

COMMIT;
