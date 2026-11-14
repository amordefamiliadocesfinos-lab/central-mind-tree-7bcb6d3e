-- F6-O.2e.4b regression repair — preserve CURRENT create_shopee_api_order
-- commercial/presentation/idempotency guards. Never restore an older 2026-10
-- function body; this migration modifies only the marketplace JSON metadata.
-- Operates on the Lovable-managed Core PostgreSQL, NOT external Supabase.
-- No labels, stocks, finance, Scheduler, order creation or shipping changes.
DO $repair$
DECLARE
  v_fn_oid oid;
  v_current text;
  v_patched text;
  v_needle text := '''external_status'', v_external_status';
  v_replacement text := $fragment$'external_status', v_external_status,
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
      )$fragment$;
BEGIN
  SELECT p.oid, pg_get_functiondef(p.oid)
    INTO v_fn_oid, v_current
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace
    AND p.proname = 'create_shopee_api_order'
    AND pg_get_function_identity_arguments(p.oid) = 'p_order jsonb, p_items jsonb';
  IF v_fn_oid IS NULL THEN
    RAISE EXCEPTION 'buyer_message_patch_rpc_not_found';
  END IF;

  -- Refuse unexpected versions rather than silently overwrite the current
  -- RPC or lose newer commercial rules. Operator must inspect the drift.
  IF position('''buyer_message''' IN v_current) > 0 THEN
    RAISE NOTICE 'buyer_message field already present; no RPC replacement';
    RETURN;
  END IF;
  IF v_current NOT LIKE '%CREATE OR REPLACE FUNCTION public.create_shopee_api_order%'
    OR v_current NOT LIKE '%shopee_commercial_presentation_quantity_mismatch%'
    OR v_current NOT LIKE '%pg_advisory_xact_lock%'
    OR v_current NOT LIKE '%v_existing_deleted_at%'
    OR v_current NOT LIKE '%jsonb_strip_nulls(jsonb_build_object(%'
    OR (length(v_current) - length(replace(v_current, v_needle, ''))) <> length(v_needle)
  THEN
    RAISE EXCEPTION 'buyer_message_patch_rpc_drift_refused';
  END IF;
  v_patched := replace(v_current, v_needle, v_replacement);
  EXECUTE v_patched;
END;
$repair$;

-- Surgical backfill for the verified live Adão order. No update when source
-- missing or empty. Do not overwrite any populated buyer_message, any manual
-- notes or any other account. No consumer/recipient data is logged or returned.
WITH latest AS (
  SELECT s.payload #>> '{response,order_list,0,message_to_seller}' AS note
  FROM public.marketplace_raw_snapshots s
  WHERE s.source='shopee_open_platform'
    AND s.environment='live'
    AND s.external_entity_type='order'
    AND s.endpoint='/api/v2/order/get_order_detail'
    AND s.channel_account_id='b4027369-5abf-4ac1-ab24-862334fae892'::uuid
    AND s.external_entity_id='2611148HXRRP6A'
    AND s.payload #>> '{response,order_list,0,order_sn}'='2611148HXRRP6A'
  ORDER BY s.observed_at DESC, s.created_at DESC, s.id DESC
  LIMIT 1
), message AS (
  SELECT LEFT(NULLIF(btrim(note), ''),4000) AS value FROM latest
)
UPDATE public.orders o
SET marketplace_metadata = jsonb_set(
  COALESCE(o.marketplace_metadata, '{}'::jsonb),
  '{buyer_message}',to_jsonb(message.value),true
)
FROM message
WHERE message.value IS NOT NULL
  AND o.id='ac47714e-564f-4990-bc61-b3dfd86d5cf0'::uuid
  AND o.channel_account_id='b4027369-5abf-4ac1-ab24-862334fae892'::uuid
  AND o.order_number='2611148HXRRP6A'
  AND o.internal_order_number='PED-00427'
  AND o.channel='shopee'
  AND o.sale_origin='shopee_open_platform'
  AND o.deleted_at IS NULL
  AND NULLIF(btrim(o.marketplace_metadata->>'buyer_message'), '') IS NULL;
