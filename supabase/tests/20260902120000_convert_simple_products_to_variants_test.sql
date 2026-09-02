-- Teste transacional controlado da FASE 4.8.5A.1.
-- Executar depois das migrations. ROLLBACK remove integralmente os dados temporarios.
BEGIN;

DO $$
DECLARE
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_untouched uuid := gen_random_uuid();
  v_rollback_a uuid := gen_random_uuid();
  v_rollback_b uuid := gen_random_uuid();
  v_existing_master uuid := gen_random_uuid();
  v_existing_variant uuid := gen_random_uuid();
  v_existing_source uuid := gen_random_uuid();
  v_result jsonb;
  v_master uuid;
  v_before_products bigint;
  v_before_variants bigint;
BEGIN
  INSERT INTO public.products (id, sku, name, variation_mode, is_active)
  VALUES
    (v_a, 'TMP-CONVERT-A-' || v_a, 'Temporario A', 'sem_variacao', true),
    (v_b, 'TMP-CONVERT-B-' || v_b, 'Temporario B', 'sem_variacao', true),
    (v_untouched, 'TMP-UNTOUCHED-' || v_untouched, 'Temporario intacto', 'sem_variacao', true),
    (v_rollback_a, 'TMP-ROLLBACK-A-' || v_rollback_a, 'Temporario rollback A', 'sem_variacao', true),
    (v_rollback_b, 'TMP-ROLLBACK-B-' || v_rollback_b, 'Temporario rollback B', 'sem_variacao', true),
    (v_existing_source, 'TMP-EXISTING-SOURCE-' || v_existing_source, 'Temporario para Mestre existente', 'sem_variacao', true),
    (v_existing_master, 'TMP-MASTER-EX-' || v_existing_master, 'Mestre temporario existente', 'variacoes_fisicas', true);
  INSERT INTO public.product_variants (id, product_id, sku, variant_name)
  VALUES (v_existing_variant, v_existing_master, 'TMP-VARIANT-EX-' || v_existing_variant, 'Existente');
  INSERT INTO public.inventory (product_id, quantity, location)
  VALUES (v_a, 9, 'Teste temporario'), (v_b, 4, 'Teste temporario');

  v_result := public.convert_simple_products_to_variants(
    ARRAY[v_a, v_b],
    jsonb_build_object('sku', 'TMP-MASTER-NEW-' || gen_random_uuid(), 'name', 'Mestre temporario novo'),
    jsonb_build_array(
      jsonb_build_object('source_product_id', v_a, 'variant_name', 'Variante A', 'attributes', jsonb_build_object('teste', 'a')),
      jsonb_build_object('source_product_id', v_b, 'variant_name', 'Variante B', 'attributes', jsonb_build_object('teste', 'b'))
    ), true
  );
  v_master := (v_result->>'master_product_id')::uuid;

  IF (SELECT count(*) FROM public.product_variants WHERE product_id = v_master) <> 2 THEN RAISE EXCEPTION 'A falhou'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.product_variants WHERE product_id=v_master AND sku='TMP-CONVERT-A-' || v_a)
     OR NOT EXISTS (SELECT 1 FROM public.product_variants WHERE product_id=v_master AND sku='TMP-CONVERT-B-' || v_b) THEN RAISE EXCEPTION 'B falhou'; END IF;
  IF EXISTS (SELECT 1 FROM public.products WHERE id IN (v_a,v_b) AND (is_active OR deleted_at IS NULL)) THEN RAISE EXCEPTION 'C falhou'; END IF;
  IF COALESCE((SELECT sum(i.quantity) FROM public.inventory i JOIN public.product_variants pv ON pv.id=i.variant_id WHERE pv.product_id=v_master),0) <> 0 THEN RAISE EXCEPTION 'D falhou'; END IF;

  BEGIN
    INSERT INTO public.products(sku,name) VALUES ('TMP-CONVERT-A-' || v_a, 'Duplicado temporario');
    RAISE EXCEPTION 'E falhou: SKU duplicado aceito';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'E falhou: SKU duplicado aceito' THEN RAISE; END IF;
  END;

  v_before_products := (SELECT count(*) FROM public.products);
  v_before_variants := (SELECT count(*) FROM public.product_variants);
  BEGIN
    PERFORM public.convert_simple_products_to_variants(
      ARRAY[v_rollback_a, v_rollback_b], jsonb_build_object('sku','TMP-ROLLBACK-' || gen_random_uuid(),'name','Rollback'),
      jsonb_build_array(
        jsonb_build_object('source_product_id',v_rollback_a,'variant_name','Primeira valida'),
        jsonb_build_object('source_product_id',v_rollback_b,'variant_name','')
      ), true);
    RAISE EXCEPTION 'F falhou: erro esperado nao ocorreu';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'F falhou: erro esperado nao ocorreu' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.products) <> v_before_products
     OR (SELECT count(*) FROM public.product_variants) <> v_before_variants
     OR NOT EXISTS (SELECT 1 FROM public.products WHERE id=v_rollback_a AND is_active AND deleted_at IS NULL AND sku='TMP-ROLLBACK-A-' || v_rollback_a)
     OR NOT EXISTS (SELECT 1 FROM public.products WHERE id=v_rollback_b AND is_active AND deleted_at IS NULL AND sku='TMP-ROLLBACK-B-' || v_rollback_b) THEN RAISE EXCEPTION 'F falhou: rollback incompleto'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id=v_untouched AND variation_mode='sem_variacao' AND sku='TMP-UNTOUCHED-' || v_untouched) THEN RAISE EXCEPTION 'G falhou'; END IF;
  PERFORM public.convert_simple_products_to_variants(
    ARRAY[v_existing_source], jsonb_build_object('id',v_existing_master),
    jsonb_build_array(jsonb_build_object('source_product_id',v_existing_source,'variant_name','Adicionada')), true);
  IF NOT EXISTS (SELECT 1 FROM public.product_variants WHERE id=v_existing_variant AND product_id=v_existing_master)
     OR NOT EXISTS (SELECT 1 FROM public.product_variants WHERE product_id=v_existing_master AND sku='TMP-EXISTING-SOURCE-' || v_existing_source)
     OR (SELECT count(*) FROM public.product_variants WHERE product_id=v_existing_master) <> 2 THEN RAISE EXCEPTION 'H falhou'; END IF;
END;
$$;

ROLLBACK;
