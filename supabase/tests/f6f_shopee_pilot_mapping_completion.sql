-- F6-F verification — exact pilot mappings only.

DO $$
DECLARE
  v_channel_account_id uuid := '8a8ad166-0317-4597-8be6-e43fb46b4d1b';
  v_account text := 'SHOPEE VIVIANE';
  v_alfajor_mapping uuid;
  v_glucodry_mapping uuid;
BEGIN
  SELECT id INTO v_alfajor_mapping
  FROM public.marketplace_product_mappings
  WHERE marketplace = 'shopee'
    AND marketplace_account = v_account
    AND channel_account_id = v_channel_account_id
    AND external_item_key = 'code:SH-002-015|variation:'
    AND product_id = '62cf9f63-be04-4261-ad11-569028dd1125'
    AND variant_id = 'd89e1dba-ca80-4136-b9f3-225fb80b6dfb'
    AND physical_multiplier = 3;

  IF v_alfajor_mapping IS NULL THEN
    RAISE EXCEPTION 'F6-F alfajor mapping missing or divergent';
  END IF;

  IF (
    SELECT count(*)
    FROM public.marketplace_product_mapping_items
    WHERE mapping_id = v_alfajor_mapping
  ) <> 2 THEN
    RAISE EXCEPTION 'F6-F alfajor composition count mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.marketplace_product_mapping_items
    WHERE mapping_id = v_alfajor_mapping
      AND product_id = '62cf9f63-be04-4261-ad11-569028dd1125'
      AND variant_id = 'd89e1dba-ca80-4136-b9f3-225fb80b6dfb'
      AND physical_multiplier = 3
      AND position = 0
  ) OR NOT EXISTS (
    SELECT 1 FROM public.marketplace_product_mapping_items
    WHERE mapping_id = v_alfajor_mapping
      AND product_id = '62cf9f63-be04-4261-ad11-569028dd1125'
      AND variant_id = 'e4d756c8-f324-4ac0-b9ff-6adae24f5310'
      AND physical_multiplier = 3
      AND position = 1
  ) THEN
    RAISE EXCEPTION 'F6-F alfajor 50/50 composition mismatch';
  END IF;

  SELECT id INTO v_glucodry_mapping
  FROM public.marketplace_product_mappings
  WHERE marketplace = 'shopee'
    AND marketplace_account = v_account
    AND channel_account_id = v_channel_account_id
    AND external_item_key = 'code:SH-002-006|variation:1 kg'
    AND product_id = '92088a70-8cc0-40ef-a39d-564603df6866'
    AND variant_id IS NULL
    AND physical_multiplier = 1000;

  IF v_glucodry_mapping IS NULL THEN
    RAISE EXCEPTION 'F6-F Glucodry 1kg mapping missing or divergent';
  END IF;

  IF (
    SELECT count(*)
    FROM public.marketplace_product_mapping_items
    WHERE mapping_id = v_glucodry_mapping
  ) <> 1 THEN
    RAISE EXCEPTION 'F6-F Glucodry composition count mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.marketplace_product_mapping_items
    WHERE mapping_id = v_glucodry_mapping
      AND product_id = '92088a70-8cc0-40ef-a39d-564603df6866'
      AND variant_id IS NULL
      AND physical_multiplier = 1000
      AND position = 0
  ) THEN
    RAISE EXCEPTION 'F6-F Glucodry composition mismatch';
  END IF;
END $$;
