-- FASE 4.5D: normalização autorizada da família Biscoito para Alfajor.
-- Pedidos, movimentações e ordens de produção históricas continuam apontando
-- para os produtos legados; somente operações futuras passam a usar mestre + variante.

DO $$
DECLARE
  v_master_id uuid;
  v_traditional_variant_id uuid;
BEGIN
  INSERT INTO public.products (
    sku, name, description, unit, is_active, attributes
  ) VALUES (
    'BISCOITO-ALFAJOR-MESTRE',
    'BISCOITO PARA ALFAJOR',
    'Produto mestre canônico. A apresentação física é definida pela variante.',
    'un',
    true,
    jsonb_build_object('tipo_produto', 'mestre')
  )
  ON CONFLICT (sku) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    unit = EXCLUDED.unit,
    is_active = true,
    updated_at = now()
  RETURNING id INTO v_master_id;

  INSERT INTO public.product_variants (
    product_id, sku, variant_name, attributes, unit, is_active,
    cost_override, price_override
  ) VALUES
    (v_master_id, '200408000', 'Tradicional', jsonb_build_object('tipo_variacao', 'tipo', 'tipo', 'tradicional'), 'un', true, 0.17, 0.17),
    (v_master_id, 'SKU-1779720474267', 'Chocolate', jsonb_build_object('tipo_variacao', 'tipo', 'tipo', 'chocolate'), 'un', true, 0.21, 0.21)
  ON CONFLICT (sku) DO UPDATE SET
    product_id = EXCLUDED.product_id,
    variant_name = EXCLUDED.variant_name,
    attributes = EXCLUDED.attributes,
    unit = EXCLUDED.unit,
    is_active = true,
    cost_override = EXCLUDED.cost_override,
    price_override = EXCLUDED.price_override,
    updated_at = now();

  SELECT id INTO v_traditional_variant_id
  FROM public.product_variants
  WHERE product_id = v_master_id AND sku = '200408000';

  -- BOM ativa do Alfajor: mantém fórmula e produto final, troca apenas a
  -- identidade física do componente para Mestre + Tradicional.
  UPDATE public.product_components
  SET component_id = v_master_id,
      variant_id = v_traditional_variant_id
  WHERE id = '7fdbf794-ea37-499c-b7c4-f6f163dbb2b5'
    AND component_id = '176e9144-47e2-486b-ad12-601b30895f5c'
    AND variant_id IS NULL;

  -- Mapping Shopee confirmado como "Biscoito Tradicional".
  UPDATE public.marketplace_product_mappings
  SET product_id = v_master_id,
      variant_id = v_traditional_variant_id,
      updated_at = now()
  WHERE id = '1cd1af82-788a-475b-b794-a5226013311b'
    AND product_id = '176e9144-47e2-486b-ad12-601b30895f5c'
    AND variant_id IS NULL;

  -- Saldos legados não são a verdade operacional. São apenas zerados, sem
  -- reescrever movimentos ou transportar/convertê-los para variantes.
  UPDATE public.inventory
  SET quantity = 0, updated_at = now()
  WHERE product_id IN (
    '176e9144-47e2-486b-ad12-601b30895f5c',
    '5242fe01-9cd4-4093-8777-78c94c7df5c6'
  );

  -- Cria inventário físico independente e zerado por variante nos locais
  -- aplicáveis às apresentações legadas; o inventário físico posterior define
  -- os saldos reais.
  INSERT INTO public.inventory (product_id, variant_id, quantity, location, location_id)
  SELECT v_master_id, pv.id, 0, legacy_inventory.location, legacy_inventory.location_id
  FROM public.inventory legacy_inventory
  JOIN public.products legacy_product ON legacy_product.id = legacy_inventory.product_id
  JOIN public.product_variants pv ON pv.product_id = v_master_id AND pv.sku = legacy_product.sku
  WHERE legacy_product.id IN (
    '176e9144-47e2-486b-ad12-601b30895f5c',
    '5242fe01-9cd4-4093-8777-78c94c7df5c6'
  )
  ON CONFLICT (product_id, variant_id, location) DO UPDATE
  SET quantity = 0, updated_at = now();

  -- Não apagar: históricos continuam referenciando esses produtos legados.
  UPDATE public.products
  SET is_active = false, updated_at = now()
  WHERE id IN (
    '176e9144-47e2-486b-ad12-601b30895f5c',
    '5242fe01-9cd4-4093-8777-78c94c7df5c6'
  );
END;
$$;
