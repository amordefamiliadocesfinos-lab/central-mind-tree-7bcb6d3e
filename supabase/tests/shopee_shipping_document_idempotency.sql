-- Run ONLY in a disposable database with synthetic fixtures, after the migration.
-- Fixture account 1111..., Shop 123, canonical order SYNTHETIC123.
BEGIN;
DO $$
DECLARE
  a jsonb; b jsonb; c jsonb;
  account uuid := '11111111-1111-4111-8111-111111111111';
  fingerprint text := repeat('a',64);
BEGIN
  a := public.claim_shopee_shipping_document(account,123,'SYNTHETIC123','SQL_PK1','NORMAL_AIR_WAYBILL',fingerprint);
  IF a->>'status' <> 'claimed' OR (a->>'fresh')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'fresh claim failed'; END IF;
  b := public.claim_shopee_shipping_document(account,123,'SYNTHETIC123','SQL_PK1','NORMAL_AIR_WAYBILL',fingerprint);
  IF b->>'status' <> 'already_claimed' OR b->>'attempt_id' <> a->>'attempt_id' THEN RAISE EXCEPTION 'duplicate claim allowed'; END IF;
  b := public.resolve_shopee_shipping_document((a->>'attempt_id')::uuid,fingerprint,'succeeded');
  IF b->>'state' <> 'succeeded' THEN RAISE EXCEPTION 'resolution failed'; END IF;
  b := public.claim_shopee_shipping_document(account,123,'SYNTHETIC123','SQL_PK1','NORMAL_AIR_WAYBILL',fingerprint);
  IF b->>'status' <> 'already_succeeded' OR (b->>'fresh')::boolean IS NOT FALSE THEN RAISE EXCEPTION 'success retry allowed'; END IF;
  b := public.resolve_shopee_shipping_document((a->>'attempt_id')::uuid,fingerprint,'uncertain');
  IF b->>'status' <> 'transition_forbidden' THEN RAISE EXCEPTION 'terminal state changed'; END IF;
  b := public.claim_shopee_shipping_document(account,123,'SYNTHETIC123','SQL_PK1','NORMAL_AIR_WAYBILL',repeat('b',64));
  IF b->>'status' <> 'claim_fingerprint_mismatch' THEN RAISE EXCEPTION 'fingerprint bypass'; END IF;
  c := public.claim_shopee_shipping_document(account,123,'SYNTHETIC123','SQL_PK2','NORMAL_AIR_WAYBILL',fingerprint);
  b := public.resolve_shopee_shipping_document((c->>'attempt_id')::uuid,fingerprint,'uncertain');
  b := public.claim_shopee_shipping_document(account,123,'SYNTHETIC123','SQL_PK2','NORMAL_AIR_WAYBILL',fingerprint);
  IF b->>'status' <> 'uncertain_requires_reconciliation' THEN RAISE EXCEPTION 'uncertain retry allowed'; END IF;
  b := public.claim_shopee_shipping_document(account,999,'SYNTHETIC123','SQL_PK3','NORMAL_AIR_WAYBILL',fingerprint);
  IF b->>'status' <> 'account_or_shop_mismatch' THEN RAISE EXCEPTION 'wrong shop accepted'; END IF;
  b := public.claim_shopee_shipping_document(account,123,'SYNTHETIC123','SQL_PK3','THERMAL_AIR_WAYBILL',fingerprint);
  IF b->>'status' <> 'invalid_request' THEN RAISE EXCEPTION 'wrong type accepted'; END IF;
  IF has_function_privilege('anon','public.claim_shopee_shipping_document(uuid,bigint,text,text,text,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.resolve_shopee_shipping_document(uuid,text,text)','EXECUTE')
     OR has_table_privilege('authenticated','public.shopee_shipping_document_attempts','SELECT') THEN
    RAISE EXCEPTION 'browser role access';
  END IF;
  IF NOT has_function_privilege('service_role','public.claim_shopee_shipping_document(uuid,bigint,text,text,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'runtime role cannot claim';
  END IF;
END $$;
ROLLBACK;
