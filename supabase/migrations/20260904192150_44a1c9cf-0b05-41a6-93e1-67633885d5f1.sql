CREATE OR REPLACE FUNCTION public.assert_global_product_sku()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  keeps_own_sku boolean := TG_OP = 'UPDATE' AND lower(btrim(OLD.sku)) = lower(btrim(NEW.sku));
BEGIN
  IF TG_TABLE_NAME = 'products' THEN
    IF EXISTS (SELECT 1 FROM public.products p WHERE p.id <> NEW.id AND lower(btrim(p.sku)) = lower(btrim(NEW.sku))) THEN
      RAISE EXCEPTION 'SKU % já pertence a outro produto.', NEW.sku;
    END IF;
    IF NOT keeps_own_sku AND EXISTS (SELECT 1 FROM public.product_variants v WHERE lower(btrim(v.sku)) = lower(btrim(NEW.sku))) THEN
      RAISE EXCEPTION 'SKU % já pertence a uma variante física.', NEW.sku;
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM public.product_variants v WHERE v.id <> NEW.id AND lower(btrim(v.sku)) = lower(btrim(NEW.sku))) THEN
      RAISE EXCEPTION 'SKU % já pertence a outra variante física.', NEW.sku;
    END IF;
    IF NOT keeps_own_sku AND EXISTS (SELECT 1 FROM public.products p WHERE lower(btrim(p.sku)) = lower(btrim(NEW.sku))) THEN
      RAISE EXCEPTION 'SKU % já pertence a um produto.', NEW.sku;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = NEW.product_id AND p.variation_mode = 'variacoes_fisicas') THEN
      RAISE EXCEPTION 'Variantes físicas exigem Produto Mestre com variation_mode = variacoes_fisicas.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_product_catalog_import(
  p_products jsonb DEFAULT '[]'::jsonb,
  p_variants jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  item jsonb;
  target_id uuid;
  master_id uuid;
  new_sku text;
  current_sku text;
  keeps_own_sku boolean;
  products_created integer := 0;
  products_updated integer := 0;
  variants_created integer := 0;
  variants_updated integer := 0;
BEGIN
  IF jsonb_typeof(p_products) <> 'array' OR jsonb_typeof(p_variants) <> 'array' THEN
    RAISE EXCEPTION 'Os lotes de produtos e variações devem ser listas.';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_products)
  LOOP
    target_id := NULLIF(item ->> 'id', '')::uuid;
    new_sku := btrim(item ->> 'sku');
    IF COALESCE(new_sku, '') = '' OR COALESCE(btrim(item ->> 'name'), '') = '' THEN
      RAISE EXCEPTION 'Produto exige SKU e nome.';
    END IF;

    current_sku := NULL;
    IF target_id IS NOT NULL THEN
      SELECT p.sku INTO current_sku FROM public.products p WHERE p.id = target_id;
      IF current_sku IS NULL THEN RAISE EXCEPTION 'Produto % não encontrado.', target_id; END IF;
    END IF;
    keeps_own_sku := current_sku IS NOT NULL AND lower(btrim(current_sku)) = lower(new_sku);

    IF NOT keeps_own_sku AND EXISTS (SELECT 1 FROM public.product_variants v WHERE v.sku = new_sku) THEN
      RAISE EXCEPTION 'SKU % já pertence a uma variação.', new_sku;
    END IF;

    IF target_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.products p WHERE p.sku = new_sku AND p.id <> target_id) THEN RAISE EXCEPTION 'SKU % já pertence a outro produto.', new_sku; END IF;
      UPDATE public.products SET sku = new_sku, name = btrim(item ->> 'name'), category = NULLIF(item ->> 'category', ''), unit = NULLIF(item ->> 'unit', ''), cost = NULLIF(item ->> 'cost', '')::numeric, price = NULLIF(item ->> 'price', '')::numeric, min_stock = COALESCE(NULLIF(item ->> 'min_stock', '')::numeric, 0), description = NULLIF(item ->> 'description', ''), attributes = COALESCE(item -> 'attributes', '{}'::jsonb), expiry_days = NULLIF(item ->> 'expiry_days', '')::integer, is_active = COALESCE(NULLIF(item ->> 'is_active', '')::boolean, true), height_cm = NULLIF(item ->> 'height_cm', '')::numeric, width_cm = NULLIF(item ->> 'width_cm', '')::numeric, length_cm = NULLIF(item ->> 'length_cm', '')::numeric, weight_g = NULLIF(item ->> 'weight_g', '')::numeric, updated_at = now() WHERE id = target_id;
      products_updated := products_updated + 1;
    ELSE
      IF EXISTS (SELECT 1 FROM public.products p WHERE p.sku = new_sku) THEN RAISE EXCEPTION 'SKU % já pertence a um produto.', new_sku; END IF;
      INSERT INTO public.products (sku, name, category, unit, cost, price, min_stock, description, attributes, expiry_days, is_active, height_cm, width_cm, length_cm, weight_g) VALUES (new_sku, btrim(item ->> 'name'), NULLIF(item ->> 'category', ''), NULLIF(item ->> 'unit', ''), NULLIF(item ->> 'cost', '')::numeric, NULLIF(item ->> 'price', '')::numeric, COALESCE(NULLIF(item ->> 'min_stock', '')::numeric, 0), NULLIF(item ->> 'description', ''), COALESCE(item -> 'attributes', '{}'::jsonb), NULLIF(item ->> 'expiry_days', '')::integer, COALESCE(NULLIF(item ->> 'is_active', '')::boolean, true), NULLIF(item ->> 'height_cm', '')::numeric, NULLIF(item ->> 'width_cm', '')::numeric, NULLIF(item ->> 'length_cm', '')::numeric, NULLIF(item ->> 'weight_g', '')::numeric);
      products_created := products_created + 1;
    END IF;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(p_variants)
  LOOP
    target_id := NULLIF(item ->> 'id', '')::uuid;
    new_sku := btrim(item ->> 'sku');
    IF COALESCE(new_sku, '') = '' OR COALESCE(btrim(item ->> 'variant_name'), '') = '' THEN RAISE EXCEPTION 'Variação exige SKU e nome.'; END IF;
    master_id := NULLIF(item ->> 'product_id', '')::uuid;
    IF master_id IS NULL THEN SELECT id INTO master_id FROM public.products WHERE sku = btrim(item ->> 'product_sku'); END IF;
    IF master_id IS NULL THEN RAISE EXCEPTION 'Produto mestre % não encontrado.', item ->> 'product_sku'; END IF;

    current_sku := NULL;
    IF target_id IS NOT NULL THEN
      SELECT v.sku INTO current_sku FROM public.product_variants v WHERE v.id = target_id;
      IF current_sku IS NULL THEN RAISE EXCEPTION 'Variação % não encontrada.', target_id; END IF;
    END IF;
    keeps_own_sku := current_sku IS NOT NULL AND lower(btrim(current_sku)) = lower(new_sku);

    IF NOT keeps_own_sku AND EXISTS (SELECT 1 FROM public.products p WHERE p.sku = new_sku) THEN
      RAISE EXCEPTION 'SKU % já pertence a um produto mestre.', new_sku;
    END IF;

    IF target_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.product_variants v WHERE v.sku = new_sku AND v.id <> target_id) THEN RAISE EXCEPTION 'SKU % já pertence a outra variação.', new_sku; END IF;
      UPDATE public.product_variants SET product_id = master_id, sku = new_sku, variant_name = btrim(item ->> 'variant_name'), attributes = COALESCE(item -> 'attributes', '{}'::jsonb), unit = NULLIF(item ->> 'unit', ''), cost_override = NULLIF(item ->> 'cost_override', '')::numeric, price_override = NULLIF(item ->> 'price_override', '')::numeric, is_active = COALESCE(NULLIF(item ->> 'is_active', '')::boolean, true), height_cm = NULLIF(item ->> 'height_cm', '')::numeric, width_cm = NULLIF(item ->> 'width_cm', '')::numeric, length_cm = NULLIF(item ->> 'length_cm', '')::numeric, weight_g = NULLIF(item ->> 'weight_g', '')::numeric, updated_at = now() WHERE id = target_id;
      variants_updated := variants_updated + 1;
    ELSE
      IF EXISTS (SELECT 1 FROM public.product_variants v WHERE v.sku = new_sku) THEN RAISE EXCEPTION 'SKU % já pertence a uma variação.', new_sku; END IF;
      INSERT INTO public.product_variants (product_id, sku, variant_name, attributes, unit, cost_override, price_override, is_active, height_cm, width_cm, length_cm, weight_g) VALUES (master_id, new_sku, btrim(item ->> 'variant_name'), COALESCE(item -> 'attributes', '{}'::jsonb), NULLIF(item ->> 'unit', ''), NULLIF(item ->> 'cost_override', '')::numeric, NULLIF(item ->> 'price_override', '')::numeric, COALESCE(NULLIF(item ->> 'is_active', '')::boolean, true), NULLIF(item ->> 'height_cm', '')::numeric, NULLIF(item ->> 'width_cm', '')::numeric, NULLIF(item ->> 'length_cm', '')::numeric, NULLIF(item ->> 'weight_g', '')::numeric);
      variants_created := variants_created + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('products_created', products_created, 'products_updated', products_updated, 'variants_created', variants_created, 'variants_updated', variants_updated);
END;
$$;