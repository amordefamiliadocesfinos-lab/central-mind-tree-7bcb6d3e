-- PROPOSTA AC-02 / Núcleo V1.3 — somente CI descartável.
-- NÃO colocar em supabase/migrations nem aplicar no Cloud produtivo sem decisão posterior.
-- Extensão mínima: um ledger de eventos; não é nova Biblioteca, mandato ou evidência M4.
BEGIN;
DO $gate$
BEGIN
 IF to_regclass('public.nucleo_development_workstreams') IS NULL
 OR to_regclass('public.app_admin_capabilities') IS NULL
 THEN RAISE EXCEPTION 'AC02: requires existing M3 and administrative capability'; END IF;
END $gate$;

CREATE TABLE public.nucleo_ac02_handoff_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 package_id uuid NOT NULL,
 package_version text NOT NULL CHECK(package_version ~ '^1[.][0-9]{1,4}$'),
 package_sha256 text NOT NULL CHECK(package_sha256 ~ '^[0-9a-f]{64}$'),
 module_id uuid NOT NULL REFERENCES public.nucleo_development_workstreams(id) ON DELETE RESTRICT,
 specialist_role_code text NOT NULL CHECK(specialist_role_code ~ '^[a-z][a-z0-9_]{2,49}$'),
 recipient_kind text NOT NULL CHECK(recipient_kind IN ('sucessor_humano','novo_chat_ia')),
 recipient_auth_uid uuid,
 event_kind text NOT NULL CHECK(event_kind IN
 ('preparado','disponibilizado','entregue','recebido','aceito','falha','expirado','retificado')),
 previous_event_id uuid REFERENCES public.nucleo_ac02_handoff_events(id) ON DELETE RESTRICT,
 evidence_class text NOT NULL CHECK(evidence_class IN
 ('declaracao_gestor','confirmacao_destinatario','referencia_externa')),
 evidence_ref text CHECK(evidence_ref IS NULL OR (length(evidence_ref) BETWEEN 3 AND 180
  AND evidence_ref ~ '^[a-zA-Z0-9][a-zA-Z0-9_./:-]*$')),
 source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 3 AND 180
  AND source_ref ~ '^[a-zA-Z0-9][a-zA-Z0-9_./:-]*$'),
 expires_at timestamptz NOT NULL,
 request_id uuid NOT NULL UNIQUE,
 actor_auth_uid uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT ac02_recipient_shape CHECK (
  (recipient_kind='sucessor_humano' AND recipient_auth_uid IS NOT NULL)
  OR (recipient_kind='novo_chat_ia' AND recipient_auth_uid IS NULL)),
 CONSTRAINT ac02_event_proof_shape CHECK (
  (event_kind IN ('recebido','aceito') AND recipient_kind='sucessor_humano'
    AND evidence_class='confirmacao_destinatario')
  OR (event_kind NOT IN ('recebido','aceito')
    AND evidence_class IN ('declaracao_gestor','referencia_externa'))),
 CONSTRAINT ac02_external_proof_requires_ref CHECK (
  evidence_class <> 'referencia_externa' OR evidence_ref IS NOT NULL)
);
CREATE UNIQUE INDEX nucleo_ac02_handoff_one_start
 ON public.nucleo_ac02_handoff_events(package_id) WHERE previous_event_id IS NULL;
CREATE UNIQUE INDEX nucleo_ac02_handoff_one_child
 ON public.nucleo_ac02_handoff_events(previous_event_id)
 WHERE previous_event_id IS NOT NULL;
CREATE INDEX nucleo_ac02_handoff_package_history
 ON public.nucleo_ac02_handoff_events(package_id,recorded_at,id);
CREATE INDEX nucleo_ac02_handoff_module_history
 ON public.nucleo_ac02_handoff_events(module_id,recorded_at DESC,id DESC);

CREATE FUNCTION public.nucleo_ac02_handoff_insert_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE old_row public.nucleo_ac02_handoff_events%ROWTYPE;
        module_kind text;
        admin_ok boolean;
        previous_stage text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AC02: authenticated identity required'; END IF;
 NEW.actor_auth_uid := auth.uid();
 NEW.recorded_at := now();
 SELECT EXISTS(
  SELECT 1 FROM public.app_admin_capabilities c
   WHERE c.auth_user_id=auth.uid() AND c.capability='nucleo_manage'
    AND c.active AND c.revoked_at IS NULL
 ) INTO admin_ok;
 -- Identidade de módulo verificada somente na preparação pelo gestor.
 -- O destinatário pode não ter RLS de leitura M3; a sequência herda módulo
 -- imutável de um evento inicial já verificado.
 IF NEW.previous_event_id IS NULL THEN
  SELECT w.kind INTO module_kind FROM public.nucleo_development_workstreams w WHERE w.id=NEW.module_id;
  IF module_kind IS DISTINCT FROM 'modulo' THEN
   RAISE EXCEPTION 'AC02: module reference must be an existing module';
  END IF;
 END IF;
 -- Serializa evolução por package_id, impedindo dois próximos estados simultâneos.
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.package_id::text, 3202));
 IF NEW.previous_event_id IS NULL THEN
  IF NEW.event_kind <> 'preparado' OR NOT admin_ok THEN
   RAISE EXCEPTION 'AC02: only administrator can prepare first event';
  END IF;
  IF NEW.expires_at <= now() OR NEW.expires_at > now()+interval '30 days' THEN
   RAISE EXCEPTION 'AC02: invalid validity window';
  END IF;
  IF EXISTS(SELECT 1 FROM public.nucleo_ac02_handoff_events e WHERE e.package_id=NEW.package_id) THEN
   RAISE EXCEPTION 'AC02: package already has a history';
  END IF;
 ELSE
  SELECT * INTO old_row FROM public.nucleo_ac02_handoff_events e
   WHERE e.id=NEW.previous_event_id;
  IF NOT FOUND OR old_row.package_id IS DISTINCT FROM NEW.package_id
   OR old_row.module_id IS DISTINCT FROM NEW.module_id
   OR old_row.package_version IS DISTINCT FROM NEW.package_version
   OR old_row.package_sha256 IS DISTINCT FROM NEW.package_sha256
   OR old_row.specialist_role_code IS DISTINCT FROM NEW.specialist_role_code
   OR old_row.recipient_kind IS DISTINCT FROM NEW.recipient_kind
   OR old_row.recipient_auth_uid IS DISTINCT FROM NEW.recipient_auth_uid
   OR old_row.source_ref IS DISTINCT FROM NEW.source_ref
   OR old_row.expires_at IS DISTINCT FROM NEW.expires_at THEN
    RAISE EXCEPTION 'AC02: lineage identity mismatch';
  END IF;
  IF EXISTS(SELECT 1 FROM public.nucleo_ac02_handoff_events e
    WHERE e.previous_event_id=NEW.previous_event_id) THEN
    RAISE EXCEPTION 'AC02: previous event already has a successor';
  END IF;
  previous_stage := old_row.event_kind;
  IF NOT (
    (NEW.event_kind='disponibilizado' AND previous_stage='preparado')
    OR (NEW.event_kind='entregue' AND previous_stage='disponibilizado')
    OR (NEW.event_kind='recebido' AND previous_stage='entregue')
    OR (NEW.event_kind='aceito' AND previous_stage='recebido')
    OR (NEW.event_kind='falha' AND previous_stage IN ('preparado','disponibilizado','entregue'))
    OR (NEW.event_kind='expirado' AND previous_stage IN ('preparado','disponibilizado','entregue'))
    OR (NEW.event_kind='retificado' AND previous_stage IN
      ('preparado','disponibilizado','entregue','recebido','aceito','falha','expirado'))
   ) THEN RAISE EXCEPTION 'AC02: invalid transition'; END IF;
  IF NEW.event_kind='expirado' AND now()<NEW.expires_at THEN
    RAISE EXCEPTION 'AC02: cannot assert expiry before deadline'; END IF;
  IF NEW.event_kind NOT IN ('expirado','falha','retificado') AND now()>NEW.expires_at THEN
    RAISE EXCEPTION 'AC02: package expired; no implicit delivery or receipt'; END IF;
  IF NEW.event_kind IN ('recebido','aceito') THEN
    IF NEW.recipient_kind<>'sucessor_humano'
      OR NEW.recipient_auth_uid IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'AC02: receipt/acceptance requires actual authenticated recipient'; END IF;
  ELSIF NOT admin_ok THEN
    RAISE EXCEPTION 'AC02: manager capability required for declarative event';
  END IF;
 END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER nucleo_ac02_handoff_before_insert
 BEFORE INSERT ON public.nucleo_ac02_handoff_events
 FOR EACH ROW EXECUTE FUNCTION public.nucleo_ac02_handoff_insert_guard();
CREATE FUNCTION public.nucleo_ac02_handoff_immutable_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$ BEGIN RAISE EXCEPTION 'AC02: append-only event; use new correction event'; END $fn$;
CREATE TRIGGER nucleo_ac02_handoff_no_change
 BEFORE UPDATE OR DELETE ON public.nucleo_ac02_handoff_events
 FOR EACH ROW EXECUTE FUNCTION public.nucleo_ac02_handoff_immutable_guard();

ALTER TABLE public.nucleo_ac02_handoff_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nucleo_ac02_handoff_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.nucleo_ac02_handoff_events TO authenticated;
CREATE POLICY nucleo_ac02_handoff_select ON public.nucleo_ac02_handoff_events
 FOR SELECT TO authenticated USING (
  (SELECT auth.uid())=recipient_auth_uid
  OR EXISTS(SELECT 1 FROM public.app_admin_capabilities c
    WHERE c.auth_user_id=(SELECT auth.uid())
    AND c.capability='nucleo_manage' AND c.active AND c.revoked_at IS NULL)
 );
CREATE POLICY nucleo_ac02_handoff_insert ON public.nucleo_ac02_handoff_events
 FOR INSERT TO authenticated WITH CHECK (
  actor_auth_uid=(SELECT auth.uid())
  AND (
   (event_kind IN ('recebido','aceito') AND recipient_auth_uid=(SELECT auth.uid()))
   OR
   (event_kind NOT IN ('recebido','aceito') AND EXISTS(
    SELECT 1 FROM public.app_admin_capabilities c
     WHERE c.auth_user_id=(SELECT auth.uid()) AND c.capability='nucleo_manage'
       AND c.active AND c.revoked_at IS NULL))
  )
 );
-- A evidência externa é apenas referenciada e não certificada por este ledger.
-- Um administrador pode declarar entrega, não confirmar recebimento/aceite alheio.
-- Não há grants de UPDATE/DELETE nem função SECURITY DEFINER.
COMMIT;
