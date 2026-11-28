\set ON_ERROR_STOP on
\ir ../../docs/architecture/proposals/FIN_D1_LINKED_OBLIGATION_GUARD_NAO_APLICAR.sql
BEGIN;
DO $$
DECLARE eid uuid:='00000000-0000-0000-0000-000000000002'; legacy uuid:='00000000-0000-0000-0000-000000000001'; aid uuid:='00000000-0000-0000-0000-000000000004'; r record; mid uuid;
BEGIN
 BEGIN UPDATE public.financial_entries SET value=201 WHERE id=eid; RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'D1 linked obligation identity is immutable' THEN RAISE; END IF; END;
 BEGIN UPDATE public.financial_entries SET type='pagar' WHERE id=eid; RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'D1 linked obligation identity is immutable' THEN RAISE; END IF; END;
 BEGIN UPDATE public.financial_entries SET lifecycle_status='cancelled' WHERE id=eid; RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'D1 linked obligation identity is immutable' THEN RAISE; END IF; END;
 BEGIN UPDATE public.financial_entries SET id=gen_random_uuid() WHERE id=eid; RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'D1 linked obligation identity is immutable' THEN RAISE; END IF; END;
 UPDATE public.financial_entries SET value=101 WHERE id=legacy;
 IF (SELECT value FROM public.financial_entries WHERE id=legacy)<>101 THEN RAISE EXCEPTION 'unlinked legacy behavior changed'; END IF;
 mid:=fin_settlement_private.record_settlement(gen_random_uuid(),eid,aid,10,0,0,0,0,0,'2026-11-27',gen_random_uuid(),'guard fixture');
 SELECT * INTO STRICT r FROM fin_settlement_private.obligation_comparison WHERE entry_id=eid;
 IF r.original_value<>200 OR r.legacy_paid<>150 OR r.explicit_principal<>160 OR r.explicit_remaining_principal<>40 OR r.effective_cash<>156 THEN RAISE EXCEPTION 'settlement regression: %',row_to_json(r); END IF;
 UPDATE public.financial_entries SET is_conciliated=true WHERE id=eid;
 IF NOT (SELECT is_conciliated FROM public.financial_entries WHERE id=eid) THEN RAISE EXCEPTION 'conciliation behavior changed'; END IF;
 RAISE NOTICE 'PASS linked obligation identity, existing settlement trigger and unlinked legacy';
END $$;
ROLLBACK;
