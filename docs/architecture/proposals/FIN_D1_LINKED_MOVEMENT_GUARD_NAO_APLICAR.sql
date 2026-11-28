-- D1 candidate: disposable only. Not a migration; never apply to Lovable Cloud.
-- Narrow guard: freeze monetary identity of movements already linked to D1.
-- Does not authorize writers, block all unstructured inserts or solve concurrent cutover.
BEGIN;
CREATE FUNCTION fin_settlement_private.guard_linked_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF ROW(NEW.id,NEW.entry_id,NEW.account_id,NEW.value,NEW.movement_date)
 IS DISTINCT FROM ROW(OLD.id,OLD.entry_id,OLD.account_id,OLD.value,OLD.movement_date)
 AND (EXISTS(SELECT 1 FROM fin_settlement_private.settlements WHERE movement_id=OLD.id)
 OR EXISTS(SELECT 1 FROM fin_settlement_private.rectifications WHERE movement_id=OLD.id)) THEN
 RAISE EXCEPTION 'D1 linked movement is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fin_d1_guard_linked_movement BEFORE UPDATE ON public.financial_movements
 FOR EACH ROW EXECUTE FUNCTION fin_settlement_private.guard_linked_movement();
REVOKE ALL ON FUNCTION fin_settlement_private.guard_linked_movement() FROM PUBLIC,anon,authenticated,service_role;
-- Invoker-only fixture: API roles cannot read private schema. A trusted execution
-- identity, role matrix and race-safe cutover must be designed before production.
COMMIT;
