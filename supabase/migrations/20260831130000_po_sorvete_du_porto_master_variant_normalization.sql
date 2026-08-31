-- FASE 4.5F: normalização autorizada dos pós para Sorvete Du Porto.
-- Sabores com SKU próprio tornam-se variantes físicas; o cadastro genérico
-- "Variados" permanece somente como legado desativado, sem variante inferida.

DO $$
DECLARE
  v_master_id uuid;
  v_morango_id uuid;
  v_maracuja_id uuid;
  v_doce_leite_id uuid;
BEGIN
  INSERT INTO public.products (
    sku, name, description, category, unit, is_active, attributes
  ) VALUES (
    'PO-SORVETE-DUPORTO-MESTRE',
    'PÓ PARA SORVETE DU PORTO',
    'Produto mestre canônico. O sabor físico é definido pela variante.',
    'MATÉRIA PRIMA',
    'un',
    true,
    jsonb_build_object('tipo_produto', 'mestre')
  )
  ON CONFLICT (sku) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    unit = EXCLUDED.unit,
    is_active = true,
    updated_at = now()
  RETURNING id INTO v_master_id;

  INSERT INTO public.product_variants (
    product_id, sku, variant_name, attributes, unit, is_active, cost_override, price_override
  ) VALUES
    (v_master_id, 'SKU-1767031953064', 'Coco',          jsonb_build_object('tipo_variacao','sabor','sabor','coco'),          'un', true, 12.96, 24.99),
    (v_master_id, 'SKU-1767032207672', 'Morango',       jsonb_build_object('tipo_variacao','sabor','sabor','morango'),       'g',  true, 15.24, 24.99),
    (v_master_id, 'SKU-1767032238051', 'Maracujá',      jsonb_build_object('tipo_variacao','sabor','sabor','maracuja'),      'un', true, 12.78, 24.99),
    (v_master_id, 'SKU-1767032273357', 'Banana',        jsonb_build_object('tipo_variacao','sabor','sabor','banana'),        'un', true, 15.04, 15.00),
    (v_master_id, 'SKU-1767032301843', 'Açaí',          jsonb_build_object('tipo_variacao','sabor','sabor','acai'),          'un', true, 15.00, 15.00),
    (v_master_id, 'SKU-1767032349987', 'Limão',         jsonb_build_object('tipo_variacao','sabor','sabor','limao'),         'un', true, 13.46, 24.99),
    (v_master_id, 'SKU-1767032378391', 'Doce de Leite', jsonb_build_object('tipo_variacao','sabor','sabor','doce_de_leite'),'un', true, 15.83, 24.99),
    (v_master_id, 'SKU-1767032426803', 'Leitinho',      jsonb_build_object('tipo_variacao','sabor','sabor','leitinho'),      'un', true, 15.36, 24.99),
    (v_master_id, 'SKU-1767032460439', 'Cereja',        jsonb_build_object('tipo_variacao','sabor','sabor','cereja'),        'un', true, 15.00, 15.00),
    (v_master_id, 'SKU-1767032523321', 'Café',          jsonb_build_object('tipo_variacao','sabor','sabor','cafe'),          'un', true, 17.02, 24.99),
    (v_master_id, 'SKU-1767033712634', 'Abacaxi',       jsonb_build_object('tipo_variacao','sabor','sabor','abacaxi'),       'un', true, 15.00, 15.00),
    (v_master_id, 'SKU-1767033783000', 'Uva',           jsonb_build_object('tipo_variacao','sabor','sabor','uva'),           'un', true, 15.00, 15.00)
  ON CONFLICT (sku) DO UPDATE SET
    product_id = EXCLUDED.product_id,
    variant_name = EXCLUDED.variant_name,
    attributes = EXCLUDED.attributes,
    unit = EXCLUDED.unit,
    is_active = true,
    cost_override = EXCLUDED.cost_override,
    price_override = EXCLUDED.price_override,
    updated_at = now();

  SELECT id INTO v_morango_id FROM public.product_variants WHERE product_id = v_master_id AND sku = 'SKU-1767032207672';
  SELECT id INTO v_maracuja_id FROM public.product_variants WHERE product_id = v_master_id AND sku = 'SKU-1767032238051';
  SELECT id INTO v_doce_leite_id FROM public.product_variants WHERE product_id = v_master_id AND sku = 'SKU-1767032378391';

  -- Os cinco mappings Shopee registram explicitamente o sabor da variação.
  UPDATE public.marketplace_product_mappings
  SET product_id = v_master_id, variant_id = v_morango_id, updated_at = now()
  WHERE id IN ('56fdc3af-7151-49e5-a1ba-f9419af6cfb5','d289a801-84de-4109-88ca-d3e0d60e545f')
    AND product_id = '9652586b-e83d-4f53-9ca0-14c0f4735360' AND variant_id IS NULL;

  UPDATE public.marketplace_product_mappings
  SET product_id = v_master_id, variant_id = v_maracuja_id, updated_at = now()
  WHERE id IN ('6523385a-5f89-4ef9-8a91-ab6f75b96d05','16bd34e7-de8c-4f1d-9e98-8d25a18caa27')
    AND product_id = 'ce527298-7c63-4348-b112-808caaa856cc' AND variant_id IS NULL;

  UPDATE public.marketplace_product_mappings
  SET product_id = v_master_id, variant_id = v_doce_leite_id, updated_at = now()
  WHERE id = 'd596490e-36a4-44a4-92ab-fe6d8f0c6f13'
    AND product_id = 'ce5a860d-875f-4ce8-95ba-fc190c2aa40e' AND variant_id IS NULL;

  -- O inventário atual é provisório: zera legados e inaugura saldos físicos
  -- independentes por sabor, sem reescrever movimentos passados.
  UPDATE public.inventory SET quantity = 0, updated_at = now()
  WHERE product_id IN (
    '6a4f4e87-6369-4809-b665-2a3f05692d4c','1d514181-08e1-4b1d-879f-15bdfd12131a','9652586b-e83d-4f53-9ca0-14c0f4735360',
    'ce527298-7c63-4348-b112-808caaa856cc','d3065783-10c7-42c3-88c7-41366aa8c5ba','44c0dc65-fc49-4fbd-9b7e-799c4423e111',
    'dcde83c5-f3af-4c25-85ad-c152cda76979','ce5a860d-875f-4ce8-95ba-fc190c2aa40e','2c48ccd8-8af3-43f6-b144-a90e8f16404a',
    'db43f613-32d7-4480-be80-72ea640907c5','d82cefff-ee1d-4e1f-b04f-87e6e9f4a93e','a9b6e76c-5a24-4706-8abd-2afd05dd8901',
    'd1ae93bd-f11b-4964-a55e-cf65c8d85a7d'
  );

  INSERT INTO public.inventory (product_id, variant_id, quantity, location, location_id)
  SELECT v_master_id, pv.id, 0, legacy_inventory.location, legacy_inventory.location_id
  FROM public.inventory legacy_inventory
  JOIN public.products legacy_product ON legacy_product.id = legacy_inventory.product_id
  JOIN public.product_variants pv ON pv.product_id = v_master_id AND pv.sku = legacy_product.sku
  WHERE legacy_product.id IN (
    '1d514181-08e1-4b1d-879f-15bdfd12131a','9652586b-e83d-4f53-9ca0-14c0f4735360','ce527298-7c63-4348-b112-808caaa856cc',
    'd3065783-10c7-42c3-88c7-41366aa8c5ba','44c0dc65-fc49-4fbd-9b7e-799c4423e111','dcde83c5-f3af-4c25-85ad-c152cda76979',
    'ce5a860d-875f-4ce8-95ba-fc190c2aa40e','2c48ccd8-8af3-43f6-b144-a90e8f16404a','db43f613-32d7-4480-be80-72ea640907c5',
    'd82cefff-ee1d-4e1f-b04f-87e6e9f4a93e','a9b6e76c-5a24-4706-8abd-2afd05dd8901','d1ae93bd-f11b-4964-a55e-cf65c8d85a7d'
  )
  ON CONFLICT (product_id, variant_id, location) DO UPDATE SET quantity = 0, updated_at = now();

  -- Não apagar: pedidos e movimentos continuam apontando aos produtos legados.
  UPDATE public.products SET is_active = false, updated_at = now()
  WHERE id IN (
    '6a4f4e87-6369-4809-b665-2a3f05692d4c','1d514181-08e1-4b1d-879f-15bdfd12131a','9652586b-e83d-4f53-9ca0-14c0f4735360',
    'ce527298-7c63-4348-b112-808caaa856cc','d3065783-10c7-42c3-88c7-41366aa8c5ba','44c0dc65-fc49-4fbd-9b7e-799c4423e111',
    'dcde83c5-f3af-4c25-85ad-c152cda76979','ce5a860d-875f-4ce8-95ba-fc190c2aa40e','2c48ccd8-8af3-43f6-b144-a90e8f16404a',
    'db43f613-32d7-4480-be80-72ea640907c5','d82cefff-ee1d-4e1f-b04f-87e6e9f4a93e','a9b6e76c-5a24-4706-8abd-2afd05dd8901',
    'd1ae93bd-f11b-4964-a55e-cf65c8d85a7d'
  );
END;
$$;
