-- STAGING ONLY: mirror current Core M3 immutability read from pg_get_functiondef
-- on 2026-11-23. Does NOT alter the productive M3 function/triggers.
\set ON_ERROR_STOP on
CREATE FUNCTION f12_core.m3_official_identity_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $official$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.code IS DISTINCT FROM OLD.code
    OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
   RAISE EXCEPTION 'M3 identity fields immutable';
 END IF;
 RETURN NEW;
END $official$;
CREATE TRIGGER m3_official_before BEFORE UPDATE ON f12_core.workstreams
 FOR EACH ROW EXECUTE FUNCTION f12_core.m3_official_identity_guard();
-- Baseline checks: access stays restricted by owner-only RLS and not via client grants.
DO $verify$
BEGIN
 IF (SELECT count(*) FROM pg_trigger WHERE tgrelid='f12_core.workstreams'::regclass
   AND tgname IN ('m3_official_before','m3_reparent_reference_guard'))<>2 THEN
   RAISE EXCEPTION 'M3 staging trigger reconciliation incomplete';
 END IF;
END $verify$;
