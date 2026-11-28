-- D1 candidate only. Never apply to official Lovable Cloud.
-- Protect principal and direction of obligations carrying structured settlements.
-- Do not replace purchase guards or freeze value_paid maintained by existing triggers.
BEGIN;
CREATE FUNCTION fin_settlement_private.guard_linked_obligation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF ROW(NEW.id,NEW.value,NEW.type,NEW.lifecycle_status)
 IS DISTINCT FROM ROW(OLD.id,OLD.value,OLD.type,OLD.lifecycle_status)
 AND (EXISTS(SELECT 1 FROM fin_settlement_private.settlements WHERE entry_id=OLD.id)
 OR EXISTS(SELECT 1 FROM fin_settlement_private.rectifications r JOIN public.financial_movements m ON m.id=r.movement_id WHERE m.entry_id=OLD.id)) THEN
 RAISE EXCEPTION 'D1 linked obligation identity is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fin_d1_guard_linked_obligation BEFORE UPDATE ON public.financial_entries
 FOR EACH ROW EXECUTE FUNCTION fin_settlement_private.guard_linked_obligation();
REVOKE ALL ON FUNCTION fin_settlement_private.guard_linked_obligation() FROM PUBLIC,anon,authenticated,service_role;
-- Owner-only disposable fixture. No API authority or concurrency guarantee.
-- Due date and origin-specific fields remain subject to existing domain guards.
COMMIT;
