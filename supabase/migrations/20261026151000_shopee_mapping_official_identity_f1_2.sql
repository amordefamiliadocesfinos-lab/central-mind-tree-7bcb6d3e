-- F1.2 — Official Shopee mapping identity (additive, no backfill, no product changes).
-- NULL/NULL preserves the provisional title/SKU mapping catalog until homologation.
ALTER TABLE public.marketplace_product_mappings
  ADD COLUMN IF NOT EXISTS external_item_id text,
  ADD COLUMN IF NOT EXISTS external_model_id text;

ALTER TABLE public.marketplace_product_mappings
  ADD CONSTRAINT marketplace_mapping_official_identity_pair_chk
  CHECK (
    (external_item_id IS NULL AND external_model_id IS NULL)
    OR (
      marketplace = 'shopee'
      AND channel_account_id IS NOT NULL
      AND external_item_id ~ '^[0-9]{1,30}$'
      AND external_model_id ~ '^[0-9]{1,30}$'
    )
  );

-- Only one authoritative mapping for an exact account/item/model tuple.
-- Legacy rows remain untouched and outside this unique index.
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_mapping_official_identity_unique
  ON public.marketplace_product_mappings
    (channel_account_id, external_item_id, external_model_id)
  WHERE marketplace = 'shopee'
    AND external_item_id IS NOT NULL
    AND external_model_id IS NOT NULL;

COMMENT ON COLUMN public.marketplace_product_mappings.external_item_id
  IS 'Shopee Open Platform item_id as text; NULL means legacy provisional mapping.';
COMMENT ON COLUMN public.marketplace_product_mappings.external_model_id
  IS 'Shopee Open Platform model_id as text (including 0 for no model); NULL means legacy provisional mapping.';
