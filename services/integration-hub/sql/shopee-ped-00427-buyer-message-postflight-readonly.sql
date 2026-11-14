-- Run only on official Lovable Cloud after the targeted migration.
-- Returns no customer text or personally identifying data.
WITH order_state AS (
 SELECT
   o.marketplace_metadata->>'buyer_message' AS buyer_message,
   o.notes AS internal_notes, o.production_notes
 FROM public.orders o
 WHERE o.id='ac47714e-564f-4990-bc61-b3dfd86d5cf0'::uuid
   AND o.channel_account_id='b4027369-5abf-4ac1-ab24-862334fae892'::uuid
   AND o.order_number='2611148HXRRP6A'
   AND o.internal_order_number='PED-00427'
   AND o.sale_origin='shopee_open_platform'
   AND o.deleted_at IS NULL
)
SELECT
  (SELECT count(*)::int FROM order_state) AS matching_orders,
  (SELECT count(*)::int FROM order_state
   WHERE nullif(btrim(buyer_message),'') IS NOT NULL) AS buyer_notes_restored,
  (SELECT count(*)::int FROM order_state
   WHERE internal_notes IS NULL AND production_notes IS NULL) AS internal_notes_untouched,
  EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
    AND p.proname='create_shopee_api_order'
    AND pg_get_functiondef(p.oid) LIKE '%buyer_message%') AS rpc_buyer_message_present;
