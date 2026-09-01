-- Fase 4.8.3: contrato universal de identidade física. Preserva todos os fatos
-- históricos; as regras abaixo protegem INSERT/UPDATE futuros.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.product_categories(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS variation_mode text NOT NULL DEFAULT 'sem_variacao',
  ADD COLUMN IF NOT EXISTS is_purchased boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_manufactured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_intermediate boolean NOT NULL DEFAULT false;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_variation_mode_check;
ALTER TABLE public.products ADD CONSTRAINT products_variation_mode_check
  CHECK (variation_mode IN ('sem_variacao', 'variacoes_fisicas'));
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_intermediate_requires_manufactured_check;
ALTER TABLE public.products ADD CONSTRAINT products_intermediate_requires_manufactured_check
  CHECK (NOT is_intermediate OR is_manufactured);

ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS attribute_schema jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_products_family_id ON public.products(family_id) WHERE family_id IS NOT NULL;

-- Backfill seguro: variantes existentes tornam o produto um Mestre. A Família
-- só é vinculada quando o texto legado encontra uma única categoria pelo nome.
UPDATE public.products p SET variation_mode = 'variacoes_fisicas'
WHERE EXISTS (SELECT 1 FROM public.product_variants v WHERE v.product_id = p.id);

UPDATE public.products p SET family_id = c.id
FROM public.product_categories c
WHERE p.family_id IS NULL
  AND NULLIF(btrim(p.category), '') IS NOT NULL
  AND lower(btrim(c.name)) = lower(btrim(p.category));

CREATE OR REPLACE FUNCTION public.assert_global_product_sku()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'products' THEN
    IF EXISTS (SELECT 1 FROM public.products p WHERE p.id <> NEW.id AND lower(btrim(p.sku)) = lower(btrim(NEW.sku))) THEN
      RAISE EXCEPTION 'SKU % já pertence a outro produto.', NEW.sku;
    END IF;
    IF EXISTS (SELECT 1 FROM public.product_variants v WHERE lower(btrim(v.sku)) = lower(btrim(NEW.sku))) THEN
      RAISE EXCEPTION 'SKU % já pertence a uma variante física.', NEW.sku;
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM public.product_variants v WHERE v.id <> NEW.id AND lower(btrim(v.sku)) = lower(btrim(NEW.sku))) THEN
      RAISE EXCEPTION 'SKU % já pertence a outra variante física.', NEW.sku;
    END IF;
    IF EXISTS (SELECT 1 FROM public.products p WHERE lower(btrim(p.sku)) = lower(btrim(NEW.sku))) THEN
      RAISE EXCEPTION 'SKU % já pertence a um produto.', NEW.sku;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = NEW.product_id AND p.variation_mode = 'variacoes_fisicas') THEN
      RAISE EXCEPTION 'Variantes físicas exigem Produto Mestre com variation_mode = variacoes_fisicas.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_global_sku_check ON public.products;
CREATE TRIGGER products_global_sku_check BEFORE INSERT OR UPDATE OF sku ON public.products
FOR EACH ROW EXECUTE FUNCTION public.assert_global_product_sku();
DROP TRIGGER IF EXISTS product_variants_global_sku_check ON public.product_variants;
CREATE TRIGGER product_variants_global_sku_check BEFORE INSERT OR UPDATE OF sku, product_id ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.assert_global_product_sku();

CREATE OR REPLACE FUNCTION public.assert_product_variation_mode()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.variation_mode = 'sem_variacao'
    AND EXISTS (SELECT 1 FROM public.product_variants v WHERE v.product_id = NEW.id) THEN
    RAISE EXCEPTION 'Produto com variantes físicas não pode voltar para sem_variacao.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS products_variation_mode_check ON public.products;
CREATE TRIGGER products_variation_mode_check BEFORE UPDATE OF variation_mode ON public.products
FOR EACH ROW EXECUTE FUNCTION public.assert_product_variation_mode();

CREATE OR REPLACE FUNCTION public.assert_physical_identity(
  p_product_id uuid,
  p_variant_id uuid,
  p_context text
) RETURNS void LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE v_mode text; v_variant_product uuid;
BEGIN
  SELECT variation_mode INTO v_mode FROM public.products WHERE id = p_product_id;
  IF v_mode IS NULL THEN RAISE EXCEPTION 'Produto físico não encontrado para %.', p_context; END IF;
  IF v_mode = 'sem_variacao' AND p_variant_id IS NOT NULL THEN
    RAISE EXCEPTION 'Produto simples não aceita variante em %.', p_context;
  END IF;
  IF v_mode = 'variacoes_fisicas' AND p_variant_id IS NULL THEN
    RAISE EXCEPTION 'Produto Mestre exige variante física em %.', p_context;
  END IF;
  IF p_variant_id IS NOT NULL THEN
    SELECT product_id INTO v_variant_product FROM public.product_variants WHERE id = p_variant_id;
    IF v_variant_product IS DISTINCT FROM p_product_id THEN
      RAISE EXCEPTION 'A variante não pertence ao produto em %.', p_context;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_operational_physical_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM public.assert_physical_identity(NEW.product_id, NEW.variant_id, TG_TABLE_NAME);
  RETURN NEW;
END;
$$;

-- Os fatos anteriores permanecem intactos. Triggers somente validam novas
-- inserções ou atualizações que mudem a identidade física.
DROP TRIGGER IF EXISTS inventory_physical_identity_check ON public.inventory;
CREATE TRIGGER inventory_physical_identity_check BEFORE INSERT OR UPDATE OF product_id, variant_id ON public.inventory
FOR EACH ROW EXECUTE FUNCTION public.assert_operational_physical_identity();
DROP TRIGGER IF EXISTS inventory_movements_physical_identity_check ON public.inventory_movements;
CREATE TRIGGER inventory_movements_physical_identity_check BEFORE INSERT OR UPDATE OF product_id, variant_id ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.assert_operational_physical_identity();
DROP TRIGGER IF EXISTS order_items_physical_identity_check ON public.order_items;
CREATE TRIGGER order_items_physical_identity_check BEFORE INSERT OR UPDATE OF product_id, variant_id ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.assert_operational_physical_identity();
DROP TRIGGER IF EXISTS marketplace_mapping_physical_identity_check ON public.marketplace_product_mappings;
CREATE TRIGGER marketplace_mapping_physical_identity_check BEFORE INSERT OR UPDATE OF product_id, variant_id ON public.marketplace_product_mappings
FOR EACH ROW EXECUTE FUNCTION public.assert_operational_physical_identity();
DROP TRIGGER IF EXISTS production_orders_physical_identity_check ON public.production_orders;
CREATE TRIGGER production_orders_physical_identity_check BEFORE INSERT OR UPDATE OF product_id, variant_id ON public.production_orders
FOR EACH ROW EXECUTE FUNCTION public.assert_operational_physical_identity();

CREATE OR REPLACE FUNCTION public.assert_product_component_identity_and_cycle()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM public.assert_physical_identity(NEW.product_id, NEW.product_variant_id, 'BOM do produto final');
  PERFORM public.assert_physical_identity(NEW.component_id, NEW.variant_id, 'componente da BOM');
  IF EXISTS (
    WITH RECURSIVE descendants(product_id, component_id) AS (
      SELECT pc.product_id, pc.component_id FROM public.product_components pc WHERE pc.product_id = NEW.component_id
      UNION
      SELECT pc.product_id, pc.component_id FROM public.product_components pc
      JOIN descendants d ON pc.product_id = d.component_id
    ) SELECT 1 FROM descendants WHERE component_id = NEW.product_id
  ) THEN
    RAISE EXCEPTION 'Esta composição criaria um ciclo de produção.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_components_universal_identity_check ON public.product_components;
CREATE TRIGGER product_components_universal_identity_check
BEFORE INSERT OR UPDATE OF product_id, product_variant_id, component_id, variant_id ON public.product_components
FOR EACH ROW EXECUTE FUNCTION public.assert_product_component_identity_and_cycle();

-- A RPC do catálogo continua aceitando planilhas antigas. Os novos campos são
-- opcionais e só são usados quando vierem no payload.
CREATE OR REPLACE FUNCTION public.apply_product_catalog_import(p_products jsonb DEFAULT '[]'::jsonb, p_variants jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE item jsonb; target_id uuid; master_id uuid; family uuid;
  products_created integer := 0; products_updated integer := 0; variants_created integer := 0; variants_updated integer := 0;
BEGIN
  IF jsonb_typeof(p_products) <> 'array' OR jsonb_typeof(p_variants) <> 'array' THEN RAISE EXCEPTION 'Os lotes de produtos e variações devem ser listas.'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_products) LOOP
    target_id := NULLIF(item->>'id','')::uuid;
    IF COALESCE(btrim(item->>'sku'),'') = '' OR COALESCE(btrim(item->>'name'),'') = '' THEN RAISE EXCEPTION 'Produto exige SKU e nome.'; END IF;
    SELECT id INTO family FROM public.product_categories WHERE lower(btrim(name)) = lower(btrim(COALESCE(item->>'family_name', item->>'category', ''))) LIMIT 1;
    IF target_id IS NOT NULL THEN
      UPDATE public.products SET sku=btrim(item->>'sku'), name=btrim(item->>'name'), category=NULLIF(item->>'category',''), family_id=COALESCE(family, family_id), variation_mode=COALESCE(NULLIF(item->>'variation_mode',''), variation_mode), is_purchased=COALESCE(NULLIF(item->>'is_purchased','')::boolean,is_purchased), is_manufactured=COALESCE(NULLIF(item->>'is_manufactured','')::boolean,is_manufactured), is_intermediate=COALESCE(NULLIF(item->>'is_intermediate','')::boolean,is_intermediate), unit=NULLIF(item->>'unit',''), cost=NULLIF(item->>'cost','')::numeric, price=NULLIF(item->>'price','')::numeric, min_stock=COALESCE(NULLIF(item->>'min_stock','')::numeric,0), description=NULLIF(item->>'description',''), attributes=COALESCE(item->'attributes','{}'::jsonb), expiry_days=NULLIF(item->>'expiry_days','')::integer, is_active=COALESCE(NULLIF(item->>'is_active','')::boolean,true), height_cm=NULLIF(item->>'height_cm','')::numeric, width_cm=NULLIF(item->>'width_cm','')::numeric, length_cm=NULLIF(item->>'length_cm','')::numeric, weight_g=NULLIF(item->>'weight_g','')::numeric, updated_at=now() WHERE id=target_id;
      products_updated := products_updated + 1;
    ELSE
      INSERT INTO public.products(sku,name,category,family_id,variation_mode,is_purchased,is_manufactured,is_intermediate,unit,cost,price,min_stock,description,attributes,expiry_days,is_active,height_cm,width_cm,length_cm,weight_g)
      VALUES(btrim(item->>'sku'),btrim(item->>'name'),NULLIF(item->>'category',''),family,COALESCE(NULLIF(item->>'variation_mode',''),'sem_variacao'),COALESCE(NULLIF(item->>'is_purchased','')::boolean,false),COALESCE(NULLIF(item->>'is_manufactured','')::boolean,false),COALESCE(NULLIF(item->>'is_intermediate','')::boolean,false),NULLIF(item->>'unit',''),NULLIF(item->>'cost','')::numeric,NULLIF(item->>'price','')::numeric,COALESCE(NULLIF(item->>'min_stock','')::numeric,0),NULLIF(item->>'description',''),COALESCE(item->'attributes','{}'::jsonb),NULLIF(item->>'expiry_days','')::integer,COALESCE(NULLIF(item->>'is_active','')::boolean,true),NULLIF(item->>'height_cm','')::numeric,NULLIF(item->>'width_cm','')::numeric,NULLIF(item->>'length_cm','')::numeric,NULLIF(item->>'weight_g','')::numeric);
      products_created := products_created + 1;
    END IF;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(p_variants) LOOP
    target_id := NULLIF(item->>'id','')::uuid; master_id := NULLIF(item->>'product_id','')::uuid;
    IF master_id IS NULL THEN SELECT id INTO master_id FROM public.products WHERE sku=btrim(item->>'product_sku'); END IF;
    IF master_id IS NULL OR COALESCE(btrim(item->>'sku'),'')='' OR COALESCE(btrim(item->>'variant_name'),'')='' THEN RAISE EXCEPTION 'Variação exige Mestre, SKU e nome.'; END IF;
    IF target_id IS NOT NULL THEN UPDATE public.product_variants SET product_id=master_id, sku=btrim(item->>'sku'), variant_name=btrim(item->>'variant_name'), attributes=COALESCE(item->'attributes','{}'::jsonb), unit=NULLIF(item->>'unit',''), cost_override=NULLIF(item->>'cost_override','')::numeric, price_override=NULLIF(item->>'price_override','')::numeric, is_active=COALESCE(NULLIF(item->>'is_active','')::boolean,true), height_cm=NULLIF(item->>'height_cm','')::numeric,width_cm=NULLIF(item->>'width_cm','')::numeric,length_cm=NULLIF(item->>'length_cm','')::numeric,weight_g=NULLIF(item->>'weight_g','')::numeric,updated_at=now() WHERE id=target_id; variants_updated:=variants_updated+1;
    ELSE INSERT INTO public.product_variants(product_id,sku,variant_name,attributes,unit,cost_override,price_override,is_active,height_cm,width_cm,length_cm,weight_g) VALUES(master_id,btrim(item->>'sku'),btrim(item->>'variant_name'),COALESCE(item->'attributes','{}'::jsonb),NULLIF(item->>'unit',''),NULLIF(item->>'cost_override','')::numeric,NULLIF(item->>'price_override','')::numeric,COALESCE(NULLIF(item->>'is_active','')::boolean,true),NULLIF(item->>'height_cm','')::numeric,NULLIF(item->>'width_cm','')::numeric,NULLIF(item->>'length_cm','')::numeric,NULLIF(item->>'weight_g','')::numeric); variants_created:=variants_created+1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('products_created',products_created,'products_updated',products_updated,'variants_created',variants_created,'variants_updated',variants_updated);
END;
$$;
