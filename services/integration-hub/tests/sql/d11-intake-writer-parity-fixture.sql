-- Disposable ONLY: reproduce the sole observed P4 -> live writer delta.
-- Never publish this test adapter as a production migration.
DO $proof$
DECLARE original text; patched text;
BEGIN
 IF current_database()<>'p4_shopee_writer_disposable' THEN RAISE EXCEPTION 'disposable database required'; END IF;
 original:=pg_get_functiondef('public.create_shopee_api_order(jsonb,jsonb)'::regprocedure);
 patched:=replace(original,$old$      'external_status', v_external_status$old$,$new$      'external_status', v_external_status,
      -- F6-O.2e.4: buyer-provided shipping/packaging instruction is
      -- immutable marketplace metadata, never orders.notes.
      -- Historical Hub may omit the field; recover strictly from the
      -- already authenticated and identity-scoped Shopee detail snapshot.
      'buyer_message', COALESCE(
        LEFT(NULLIF(btrim(p_order->>'buyer_message'), ''), 4000),
        (
          SELECT LEFT(NULLIF(btrim(s.payload #>> '{response,order_list,0,message_to_seller}'), ''), 4000)
          FROM public.marketplace_raw_snapshots s
          WHERE s.source = 'shopee_open_platform'
            AND s.environment = 'live'
            AND s.external_entity_type = 'order'
            AND s.endpoint = '/api/v2/order/get_order_detail'
            AND s.channel_account_id = v_channel_account_id
            AND s.external_entity_id = v_order_number
            AND s.payload #>> '{response,order_list,0,order_sn}' = v_order_number
          ORDER BY s.observed_at DESC, s.created_at DESC, s.id DESC
          LIMIT 1
        )
      )$new$);
 IF patched=original OR md5(patched)<>'330a7966a1c0143d4b9fc82229bf9013' THEN
  RAISE EXCEPTION 'D11 observed writer definition drift'; END IF;
 EXECUTE patched;
 IF md5(pg_get_functiondef('public.create_shopee_api_order(jsonb,jsonb)'::regprocedure))<>'330a7966a1c0143d4b9fc82229bf9013' THEN
  RAISE EXCEPTION 'D11 fixture writer fingerprint mismatch'; END IF;
END $proof$;
