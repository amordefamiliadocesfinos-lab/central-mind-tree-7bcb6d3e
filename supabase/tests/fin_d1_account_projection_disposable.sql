\set ON_ERROR_STOP on
\ir ../../docs/architecture/proposals/FIN_D1_ACCOUNT_PROJECTION_NAO_APLICAR.sql
DO $$
DECLARE a uuid:='00000000-0000-0000-0000-000000000004'; r record;
BEGIN
 SELECT * INTO STRICT r FROM fin_settlement_private.account_comparison WHERE account_id=a;
 -- Prior fixture: legacy 280; older synthetic receipt revision +5, new chained receipt +2.
 IF r.legacy_balance<>280 OR r.signed_delta<>7 OR r.projected_balance<>287 OR r.invalid_count<>0 THEN RAISE EXCEPTION 'account projection mismatch: %',row_to_json(r); END IF;
 SELECT * INTO STRICT r FROM fin_settlement_private.cash_period_comparison WHERE account_id=a AND movement_date='2026-11-27' AND direction='receber';
 IF r.legacy_cash<>90 OR r.effective_cash<>92 OR r.cash_delta<>2 OR r.movement_count<>1 OR r.unmapped_principal_count<>0 OR r.invalid_count<>0 THEN RAISE EXCEPTION 'period projection mismatch'; END IF;
 -- Preserve an independent balance adjustment rather than reconstructing balance from movements.
 UPDATE public.financial_accounts SET current_balance=current_balance+11 WHERE id=a;
 IF (SELECT projected_balance FROM fin_settlement_private.account_comparison WHERE account_id=a)<>298 THEN RAISE EXCEPTION 'baseline adjustment lost'; END IF;
 UPDATE public.financial_accounts SET current_balance=current_balance-11 WHERE id=a;
 -- Payable sign tested with a synthetic direction change inside a rolled-back subtransaction.
 BEGIN
 UPDATE public.financial_entries SET type='pagar' WHERE id='00000000-0000-0000-0000-000000000002';
 IF (SELECT signed_delta FROM fin_settlement_private.account_comparison WHERE account_id=a)<>3 THEN RAISE EXCEPTION 'payable sign mismatch'; END IF;
 RAISE EXCEPTION 'fixture rollback';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'fixture rollback' THEN RAISE; END IF; END;
 BEGIN
 UPDATE public.financial_entries SET lifecycle_status='cancelled' WHERE id='00000000-0000-0000-0000-000000000002';
 IF (SELECT projected_balance FROM fin_settlement_private.account_comparison WHERE account_id=a) IS NOT NULL THEN RAISE EXCEPTION 'invalid revision not blocked'; END IF;
 RAISE EXCEPTION 'fixture rollback';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'fixture rollback' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM (VALUES('anon'),('authenticated'),('service_role')) x(role_name) WHERE has_table_privilege(role_name,'fin_settlement_private.account_comparison','SELECT') OR has_table_privilege(role_name,'fin_settlement_private.cash_period_comparison','SELECT')) THEN RAISE EXCEPTION 'projection ACL leak'; END IF;
 IF (SELECT current_balance FROM public.financial_accounts WHERE id=a)<>280 THEN RAISE EXCEPTION 'legacy balance changed'; END IF;
 RAISE NOTICE 'PASS shadow account, signed deltas, period cash, baseline adjustment, invalid revision, ACL and legacy preservation';
END $$;
