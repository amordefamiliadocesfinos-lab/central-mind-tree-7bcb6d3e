-- Operações 8 / AM-1 — Amendoim Torrado: dois kits fracionados de 1 kg.
-- APENAS apresentações comerciais; estoque canônico permanece em gramas (EG).
-- Um kit 2 kg = PREPARAR 2 pacotes de 1.000g; um kit 3 kg = PREPARAR 3 pacotes de 1.000g.
-- NÃO cria embalagem física/estoque de pacotes, nem converte E24 (saco fechado 24kg).
-- NÃO modifica as apresentações existentes 350g e kg, Produto Mestre, BOM,
-- recebimentos, pedidos, estoque, compras, Shopee, preços ou precificação.
DO $am1$
DECLARE
  v_product constant uuid := 'c177f332-a1c7-4276-9cef-7b81af920174'::uuid;
  v_item record;
  v_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('operacoes:amendoim-torrado:am1:comercial',0));

  IF NOT EXISTS (
    SELECT 1 FROM public.products WHERE id=v_product AND is_active
      AND variation_mode='sem_variacao' AND unit='g' AND is_purchased
  ) THEN RAISE EXCEPTION 'AM1_PRODUTO_MESTRE_INCOMPATIVEL'; END IF;

  IF (SELECT count(*) FROM public.commercial_presentations
    WHERE product_id=v_product AND variant_id IS NULL AND is_active
      AND composition_mode='single'
      AND ((id='f0d618e4-350b-427f-8c32-c15fb6fd8431'::uuid
            AND name='350 g' AND conversion_factor=350 AND commercial_unit_label='pacote')
        OR (id='c04e4067-cf9d-430f-a099-3bb5066b3d38'::uuid
            AND name='kg' AND conversion_factor=1000 AND commercial_unit_label='kg'))
  ) <> 2 THEN RAISE EXCEPTION 'AM1_APRESENTACOES_ANTERIORES_DIVERGENTES'; END IF;

  FOR v_item IN SELECT * FROM (VALUES
    ('a11e0000-0000-4000-8000-000000002000'::uuid,
      'Kit 2 pacotes de 1 kg',2000,2,
      'AM1 | Kit fracionado 2kg: preparar 2 pacotes de 1.000g. A baixa de estoque ocorre em 2.000g EG. Não equivale a saco original lacrado.'),
    ('a11e0000-0000-4000-8000-000000003000'::uuid,
      'Kit 3 pacotes de 1 kg',3000,3,
      'AM1 | Kit fracionado 3kg: preparar 3 pacotes de 1.000g. A baixa de estoque ocorre em 3.000g EG. Não equivale a saco original lacrado.')
  ) AS x(id,name,grams,packages,description)
  LOOP
    IF EXISTS (SELECT 1 FROM public.commercial_presentations
      WHERE product_id=v_product AND name=v_item.name AND id<>v_item.id)
    THEN RAISE EXCEPTION 'AM1_NOME_COMERCIAL_DUPLICADO: %',v_item.name;END IF;

    INSERT INTO public.commercial_presentations
      (id,product_id,variant_id,name,commercial_unit_label,
        conversion_factor,composition_mode,is_active,notes)
    VALUES (v_item.id,v_product,NULL,v_item.name,'kit',
      v_item.grams,'single',true,v_item.description)
    ON CONFLICT (id) DO NOTHING;

    IF NOT EXISTS (SELECT 1 FROM public.commercial_presentations
      WHERE id=v_item.id AND product_id=v_product AND variant_id IS NULL
        AND name=v_item.name AND commercial_unit_label='kit'
        AND conversion_factor=v_item.grams AND composition_mode='single'
        AND is_active)
    THEN RAISE EXCEPTION 'AM1_IDENTIDADE_INCONSISTENTE: %',v_item.name;END IF;
  END LOOP;

  SELECT COUNT(*) INTO v_count FROM public.commercial_presentations WHERE product_id=v_product;
  IF v_count<>4 THEN
    RAISE EXCEPTION 'AM1_TOTAL_APRESENTACOES_INESPERADO: %',v_count;
  END IF;
END $am1$;