-- Núcleo V1.3 AC-01 CA-27 / P4: DECISÃO e PUBLICAÇÃO são eventos distintos.
-- Nenhuma autoridade é provisionada automaticamente. Nunca usar nucleo_manage
-- como mandato substantivo. Os atos não alteram documentos/fontes existentes.
CREATE TABLE public.nucleo_ac01_authority_grants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 module_id uuid NOT NULL REFERENCES public.nucleo_development_workstreams(id) ON DELETE RESTRICT,
 specialist_role text NOT NULL CHECK (length(btrim(specialist_role)) BETWEEN 3 AND 180),
 contribution_kind text NOT NULL CHECK (contribution_kind IN ('metodo','ecossistema','manual','procedimento','aprendizado','mapa','checkpoint','arquivo','outro')),
 delegate_auth_uid uuid NOT NULL,
 authority_kind text NOT NULL CHECK (authority_kind IN ('decisor','executor')),
 mandate_record_id uuid NOT NULL REFERENCES public.nucleo_specialist_mandate_records(id) ON DELETE RESTRICT,
 authority_source_locator text NOT NULL CHECK (length(btrim(authority_source_locator)) BETWEEN 8 AND 1500),
 evidence_ref text NOT NULL CHECK (length(btrim(evidence_ref)) BETWEEN 8 AND 800),
 granted_by_auth_uid uuid NOT NULL,
 effective_from timestamptz NOT NULL,
 effective_until timestamptz,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 CHECK (effective_until IS NULL OR effective_until>effective_from),
 CHECK (delegate_auth_uid<>granted_by_auth_uid)
);
CREATE INDEX nucleo_ac01_authority_grants_lookup ON public.nucleo_ac01_authority_grants
(module_id,specialist_role,contribution_kind,delegate_auth_uid,authority_kind);
-- Provisionamento somente após comprovação humana externa e por ato
-- privilegiado controlado; não existe UI/RPC/GRANT de INSERT nesta tabela.
CREATE TABLE public.nucleo_ac01_decision_acts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 decision_request_id uuid NOT NULL UNIQUE REFERENCES public.nucleo_ac01_decision_requests(id) ON DELETE RESTRICT,
 contribution_id uuid NOT NULL REFERENCES public.nucleo_specialist_contributions(id) ON DELETE RESTRICT,
 authority_grant_id uuid NOT NULL REFERENCES public.nucleo_ac01_authority_grants(id) ON DELETE RESTRICT,
 outcome text NOT NULL CHECK (outcome IN ('aprovada','devolvida','rejeitada','mantida_separada')),
 reasoning text NOT NULL CHECK(length(btrim(reasoning)) BETWEEN 20 AND 4000),
 authority_decision_ref text NOT NULL CHECK(length(btrim(authority_decision_ref)) BETWEEN 8 AND 800),
 decided_by_auth_uid uuid NOT NULL,
 request_id uuid NOT NULL UNIQUE,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX nucleo_ac01_decision_acts_contribution ON public.nucleo_ac01_decision_acts(contribution_id,recorded_at DESC);
CREATE TABLE public.nucleo_ac01_publication_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 decision_act_id uuid NOT NULL UNIQUE REFERENCES public.nucleo_ac01_decision_acts(id) ON DELETE RESTRICT,
 contribution_id uuid NOT NULL REFERENCES public.nucleo_specialist_contributions(id) ON DELETE RESTRICT,
 executor_grant_id uuid NOT NULL REFERENCES public.nucleo_ac01_authority_grants(id) ON DELETE RESTRICT,
 previous_publication_id uuid REFERENCES public.nucleo_ac01_publication_events(id) ON DELETE RESTRICT,
 publication_note text NOT NULL CHECK(length(btrim(publication_note)) BETWEEN 20 AND 3000),
 executed_by_auth_uid uuid NOT NULL,
 request_id uuid NOT NULL UNIQUE,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX nucleo_ac01_publication_events_contribution ON public.nucleo_ac01_publication_events(contribution_id,recorded_at DESC);

CREATE FUNCTION public.nucleo_ac01_authority_grant_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $f$
DECLARE m public.nucleo_specialist_mandate_records%ROWTYPE;
BEGIN
 SELECT * INTO m FROM public.nucleo_specialist_mandate_records WHERE id=NEW.mandate_record_id;
 IF NOT FOUND OR m.record_kind<>'certificacao' OR m.module_id<>NEW.module_id
 OR m.specialist_role<>NEW.specialist_role OR m.specialist_auth_uid IS NULL
 OR m.authority_decision_ref='' OR m.effective_from IS NULL OR m.effective_from>now()
 OR (m.effective_until IS NOT NULL AND m.effective_until<=now())
 THEN RAISE EXCEPTION 'AC01: certified and current mandate required'; END IF;
 -- Certificação posteriormente revogada não fundamenta delegação.
 IF EXISTS (SELECT 1 FROM public.nucleo_specialist_mandate_records rev
 WHERE rev.record_kind='revogacao' AND rev.supersedes_record_id=m.id)
 THEN RAISE EXCEPTION 'AC01: revoked mandate'; END IF;
 IF NEW.effective_from<m.effective_from OR
 (m.effective_until IS NOT NULL AND
  (NEW.effective_until IS NULL OR NEW.effective_until>m.effective_until))
 THEN RAISE EXCEPTION 'AC01: delegation outside mandate validity'; END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER nucleo_ac01_authority_guard BEFORE INSERT ON public.nucleo_ac01_authority_grants
FOR EACH ROW EXECUTE FUNCTION public.nucleo_ac01_authority_grant_guard();

CREATE FUNCTION public.nucleo_ac01_decision_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $f$
DECLARE rq public.nucleo_ac01_decision_requests%ROWTYPE;
        c public.nucleo_specialist_contributions%ROWTYPE;
        g public.nucleo_ac01_authority_grants%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AC01 decision requires authenticated human'; END IF;
 SELECT * INTO rq FROM public.nucleo_ac01_decision_requests WHERE id=NEW.decision_request_id;
 SELECT * INTO c FROM public.nucleo_specialist_contributions WHERE id=NEW.contribution_id;
 SELECT * INTO g FROM public.nucleo_ac01_authority_grants WHERE id=NEW.authority_grant_id;
 IF rq.id IS NULL OR c.id IS NULL OR g.id IS NULL
 OR rq.contribution_id<>c.id OR rq.module_id<>c.module_id
 OR g.module_id<>c.module_id OR g.specialist_role<>c.specialist_role
 OR g.contribution_kind<>c.contribution_kind OR g.authority_kind<>'decisor'
 OR g.delegate_auth_uid<>auth.uid() OR g.effective_from>now()
 OR (g.effective_until IS NOT NULL AND g.effective_until<=now())
 THEN RAISE EXCEPTION 'AC01: decision authority, scope or request mismatch'; END IF;
 IF c.recorded_by_auth_uid=auth.uid() OR rq.submitter_auth_uid=auth.uid()
 THEN RAISE EXCEPTION 'AC01: proponent/submitter cannot decide'; END IF;
 -- Conferir mandato de novo na hora do ato: delegação não sobrevive à revogação.
 IF NOT EXISTS (SELECT 1 FROM public.nucleo_specialist_mandate_records m
 WHERE m.id=g.mandate_record_id AND m.record_kind='certificacao'
 AND m.effective_from<=now() AND (m.effective_until IS NULL OR m.effective_until>now())
 AND NOT EXISTS (SELECT 1 FROM public.nucleo_specialist_mandate_records rev
 WHERE rev.record_kind='revogacao' AND rev.supersedes_record_id=m.id))
 THEN RAISE EXCEPTION 'AC01: mandate not current for decision'; END IF;
 NEW.decided_by_auth_uid:=auth.uid(); NEW.recorded_at:=now();
 RETURN NEW;
END $f$;
CREATE TRIGGER nucleo_ac01_decision_guard BEFORE INSERT ON public.nucleo_ac01_decision_acts
FOR EACH ROW EXECUTE FUNCTION public.nucleo_ac01_decision_guard();

CREATE FUNCTION public.nucleo_ac01_publication_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $f$
DECLARE d public.nucleo_ac01_decision_acts%ROWTYPE;
        c public.nucleo_specialist_contributions%ROWTYPE;
        g public.nucleo_ac01_authority_grants%ROWTYPE;
        last_p uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AC01 publication requires authenticated executor'; END IF;
 SELECT * INTO d FROM public.nucleo_ac01_decision_acts WHERE id=NEW.decision_act_id;
 SELECT * INTO c FROM public.nucleo_specialist_contributions WHERE id=NEW.contribution_id;
 SELECT * INTO g FROM public.nucleo_ac01_authority_grants WHERE id=NEW.executor_grant_id;
 IF d.id IS NULL OR d.outcome<>'aprovada' OR d.contribution_id<>c.id
 OR g.id IS NULL OR g.authority_kind<>'executor'
 OR g.module_id<>c.module_id OR g.specialist_role<>c.specialist_role
 OR g.contribution_kind<>c.contribution_kind OR g.delegate_auth_uid<>auth.uid()
 OR g.effective_from>now() OR (g.effective_until IS NOT NULL AND g.effective_until<=now())
 THEN RAISE EXCEPTION 'AC01: publication requires approved decision and scoped executor'; END IF;
 IF d.decided_by_auth_uid=auth.uid() OR c.recorded_by_auth_uid=auth.uid()
 THEN RAISE EXCEPTION 'AC01: executor must differ from decider/proponent'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.nucleo_specialist_mandate_records m
 WHERE m.id=g.mandate_record_id AND m.record_kind='certificacao'
 AND m.effective_from<=now() AND (m.effective_until IS NULL OR m.effective_until>now())
 AND NOT EXISTS (SELECT 1 FROM public.nucleo_specialist_mandate_records rev
 WHERE rev.record_kind='revogacao' AND rev.supersedes_record_id=m.id))
 THEN RAISE EXCEPTION 'AC01: executor mandate not current'; END IF;
 -- Não atualizar referência vigente em tabela legada: publicar primeiro
 -- um evento append-only de vigência interna AC-01, com origem preservada.
 PERFORM pg_advisory_xact_lock(hashtextextended(c.module_id::text||':'||c.specialist_role||':'||c.contribution_kind,0));
 SELECT p.id INTO last_p FROM public.nucleo_ac01_publication_events p
 JOIN public.nucleo_specialist_contributions prior ON prior.id=p.contribution_id
 WHERE prior.module_id=c.module_id AND prior.specialist_role=c.specialist_role
   AND prior.contribution_kind=c.contribution_kind
 ORDER BY p.recorded_at DESC,p.id DESC LIMIT 1;
 IF last_p IS DISTINCT FROM NEW.previous_publication_id
 THEN RAISE EXCEPTION 'AC01: current publication changed, re-read before publishing'; END IF;
 NEW.executed_by_auth_uid:=auth.uid();NEW.recorded_at:=now();
 RETURN NEW;
END $f$;
CREATE TRIGGER nucleo_ac01_publication_guard BEFORE INSERT ON public.nucleo_ac01_publication_events
FOR EACH ROW EXECUTE FUNCTION public.nucleo_ac01_publication_guard();

-- Escritas privilegiadas também preservam imutabilidade.
CREATE TRIGGER nucleo_ac01_authority_immutable BEFORE UPDATE OR DELETE
ON public.nucleo_ac01_authority_grants FOR EACH ROW EXECUTE FUNCTION public.nucleo_revisions_immutable_guard();
CREATE TRIGGER nucleo_ac01_decision_immutable BEFORE UPDATE OR DELETE
ON public.nucleo_ac01_decision_acts FOR EACH ROW EXECUTE FUNCTION public.nucleo_revisions_immutable_guard();
CREATE TRIGGER nucleo_ac01_publication_immutable BEFORE UPDATE OR DELETE
ON public.nucleo_ac01_publication_events FOR EACH ROW EXECUTE FUNCTION public.nucleo_revisions_immutable_guard();

-- Todas as tabelas de atos e delegações ficam fechadas para escritas via Data API
-- até haver um fluxo autenticado de decisão e executor avaliado pela Camada Mestre.
ALTER TABLE public.nucleo_ac01_authority_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nucleo_ac01_decision_acts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nucleo_ac01_publication_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nucleo_ac01_authority_grants FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.nucleo_ac01_decision_acts FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.nucleo_ac01_publication_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.nucleo_ac01_authority_grants,public.nucleo_ac01_decision_acts,
 public.nucleo_ac01_publication_events TO authenticated;
CREATE POLICY nucleo_ac01_grants_read ON public.nucleo_ac01_authority_grants FOR SELECT
TO authenticated USING(EXISTS(SELECT 1 FROM public.app_admin_capabilities a
WHERE a.auth_user_id=(SELECT auth.uid()) AND a.capability='nucleo_manage'
AND a.active AND a.revoked_at IS NULL));
CREATE POLICY nucleo_ac01_acts_read ON public.nucleo_ac01_decision_acts FOR SELECT
TO authenticated USING(EXISTS(SELECT 1 FROM public.app_admin_capabilities a
WHERE a.auth_user_id=(SELECT auth.uid()) AND a.capability='nucleo_manage'
AND a.active AND a.revoked_at IS NULL));
CREATE POLICY nucleo_ac01_publications_read ON public.nucleo_ac01_publication_events FOR SELECT
TO authenticated USING(EXISTS(SELECT 1 FROM public.app_admin_capabilities a
WHERE a.auth_user_id=(SELECT auth.uid()) AND a.capability='nucleo_manage'
AND a.active AND a.revoked_at IS NULL));
-- Não criar GRANT de INSERT nem política INSERT para papéis de cliente.
-- A implementação de execução humana autenticada requer decisão da
-- Camada Mestre sobre quem concede e audita a competência substantiva.
