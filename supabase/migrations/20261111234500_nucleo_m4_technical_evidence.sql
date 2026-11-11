-- Núcleo 2.0 M4: catálogo auditável de evidências técnicas externas.
-- M4 não altera status, não infere progresso, não chama GitHub do navegador.
BEGIN;
DO $gate$
BEGIN
 IF to_regclass('public.nucleo_development_workstreams') IS NULL
 OR to_regprocedure('public.nucleo_reject_delete_guard()') IS NULL
 OR to_regprocedure('public.nucleo_revisions_immutable_guard()') IS NULL THEN
 RAISE EXCEPTION 'M4 requires audited M3';
 END IF;
END $gate$;

CREATE TABLE public.nucleo_development_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workstream_id uuid NOT NULL REFERENCES public.nucleo_development_workstreams(id) ON DELETE RESTRICT,
 source text NOT NULL CHECK(source IN ('github','supabase')),
 kind text NOT NULL CHECK(kind IN ('pull_request','commit','workflow_run','migration')),
 repository text,
 external_key text NOT NULL CHECK (length(trim(external_key)) BETWEEN 1 AND 150),
 reference_url text,
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 260),
 observed_state text NOT NULL DEFAULT 'observado'
  CHECK(observed_state IN ('observado','verificado','divergente','nao_verificado')),
 source_observed_at timestamptz,
 checked_at timestamptz,
 evidence_note text NOT NULL DEFAULT '',
 snapshot jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(snapshot)='object'),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 recorded_by_auth_uid uuid,
 CONSTRAINT nucleo_m4_kind_source CHECK(
  (source='github' AND kind IN ('pull_request','commit','workflow_run')
    AND repository='amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e'
    AND reference_url IS NOT NULL AND reference_url LIKE 'https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/%')
  OR (source='supabase' AND kind='migration' AND repository IS NULL AND reference_url IS NULL)
 ),
 CONSTRAINT nucleo_m4_checked CHECK (observed_state<>'verificado' OR checked_at IS NOT NULL),
 CONSTRAINT nucleo_m4_no_fabricated_progress CHECK(
   NOT(snapshot ? 'percent_complete') AND NOT(snapshot ? 'progress_percentage')),
 CONSTRAINT nucleo_m4_unique_snapshot UNIQUE(workstream_id,source,kind,external_key,observed_state,checked_at)
);
CREATE INDEX nucleo_m4_evidence_workstream_idx ON public.nucleo_development_evidence(workstream_id,recorded_at DESC);

CREATE FUNCTION public.nucleo_m4_evidence_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $audit$
BEGIN
 NEW.recorded_at=now();
 NEW.recorded_by_auth_uid=auth.uid();
 RETURN NEW;
END $audit$;
CREATE TRIGGER nucleo_m4_set_authorship BEFORE INSERT ON public.nucleo_development_evidence
 FOR EACH ROW EXECUTE FUNCTION public.nucleo_m4_evidence_audit();
CREATE TRIGGER nucleo_m4_no_change BEFORE UPDATE OR DELETE ON public.nucleo_development_evidence
 FOR EACH ROW EXECUTE FUNCTION public.nucleo_revisions_immutable_guard();

ALTER TABLE public.nucleo_development_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nucleo_development_evidence FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.nucleo_development_evidence TO authenticated,service_role;
CREATE POLICY nucleo_m4_evidence_read ON public.nucleo_development_evidence
 FOR SELECT TO authenticated USING (EXISTS(
 SELECT 1 FROM public.app_admin_capabilities c
 WHERE c.auth_user_id=(SELECT auth.uid()) AND c.capability='nucleo_manage'
 AND c.active AND c.revoked_at IS NULL));
CREATE POLICY nucleo_m4_evidence_insert ON public.nucleo_development_evidence
 FOR INSERT TO authenticated WITH CHECK (EXISTS(
 SELECT 1 FROM public.app_admin_capabilities c
 WHERE c.auth_user_id=(SELECT auth.uid()) AND c.capability='nucleo_manage'
 AND c.active AND c.revoked_at IS NULL));

-- Nenhuma integração automatizada de credenciais e nenhum grant administrativo novo.
COMMIT;
