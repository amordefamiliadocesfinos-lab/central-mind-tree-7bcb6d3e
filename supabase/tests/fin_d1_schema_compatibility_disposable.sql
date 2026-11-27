\set ON_ERROR_STOP on
-- Disposable schema based on inspected UUID/numeric/date columns; not a full production clone.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TABLE public.financial_entries(id uuid PRIMARY KEY,value numeric NOT NULL,value_paid numeric NOT NULL DEFAULT 0);
CREATE TABLE public.financial_accounts(id uuid PRIMARY KEY,current_balance numeric NOT NULL DEFAULT 0);
CREATE TABLE public.financial_movements(id uuid PRIMARY KEY,entry_id uuid NOT NULL REFERENCES public.financial_entries,account_id uuid REFERENCES public.financial_accounts,movement_date date NOT NULL,value numeric NOT NULL);
INSERT INTO public.financial_entries VALUES('00000000-0000-0000-0000-000000000001',100,100),('00000000-0000-0000-0000-000000000002',200,0),('00000000-0000-0000-0000-000000000003',100,90);
INSERT INTO public.financial_accounts VALUES('00000000-0000-0000-0000-000000000004',190);
INSERT INTO public.financial_movements VALUES('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004','2026-11-01',100),('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','2026-11-02',90);
\ir ../../docs/architecture/proposals/FIN_D1_SCHEMA_CANDIDATE_NAO_APLICAR.sql
DO $$
BEGIN
 IF (SELECT count(*) FROM fin_settlement_private.settlements)<>0 OR (SELECT count(*) FROM fin_settlement_private.rectifications)<>0 THEN RAISE EXCEPTION 'unexpected backfill'; END IF;
 IF (SELECT explicit_remaining_principal FROM fin_settlement_private.obligation_comparison WHERE entry_id='00000000-0000-0000-0000-000000000001') IS NOT NULL THEN RAISE EXCEPTION 'legacy principal inferred'; END IF;
 IF (SELECT explicit_remaining_principal FROM fin_settlement_private.obligation_comparison WHERE entry_id='00000000-0000-0000-0000-000000000002')<>200 THEN RAISE EXCEPTION 'open obligation mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM (VALUES('anon'),('authenticated'),('service_role')) r(role_name) WHERE has_schema_privilege(role_name,'fin_settlement_private','USAGE') OR has_table_privilege(role_name,'fin_settlement_private.settlements','SELECT,INSERT,UPDATE,DELETE') OR has_table_privilege(role_name,'fin_settlement_private.rectifications','SELECT,INSERT,UPDATE,DELETE')) THEN RAISE EXCEPTION 'API privilege leak'; END IF;
END $$;
-- Owner-only synthetic inputs prove projection shape; do not constitute a writer.
INSERT INTO fin_settlement_private.settlements(request_id,movement_id,entry_id,account_id,direction,principal,interest,penalty,discount,fee,marketplace_fee,cash,movement_date,actor_id,reason)
VALUES('00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','receber',100,0,0,5,5,0,90,'2026-11-02','00000000-0000-0000-0000-000000000008','fixture');
INSERT INTO fin_settlement_private.rectifications(request_id,movement_id,previous_value,corrected_value,effective_date,actor_id,reason,evidence_ref)
VALUES('00000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000006',90,95,'2026-11-02','00000000-0000-0000-0000-000000000008','fixture','synthetic');
DO $$
DECLARE r record;
BEGIN
 SELECT * INTO STRICT r FROM fin_settlement_private.obligation_comparison WHERE entry_id='00000000-0000-0000-0000-000000000003';
 IF r.original_value<>100 OR r.legacy_paid<>90 OR r.explicit_principal<>100 OR r.explicit_remaining_principal<>0 OR r.effective_cash<>95 THEN RAISE EXCEPTION 'projection mismatch'; END IF;
 IF (SELECT sum(value) FROM public.financial_movements)<>190 OR (SELECT sum(value_paid) FROM public.financial_entries)<>190 OR (SELECT current_balance FROM public.financial_accounts)<>190 THEN RAISE EXCEPTION 'legacy changed'; END IF;
 BEGIN
 DELETE FROM public.financial_movements WHERE id='00000000-0000-0000-0000-000000000006';
 RAISE EXCEPTION 'linked movement deletion allowed';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 RAISE NOTICE 'PASS: additive schema, no backfill, private access, legacy unknown principal, explicit principal, rectification projection, legacy preservation, FK protection';
END $$;
