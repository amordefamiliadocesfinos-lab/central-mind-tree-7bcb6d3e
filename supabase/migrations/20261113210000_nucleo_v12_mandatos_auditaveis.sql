-- Núcleo V1.2 Entrega A+ — mandatos de especialistas com decisões imutáveis.
-- Estrutura aditiva; nenhuma linha é criada, nenhum mandato é certificado no deploy.
BEGIN;
DO $gate$
BEGIN
 IF to_regclass('public.nucleo_development_workstreams') IS NULL
 OR to_regclass('public.app_admin_capabilities') IS NULL
 OR to_regprocedure('public.nucleo_revisions_immutable_guard()') IS NULL
 THEN RAISE EXCEPTION 'Núcleo mandates require existing M1/M3 foundation'; END IF;
END $gate$;

CREATE TABLE public.nucleo_specialist_mandate_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 module_id uuid NOT NULL REFERENCES public.nucleo_development_workstreams(id) ON DELETE RESTRICT,
 record_kind text NOT NULL CHECK (record_kind IN ('proposta','certificacao','revogacao')),
 specialist_role text NOT NULL CHECK (length(trim(specialist_role)) BETWEEN 3 AND 180),
 specialist_auth_uid uuid,
 method_name text NOT NULL DEFAULT '' CHECK (length(method_name) <= 180),
 method_version text NOT NULL DEFAULT '' CHECK (length(method_version) <= 100),
 authority_source_url text NOT NULL DEFAULT '' CHECK (length(authority_source_url) <= 1500),
 authority_decision_ref text NOT NULL DEFAULT '' CHECK (length(authority_decision_ref) <= 800),
 decision_note text NOT NULL DEFAULT '' CHECK (length(decision_note) <= 2000),
 effective_from timestamptz,
 effective_until timestamptz,
 supersedes_record_id uuid REFERENCES public.nucleo_specialist_mandate_records(id) ON DELETE RESTRICT,
 recorded_by_auth_uid uuid,
 decided_by_auth_uid uuid,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT nucleo_mandate_period CHECK (effective_until IS NULL OR effective_from IS NULL OR effective_until > effective_from),
 CONSTRAINT nucleo_mandate_decision_requires_proof CHECK (
   record_kind='proposta'
   OR (
     specialist_auth_uid IS NOT NULL
     AND length(trim(method_name)) >= 3
     AND length(trim(method_version)) >= 1
     AND authority_source_url ~ '^https://'
     AND length(trim(authority_decision_ref)) >= 5
     AND length(trim(decision_note)) >= 10
     AND effective_from IS NOT NULL
     AND decided_by_auth_uid IS NOT NULL
   )
 ),
 CONSTRAINT nucleo_mandate_no_self_supersede CHECK (supersedes_record_id IS NULL OR supersedes_record_id <> id),
 CONSTRAINT nucleo_mandate_revocation_requires_previous CHECK (
   record_kind <> 'revogacao' OR supersedes_record_id IS NOT NULL
 )
);
CREATE INDEX nucleo_mandates_module_time_idx ON public.nucleo_specialist_mandate_records(module_id,recorded_at DESC,id DESC);

CREATE FUNCTION public.nucleo_mandate_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE v_kind text; v_previous_module uuid; v_previous_kind text;
BEGIN
 SELECT kind INTO v_kind FROM public.nucleo_development_workstreams WHERE id=NEW.module_id;
 IF v_kind IS DISTINCT FROM 'modulo' THEN
   RAISE EXCEPTION 'Mandate record requires an existing module';
 END IF;
 IF NEW.supersedes_record_id IS NOT NULL THEN
   SELECT module_id,record_kind INTO v_previous_module,v_previous_kind
   FROM public.nucleo_specialist_mandate_records WHERE id=NEW.supersedes_record_id;
   IF v_previous_module IS DISTINCT FROM NEW.module_id THEN
     RAISE EXCEPTION 'Mandate supersession must remain in the same module';
   END IF;
   IF NEW.record_kind='revogacao' AND v_previous_kind<>'certificacao' THEN
     RAISE EXCEPTION 'Mandate revocation must reference a certification';
   END IF;
 END IF;
 IF current_user IN ('authenticated','service_role') THEN
   IF NEW.record_kind <> 'proposta' OR NEW.decided_by_auth_uid IS NOT NULL
     OR NEW.effective_from IS NOT NULL OR NEW.effective_until IS NOT NULL
     OR NEW.supersedes_record_id IS NOT NULL THEN
     RAISE EXCEPTION 'Client may only create unapproved specialist mandate proposals';
   END IF;
   IF auth.uid() IS NULL OR NOT EXISTS (
     SELECT 1 FROM public.app_admin_capabilities c
     WHERE c.auth_user_id=auth.uid() AND c.capability='nucleo_manage'
       AND c.active AND c.revoked_at IS NULL
   ) THEN RAISE EXCEPTION 'Active nucleo_manage authorization required'; END IF;
 END IF;
 NEW.recorded_at=now();
 NEW.recorded_by_auth_uid=auth.uid();
 RETURN NEW;
END $fn$;

CREATE TRIGGER nucleo_mandate_before_insert_guard
 BEFORE INSERT ON public.nucleo_specialist_mandate_records
 FOR EACH ROW EXECUTE FUNCTION public.nucleo_mandate_before_insert();
CREATE TRIGGER nucleo_mandate_immutable
 BEFORE UPDATE OR DELETE ON public.nucleo_specialist_mandate_records
 FOR EACH ROW EXECUTE FUNCTION public.nucleo_revisions_immutable_guard();

ALTER TABLE public.nucleo_specialist_mandate_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nucleo_specialist_mandate_records FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.nucleo_specialist_mandate_records TO authenticated,service_role;
CREATE POLICY nucleo_mandates_read ON public.nucleo_specialist_mandate_records
 FOR SELECT TO authenticated USING (EXISTS (
   SELECT 1 FROM public.app_admin_capabilities c
    WHERE c.auth_user_id=(SELECT auth.uid()) AND c.capability='nucleo_manage'
      AND c.active AND c.revoked_at IS NULL
 ));
CREATE POLICY nucleo_mandates_propose ON public.nucleo_specialist_mandate_records
 FOR INSERT TO authenticated WITH CHECK (
   record_kind='proposta'
   AND decided_by_auth_uid IS NULL
   AND effective_from IS NULL
   AND effective_until IS NULL
   AND supersedes_record_id IS NULL
   AND EXISTS (SELECT 1 FROM public.app_admin_capabilities c
     WHERE c.auth_user_id=(SELECT auth.uid()) AND c.capability='nucleo_manage'
       AND c.active AND c.revoked_at IS NULL)
 );
-- Certificação e revogação exigem decisão privilegiada, comprovada e separada.
-- Sem GRANT UPDATE/DELETE, sem função SECURITY DEFINER e sem dados iniciais.
COMMIT;
