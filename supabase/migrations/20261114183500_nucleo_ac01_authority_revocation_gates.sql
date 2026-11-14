-- AC-01 V1.3 A+: revogação independente de delegações, sucessão auditável.
-- NÃO atribui poderes de escrita; atos seguem fechados no Data API.
ALTER TABLE public.nucleo_ac01_authority_grants
 ADD COLUMN supersedes_grant_id uuid REFERENCES public.nucleo_ac01_authority_grants(id) ON DELETE RESTRICT;
CREATE TABLE public.nucleo_ac01_authority_revocations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 authority_grant_id uuid NOT NULL REFERENCES public.nucleo_ac01_authority_grants(id) ON DELETE RESTRICT,
 revocation_kind text NOT NULL CHECK (revocation_kind IN ('revogacao','suspensao')),
 reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 20 AND 2000),
 authority_source_locator text NOT NULL CHECK (char_length(btrim(authority_source_locator)) BETWEEN 8 AND 1500),
 authority_decision_ref text NOT NULL CHECK (char_length(btrim(authority_decision_ref)) BETWEEN 8 AND 800),
 revoked_by_auth_uid uuid NOT NULL,
 request_id uuid NOT NULL UNIQUE,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT nucleo_ac01_one_termination_per_grant UNIQUE(authority_grant_id)
);
CREATE INDEX nucleo_ac01_revocations_grant_idx ON public.nucleo_ac01_authority_revocations(authority_grant_id);
CREATE FUNCTION public.nucleo_ac01_revocation_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $guard$
DECLARE g public.nucleo_ac01_authority_grants%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AC01: revocation needs authenticated human'; END IF;
 SELECT * INTO g FROM public.nucleo_ac01_authority_grants WHERE id=NEW.authority_grant_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'AC01: grant not found'; END IF;
 IF auth.uid()=g.delegate_auth_uid THEN RAISE EXCEPTION 'AC01: delegate cannot revoke own authority'; END IF;
 NEW.revoked_by_auth_uid:=auth.uid();
 NEW.recorded_at:=now();
 RETURN NEW;
END $guard$;
CREATE TRIGGER nucleo_ac01_revocation_insert_guard BEFORE INSERT
 ON public.nucleo_ac01_authority_revocations FOR EACH ROW
 EXECUTE FUNCTION public.nucleo_ac01_revocation_guard();
CREATE TRIGGER nucleo_ac01_revocation_immutable BEFORE UPDATE OR DELETE
 ON public.nucleo_ac01_authority_revocations FOR EACH ROW
 EXECUTE FUNCTION public.nucleo_revisions_immutable_guard();

-- Helper apenas de leitura, SECURITY INVOKER, não é endpoint decisório.
CREATE FUNCTION public.nucleo_ac01_grant_is_revoked(p_grant_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $check$
 SELECT EXISTS(SELECT 1 FROM public.nucleo_ac01_authority_revocations r
 WHERE r.authority_grant_id=p_grant_id)
$check$;
REVOKE ALL ON FUNCTION public.nucleo_ac01_grant_is_revoked(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.nucleo_ac01_grant_is_revoked(uuid) TO authenticated;
-- Trigger grant anterior continua. Alterações abaixo apenas adicionam verificação.
CREATE OR REPLACE FUNCTION public.nucleo_ac01_authority_grant_guard() RETURNS trigger
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
 IF NEW.supersedes_grant_id IS NOT NULL THEN
  PERFORM 1 FROM public.nucleo_ac01_authority_grants prior
  WHERE prior.id=NEW.supersedes_grant_id AND prior.module_id=NEW.module_id
   AND prior.specialist_role=NEW.specialist_role AND prior.contribution_kind=NEW.contribution_kind
   AND prior.authority_kind=NEW.authority_kind;
  IF NOT FOUND OR NOT EXISTS (
   SELECT 1 FROM public.nucleo_ac01_authority_revocations rv
   WHERE rv.authority_grant_id=NEW.supersedes_grant_id AND rv.revocation_kind='revogacao'
  ) THEN RAISE EXCEPTION 'AC01: replacement requires revoked predecessor in same scope'; END IF;
 END IF;
 RETURN NEW;
END $f$;
CREATE OR REPLACE FUNCTION public.nucleo_ac01_decision_guard() RETURNS trigger
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
 IF NOT EXISTS (SELECT 1 FROM public.app_admin_capabilities a
 WHERE a.auth_user_id=auth.uid() AND a.capability='nucleo_manage'
 AND a.active AND a.revoked_at IS NULL)
 THEN RAISE EXCEPTION 'AC01: nucleo_manage required to inspect authority evidence'; END IF;
 IF public.nucleo_ac01_grant_is_revoked(g.id) THEN
  RAISE EXCEPTION 'AC01: delegated decision authority revoked or suspended';
 END IF;
 NEW.decided_by_auth_uid:=auth.uid(); NEW.recorded_at:=now();
 RETURN NEW;
END $f$;
CREATE OR REPLACE FUNCTION public.nucleo_ac01_publication_guard() RETURNS trigger
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
 IF public.nucleo_ac01_grant_is_revoked(g.id) THEN
  RAISE EXCEPTION 'AC01: delegated executor authority revoked or suspended';
 END IF;
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
ALTER TABLE public.nucleo_ac01_authority_revocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nucleo_ac01_authority_revocations FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.nucleo_ac01_authority_revocations TO authenticated;
CREATE POLICY nucleo_ac01_revocations_read ON public.nucleo_ac01_authority_revocations
 FOR SELECT TO authenticated USING(EXISTS (
 SELECT 1 FROM public.app_admin_capabilities a
 WHERE a.auth_user_id=(SELECT auth.uid()) AND a.capability='nucleo_manage'
 AND a.active AND a.revoked_at IS NULL));
-- GRANT INSERT/RPC permanece fechado, inclusive para service_role.
