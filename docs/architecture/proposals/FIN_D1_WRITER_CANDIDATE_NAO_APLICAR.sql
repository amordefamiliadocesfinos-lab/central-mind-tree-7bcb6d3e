-- D1 candidate only: owner-only invoker functions, no production authorization.
-- Assumes existing movement INSERT triggers maintain legacy balance and value_paid.
BEGIN;
CREATE FUNCTION fin_settlement_private.record_settlement(
 k uuid,eid uuid,aid uuid,p numeric,j numeric,m numeric,d numeric,t numeric,mp numeric,dt date,actor uuid,why text
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
DECLARE e public.financial_entries%ROWTYPE; s fin_settlement_private.settlements%ROWTYPE; mid uuid; net numeric; remaining numeric; unmapped bigint;
BEGIN
 IF k IS NULL OR eid IS NULL OR aid IS NULL OR dt IS NULL OR actor IS NULL OR nullif(btrim(why),'') IS NULL OR EXISTS (SELECT 1 FROM unnest(ARRAY[p,j,m,d,t,mp]) v WHERE v IS NULL OR v::text IN ('NaN','Infinity','-Infinity') OR v<0 OR v<>round(v,2) OR v>=1000000000000000000) OR p<=0 OR d>p+j+m THEN RAISE EXCEPTION 'invalid payload'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(k::text,0));
 SELECT * INTO s FROM fin_settlement_private.settlements WHERE request_id=k;
 IF FOUND THEN
  IF ROW(s.entry_id,s.account_id,s.principal,s.interest,s.penalty,s.discount,s.fee,s.marketplace_fee,s.movement_date,s.actor_id,s.reason) IS DISTINCT FROM ROW(eid,aid,p,j,m,d,t,mp,dt,actor,why) THEN RAISE EXCEPTION 'request collision'; END IF;
  RETURN s.movement_id;
 END IF;
 IF EXISTS(SELECT 1 FROM fin_settlement_private.rectifications WHERE request_id=k) THEN RAISE EXCEPTION 'request collision'; END IF;
 SELECT * INTO STRICT e FROM public.financial_entries WHERE id=eid FOR UPDATE;
 IF e.lifecycle_status<>'active' OR e.is_conciliated OR e.type NOT IN ('pagar','receber') OR (e.type='pagar' AND mp<>0) THEN RAISE EXCEPTION 'protected or unsupported obligation'; END IF;
 SELECT explicit_remaining_principal,unmapped_movements INTO remaining,unmapped FROM fin_settlement_private.obligation_comparison WHERE entry_id=eid;
 IF unmapped<>0 OR remaining IS NULL OR p>remaining THEN RAISE EXCEPTION 'unknown or insufficient principal'; END IF;
 net:=p+j+m-d+CASE WHEN e.type='pagar' THEN t ELSE -t-mp END;
 IF net<=0 OR net>=1000000000000000000 THEN RAISE EXCEPTION 'invalid cash'; END IF;
 PERFORM 1 FROM public.financial_accounts WHERE id=aid AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive or missing account'; END IF;
 INSERT INTO public.financial_movements(entry_id,account_id,value,movement_date,notes,created_by)
 VALUES(eid,aid,net,dt,why,actor::text) RETURNING id INTO mid;
 INSERT INTO fin_settlement_private.settlements(request_id,movement_id,entry_id,account_id,direction,principal,interest,penalty,discount,fee,marketplace_fee,cash,movement_date,actor_id,reason)
 VALUES(k,mid,eid,aid,e.type,p,j,m,d,t,mp,net,dt,actor,why);
 RETURN mid;
END $$;
REVOKE ALL ON FUNCTION fin_settlement_private.record_settlement(uuid,uuid,uuid,numeric,numeric,numeric,numeric,numeric,numeric,date,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
-- Actor is explicit fixture input, not trusted authentication. No API wrapper.
-- No payment_date or CRM event until consumer contract is integrated.
COMMIT;
