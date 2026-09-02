-- FASE 4.8.5A.1: motor transacional universal de conversao.
-- Esta migration cria somente infraestrutura; nao contem nem converte dados reais.

CREATE OR REPLACE FUNCTION public.convert_simple_products_to_variants(
  p_source_product_ids uuid[],
  p_master jsonb,
  p_variants jsonb,
  p_reset_stock boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_id uuid;
  v_source public.products%ROWTYPE;
  v_master_id uuid;
  v_master public.products%ROWTYPE;
  v_variant jsonb;
  v_variant_id uuid;
  v_variant_ids uuid[] := ARRAY[]::uuid[];
  v_original_skus jsonb := '{}'::jsonb;
  v_archival_sku text;
BEGIN
  IF p_source_product_ids IS NULL OR cardinality(p_source_product_ids) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um produto simples de origem.';
  END IF;
  IF p_master IS NULL OR jsonb_typeof(p_master) <> 'object' THEN
    RAISE EXCEPTION 'A definicao do Produto Mestre deve ser um objeto.';
  END IF;
  IF p_variants IS NULL OR jsonb_typeof(p_variants) <> 'array'
     OR jsonb_array_length(p_variants) <> cardinality(p_source_product_ids) THEN
    RAISE EXCEPTION 'Deve existir exatamente uma definicao de variante para cada produto de origem.';
  END IF;
  IF p_reset_stock IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Esta fase exige reset_stock=true; transporte de saldo ainda nao e suportado.';
  END IF;
  IF cardinality(p_source_product_ids) <> (
    SELECT count(DISTINCT source_id)
    FROM unnest(p_source_product_ids) AS source_id
  ) THEN
    RAISE EXCEPTION 'A lista de produtos de origem contem IDs duplicados.';
  END IF;

  -- Serializa conversoes e criacoes comuns que respeitem o mesmo lock. Os locks
  -- de linha abaixo protegem os produtos selecionados contra alteracao concorrente.
  PERFORM pg_advisory_xact_lock(hashtext('convert-simple-products-to-variants'));
  PERFORM 1
  FROM public.products
  WHERE id = ANY(p_source_product_ids)
  ORDER BY id
  FOR UPDATE;

  IF (SELECT count(*) FROM public.products WHERE id = ANY(p_source_product_ids))
     <> cardinality(p_source_product_ids) THEN
    RAISE EXCEPTION 'Um ou mais produtos de origem nao foram encontrados.';
  END IF;

  -- Cada variante declara explicitamente sua origem; ordem do JSON nao importa.
  FOR v_source_id IN SELECT unnest(p_source_product_ids) LOOP
    IF (SELECT count(*) FROM jsonb_array_elements(p_variants) item
        WHERE NULLIF(item->>'source_product_id', '')::uuid = v_source_id) <> 1 THEN
      RAISE EXCEPTION 'Cada produto de origem deve aparecer exatamente uma vez em p_variants (%).', v_source_id;
    END IF;

    SELECT * INTO STRICT v_source FROM public.products WHERE id = v_source_id;
    IF NOT v_source.is_active OR v_source.deleted_at IS NOT NULL
       OR v_source.variation_mode <> 'sem_variacao' THEN
      RAISE EXCEPTION 'Produto % nao e um produto simples ativo e elegivel.', v_source_id;
    END IF;
    IF EXISTS (SELECT 1 FROM public.product_variants WHERE product_id = v_source_id) THEN
      RAISE EXCEPTION 'Produto % ja possui variantes.', v_source_id;
    END IF;
    v_original_skus := v_original_skus || jsonb_build_object(v_source_id::text, v_source.sku);
  END LOOP;

  v_master_id := NULLIF(btrim(p_master->>'id'), '')::uuid;
  IF v_master_id IS NOT NULL THEN
    IF v_master_id = ANY(p_source_product_ids) THEN
      RAISE EXCEPTION 'O Mestre existente nao pode ser um dos produtos de origem.';
    END IF;
    SELECT * INTO v_master FROM public.products WHERE id = v_master_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto Mestre existente nao encontrado.'; END IF;
    IF NOT v_master.is_active OR v_master.deleted_at IS NOT NULL
       OR v_master.variation_mode <> 'variacoes_fisicas' THEN
      RAISE EXCEPTION 'O Produto Mestre existente deve estar ativo e usar variacoes_fisicas.';
    END IF;
  ELSE
    IF COALESCE(btrim(p_master->>'sku'), '') = '' OR COALESCE(btrim(p_master->>'name'), '') = '' THEN
      RAISE EXCEPTION 'Um novo Produto Mestre exige sku e name.';
    END IF;
    INSERT INTO public.products (
      sku, name, description, unit, min_stock, cost, price, is_active,
      category, family_id, variation_mode, is_purchased, is_manufactured,
      is_intermediate, attributes, expiry_days, cover_image_url, media_urls
    ) VALUES (
      btrim(p_master->>'sku'), btrim(p_master->>'name'), NULLIF(p_master->>'description', ''),
      NULLIF(p_master->>'unit', ''), COALESCE(NULLIF(p_master->>'min_stock', '')::numeric, 0),
      NULLIF(p_master->>'cost', '')::numeric, NULLIF(p_master->>'price', '')::numeric, true,
      NULLIF(p_master->>'category', ''), NULLIF(p_master->>'family_id', '')::uuid,
      'variacoes_fisicas', COALESCE(NULLIF(p_master->>'is_purchased', '')::boolean, false),
      COALESCE(NULLIF(p_master->>'is_manufactured', '')::boolean, false),
      COALESCE(NULLIF(p_master->>'is_intermediate', '')::boolean, false),
      CASE WHEN jsonb_typeof(p_master->'attributes') = 'object' THEN p_master->'attributes' ELSE '{}'::jsonb END,
      NULLIF(p_master->>'expiry_days', '')::integer, NULLIF(p_master->>'cover_image_url', ''),
      CASE WHEN jsonb_typeof(p_master->'media_urls') = 'array' THEN p_master->'media_urls' ELSE '[]'::jsonb END
    ) RETURNING * INTO v_master;
    v_master_id := v_master.id;
  END IF;

  -- Libera todos os SKUs primeiro. O valor tecnico e deterministico, nao colide
  -- com identidades fisicas e permite auditoria do registro legado.
  FOR v_source_id IN SELECT unnest(p_source_product_ids) LOOP
    v_archival_sku := '__converted__:' || v_source_id::text;
    UPDATE public.products
    SET sku = v_archival_sku,
        is_active = false,
        deleted_at = now(),
        updated_at = now()
    WHERE id = v_source_id;
  END LOOP;

  FOR v_variant IN SELECT value FROM jsonb_array_elements(p_variants) LOOP
    v_source_id := NULLIF(v_variant->>'source_product_id', '')::uuid;
    SELECT * INTO STRICT v_source FROM public.products WHERE id = v_source_id;
    IF COALESCE(btrim(v_variant->>'variant_name'), '') = '' THEN
      RAISE EXCEPTION 'A variante do produto % exige variant_name.', v_source_id;
    END IF;
    IF v_variant ? 'attributes' AND jsonb_typeof(v_variant->'attributes') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Os attributes da variante do produto % devem ser um objeto.', v_source_id;
    END IF;

    INSERT INTO public.product_variants (
      product_id, sku, variant_name, attributes, unit, is_active,
      cost_override, price_override, weight_g, height_cm, width_cm, length_cm
    ) VALUES (
      v_master_id, v_original_skus->>v_source_id::text, btrim(v_variant->>'variant_name'),
      COALESCE(v_source.attributes, '{}'::jsonb) || COALESCE(v_variant->'attributes', '{}'::jsonb),
      v_source.unit, true, v_source.cost, v_source.price, v_source.weight_g,
      v_source.height_cm, v_source.width_cm, v_source.length_cm
    ) RETURNING id INTO v_variant_id;
    v_variant_ids := array_append(v_variant_ids, v_variant_id);
  END LOOP;

  RETURN jsonb_build_object(
    'master_product_id', v_master_id,
    'variant_ids', to_jsonb(v_variant_ids),
    'converted_product_ids', to_jsonb(p_source_product_ids),
    'reset_stock', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.convert_simple_products_to_variants(uuid[], jsonb, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_simple_products_to_variants(uuid[], jsonb, jsonb, boolean) TO authenticated;

COMMENT ON FUNCTION public.convert_simple_products_to_variants(uuid[], jsonb, jsonb, boolean) IS
  'Converte atomicamente produtos simples arquivados em variantes fisicas de um Mestre novo ou existente. Nesta fase reset_stock deve ser true.';
