-- Porto Gel / modelo B: identidades novas, inicialmente INATIVAS.
-- Preserva variantes históricas em g e todas as referências de BOM, compras,
-- pedidos, estoque e marketplace. A ativação depende do motor transacional.
DO $$
DECLARE
  v_product uuid := '6e757550-a9b6-4644-8164-8c802760e373';
  v_count int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id=v_product AND is_active) THEN
    RAISE EXCEPTION 'Porto Gel master not available';
  END IF;
  SELECT count(*) INTO v_count FROM public.product_variants
  WHERE product_id=v_product AND sku IN (
    'EMUL-PORTOGEL-NEW-10KG-UN','EMUL-PORTOGEL-NEW-3KG-UN',
    'EMUL-PORTOGEL-NEW-1KG-UN','EMUL-PORTOGEL-PRODUCAO-G'
  );
  IF v_count NOT IN (0,4) THEN RAISE EXCEPTION 'Partial target variant set; manual review required'; END IF;
  IF v_count=0 THEN
    INSERT INTO public.product_variants
      (product_id,sku,variant_name,unit,is_active,attributes)
    VALUES
      (v_product,'EMUL-PORTOGEL-NEW-10KG-UN','10 kg — embalagem fechada (nova)','un',false,'{"peso":"10kg","conteudo_g":10000,"uso":"venda_producao","prioridade_producao":1}'::jsonb),
      (v_product,'EMUL-PORTOGEL-NEW-3KG-UN','3 kg — embalagem fechada (nova)','un',false,'{"peso":"3kg","conteudo_g":3000,"uso":"venda_producao","prioridade_producao":2}'::jsonb),
      (v_product,'EMUL-PORTOGEL-NEW-1KG-UN','1 kg — embalagem fechada (nova)','un',false,'{"peso":"1kg","conteudo_g":1000,"uso":"venda_producao","prioridade_producao":3}'::jsonb),
      (v_product,'EMUL-PORTOGEL-PRODUCAO-G','Produção — saldo em gramas (nova)','g',false,'{"uso":"producao","controle":"gramas"}'::jsonb);
  END IF;
END $$;
