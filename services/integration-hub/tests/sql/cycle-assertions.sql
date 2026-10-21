DO $$
DECLARE a uuid := '8a8ad166-0317-4597-8be6-e43fb46b4d1b'; l jsonb; r jsonb; old_id uuid; start_time bigint;
BEGIN
  ASSERT NOT has_table_privilege('authenticated','public.shopee_cycle_state','SELECT');
  ASSERT NOT has_table_privilege('anon','public.shopee_cycle_orders','UPDATE');
  ASSERT NOT has_function_privilege('authenticated','public.acquire_shopee_cycle(uuid)','EXECUTE');
  ASSERT NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.acquire_shopee_cycle(uuid)'::regprocedure);
  ASSERT (SELECT relrowsecurity FROM pg_class WHERE oid='public.shopee_cycle_orders'::regclass);
  ASSERT public.acquire_shopee_cycle('33333333-3333-4333-8333-333333333333')->>'status'='account_refused';
  UPDATE public.shopee_oauth_connections SET shop_id=1;
  ASSERT public.acquire_shopee_cycle(a)->>'status'='account_refused';
  UPDATE public.shopee_oauth_connections SET shop_id=531736366;
  l := public.acquire_shopee_cycle(a); old_id := (l->>'lease_id')::uuid; start_time := (l->>'time_from')::bigint;
  ASSERT l->>'status'='acquired' AND l->>'candidate_order_sn' IS NULL;
  ASSERT public.acquire_shopee_cycle(a)->>'status'='busy';
  ASSERT public.finish_shopee_cycle(a,gen_random_uuid(),null,null,'pending','pending')->>'status'='stale_lease';
  ASSERT public.finish_shopee_cycle(a,old_id,'{"order_sns":["SYNTHETIC999"],"next_cursor":null}',null,'pending','pending')->>'status'='snapshot_missing_or_mismatched';
  ASSERT (SELECT count(*) FROM public.shopee_cycle_orders)=0;
  r := public.finish_shopee_cycle(a,old_id,'{"order_sns":["SYNTHETIC001","SYNTHETIC002"],"next_cursor":"page2"}',null,'pending','discovered');
  ASSERT r->>'status'='finished';
  ASSERT (SELECT cursor FROM public.shopee_cycle_state WHERE channel_account_id=a)='page2';
  ASSERT (SELECT time_from FROM public.shopee_cycle_state WHERE channel_account_id=a)=start_time;
  ASSERT public.finish_shopee_cycle(a,old_id,null,null,'pending','pending')->>'status'='stale_lease';
  l := public.acquire_shopee_cycle(a); ASSERT l->>'candidate_order_sn'='SYNTHETIC001';
  r := public.finish_shopee_cycle(a,(l->>'lease_id')::uuid,'{"order_sns":["SYNTHETIC003"],"next_cursor":null}','SYNTHETIC001','blocked','document_creation_uncertain');
  ASSERT r->>'status'='finished';
  ASSERT (SELECT cursor FROM public.shopee_cycle_state WHERE channel_account_id=a) IS NULL;
  ASSERT (SELECT time_from FROM public.shopee_cycle_state WHERE channel_account_id=a)>start_time;
  l := public.acquire_shopee_cycle(a); ASSERT l->>'candidate_order_sn'='SYNTHETIC002';
  PERFORM public.finish_shopee_cycle(a,(l->>'lease_id')::uuid,null,'SYNTHETIC002','pending','waiting_invoice');
  l := public.acquire_shopee_cycle(a); ASSERT l->>'candidate_order_sn'='SYNTHETIC003';
  PERFORM public.finish_shopee_cycle(a,(l->>'lease_id')::uuid,null,'SYNTHETIC003','complete','label_attached');
  l := public.acquire_shopee_cycle(a); ASSERT l->>'candidate_order_sn'='SYNTHETIC002';
  old_id := (l->>'lease_id')::uuid;
  UPDATE public.shopee_cycle_state SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE channel_account_id=a;
  ASSERT public.finish_shopee_cycle(a,old_id,null,'SYNTHETIC002','complete','label_attached')->>'status'='stale_lease';
  l := public.acquire_shopee_cycle(a); ASSERT l->>'candidate_order_sn' IS NULL;
  ASSERT (SELECT last_code FROM public.shopee_cycle_orders WHERE order_sn='SYNTHETIC002')='worker_lost_requires_review';
  PERFORM public.finish_shopee_cycle(a,(l->>'lease_id')::uuid,'{"order_sns":["SYNTHETIC001","SYNTHETIC003"],"next_cursor":null}',null,'pending','discovered');
  ASSERT (SELECT state FROM public.shopee_cycle_orders WHERE order_sn='SYNTHETIC001')='blocked';
  ASSERT (SELECT state FROM public.shopee_cycle_orders WHERE order_sn='SYNTHETIC003')='complete';
END $$;

-- Existing document ledger remains permanent across worker lease expiry.
DO $$
DECLARE a uuid := '8a8ad166-0317-4597-8be6-e43fb46b4d1b'; l jsonb; r jsonb; v_attempt_id uuid;
BEGIN
  l := public.claim_shopee_shipping_document(a,531736366,'SYNTHETIC001','SYNTHETICPKG','NORMAL_AIR_WAYBILL',repeat('a',64));
  ASSERT l->>'status'='claimed' AND (l->>'fresh')::boolean;
  v_attempt_id := (l->>'attempt_id')::uuid;
  r := public.claim_shopee_shipping_document(a,531736366,'SYNTHETIC001','SYNTHETICPKG','NORMAL_AIR_WAYBILL',repeat('a',64));
  ASSERT r->>'status'='already_claimed';
  PERFORM public.resolve_shopee_shipping_document(v_attempt_id,repeat('a',64),'uncertain');
  r := public.claim_shopee_shipping_document(a,531736366,'SYNTHETIC001','SYNTHETICPKG','NORMAL_AIR_WAYBILL',repeat('a',64));
  ASSERT r->>'status'='uncertain_requires_reconciliation';
  ASSERT (SELECT count(*) FROM public.shopee_shipping_document_attempts)=1;
  ASSERT (SELECT state FROM public.shopee_shipping_document_attempts WHERE id=v_attempt_id LIMIT 1)='uncertain';
END $$;

-- A service role, not the migration owner, must execute the worker RPCs.
DO $$
DECLARE a uuid := '8a8ad166-0317-4597-8be6-e43fb46b4d1b'; l jsonb;
BEGIN
  l := public.acquire_shopee_cycle(a);
  PERFORM public.finish_shopee_cycle(a,(l->>'lease_id')::uuid,null,null,'pending','token_refresh_persistence_failed');
  ASSERT public.acquire_shopee_cycle(a)->>'status'='account_halted';
  UPDATE public.shopee_cycle_state SET halted_code=NULL WHERE channel_account_id=a;
END $$;
SET ROLE service_role;
SELECT public.acquire_shopee_cycle('8a8ad166-0317-4597-8be6-e43fb46b4d1b');
RESET ROLE;
