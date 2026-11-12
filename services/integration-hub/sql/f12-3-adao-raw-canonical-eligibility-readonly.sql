-- F12.3 | ADÃO ONLY | LOVABLE CLOUD CORE | READ-ONLY OBSERVABILITY
-- This report is NOT a determination of eligibility for import. Raw data
-- includes terminal, historic, cancelled and otherwise ineligible orders.
-- Each canonical write still requires the existing live Shopee intake
-- filter, physical mapping, exact order contract and authoritative Core ACK.
-- The 48-hour window is based on snapshot observed_at, not an official
-- order creation/update window from Shopee. No buyer/order identifiers leave.
--
-- Run each SELECT as a separate read-only query on the official Lovable
-- Cloud database. Do not use the external Supabase management plugin.

WITH latest AS (
 SELECT DISTINCT ON (external_entity_id)
        external_entity_id AS sn, payload
 FROM public.marketplace_raw_snapshots
 WHERE channel_account_id='b4027369-5abf-4ac1-ab24-862334fae892'::uuid
   AND source='shopee_open_platform'
   AND external_entity_type='order'
   AND observed_at >= clock_timestamp()-interval '48 hours'
   AND external_entity_id ~ '^[A-Za-z0-9]{8,100}$'
 ORDER BY external_entity_id, observed_at DESC
), classified AS (
 SELECT latest.sn,
 COALESCE(latest.payload #>> '{response,order_list,0,order_status}',
          'missing') AS observed_status,
 EXISTS (
  SELECT 1 FROM public.orders o
  WHERE o.channel_account_id='b4027369-5abf-4ac1-ab24-862334fae892'::uuid
    AND o.order_number=latest.sn
    AND o.channel='shopee'
    AND o.sale_origin='shopee_open_platform'
    AND o.deleted_at IS NULL
 ) AS canonical_present
 FROM latest
)
SELECT observed_status,
       count(*)::integer AS raw_distinct,
       count(*) FILTER (WHERE canonical_present)::integer AS canonical_present,
       count(*) FILTER (WHERE NOT canonical_present)::integer AS unmatched_requires_classification
FROM classified
GROUP BY observed_status
ORDER BY raw_distinct DESC, observed_status;

-- Checkpoint is independent of the raw observation report.
SELECT count(*)::integer AS checkpoint_rows,
       count(*) FILTER (WHERE phase='staged')::integer AS staged_rows
FROM public.shopee_adao_f12_discovery_state;
