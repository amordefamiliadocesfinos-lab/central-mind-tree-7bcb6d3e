\set ON_ERROR_STOP on
-- Reuse D1 schema and writer fixture; legacy values must remain untouched.
\ir ../../docs/architecture/proposals/FIN_D1_RECTIFICATION_WRITER_NAO_APLICAR.sql
DO $$
DECLARE mid uuid; k uuid:=gen_random_uuid(); actor uuid:=gen_random_uuid(); entryid uuid:='00000000-0000-0000-0000-000000000002'; r record; delta numeric; aid uuid:='00000000-0000-0000-0000-000000000004';
BEGIN
 SELECT id INTO STRICT mid FROM public.financial_movements WHERE entry_id=entryid;
 delta:=fin_settlement_private.record_rectification(k,mid,90,95,'2026-11-27',actor,'fixture','synthetic-evidence');
 IF delta<>5 THEN RAISE EXCEPTION 'delta mismatch'; END IF;
 delta:=fin_settlement_private.record_rectification(k,mid,90,95,'2026-11-27',actor,'fixture','synthetic-evidence');
 IF delta<>5 OR (SELECT count(*) FROM fin_settlement_private.rectifications WHERE movement_id=mid)<>1 THEN RAISE EXCEPTION 'replay mismatch'; END IF;
 BEGIN PERFORM fin_settlement_private.record_rectification(k,mid,90,96,'2026-11-27',actor,'fixture','synthetic-evidence'); RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'request collision' THEN RAISE; END IF; END;
 BEGIN PERFORM fin_settlement_private.record_rectification(gen_random_uuid(),mid,90,96,'2026-11-27',actor,'fixture','synthetic-evidence'); RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'stale effective value' THEN RAISE; END IF; END;
 BEGIN PERFORM fin_settlement_private.record_rectification(gen_random_uuid(),mid,95,96,'2026-11-28',actor,'fixture','synthetic-evidence'); RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'unsupported date or account' THEN RAISE; END IF; END;
 BEGIN PERFORM fin_settlement_private.record_rectification(gen_random_uuid(),mid,95,96.001,'2026-11-27',actor,'fixture','synthetic-evidence'); RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'invalid payload' THEN RAISE; END IF; END;
 BEGIN PERFORM fin_settlement_private.record_rectification(gen_random_uuid(),mid,95,96,'2026-11-27',actor,'fixture',''); RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'invalid payload' THEN RAISE; END IF; END;
 BEGIN PERFORM fin_settlement_private.record_rectification((SELECT request_id FROM fin_settlement_private.settlements WHERE movement_id=mid),mid,95,96,'2026-11-27',actor,'fixture','synthetic-evidence'); RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'request collision' THEN RAISE; END IF; END;
 delta:=fin_settlement_private.record_rectification(gen_random_uuid(),mid,95,92,'2026-11-27',actor,'fixture','synthetic-evidence-2');
 IF delta<>-3 THEN RAISE EXCEPTION 'negative delta mismatch'; END IF;
 SELECT * INTO STRICT r FROM fin_settlement_private.obligation_comparison WHERE entry_id=entryid;
 IF r.legacy_paid<>90 OR r.explicit_principal<>100 OR r.explicit_remaining_principal<>100 OR r.effective_cash<>92 OR (SELECT value FROM public.financial_movements WHERE id=mid)<>90 OR (SELECT current_balance FROM public.financial_accounts WHERE id=aid)<>280 THEN RAISE EXCEPTION 'shadow readback mismatch'; END IF;
 UPDATE public.financial_entries SET is_conciliated=true WHERE id=entryid;
 BEGIN PERFORM fin_settlement_private.record_rectification(gen_random_uuid(),mid,92,93,'2026-11-27',actor,'fixture','synthetic-evidence'); RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'protected obligation' THEN RAISE; END IF; END;
 UPDATE public.financial_entries SET is_conciliated=false WHERE id=entryid;
 IF EXISTS(SELECT 1 FROM (VALUES('anon'),('authenticated'),('service_role')) x(role_name) WHERE has_function_privilege(role_name,'fin_settlement_private.record_rectification(uuid,uuid,numeric,numeric,date,uuid,text,text)','EXECUTE')) THEN RAISE EXCEPTION 'execute leak'; END IF;
 RAISE NOTICE 'PASS rectification shadow: chained deltas, replay, collision, stale, date, precision, evidence, protected obligation, ACL, legacy unchanged';
END $$;
