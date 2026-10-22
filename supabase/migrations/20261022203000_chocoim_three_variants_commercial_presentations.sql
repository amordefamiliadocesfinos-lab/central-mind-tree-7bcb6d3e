-- Operações 8: catálogo interno de apresentações comerciais do Chocoim 34g.
-- Escopo aprovado em continuidade pelo usuário: as TRÊS variantes físicas já existentes
-- (Branco, Meio Amargo e Mesclado), sem promover documentação antiga a uma nova homologação.
-- A arquitetura documental V2.0 de 02/10/2026 permanece CONGELADA e requer
-- futura revisão formal para Branco e Mesclado. Não editar documentos soberanos aqui.
-- Efeito estrito: inserir apresentações. NÃO altera produtos/variantes, BOM, preços,
-- orders, inventory, inventory_movements, marketplace_product_mappings ou anúncios.
--
-- CH1: Kit Degustação 8
-- CH2: Bandeja 20, Kit 40, Kit 80
-- CH3: atacado reutiliza a apresentação Kit 40 multiplicada pela quantidade.
-- CH4: Caixa 560 = 28 bandejas ×20; baixa 560 UNIDADES fabricadas,
--      não cria identidade física 'caixa fechada' nem estoque paralelo de caixas.
DO $chocoim$
DECLARE v_product_id uuid:='e01a87f3-615d-4330-87c6-d0f9878a7c3b'::uuid; v_total integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('catalog:chocoim34:presentations:v1',0));
  IF NOT EXISTS (SELECT 1 FROM public.products
    WHERE id=v_product_id AND is_active AND variation_mode='variacoes_fisicas'
      AND coalesce(unit,'un')='un') THEN
    RAISE EXCEPTION 'CHOCOIM_MESTRE_INCOMPATIVEL';
  END IF;
  IF (SELECT count(*) FROM public.product_variants
    WHERE product_id=v_product_id AND id IN (
      '66708945-22f3-43bf-b68e-127021448cd8'::uuid,
      '3e67edc6-1cb7-463e-8c8e-a50bfb5092f7'::uuid,
      '1a84c7f3-4130-45fc-920f-62aecafe4c91'::uuid
    ) AND is_active AND coalesce(unit,'un')='un')<>3 THEN
    RAISE EXCEPTION 'CHOCOIM_TRES_VARIANTES_NAO_ESTAO_ATIVAS';
  END IF;

  INSERT INTO public.commercial_presentations
    (product_id,variant_id,name,commercial_unit_label,conversion_factor,
     composition_mode,is_active,notes)
  SELECT v_product_id, v.variant_id,
    'Chocoim 34g — '||p.presentation_name||' — '||v.cover_name,
    p.unit_label,p.factor,'single',true,
    p.block||' | Catálogo operacional interno: variante física real '||v.cover_name
    ||'. '||CASE WHEN v.cover_name='Meio Amargo'
         THEN 'Base V2.0 homologada. '
         ELSE 'Extensão confirmada em operação; homologação documental Engenharia/Produto Mestre/Arquitetura Comercial ainda pendente. '
       END
    ||CASE WHEN p.factor=560
         THEN '28 bandejas de 20; 1 caixa comercial = 560 unidades físicas; não representa novo estoque em caixa. '
         WHEN p.factor=40
         THEN 'Reutilizar Kit 40 para volumes de atacado; não cadastrar pacotes redundantes. '
         ELSE '' END
    ||'Sem alteração de preços, custos ou anúncios Shopee.'
  FROM (VALUES
    ('66708945-22f3-43bf-b68e-127021448cd8'::uuid,'Branco'),
    ('3e67edc6-1cb7-463e-8c8e-a50bfb5092f7'::uuid,'Meio Amargo'),
    ('1a84c7f3-4130-45fc-920f-62aecafe4c91'::uuid,'Mesclado')
  ) AS v(variant_id,cover_name)
  CROSS JOIN (VALUES
    ('CH1','Degustação 8','kit',8),
    ('CH2','Bandeja 20','bandeja',20),
    ('CH2/CH3','Kit 40','kit',40),
    ('CH2','Kit 80','kit',80),
    ('CH4','Caixa 560 (28 bandejas de 20)','caixa',560)
  ) AS p(block,presentation_name,unit_label,factor)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.commercial_presentations cp
    WHERE cp.product_id=v_product_id AND cp.variant_id=v.variant_id
      AND cp.name='Chocoim 34g — '||p.presentation_name||' — '||v.cover_name
  );

  SELECT count(*) INTO v_total
  FROM public.commercial_presentations
  WHERE product_id=v_product_id AND is_active;
  IF v_total<>15 THEN
    RAISE EXCEPTION 'CHOCOIM_APRESENTACOES_INESPERADAS: total %, expected 15',v_total;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.commercial_presentations cp
    WHERE cp.product_id=v_product_id AND (cp.composition_mode<>'single'
      OR cp.variant_id IS NULL OR cp.conversion_factor NOT IN (8,20,40,80,560)
      OR cp.commercial_unit_label NOT IN ('kit','bandeja','caixa'))
  ) THEN
    RAISE EXCEPTION 'CHOCOIM_APRESENTACAO_INCONSISTENTE';
  END IF;
END $chocoim$;
