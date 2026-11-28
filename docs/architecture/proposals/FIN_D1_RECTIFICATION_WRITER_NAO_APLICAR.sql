-- D1 private candidate only. Never apply to official Cloud.
-- First tranche: value correction, same original effective date and account.
-- Preserve legacy value_paid and balance until a coordinated consumer cutover.
BEGIN;
CREATE FUNCTION fin_settlement_private.record_rectification(
 k uuid,mid uuid,expected numeric,corrected numeric,dt date,actor uuid,why text,evidence text
) RETURNS numeric LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
DECLARE mv public.financial_movements%ROWTYPE; e public.financial_entries%ROWTYPE; r fin_settlement_private.rectifications%ROWTYPE; effective numeric;
BEGIN
 IF k IS NULL OR mid IS NULL OR expected IS NULL OR corrected IS NULL OR dt IS NULL OR actor IS NULL OR nullif(btrim(why),'') IS NULL OR nullif(btrim(evidence),'') IS NULL OR expected::text IN ('NaN','Infinity','-Infinity') OR corrected::text IN ('NaN','Infinity','-Infinity') OR expected<=0 OR corrected<=0 OR corrected<>round(corrected,2) OR corrected>=1000000000000000000 THEN RAISE EXCEPTION 'invalid payload'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(k::text,0));
 SELECT * INTO r FROM fin_settlement_private.rectifications WHERE request_id=k;
 IF FOUND THEN
  IF ROW(r.movement_id,r.previous_value,r.corrected_value,r.effective_date,r.actor_id,r.reason,r.evidence_ref) IS DISTINCT FROM ROW(mid,expected,corrected,dt,actor,why,evidence) THEN RAISE EXCEPTION 'request collision'; END IF;
  RETURN r.corrected_value-r.previous_value;
 END IF;
 IF EXISTS(SELECT 1 FROM fin_settlement_private.settlements WHERE request_id=k) THEN RAISE EXCEPTION 'request collision'; END IF;
 SELECT * INTO STRICT mv FROM public.financial_movements WHERE id=mid;
 SELECT * INTO STRICT e FROM public.financial_entries WHERE id=mv.entry_id FOR UPDATE;
 -- Lock and recheck movement after obligation lock; no legacy mutation here.
 SELECT * INTO STRICT mv FROM public.financial_movements WHERE id=mid AND entry_id=e.id FOR UPDATE;
 IF e.lifecycle_status<>'active' OR e.is_conciliated OR e.type NOT IN ('pagar','receber') THEN RAISE EXCEPTION 'protected obligation'; END IF;
 IF dt<>mv.movement_date OR mv.account_id IS NULL THEN RAISE EXCEPTION 'unsupported date or account'; END IF;
 PERFORM 1 FROM public.financial_accounts WHERE id=mv.account_id AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive or missing account'; END IF;
 SELECT effective_cash INTO STRICT effective FROM fin_settlement_private.movement_comparison WHERE movement_id=mid;
 IF effective<>expected THEN RAISE EXCEPTION 'stale effective value'; END IF;
 IF effective=corrected THEN RAISE EXCEPTION 'no change'; END IF;
 INSERT INTO fin_settlement_private.rectifications(request_id,movement_id,previous_value,corrected_value,effective_date,actor_id,reason,evidence_ref)
 VALUES(k,mid,effective,corrected,dt,actor,why,evidence);
 RETURN corrected-effective;
END $$;
REVOKE ALL ON FUNCTION fin_settlement_private.record_rectification(uuid,uuid,numeric,numeric,date,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
-- Shadow projection only: no legacy balance mutation, no API, no trusted auth.
-- Evidence reference is not document verification. Cross-writer lock compatibility and
-- effective account balance projection must be proven before activation.
COMMIT;
