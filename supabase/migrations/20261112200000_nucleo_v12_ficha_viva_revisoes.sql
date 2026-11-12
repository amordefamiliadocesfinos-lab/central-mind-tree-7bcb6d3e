-- Nucleo 2.0 V1.2 / M1+M3: Ficha Viva, revisoes historicas append-only.
-- Extensao MINIMA ao cadastro M3 existente. Nao importa documentos da Entrega B.
BEGIN;
DO $gate$
BEGIN
 IF to_regclass('public.nucleo_development_workstreams') IS NULL
 OR to_regprocedure('public.nucleo_revisions_immutable_guard()') IS NULL
 OR to_regclass('public.app_admin_capabilities') IS NULL THEN
   RAISE EXCEPTION 'V1.2 Ficha Viva requires approved M1 and M3';
 END IF;
END $gate$;

CREATE TABLE public.nucleo_module_knowledge_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 module_id uuid NOT NULL REFERENCES public.nucleo_development_workstreams(id) ON DELETE RESTRICT,
 section_code text NOT NULL CHECK(section_code IN
 ('FM-01','FM-02','FM-03','FM-04','FM-05','FM-06','FM-07','FM-08','FM-09','FM-10')),
 version_no integer NOT NULL CHECK(version_no BETWEEN 1 AND 1000000),
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 3 AND 180),
 body text NOT NULL CHECK(length(trim(body)) BETWEEN 10 AND 12000),
 source_reference text NOT NULL DEFAULT '' CHECK(length(source_reference) <= 1500),
 evidence_level text NOT NULL DEFAULT 'declarado'
   CHECK(evidence_level IN ('declarado','codigo_verificado','uso_real_verificado','proposta','nao_verificado')),
 authority_state text NOT NULL DEFAULT 'rascunho'
   CHECK(authority_state IN ('rascunho','proposta','homologado','historico')),
 reviewed_by text NOT NULL DEFAULT '',
 recorded_at timestamptz NOT NULL DEFAULT now(),
 recorded_by_auth_uid uuid,
 UNIQUE(module_id,section_code,version_no),
 CONSTRAINT nucleo_fm_no_claim_without_review CHECK(
   (authority_state IN ('rascunho','proposta') AND evidence_level IN ('declarado','proposta','nao_verificado'))
   OR (authority_state IN ('homologado','historico') AND length(trim(reviewed_by)) > 0)
 )
);
CREATE INDEX nucleo_fm_module_section_idx ON public.nucleo_module_knowledge_revisions
 (module_id,section_code,version_no DESC);

CREATE FUNCTION public.nucleo_fm_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE module_kind text;
BEGIN
 IF current_user IN ('authenticated','service_role') AND NOT EXISTS (
    SELECT 1 FROM public.app_admin_capabilities c
    WHERE c.auth_user_id=auth.uid() AND c.capability='nucleo_manage'
      AND c.active AND c.revoked_at IS NULL
 ) THEN
    RAISE EXCEPTION 'Ficha Viva authorization required';
 END IF;
 SELECT kind INTO module_kind FROM public.nucleo_development_workstreams WHERE id=NEW.module_id;
 IF module_kind IS DISTINCT FROM 'modulo' THEN
   RAISE EXCEPTION 'Ficha Viva requires an existing module record';
 END IF;
 -- Browser inserts do not assert evidence verification, human approval or authority.
 IF current_user IN ('authenticated','service_role') AND
   (NEW.authority_state <> 'rascunho' OR NEW.evidence_level <> 'declarado'
    OR NEW.reviewed_by <> '') THEN
   RAISE EXCEPTION 'Ficha Viva client may only submit unverified draft revisions';
 END IF;
 NEW.recorded_at=now();
 NEW.recorded_by_auth_uid=auth.uid();
 RETURN NEW;
END $fn$;
CREATE TRIGGER nucleo_fm_author_guard BEFORE INSERT
 ON public.nucleo_module_knowledge_revisions FOR EACH ROW
 EXECUTE FUNCTION public.nucleo_fm_before_insert();
CREATE TRIGGER nucleo_fm_append_only BEFORE UPDATE OR DELETE
 ON public.nucleo_module_knowledge_revisions FOR EACH ROW
 EXECUTE FUNCTION public.nucleo_revisions_immutable_guard();

ALTER TABLE public.nucleo_module_knowledge_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nucleo_module_knowledge_revisions FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.nucleo_module_knowledge_revisions TO authenticated,service_role;
CREATE POLICY nucleo_fm_read ON public.nucleo_module_knowledge_revisions
 FOR SELECT TO authenticated USING (EXISTS(
  SELECT 1 FROM public.app_admin_capabilities c
  WHERE c.auth_user_id=(SELECT auth.uid()) AND c.capability='nucleo_manage'
  AND c.active AND c.revoked_at IS NULL
 ));
CREATE POLICY nucleo_fm_insert ON public.nucleo_module_knowledge_revisions
 FOR INSERT TO authenticated WITH CHECK (EXISTS(
  SELECT 1 FROM public.app_admin_capabilities c
  WHERE c.auth_user_id=(SELECT auth.uid()) AND c.capability='nucleo_manage'
  AND c.active AND c.revoked_at IS NULL
 ));
COMMIT;
