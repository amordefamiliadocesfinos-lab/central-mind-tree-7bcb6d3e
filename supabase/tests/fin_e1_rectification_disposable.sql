-- Executed only after loading the disposable E1.7 fixture in a fresh test database.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path=fin_e1_fixture,pg_temp;
CREATE TABLE rectification(request_id uuid PRIMARY KEY, original_movement_id bigint NOT NULL REFERENCES movement, before_value bigint NOT NULL, after_value bigint NOT NULL CHECK(after_value>0), reason text NOT NULL, evidence text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(), CHECK(before_value<>after_value));
CREATE FUNCTION rectify(p_key uuid,p_movement bigint,p_expected bigint,p_correct bigint,p_reason text,p_evidence text) RETURNS bigint LANGUAGE plpgsql SET search_path=fin_e1_fixture,pg_temp AS $$
DECLARE m movement%ROWTYPE; s settlement%ROWTYPE; o obligation%ROWTYPE; r rectification%ROWTYPE; effective bigint; delta bigint;
BEGIN
 IF p_key IS NULL OR p_movement IS NULL OR p_expected IS NULL OR p_correct IS NULL OR p_correct<=0 OR nullif(btrim(p_reason),'') IS NULL OR nullif(btrim(p_evidence),'') IS NULL THEN RAISE EXCEPTION 'invalid payload'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 SELECT * INTO r FROM rectification WHERE request_id=p_key;
 IF FOUND THEN
  IF ROW(r.original_movement_id,r.before_value,r.after_value,r.reason,r.evidence) IS DISTINCT FROM ROW(p_movement,p_expected,p_correct,p_reason,p_evidence) THEN RAISE EXCEPTION 'request collision'; END IF;
  RETURN r.after_value-r.before_value;
 END IF;
 SELECT * INTO STRICT m FROM movement WHERE id=p_movement;
 SELECT * INTO STRICT s FROM settlement WHERE request_id=m.request_id;
 SELECT * INTO STRICT o FROM obligation WHERE id=s.obligation_id FOR UPDATE;
 IF o.reconciled THEN RAISE EXCEPTION 'protected reconciliation'; END IF;
 PERFORM 1 FROM account WHERE id=m.account_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'missing account'; END IF;
 SELECT m.value+coalesce(sum(after_value-before_value),0) INTO effective FROM rectification WHERE original_movement_id=m.id;
 IF effective<>p_expected THEN RAISE EXCEPTION 'stale effective value'; END IF;
 IF effective=p_correct THEN RAISE EXCEPTION 'no change'; END IF;
 delta:=p_correct-effective;
 INSERT INTO rectification(request_id,original_movement_id,before_value,after_value,reason,evidence) VALUES(p_key,m.id,effective,p_correct,p_reason,p_evidence);
 UPDATE obligation SET cash_paid=cash_paid+delta WHERE id=o.id;
 UPDATE account SET balance=balance+CASE WHEN o.direction='receber' THEN delta ELSE -delta END WHERE id=m.account_id;
 RETURN delta;
END $$;
INSERT INTO obligation(id,direction,original) VALUES(1,'pagar',175910),(2,'receber',10000);
INSERT INTO account VALUES(1,300000);
DO $$
DECLARE k uuid:=gen_random_uuid(); m bigint; n bigint;
BEGIN
 PERFORM settle(gen_random_uuid(),1,1,175910,0,0,0,0,0,'2026-11-13','synthetic');
 SELECT id INTO STRICT m FROM movement;
 IF rectify(k,m,175910,180410,'synthetic correction','fixture-proof')<>4500 THEN RAISE EXCEPTION 'delta mismatch'; END IF;
 IF rectify(k,m,175910,180410,'synthetic correction','fixture-proof')<>4500 THEN RAISE EXCEPTION 'replay mismatch'; END IF;
 IF (SELECT count(*) FROM rectification)<>1 OR (SELECT value FROM movement WHERE id=m)<>175910 OR (SELECT principal_paid FROM obligation WHERE id=1)<>175910 OR (SELECT cash_paid FROM obligation WHERE id=1)<>180410 OR (SELECT balance FROM account WHERE id=1)<>119590 THEN RAISE EXCEPTION 'invariant mismatch'; END IF;
 BEGIN PERFORM rectify(k,m,175910,180411,'synthetic correction','fixture-proof'); RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'request collision' THEN RAISE; END IF; END;
 BEGIN PERFORM rectify(gen_random_uuid(),m,175910,180420,'stale','fixture-proof'); RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'stale effective value' THEN RAISE; END IF; END;
 BEGIN PERFORM rectify(gen_random_uuid(),m,180410,180410,'same','fixture-proof'); RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'no change' THEN RAISE; END IF; END;
 BEGIN PERFORM rectify(gen_random_uuid(),m,180410,180420,'missing',''); RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'invalid payload' THEN RAISE; END IF; END;
 UPDATE obligation SET reconciled=true WHERE id=1;
 BEGIN PERFORM rectify(gen_random_uuid(),m,180410,180420,'protected','fixture-proof'); RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'protected reconciliation' THEN RAISE; END IF; END;
 PERFORM settle(gen_random_uuid(),2,1,10000,0,0,0,0,0,'2026-11-13','synthetic receipt');
 SELECT mv.id INTO STRICT n FROM movement mv JOIN settlement st ON st.request_id=mv.request_id WHERE st.obligation_id=2;
 IF rectify(gen_random_uuid(),n,10000,9000,'receipt correction','fixture-proof')<>-1000 THEN RAISE EXCEPTION 'receipt delta mismatch'; END IF;
 IF (SELECT balance FROM account WHERE id=1)<>128590 OR (SELECT cash_paid FROM obligation WHERE id=2)<>9000 OR (SELECT principal_paid FROM obligation WHERE id=2)<>10000 THEN RAISE EXCEPTION 'receipt readback mismatch'; END IF;
END $$;
CREATE FUNCTION fail_rectification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$;
CREATE TRIGGER fail_rectification BEFORE UPDATE ON account FOR EACH ROW EXECUTE FUNCTION fail_rectification();
DO $$
DECLARE n bigint;
BEGIN
 SELECT mv.id INTO STRICT n FROM movement mv JOIN settlement st ON st.request_id=mv.request_id WHERE st.obligation_id=2;
 BEGIN PERFORM rectify(gen_random_uuid(),n,9000,9500,'rollback','fixture-proof'); RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'injected failure' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM rectification)<>2 OR (SELECT cash_paid FROM obligation WHERE id=2)<>9000 OR (SELECT balance FROM account WHERE id=1)<>128590 OR (SELECT count(*) FROM movement)<>2 THEN RAISE EXCEPTION 'rollback mismatch'; END IF;
 RAISE NOTICE 'PASS rectification: immutable original, signed delta, replay, collision, stale, no-op, evidence, reconciliation, rollback';
END $$;
ROLLBACK;
