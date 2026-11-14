-- AC-01 V1.3 / P4: intake de solicitações de decisão humana, NÃO atos decisórios.
-- Gestores com nucleo_manage podem instruir pedidos; NUNCA homologar apenas por este grant.
-- A decisão competente e eventual promoção de vigente requerem contrato/autoridade distintos.
CREATE TABLE public.nucleo_ac01_decision_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 contribution_id uuid NOT NULL REFERENCES public.nucleo_specialist_contributions(id) ON DELETE RESTRICT,
 module_id uuid NOT NULL REFERENCES public.nucleo_development_workstreams(id) ON DELETE RESTRICT,
 review_event_id uuid NOT NULL REFERENCES public.nucleo_ac01_review_events(id) ON DELETE RESTRICT,
 requested_outcome text NOT NULL CHECK (requested_outcome IN ('avaliar_aprovacao','devolver_refinamento','avaliar_rejeicao')),
 authority_source_locator text NOT NULL CHECK (char_length(btrim(authority_source_locator)) BETWEEN 8 AND 1500),
 authority_decision_ref text NOT NULL DEFAULT '' CHECK (char_length(authority_decision_ref) <= 800),
 justification text NOT NULL CHECK (char_length(btrim(justification)) BETWEEN 20 AND 4000),
 candidate_decider_auth_uid uuid,
 submitter_auth_uid uuid NOT NULL,
 request_id uuid NOT NULL UNIQUE,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT nucleo_ac01_decision_distinct_actors CHECK (
  candidate_decider_auth_uid IS NULL OR candidate_decider_auth_uid <> submitter_auth_uid)
);
CREATE INDEX nucleo_ac01_decision_requests_contribution_idx
ON public.nucleo_ac01_decision_requests(contribution_id,recorded_at DESC,id);

CREATE FUNCTION public.nucleo_ac01_decision_request_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $guard$
DECLARE actual_module uuid; actual_event_kind text; event_contribution uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AC01 decision intake needs authenticated session'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.app_admin_capabilities a WHERE
  a.auth_user_id=auth.uid() AND a.capability='nucleo_manage' AND a.active AND a.revoked_at IS NULL)
 THEN RAISE EXCEPTION 'AC01 decision intake needs active nucleo_manage'; END IF;
 SELECT c.module_id INTO actual_module FROM public.nucleo_specialist_contributions c
 WHERE c.id=NEW.contribution_id;
 IF actual_module IS DISTINCT FROM NEW.module_id OR actual_module IS NULL
 THEN RAISE EXCEPTION 'AC01 decision intake contribution module mismatch'; END IF;
 SELECT e.event_kind,e.contribution_id INTO actual_event_kind,event_contribution
 FROM public.nucleo_ac01_review_events e WHERE e.id=NEW.review_event_id;
 IF actual_event_kind IS DISTINCT FROM 'encaminhar_decisao'
   OR event_contribution IS DISTINCT FROM NEW.contribution_id
 THEN RAISE EXCEPTION 'AC01 decision intake requires matching referral event'; END IF;
 NEW.submitter_auth_uid := auth.uid();
 NEW.recorded_at := now();
 IF NEW.candidate_decider_auth_uid IS NOT NULL AND
    NEW.candidate_decider_auth_uid=NEW.submitter_auth_uid
 THEN RAISE EXCEPTION 'AC01 decision intake cannot self nominate as decider'; END IF;
 RETURN NEW;
END $guard$;
CREATE TRIGGER nucleo_ac01_decision_request_insert_guard BEFORE INSERT
ON public.nucleo_ac01_decision_requests FOR EACH ROW
EXECUTE FUNCTION public.nucleo_ac01_decision_request_guard();

ALTER TABLE public.nucleo_ac01_decision_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nucleo_ac01_decision_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.nucleo_ac01_decision_requests TO authenticated;
CREATE POLICY nucleo_ac01_decision_request_read ON public.nucleo_ac01_decision_requests
 FOR SELECT TO authenticated USING (EXISTS(
 SELECT 1 FROM public.app_admin_capabilities a WHERE
 a.auth_user_id=(SELECT auth.uid()) AND a.capability='nucleo_manage'
 AND a.active AND a.revoked_at IS NULL));
CREATE POLICY nucleo_ac01_decision_request_submit ON public.nucleo_ac01_decision_requests
 FOR INSERT TO authenticated WITH CHECK (EXISTS(
 SELECT 1 FROM public.app_admin_capabilities a WHERE
 a.auth_user_id=(SELECT auth.uid()) AND a.capability='nucleo_manage'
 AND a.active AND a.revoked_at IS NULL));
-- Nenhum grant/policy UPDATE/DELETE; nenhuma função de homologação, certificação
-- ou alteração de referência vigente; o resultado não é registrado nesta tabela.
