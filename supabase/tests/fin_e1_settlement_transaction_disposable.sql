-- Disposable PostgreSQL fixture only. Never apply to the official database.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA fin_e1_fixture;
SET LOCAL search_path=fin_e1_fixture,public;
CREATE TABLE obligation(id integer PRIMARY KEY, direction text NOT NULL CHECK(direction IN ('pagar','receber')), original bigint NOT NULL CHECK(original>0), principal_paid bigint NOT NULL DEFAULT 0, cash_paid bigint NOT NULL DEFAULT 0, reconciled boolean NOT NULL DEFAULT false, CHECK(principal_paid BETWEEN 0 AND original));
CREATE TABLE account(id integer PRIMARY KEY,balance bigint NOT NULL);
CREATE TABLE settlement(request_id uuid PRIMARY KEY, obligation_id integer NOT NULL REFERENCES obligation, account_id integer NOT NULL REFERENCES account, principal bigint NOT NULL, interest bigint NOT NULL, penalty bigint NOT NULL, discount bigint NOT NULL, fee bigint NOT NULL, marketplace_fee bigint NOT NULL, movement_date date NOT NULL, reason text NOT NULL, cash bigint NOT NULL CHECK(cash>0));
CREATE TABLE movement(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, request_id uuid UNIQUE NOT NULL REFERENCES settlement, account_id integer NOT NULL REFERENCES account, value bigint NOT NULL CHECK(value>0), movement_date date NOT NULL);
CREATE FUNCTION settle(p_key uuid,p_obligation integer,p_account integer,p_principal bigint,p_interest bigint,p_penalty bigint,p_discount bigint,p_fee bigint,p_marketplace bigint,p_date date,p_reason text) RETURNS bigint LANGUAGE plpgsql SET search_path=fin_e1_fixture,pg_temp AS $$
DECLARE o obligation%ROWTYPE; s settlement%ROWTYPE; v_cash bigint;
BEGIN
 IF p_key IS NULL OR p_obligation IS NULL OR p_account IS NULL OR p_principal IS NULL OR p_interest IS NULL OR p_penalty IS NULL OR p_discount IS NULL OR p_fee IS NULL OR p_marketplace IS NULL OR p_date IS NULL OR nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'invalid payload'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 SELECT * INTO s FROM settlement WHERE request_id=p_key;
 IF FOUND THEN
  IF ROW(s.obligation_id,s.account_id,s.principal,s.interest,s.penalty,s.discount,s.fee,s.marketplace_fee,s.movement_date,s.reason) IS DISTINCT FROM ROW(p_obligation,p_account,p_principal,p_interest,p_penalty,p_discount,p_fee,p_marketplace,p_date,p_reason) THEN RAISE EXCEPTION 'request collision'; END IF;
  RETURN s.cash;
 END IF;
 SELECT * INTO STRICT o FROM obligation WHERE id=p_obligation FOR UPDATE;
 IF o.reconciled THEN RAISE EXCEPTION 'protected reconciliation'; END IF;
 IF p_principal<=0 OR p_principal>o.original-o.principal_paid OR least(p_interest,p_penalty,p_discount,p_fee,p_marketplace)<0 OR p_discount>p_principal+p_interest+p_penalty THEN RAISE EXCEPTION 'invalid components'; END IF;
 IF o.direction='pagar' AND p_marketplace<>0 THEN RAISE EXCEPTION 'unsupported marketplace payable'; END IF;
 v_cash:=p_principal+p_interest+p_penalty-p_discount+CASE WHEN o.direction='pagar' THEN p_fee ELSE -p_fee-p_marketplace END;
 IF v_cash<=0 THEN RAISE EXCEPTION 'nonpositive cash'; END IF;
 PERFORM 1 FROM account WHERE id=p_account FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'missing account'; END IF;
 INSERT INTO settlement VALUES(p_key,p_obligation,p_account,p_principal,p_interest,p_penalty,p_discount,p_fee,p_marketplace,p_date,p_reason,v_cash);
 INSERT INTO movement(request_id,account_id,value,movement_date) VALUES(p_key,p_account,v_cash,p_date);
 UPDATE obligation SET principal_paid=principal_paid+p_principal,cash_paid=cash_paid+v_cash WHERE id=p_obligation;
 UPDATE account SET balance=balance+CASE WHEN o.direction='receber' THEN v_cash ELSE -v_cash END WHERE id=p_account;
 RETURN v_cash;
END $$;
INSERT INTO obligation(id,direction,original,reconciled) VALUES(1,'receber',10000,false),(2,'pagar',10000,false),(3,'pagar',5000,true),(4,'receber',10000,false);
INSERT INTO account VALUES(1,100000);
DO $test$
DECLARE k uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); r bigint;
BEGIN
 r:=settle(k,1,1,4000,0,0,400,200,100,'2026-11-27','partial');
 IF r<>3300 OR (SELECT principal_paid FROM obligation WHERE id=1)<>4000 OR (SELECT cash_paid FROM obligation WHERE id=1)<>3300 THEN RAISE EXCEPTION 'partial mismatch'; END IF;
 IF settle(k,1,1,4000,0,0,400,200,100,'2026-11-27','partial')<>3300 OR (SELECT count(*) FROM movement)<>1 THEN RAISE EXCEPTION 'replay mismatch'; END IF;
 BEGIN PERFORM settle(k,1,1,4001,0,0,400,200,100,'2026-11-27','partial'); RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'request collision' THEN RAISE; END IF; END;
 r:=settle(p,2,1,10000,500,200,100,300,0,'2026-11-27','paid');
 IF r<>10900 OR (SELECT principal_paid FROM obligation WHERE id=2)<>10000 OR (SELECT original FROM obligation WHERE id=2)<>10000 OR (SELECT balance FROM account WHERE id=1)<>92400 THEN RAISE EXCEPTION 'payable mismatch'; END IF;
 BEGIN PERFORM settle(gen_random_uuid(),2,1,1,0,0,0,0,0,'2026-11-27','extra'); RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'invalid components' THEN RAISE; END IF; END;
 BEGIN PERFORM settle(gen_random_uuid(),3,1,1000,0,0,0,0,0,'2026-11-27','protected'); RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'protected reconciliation' THEN RAISE; END IF; END;
 BEGIN PERFORM settle(gen_random_uuid(),4,99,1000,0,0,0,0,0,'2026-11-27','missing'); RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'missing account' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM settlement)<>2 OR (SELECT count(*) FROM movement)<>2 THEN RAISE EXCEPTION 'unexpected writes'; END IF;
END $test$;
-- Deliberately fail after settlement and movement insertion, before completion.
CREATE FUNCTION fail_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$;
CREATE TRIGGER fail_final_write BEFORE UPDATE ON account FOR EACH ROW EXECUTE FUNCTION fail_update();
DO $test$
BEGIN
 BEGIN PERFORM settle(gen_random_uuid(),4,1,1000,0,0,0,0,0,'2026-11-27','rollback'); RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'injected failure' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM settlement)<>2 OR (SELECT count(*) FROM movement)<>2 OR (SELECT principal_paid FROM obligation WHERE id=4)<>0 OR (SELECT cash_paid FROM obligation WHERE id=4)<>0 OR (SELECT balance FROM account WHERE id=1)<>92400 THEN RAISE EXCEPTION 'rollback failed'; END IF;
 RAISE NOTICE 'PASS: partial, full payable, replay, collision, overpayment, reconciled, missing account, atomic rollback';
END $test$;
ROLLBACK;
