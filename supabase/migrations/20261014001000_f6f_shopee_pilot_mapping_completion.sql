-- F6-F — complete only the two exact Shopee Viviane mappings proven missing by F6-E.
-- Scope: pilot channel_account_id only. No operational order/stock/finance/CRM writes.

DO $$
DECLARE
  v_channel_account_id uuid := '8a8ad166-0317-4597-8be6-e43fb46b4d1b';
  v_account text := 'SHOPEE VIVIANE';

  v_alfajor_product uuid := '62cf9f63-be04-4261-ad11-569028dd1125';
  v_alfajor_white uuid := 'd89e1dba-ca80-4136-b9f3-225fb80b6dfb';
  v_alfajor_dark uuid := 'e4d756c8-f324-4ac0-b9ff-6adae24f5310';

  v_glucodry_product uuid := '92088a70-8cc0-40ef-a39d-564603df6866';

  v_mapping_alfajor uuid;
  v_mapping_glucodry uuid;
BEGIN
  -- Guard canonical identities before touching mapping data.
  IF NOT EXISTS (
    SELECT 1 FROM public.channel_accounts
    WHERE id = v_channel_account_id
      AND name = v_account
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'F6-F pilot channel account unavailable';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.products
    WHERE id = v_alfajor_product AND name = 'ALFAJOR ARTESANAL 60G DOCE DE LEITE'
  ) THEN
    RAISE EXCEPTION 'F6-F canonical alfajor product mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.product_variants
    WHERE id = v_alfajor_white
      AND product_id = v_alfajor_product
      AND variant_name = 'Chocolate Branco'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.product_variants
    WHERE id = v_alfajor_dark
      AND product_id = v_alfajor_product
      AND variant_name = 'Chocolate Meio Amargo'
  ) THEN
    RAISE EXCEPTION 'F6-F canonical alfajor variants mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.products
    WHERE id = v_glucodry_product
      AND name = 'GLUCOSE DE MILHO DESIDRATADA EM PÓ - GLUCODRY 1000 GRAMAS'
  ) THEN
    RAISE EXCEPTION 'F6-F canonical Glucodry product mismatch';
  END IF;

  -- SH-002-015 = kit 6 alfajores, frozen commercial rule 50/50:
  -- 3 Chocolate Branco + 3 Chocolate Meio Amargo.
  INSERT INTO public.marketplace_product_mappings (
    marketplace,
    marketplace_account,
    external_item_key,
    external_product_title,
    external_variation,
    product_id,
    variant_id,
    physical_multiplier,
    channel_account_id
  ) VALUES (
    'shopee',
    v_account,
    'code:SH-002-015|variation:',
    'Alfajor 60g - Kit com 6 UNI. – Sabor Irresistível com Doce de Leite e Chocolate Premium | SH-002-015',
    NULL,
    v_alfajor_product,
    v_alfajor_white,
    3,
    v_channel_account_id
  )
  ON CONFLICT (marketplace, marketplace_account, external_item_key)
  DO UPDATE SET
    external_product_title = EXCLUDED.external_product_title,
    external_variation = EXCLUDED.external_variation,
    product_id = EXCLUDED.product_id,
    variant_id = EXCLUDED.variant_id,
    physical_multiplier = EXCLUDED.physical_multiplier,
    channel_account_id = EXCLUDED.channel_account_id,
    updated_at = now()
  RETURNING id INTO v_mapping_alfajor;

  DELETE FROM public.marketplace_product_mapping_items
  WHERE mapping_id = v_mapping_alfajor;

  INSERT INTO public.marketplace_product_mapping_items (
    mapping_id, product_id, variant_id, physical_multiplier, position
  ) VALUES
    (v_mapping_alfajor, v_alfajor_product, v_alfajor_white, 3, 0),
    (v_mapping_alfajor, v_alfajor_product, v_alfajor_dark, 3, 1);

  -- SH-002-006 / 1 Kg = exactly one 1000 g Glucodry unit.
  INSERT INTO public.marketplace_product_mappings (
    marketplace,
    marketplace_account,
    external_item_key,
    external_product_title,
    external_variation,
    product_id,
    variant_id,
    physical_multiplier,
    channel_account_id
  ) VALUES (
    'shopee',
    v_account,
    'code:SH-002-006|variation:1 kg',
    'Glucose de Milho desidratada em Pó - Glucodry - VARIAÇÃO 1 Kg a 4 Kg | SH-002-006',
    '1 Kg',
    v_glucodry_product,
    NULL,
    1000,
    v_channel_account_id
  )
  ON CONFLICT (marketplace, marketplace_account, external_item_key)
  DO UPDATE SET
    external_product_title = EXCLUDED.external_product_title,
    external_variation = EXCLUDED.external_variation,
    product_id = EXCLUDED.product_id,
    variant_id = EXCLUDED.variant_id,
    physical_multiplier = EXCLUDED.physical_multiplier,
    channel_account_id = EXCLUDED.channel_account_id,
    updated_at = now()
  RETURNING id INTO v_mapping_glucodry;

  DELETE FROM public.marketplace_product_mapping_items
  WHERE mapping_id = v_mapping_glucodry;

  INSERT INTO public.marketplace_product_mapping_items (
    mapping_id, product_id, variant_id, physical_multiplier, position
  ) VALUES
    (v_mapping_glucodry, v_glucodry_product, NULL, 1000, 0);
END $$;
