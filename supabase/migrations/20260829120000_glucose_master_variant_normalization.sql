-- FASE 4.5C: normalização autorizada da família Glucose de Milho.
-- Preserva pedidos e movimentos históricos nos produtos legados, preparando
-- somente as novas operações para produto mestre + variante física.

-- O mapping legado SH-003-011 é de Emulsificante Porto Gel. Ele precisa poder
-- ficar explicitamente sem associação até que o produto correto seja definido.
ALTER TABLE public.marketplace_product_mappings
  ALTER COLUMN product_id DROP NOT NULL;

DO $$
DECLARE
  v_master_id uuid;
  v_variant_5kg_id uuid;
BEGIN
  INSERT INTO public.products (
    sku, name, description, unit, is_active, attributes
  ) VALUES (
    'GLUCOSE-MILHO-MESTRE',
    'GLUCOSE DE MILHO',
    'Produto mestre canônico. A apresentação física é definida pela variante.',
    'un',
    true,
    jsonb_build_object('tipo_produto', 'mestre')
  )
  ON CONFLICT (sku) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = true,
    updated_at = now()
  RETURNING id INTO v_master_id;

  INSERT INTO public.product_variants (
    product_id, sku, variant_name, attributes, unit, is_active,
    cost_override, price_override
  ) VALUES
    (v_master_id, '201400500V', '500 g', jsonb_build_object('tipo_variacao', 'apresentacao', 'peso_valor', 500, 'peso_unidade', 'g'), 'un', true, 7, 7),
    (v_master_id, '201401000V', '1 kg',  jsonb_build_object('tipo_variacao', 'apresentacao', 'peso_valor', 1, 'peso_unidade', 'kg'), 'un', true, 9, 9),
    (v_master_id, '201405000V', '5 kg',  jsonb_build_object('tipo_variacao', 'apresentacao', 'peso_valor', 5, 'peso_unidade', 'kg'), 'un', true, 39, 39),
    (v_master_id, '201410000V', '10 kg', jsonb_build_object('tipo_variacao', 'apresentacao', 'peso_valor', 10, 'peso_unidade', 'kg'), 'un', true, 70, 70),
    (v_master_id, '201425000V', '25 kg', jsonb_build_object('tipo_variacao', 'apresentacao', 'peso_valor', 25, 'peso_unidade', 'kg'), 'un', true, 138, 138),
    (v_master_id, 'SKU-1779371300690', '75 kg', jsonb_build_object('tipo_variacao', 'apresentacao', 'peso_valor', 75, 'peso_unidade', 'kg'), 'un', true, 400, 520)
  ON CONFLICT (sku) DO UPDATE SET
    product_id = EXCLUDED.product_id,
    variant_name = EXCLUDED.variant_name,
    attributes = EXCLUDED.attributes,
    unit = EXCLUDED.unit,
    is_active = true,
    cost_override = EXCLUDED.cost_override,
    price_override = EXCLUDED.price_override,
    updated_at = now();

  SELECT id INTO v_variant_5kg_id
  FROM public.product_variants
  WHERE product_id = v_master_id AND sku = '201405000V';

  -- Somente os dois anúncios cujo título é realmente de Glucose migram.
  UPDATE public.marketplace_product_mappings
  SET product_id = v_master_id, variant_id = v_variant_5kg_id, updated_at = now()
  WHERE external_item_key IN (
    'code:SH-001-031|variation:5 kg',
    'code:SH-002-031|variation:5 kg'
  );

  -- Não inferir o produto do anúncio Emulsificante Porto Gel.
  UPDATE public.marketplace_product_mappings
  SET product_id = NULL, variant_id = NULL, updated_at = now()
  WHERE external_item_key = 'code:SH-003-011|variation:5 kg';

  -- O saldo antigo é provisório. Mantemos as linhas históricas, mas zeradas.
  UPDATE public.inventory
  SET quantity = 0, updated_at = now()
  WHERE product_id IN (
    SELECT id FROM public.products
    WHERE sku IN ('201400500V', '201401000V', '201405000V', '201410000V', '201425000V', 'SKU-1779371300690')
  );

  -- Cria saldos independentes, zerados, nos mesmos locais antes usados pelas
  -- apresentações legadas. Não transporta nem converte estoque.
  INSERT INTO public.inventory (product_id, variant_id, quantity, location, location_id)
  SELECT
    v_master_id,
    pv.id,
    0,
    legacy_inventory.location,
    legacy_inventory.location_id
  FROM public.inventory legacy_inventory
  JOIN public.products legacy_product ON legacy_product.id = legacy_inventory.product_id
  JOIN public.product_variants pv ON pv.product_id = v_master_id AND pv.sku = legacy_product.sku
  WHERE legacy_product.sku IN ('201400500V', '201401000V', '201405000V', '201410000V', '201425000V', 'SKU-1779371300690')
  ON CONFLICT (product_id, variant_id, location) DO UPDATE
  SET quantity = 0, updated_at = now();

  -- Não apagar: pedidos e movimentos continuam apontando para estes registros.
  UPDATE public.products
  SET is_active = false, updated_at = now()
  WHERE sku IN ('201400500V', '201401000V', '201405000V', '201410000V', '201425000V', 'SKU-1779371300690');
END;
$$;
