\set ON_ERROR_STOP on
\ir ../../docs/architecture/proposals/FIN_D1_LINKED_MOVEMENT_GUARD_NAO_APLICAR.sql
BEGIN;
DO $$
DECLARE mid uuid; legacy uuid:='00000000-0000-0000-0000-000000000005'; r record;
BEGIN
 SELECT movement_id INTO STRICT mid FROM fin_settlement_private.settlements WHERE entry_id='00000000-0000-0000-0000-000000000002' AND cash=90;
 BEGIN UPDATE public.financial_movements SET value=91 WHERE id=mid; RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'D1 linked movement is immutable' THEN RAISE; END IF; END;
 BEGIN UPDATE public.financial_movements SET movement_date='2026-11-28' WHERE id=mid; RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'D1 linked movement is immutable' THEN RAISE; END IF; END;
 BEGIN UPDATE public.financial_movements SET account_id=NULL WHERE id=mid; RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'D1 linked movement is immutable' THEN RAISE; END IF; END;
 BEGIN UPDATE public.financial_movements SET entry_id='00000000-0000-0000-0000-000000000001' WHERE id=mid; RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'D1 linked movement is immutable' THEN RAISE; END IF; END;
 BEGIN UPDATE public.financial_movements SET id=gen_random_uuid() WHERE id=mid; RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'D1 linked movement is immutable' THEN RAISE; END IF; END;
 UPDATE public.financial_movements SET notes='metadata only' WHERE id=mid;
 UPDATE public.financial_movements SET value=101 WHERE id=legacy;
 IF (SELECT value FROM public.financial_movements WHERE id=legacy)<>101 THEN RAISE EXCEPTION 'unlinked legacy behavior changed'; END IF;
 SELECT * INTO STRICT r FROM fin_settlement_private.movement_comparison WHERE movement_id=mid;
 IF r.legacy_cash<>90 OR r.effective_cash<>96 THEN RAISE EXCEPTION 'linked movement drift'; END IF;
 RAISE NOTICE 'PASS linked movement monetary identity frozen; metadata and unlinked legacy retained';
END $$;
ROLLBACK;
