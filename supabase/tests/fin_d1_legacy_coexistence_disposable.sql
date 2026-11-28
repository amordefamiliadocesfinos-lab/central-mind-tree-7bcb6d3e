\set ON_ERROR_STOP on
-- Run after cumulative D1 fixtures. These are deliberate negative compatibility probes,
-- not an authorization to install a guard or change production.
BEGIN;
DO $$
DECLARE eid uuid:='00000000-0000-0000-0000-000000000002'; aid uuid:='00000000-0000-0000-0000-000000000004'; mid uuid; r record; actor uuid:=gen_random_uuid();
BEGIN
 SELECT movement_id INTO STRICT mid FROM fin_settlement_private.settlements WHERE entry_id=eid AND cash=90;
 -- Legacy direct insert can bypass structured principal; candidate detects ambiguity.
 INSERT INTO public.financial_movements(entry_id,account_id,value,movement_date,notes) VALUES(eid,aid,10,'2026-11-27','legacy fixture');
 SELECT * INTO STRICT r FROM fin_settlement_private.obligation_comparison WHERE entry_id=eid;
 IF r.unmapped_movements<>1 OR r.explicit_remaining_principal IS NOT NULL OR r.legacy_paid<>150 THEN RAISE EXCEPTION 'mixed history detection failed'; END IF;
 BEGIN
 PERFORM fin_settlement_private.record_settlement(gen_random_uuid(),eid,aid,1,0,0,0,0,0,'2026-11-27',actor,'fixture');
 RAISE EXCEPTION 'unexpected success';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'unknown or insufficient principal' THEN RAISE; END IF; END;
 RAISE NOTICE 'PASS mixed history detected; BLOCKER legacy direct insert still allowed';
 -- FK protection already prevents deleting linked movement, but does not prevent updating its value.
 UPDATE public.financial_movements SET value=91 WHERE id=mid;
 IF NOT EXISTS(SELECT 1 FROM fin_settlement_private.settlements s JOIN public.financial_movements m ON m.id=s.movement_id WHERE s.movement_id=mid AND s.cash<>m.value) THEN RAISE EXCEPTION 'expected baseline drift not observed'; END IF;
 RAISE NOTICE 'BLOCKER linked movement value can drift under legacy UPDATE; activation prohibited';
 -- Original obligation can also be changed without a new structured settlement.
 UPDATE public.financial_entries SET value=201 WHERE id=eid;
 IF (SELECT original_value FROM fin_settlement_private.obligation_comparison WHERE entry_id=eid)<>201 THEN RAISE EXCEPTION 'expected obligation drift not observed'; END IF;
 RAISE NOTICE 'BLOCKER obligation value mutable in representative fixture; actual production guards must be inventoried';
END $$;
ROLLBACK;
DO $$
BEGIN
 IF (SELECT legacy_paid FROM fin_settlement_private.obligation_comparison WHERE entry_id='00000000-0000-0000-0000-000000000002')<>140 OR (SELECT projected_balance FROM fin_settlement_private.account_comparison WHERE account_id='00000000-0000-0000-0000-000000000004')<>341 THEN RAISE EXCEPTION 'negative probe rollback failed'; END IF;
END $$;
