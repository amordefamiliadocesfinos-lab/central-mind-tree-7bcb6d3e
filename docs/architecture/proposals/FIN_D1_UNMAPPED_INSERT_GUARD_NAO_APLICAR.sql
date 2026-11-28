-- D1 candidate only. Never apply to official Lovable Cloud.
-- Deferred consistency gate: a new movement on a structured obligation must
-- have a matching settlement at transaction end. No caller-controlled bypass.
-- Serialize with the candidate writers on the obligation row.
BEGIN;
CREATE FUNCTION fin_settlement_private.guard_new_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 PERFORM 1 FROM public.financial_entries WHERE id=NEW.entry_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM fin_settlement_private.settlements WHERE entry_id=NEW.entry_id)
 AND NOT EXISTS(SELECT 1 FROM fin_settlement_private.settlements s
 JOIN public.financial_movements m ON m.id=s.movement_id
 JOIN public.financial_entries e ON e.id=m.entry_id
 WHERE m.id=NEW.id AND s.entry_id=m.entry_id AND s.account_id=m.account_id
 AND s.cash=m.value AND s.movement_date=m.movement_date AND s.direction=e.type) THEN
 RAISE EXCEPTION 'D1 unmapped movement on structured obligation';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER fin_d1_guard_new_movement
 AFTER INSERT ON public.financial_movements DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION fin_settlement_private.guard_new_movement();
REVOKE ALL ON FUNCTION fin_settlement_private.guard_new_movement() FROM PUBLIC,anon,authenticated,service_role;
-- This candidate does not establish a safe cutover or cover legacy UPDATE,
-- concurrent writers under every isolation level, or direct privileged D1 writes.
-- Invoker fixture only; API authority and lock-order compatibility remain gates.
COMMIT;
