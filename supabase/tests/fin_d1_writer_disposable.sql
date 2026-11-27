\set ON_ERROR_STOP on
-- Extend the already-tested disposable compatibility fixture, not production.
ALTER TABLE public.financial_entries ADD COLUMN type text NOT NULL DEFAULT 'receber', ADD COLUMN lifecycle_status text NOT NULL DEFAULT 'active', ADD COLUMN is_conciliated boolean NOT NULL DEFAULT false;
ALTER TABLE public.financial_accounts ADD COLUMN is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.financial_movements ALTER COLUMN id SET DEFAULT gen_random_uuid(), ADD COLUMN notes text, ADD COLUMN created_by text;
-- Representative INSERT effects only; not the complete production trigger graph.
CREATE FUNCTION public.fixture_movement_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE public.financial_entries SET value_paid=(SELECT sum(value) FROM public.financial_movements WHERE entry_id=NEW.entry_id) WHERE id=NEW.entry_id;
 UPDATE public.financial_accounts SET current_balance=current_balance+CASE WHEN (SELECT type FROM public.financial_entries WHERE id=NEW.entry_id)='receber' THEN NEW.value ELSE -NEW.value END WHERE id=NEW.account_id;
 RETURN NEW;
END $$;
CREATE TRIGGER fixture_movement_insert AFTER INSERT ON public.financial_movements FOR EACH ROW EXECUTE FUNCTION public.fixture_movement_insert();
\ir ../../docs/architecture/proposals/FIN_D1_WRITER_CANDIDATE_NAO_APLICAR.sql
DO $$
DECLARE e uuid:='00000000-0000-0000-0000-000000000002'; a uuid:='00000000-0000-0000-0000-000000000004'; actor uuid:=gen_random_uuid(); k uuid:=gen_random_uuid(); mid uuid; replay uuid; r record;
BEGIN
 mid:=fin_settlement_private.record_settlement(k,e,a,100,0,0,5,5,0,'2026-11-27',actor,'fixture');
 replay:=fin_settlement_private.record_settlement(k,e,a,100,0,0,5,5,0,'2026-11-27',actor,'fixture');
 IF mid IS DISTINCT FROM replay THEN RAISE EXCEPTION 'replay mismatch'; END IF;
 SELECT * INTO STRICT r FROM fin_settlement_private.obligation_comparison WHERE entry_id=e;
 IF r.legacy_paid<>90 OR r.explicit_principal<>100 OR r.explicit_remaining_principal<>100 OR r.effective_cash<>90 OR (SELECT current_balance FROM public.financial_accounts WHERE id=a)<>280 OR (SELECT count(*) FROM public.financial_movements WHERE entry_id=e)<>1 THEN RAISE EXCEPTION 'readback mismatch'; END IF;
 BEGIN PERFORM fin_settlement_private.record_settlement(k,e,a,101,0,0,5,5,0,'2026-11-27',actor,'fixture'); RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'request collision' THEN RAISE; END IF; END;
 BEGIN PERFORM fin_settlement_private.record_settlement(gen_random_uuid(),e,a,1.001,0,0,0,0,0,'2026-11-27',actor,'fixture'); RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'invalid payload' THEN RAISE; END IF; END;
 BEGIN PERFORM fin_settlement_private.record_settlement(gen_random_uuid(),e,a,101,0,0,0,0,0,'2026-11-27',actor,'fixture'); RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'unknown or insufficient principal' THEN RAISE; END IF; END;
 BEGIN PERFORM fin_settlement_private.record_settlement(gen_random_uuid(),'00000000-0000-0000-0000-000000000001',a,1,0,0,0,0,0,'2026-11-27',actor,'fixture'); RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'unknown or insufficient principal' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM (VALUES('anon'),('authenticated'),('service_role')) r(role_name) WHERE has_function_privilege(role_name,'fin_settlement_private.record_settlement(uuid,uuid,uuid,numeric,numeric,numeric,numeric,numeric,numeric,date,uuid,text)','EXECUTE')) THEN RAISE EXCEPTION 'execute leak'; END IF;
 RAISE NOTICE 'PASS writer: trigger readback, exact precision, replay, collision, principal cap, legacy ambiguity, ACL';
END $$;
CREATE FUNCTION fin_settlement_private.fixture_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$;
CREATE TRIGGER fixture_fail BEFORE INSERT ON fin_settlement_private.settlements FOR EACH ROW EXECUTE FUNCTION fin_settlement_private.fixture_fail();
DO $$
DECLARE e uuid:='00000000-0000-0000-0000-000000000002'; a uuid:='00000000-0000-0000-0000-000000000004';
BEGIN
 BEGIN PERFORM fin_settlement_private.record_settlement(gen_random_uuid(),e,a,50,0,0,0,0,0,'2026-11-27',gen_random_uuid(),'rollback'); RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'injected failure' THEN RAISE; END IF; END;
 IF (SELECT value_paid FROM public.financial_entries WHERE id=e)<>90 OR (SELECT current_balance FROM public.financial_accounts WHERE id=a)<>280 OR (SELECT count(*) FROM public.financial_movements WHERE entry_id=e)<>1 THEN RAISE EXCEPTION 'trigger rollback mismatch'; END IF;
 RAISE NOTICE 'PASS rollback of legacy trigger effects';
END $$;
