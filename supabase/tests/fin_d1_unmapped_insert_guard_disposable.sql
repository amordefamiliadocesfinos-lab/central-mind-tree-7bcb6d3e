\set ON_ERROR_STOP on
\ir ../../docs/architecture/proposals/FIN_D1_UNMAPPED_INSERT_GUARD_NAO_APLICAR.sql
BEGIN;
DO $$
DECLARE eid uuid:='00000000-0000-0000-0000-000000000002'; aid uuid:='00000000-0000-0000-0000-000000000004'; legacy uuid:='00000000-0000-0000-0000-000000000001'; r record; mid uuid;
BEGIN
 BEGIN
 INSERT INTO public.financial_movements(entry_id,account_id,value,movement_date,notes) VALUES(eid,aid,10,'2026-11-27','legacy incompatible');
 SET CONSTRAINTS fin_d1_guard_new_movement IMMEDIATE;
 RAISE EXCEPTION 'unexpected success';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'D1 unmapped movement on structured obligation' THEN RAISE; END IF; END;
 SELECT * INTO STRICT r FROM fin_settlement_private.obligation_comparison WHERE entry_id=eid;
 IF r.legacy_paid<>140 OR r.unmapped_movements<>0 OR (SELECT current_balance FROM public.financial_accounts WHERE id=aid)<>330 THEN RAISE EXCEPTION 'failed insert rollback mismatch'; END IF;
 SET CONSTRAINTS fin_d1_guard_new_movement DEFERRED;
 mid:=fin_settlement_private.record_settlement(gen_random_uuid(),eid,aid,10,0,0,0,0,0,'2026-11-27',gen_random_uuid(),'guard fixture');
 SET CONSTRAINTS fin_d1_guard_new_movement IMMEDIATE;
 SELECT * INTO STRICT r FROM fin_settlement_private.obligation_comparison WHERE entry_id=eid;
 IF r.explicit_principal<>160 OR r.explicit_remaining_principal<>40 OR r.effective_cash<>156 OR r.legacy_paid<>150 OR r.unmapped_movements<>0 THEN RAISE EXCEPTION 'candidate writer regression'; END IF;
 INSERT INTO public.financial_movements(entry_id,account_id,value,movement_date,notes) VALUES(legacy,aid,5,'2026-11-27','unstructured legacy');
 IF (SELECT unmapped_movements FROM fin_settlement_private.obligation_comparison WHERE entry_id=legacy)<>2 THEN RAISE EXCEPTION 'legacy behavior changed'; END IF;
 RAISE NOTICE 'PASS deferred guard: incompatible insertion rejected, rollback, D1 writer and legacy preserved';
END $$;
ROLLBACK;
