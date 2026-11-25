-- G03 disposable assertions: no connection to production Lovable Cloud.
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

SET ROLE authenticated;
SET request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
DO $$
DECLARE
  payload jsonb := jsonb_build_object(
   'offer_family','T30-2','offer_architecture','T30-2','canonical_sku','AF-TRF30-KT-030-BRG',
   'canonical_decision_source','Matriz V40','observation_kind','UNKNOWN',
   'reconciliation_status','PREPARADO_NO_CORE','event_kind','DECISAO'
  );
  reply jsonb;
BEGIN
 reply:=public.record_marketplace_seller_sku_state(
  '30000000-0000-0000-0000-000000000001','980cb680-5296-4342-b83d-4e09584a3fe0',0,payload);
 IF reply->>'revision'<>'1' OR reply->>'already_applied'<>'false' THEN RAISE EXCEPTION 'first write failed'; END IF;
 reply:=public.record_marketplace_seller_sku_state(
  '30000000-0000-0000-0000-000000000001','980cb680-5296-4342-b83d-4e09584a3fe0',0,payload);
 IF reply->>'revision'<>'1' OR reply->>'already_applied'<>'true' THEN RAISE EXCEPTION 'idempotency failed'; END IF;
 IF (SELECT count(*) FROM public.marketplace_seller_sku_state)<>1
   OR (SELECT count(*) FROM public.marketplace_seller_sku_events)<>1 THEN RAISE EXCEPTION 'single event expected'; END IF;
 BEGIN
  PERFORM public.record_marketplace_seller_sku_state(
   '30000000-0000-0000-0000-000000000002','980cb680-5296-4342-b83d-4e09584a3fe0',0,payload);
  RAISE EXCEPTION 'stale revision should fail';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'seller_sku_revision_conflict' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.record_marketplace_seller_sku_state(
   '30000000-0000-0000-0000-000000000001','980cb680-5296-4342-b83d-4e09584a3fe0',0,
   payload||'{"canonical_sku":"AF-DIVERGENTE"}'::jsonb);
  RAISE EXCEPTION 'id reuse should fail';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'seller_sku_idempotency_conflict' THEN RAISE; END IF;
 END;
 -- O mesmo código comercial não cria mapping novo e o histórico é append-only.
 BEGIN
  UPDATE public.marketplace_seller_sku_state SET canonical_sku='INDEVIDO';
  RAISE EXCEPTION 'direct state update must be denied';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM public.record_marketplace_seller_sku_state(
   '30000000-0000-0000-0000-000000000003','980cb680-5296-4342-b83d-4e09584a3fe1',0,
   payload||'{"canonical_sku":"AF-TRF30-KT-030-AMD"}'::jsonb);
  RAISE EXCEPTION '40g component in T30 should fail';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'seller_sku_physical_exception' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.record_marketplace_seller_sku_state(
   '30000000-0000-0000-0000-000000000006','980cb680-5296-4342-b83d-4e09584a3fe1',0,
   payload||'{"canonical_sku":"AF-TRF30-KT-030-AMD","offer_architecture":"T40-2"}'::jsonb);
  RAISE EXCEPTION 'architecture spoof must fail';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'seller_sku_architecture_mismatch' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.record_marketplace_seller_sku_state(
   '30000000-0000-0000-0000-000000000007','980cb680-5296-4342-b83d-4e09584a3fe0',1,
   payload||'{"reconciliation_status":"PRONTO_PARA_PUBLICAR"}'::jsonb);
  RAISE EXCEPTION 'publication readiness without evidence must fail';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'seller_sku_publication_evidence_required' THEN RAISE; END IF;
 END;
 reply:=public.record_marketplace_seller_sku_state(
  '30000000-0000-0000-0000-000000000004','980cb680-5296-4342-b83d-4e09584a3fe1',0,
  payload||'{"canonical_sku":"AF-TRF30-KT-030-AMD","reconciliation_status":"BLOQUEADO_LOCAL","event_kind":"BLOQUEIO"}'::jsonb);
 IF reply->>'revision'<>'1' THEN RAISE EXCEPTION 'physical exception quarantine failed'; END IF;
END $$;

SET request.jwt.claim.sub='10000000-0000-0000-0000-000000000002';
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.marketplace_seller_sku_state) THEN RAISE EXCEPTION 'RLS leaks to regular user'; END IF;
 BEGIN
  PERFORM public.record_marketplace_seller_sku_state(
   '30000000-0000-0000-0000-000000000005','980cb680-5296-4342-b83d-4e09584a3fe0',1,
   '{"offer_family":"T30-2"}'::jsonb);
  RAISE EXCEPTION 'regular user write must fail';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;

RESET ROLE;
SET ROLE anon;
DO $$
BEGIN
 BEGIN
  PERFORM 1 FROM public.marketplace_seller_sku_state LIMIT 1;
  RAISE EXCEPTION 'anon should not select';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
RESET ROLE;
DO $$
BEGIN
 IF (SELECT count(*) FROM public.marketplace_seller_sku_events)<>2 THEN RAISE EXCEPTION 'audit count wrong'; END IF;
 IF (SELECT count(*) FROM public.marketplace_seller_sku_state)<>2 THEN RAISE EXCEPTION 'state count wrong'; END IF;
 BEGIN
  UPDATE public.marketplace_seller_sku_events SET event_note='altered';
  RAISE EXCEPTION 'event trigger must protect immutable history';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'seller_sku_events_append_only' THEN RAISE; END IF;
 END;
END $$;
SELECT 'SKU V1.3 G03 DISPOSABLE POSTGRES PASS' AS outcome;
