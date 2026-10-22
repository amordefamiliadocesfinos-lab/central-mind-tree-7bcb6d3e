-- CHOCOIM 34G | MISTO COMERCIAL 50/50 DE UNIDADES PRONTAS.
-- "Mesclado" e uma variante FISICA diferente (uma unidade mesclada).
-- NAO alterar nenhuma das 15 apresentacoes single de Branco/Meio Amargo/Mesclado.
-- Mistos: Bandeja 20 = 10 Preto+10 Branco; Kit 40=20+20; Kit 80=40+40;
-- Caixa 560=280+280 (28 bandejas 20). Sem degustacao mista 8 nesta fase:
-- degustacao era uma possibilidade, nao uma das quatro apresentacoes aprovadas.
-- Sem movimento de estoque, pedido, mapeamento Shopee, receita ou custo.

DO $chocoim_misto$
DECLARE
  v_master constant uuid:='e01a87f3-615d-4330-87c6-d0f9878a7c3b'::uuid;
  v_black constant uuid:='3e67edc6-1cb7-463e-8c8e-a50bfb5092f7'::uuid;
  v_white constant uuid:='66708945-22f3-43bf-b68e-127021448cd8'::uuid;
  v_mesclado constant uuid:='1a84c7f3-4130-45fc-920f-62aecafe4c91'::uuid;
  v record;
  v_present uuid;
  v_compositions integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('catalog:chocoim34:presentations:v1',0));
  IF NOT EXISTS (
    SELECT 1 FROM public.products
    WHERE id=v_master AND is_active AND variation_mode='variacoes_fisicas'
  ) THEN RAISE EXCEPTION 'CHOCOIM_MESTRE_FISICO_INATIVO_OU_INCOMPATIVEL'; END IF;
  IF (SELECT count(*) FROM public.product_variants
      WHERE product_id=v_master
      AND id IN (v_black,v_white,v_mesclado)
      AND is_active AND unit='un')<>3 THEN
    RAISE EXCEPTION 'CHOCOIM_VARIANTES_FISICAS_NAO_CONFEREM';
  END IF;

  -- Precondicao: as 15 singles originais (5 em cada uma das 3 variantes) existem.
  IF (SELECT count(*) FROM public.commercial_presentations
      WHERE product_id=v_master AND composition_mode='single'
        AND variant_id IN (v_black,v_white,v_mesclado)
        AND is_active AND conversion_factor IN (8,20,40,80,560))<>15 THEN
    RAISE EXCEPTION 'CHOCOIM_SINGLES_ORIGINAIS_ALTERADAS';
  END IF;

  FOR v IN SELECT * FROM (VALUES
    ('c34c0a34-2026-4000-8000-000000000020'::uuid,'Chocoim 34g — Bandeja Mista 20 (10 Preto + 10 Branco)','bandeja',20,10,10,'CH2 | 1 bandeja mista = 10 Meio Amargo (Preto) + 10 Branco'),
    ('c34c0a34-2026-4000-8000-000000000040'::uuid,'Chocoim 34g — Kit Misto 40 (20 Preto + 20 Branco)','kit',40,20,20,'CH2/CH3 | 1 kit misto = 2 bandejas de 20, sendo 20 Preto + 20 Branco. Atacado em multiplos do kit 40'),
    ('c34c0a34-2026-4000-8000-000000000080'::uuid,'Chocoim 34g — Kit Misto 80 (40 Preto + 40 Branco)','kit',80,40,40,'CH2 | 1 kit misto = 4 bandejas de 20, sendo 40 Preto + 40 Branco'),
    ('c34c0a34-2026-4000-8000-000000000560'::uuid,'Chocoim 34g — Caixa Mista 560 (280 Preto + 280 Branco)','caixa',560,280,280,'CH4 | 1 caixa mista comercial = 28 bandejas de 20 (280 Preto + 280 Branco). Nao implica estoque fisico em caixas')
  ) AS p(id,name,unit_label,total,black_units,white_units,description)
  LOOP
    -- Nao sobreescrever apresentacao com o mesmo nome, mas identidade divergente.
    IF EXISTS(SELECT 1 FROM public.commercial_presentations WHERE product_id=v_master
      AND name=v.name AND id<>v.id) THEN RAISE EXCEPTION 'CHOCOIM_MISTO_NOME_DUPLICADO'; END IF;

    INSERT INTO public.commercial_presentations
      (id,product_id,variant_id,name,commercial_unit_label,conversion_factor,
       composition_mode,is_active,notes)
    VALUES(v.id,v_master,NULL,v.name,v.unit_label,v.total,
      'composite',true,v.description || '. "Mesclado" continua produto fisico proprio; nao compoe o Misto. Preco comercial negociado; nao alterar Shopee.')
    ON CONFLICT(id) DO NOTHING;

    SELECT id INTO v_present FROM public.commercial_presentations
      WHERE id=v.id AND product_id=v_master AND variant_id IS NULL AND name=v.name
        AND composition_mode='composite' AND is_active
        AND commercial_unit_label=v.unit_label AND conversion_factor=v.total;
    IF v_present IS NULL THEN RAISE EXCEPTION 'CHOCOIM_MISTO_IDENTIDADE_INVALIDA %',v.name; END IF;

    INSERT INTO public.commercial_presentation_components
      (presentation_id,product_id,variant_id,quantity)
    SELECT v_present,v_master,variant_qty.variant_id,variant_qty.quantity
    FROM (VALUES (v_black,v.black_units),(v_white,v.white_units)) AS variant_qty(variant_id,quantity)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.commercial_presentation_components existing
      WHERE existing.presentation_id=v_present
        AND existing.product_id=v_master AND existing.variant_id=variant_qty.variant_id
    );

    SELECT count(*) INTO v_compositions FROM public.commercial_presentation_components
    WHERE presentation_id=v_present;
    IF v_compositions<>2
     OR EXISTS (
      SELECT 1 FROM public.commercial_presentation_components c
      WHERE c.presentation_id=v_present AND (c.product_id<>v_master OR c.variant_id NOT IN (v_black,v_white)
        OR (c.variant_id=v_black AND c.quantity<>v.black_units)
        OR (c.variant_id=v_white AND c.quantity<>v.white_units))
     )
     OR (SELECT coalesce(sum(quantity),0) FROM public.commercial_presentation_components WHERE presentation_id=v_present)<>v.total
    THEN RAISE EXCEPTION 'CHOCOIM_MISTO_COMPOSICAO_INCONSISTENTE %',v.name; END IF;
  END LOOP;

  IF (SELECT count(*) FROM public.commercial_presentations
      WHERE product_id=v_master AND composition_mode='composite'
       AND id IN ('c34c0a34-2026-4000-8000-000000000020'::uuid,
                  'c34c0a34-2026-4000-8000-000000000040'::uuid,
                  'c34c0a34-2026-4000-8000-000000000080'::uuid,
                  'c34c0a34-2026-4000-8000-000000000560'::uuid))<>4
  THEN RAISE EXCEPTION 'CHOCOIM_MISTO_APRESENTACOES_AUSENTES';END IF;
END $chocoim_misto$;
