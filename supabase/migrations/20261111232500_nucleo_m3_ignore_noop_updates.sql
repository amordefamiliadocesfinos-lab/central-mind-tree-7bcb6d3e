-- Núcleo 2.0 — M3: impedir histórico redundante em UPDATE sem mudança semântica.
-- ADDITIVE: substitui exclusivamente a função já usada pelo gatilho BEFORE.
-- Não reescreve eventos existentes, não muda RLS nem conteúdo.
BEGIN;
DO $gate$
BEGIN
  IF to_regclass('public.nucleo_development_workstreams') IS NULL
    OR to_regclass('public.nucleo_development_events') IS NULL
    OR to_regprocedure('public.nucleo_m3_workstream_audit()') IS NULL
    OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.nucleo_development_workstreams'::regclass
      AND tgname='nucleo_m3_workstream_before' AND tgenabled='O') THEN
    RAISE EXCEPTION 'M3 no-op hardening requires active M3 schema';
  END IF;
END $gate$;

CREATE OR REPLACE FUNCTION public.nucleo_m3_workstream_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $audit$
DECLARE parent_kind text;
BEGIN
 IF TG_OP='UPDATE' THEN
   IF NEW.id IS DISTINCT FROM OLD.id OR NEW.code IS DISTINCT FROM OLD.code
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.created_by_auth_uid IS DISTINCT FROM OLD.created_by_auth_uid
     OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
     RAISE EXCEPTION 'M3 identity fields immutable';
   END IF;

   -- Ignorar os campos de auditoria preenchidos exclusivamente pelo servidor.
   -- Se o registro efetivo é idêntico, cancelar a atualização ANTES de gerar
   -- updated_at e ANTES do trigger AFTER de histórico.
   IF ROW(NEW.title,NEW.description,NEW.status,NEW.priority,NEW.specialist,
          NEW.next_action,NEW.acceptance_criteria,NEW.blocker,
          NEW.evidence_state,NEW.evidence_note)
     IS NOT DISTINCT FROM
      ROW(OLD.title,OLD.description,OLD.status,OLD.priority,OLD.specialist,
          OLD.next_action,OLD.acceptance_criteria,OLD.blocker,
          OLD.evidence_state,OLD.evidence_note) THEN
     RETURN NULL;
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
END $audit$;
COMMIT;
