-- Operações BA3: a caixa original do fornecedor é uma identidade física cx.
-- Preserva as variantes antigas em unidades (un), os saldos históricos, compras, BOM,
-- pedidos e mappings Shopee. Não migra nem presume caixas existentes.
DO $$
DECLARE
  v_product uuid := 'c4580ad6-e53a-4a36-9696-a65f2a95da00';
  v_row record;
  v_box uuid;
BEGIN
  FOR v_row IN
    SELECT *
    FROM (VALUES
      ('fa0814a0-9cd0-4d8a-b01d-2febdd1d7dcc'::uuid, 'Tradicional', 'BIS-CX8-TRAD'),
      ('34188174-5906-4f92-a16d-4e5207f37dd5'::uuid, 'Chocolate', 'BIS-CX8-CHOC')
    ) AS x(unit_variant_id, flavor, box_sku)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.product_variants v
      WHERE v.id = v_row.unit_variant_id AND v.product_id = v_product AND v.unit = 'un'
        AND v.is_active
    ) THEN
      RAISE EXCEPTION 'Biscoito: origem física em unidades não encontrada (%).', v_row.flavor;
    END IF;

    INSERT INTO public.product_variants (
      product_id, sku, variant_name, unit, attributes, is_active
    ) VALUES (
      v_product, v_row.box_sku, v_row.flavor || ' · Caixa fechada 8 kg',
      'cx',
      jsonb_build_object('flavor', v_row.flavor, 'physical_form', 'sealed_supplier_box',
                         'source_unit_variant_id', v_row.unit_variant_id::text,
                         'nominal_weight_kg', 8),
      true
    ) ON CONFLICT (sku) DO NOTHING;

    SELECT id INTO v_box FROM public.product_variants WHERE sku = v_row.box_sku;
    IF NOT EXISTS (
      SELECT 1 FROM public.product_variants
      WHERE id = v_box AND product_id = v_product AND unit = 'cx'
    ) THEN
      RAISE EXCEPTION 'SKU de caixa já pertence a identidade física incompatível: %', v_row.box_sku;
    END IF;

    INSERT INTO public.commercial_presentations (
      product_id, variant_id, name, commercial_unit_label,
      conversion_factor, is_active, composition_mode, notes
    )
    SELECT v_product, v_box, 'Caixa fechada 8 kg', 'caixa', 1, true, 'single',
      'BA3 — uma caixa original lacrada do fornecedor; 8 kg nominais. Aproximadamente 40 pacotes/880 biscoitos (não garantidos). Estoque e expedição por caixa física cx, sem converter a baixa em 880 un.'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.commercial_presentations
      WHERE product_id = v_product AND variant_id = v_box
        AND lower(btrim(name)) = 'caixa fechada 8 kg'
    );

    INSERT INTO public.purchase_presentations (
      product_id, variant_id, name, purchase_unit_label, stock_unit_label,
      conversion_factor, is_approximate, is_active, notes
    )
    SELECT v_product, v_box, 'Caixa original fechada 8 kg (1 cx)', 'caixa', 'cx',
           1, false, true,
           'Recebimento de caixa original lacrada em 1 cx. Não converter automaticamente em 880 biscoitos; abertura exige contagem física de pacotes.'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.purchase_presentations
      WHERE product_id = v_product AND variant_id = v_box
        AND name = 'Caixa original fechada 8 kg (1 cx)'
    );
  END LOOP;
END;
$$;

-- Transferência atômica entre saldo histórico em unidades e caixa fechada.
-- Na selagem/reclassificação, 880 un é equivalência contábil aproximada já
-- utilizada no estoque legado, NÃO número exato de biscoitos na caixa.
-- Na abertura, contam-se os pacotes reais e converte-se pela garantia de 22.
CREATE OR REPLACE FUNCTION public.convert_biscuit_closed_box_stock(
  p_unit_variant_id uuid,
  p_direction text,
  p_boxes integer,
  p_packages integer,
  p_location text,
  p_event_key text,
  p_confirmed boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_product uuid := 'c4580ad6-e53a-4a36-9696-a65f2a95da00';
  v_sku text;
  v_box_variant_id uuid;
  v_location_id uuid;
  v_unit_previous numeric;
  v_box_previous numeric;
  v_unit_after numeric;
  v_box_after numeric;
  v_units numeric;
  v_event_id uuid := gen_random_uuid();
  v_from_variant uuid;
  v_to_variant uuid;
  v_from_qty numeric;
  v_to_qty numeric;
  v_notes text;
BEGIN
  IF auth.role() <> 'service_role' AND
     (auth.uid() IS NULL OR COALESCE(public.current_app_user_role(), '') NOT IN ('Administrador', 'LIDER PRODUÇÃO')) THEN
    RAISE EXCEPTION 'inventory_manager_required';
  END IF;

  IF p_unit_variant_id = 'fa0814a0-9cd0-4d8a-b01d-2febdd1d7dcc'::uuid THEN
    v_sku := 'BIS-CX8-TRAD';
  ELSIF p_unit_variant_id = '34188174-5906-4f92-a16d-4e5207f37dd5'::uuid THEN
    v_sku := 'BIS-CX8-CHOC';
  ELSE
    RAISE EXCEPTION 'Variante de biscoito não autorizada para conversão de caixa.';
  END IF;

  SELECT id INTO v_box_variant_id
    FROM public.product_variants
    WHERE sku = v_sku AND product_id = v_product AND unit = 'cx' AND is_active;
  IF v_box_variant_id IS NULL THEN RAISE EXCEPTION 'Variante de caixa fechada ainda não cadastrada.'; END IF;

  IF p_direction NOT IN ('seal', 'open') THEN RAISE EXCEPTION 'Direção de conversão inválida.'; END IF;
  IF p_boxes IS NULL OR p_boxes < 1 OR p_boxes > 1000 THEN
    RAISE EXCEPTION 'Informe a quantidade inteira e positiva de caixas.';
  END IF;
  IF p_confirmed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Confirme a verificação física das caixas e dos pacotes.';
  END IF;
  IF p_direction = 'open' AND (p_packages IS NULL OR p_packages < 1 OR p_packages > p_boxes * 100) THEN
    RAISE EXCEPTION 'Conte e informe a quantidade real de pacotes retirados das caixas abertas.';
  END IF;
  IF p_direction = 'seal' AND p_packages IS NOT NULL THEN
    RAISE EXCEPTION 'Não informe contagem interna de caixa ainda lacrada.';
  END IF;
  IF p_event_key IS NULL OR p_event_key !~ '^biscuit_box:[0-9a-f-]{36}$' THEN
    RAISE EXCEPTION 'Chave de idempotência obrigatória e inválida.';
  END IF;

  SELECT id INTO v_location_id FROM public.storage_locations
    WHERE name=p_location AND is_active LIMIT 1;
  IF v_location_id IS NULL THEN RAISE EXCEPTION 'Local de estoque inexistente ou inativo.'; END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('biscuit_box:' || p_unit_variant_id::text || ':' || p_location,0)
  );

  IF EXISTS (SELECT 1 FROM public.inventory_movements WHERE event_key = p_event_key || ':out') THEN
    RETURN jsonb_build_object('success',true,'already_processed',true,'event_key',p_event_key);
  END IF;

  INSERT INTO public.inventory(product_id,variant_id,location,location_id,quantity,updated_at)
  VALUES (v_product,p_unit_variant_id,p_location,v_location_id,0,now())
  ON CONFLICT(product_id,variant_id,location) DO NOTHING;
  INSERT INTO public.inventory(product_id,variant_id,location,location_id,quantity,updated_at)
  VALUES (v_product,v_box_variant_id,p_location,v_location_id,0,now())
  ON CONFLICT(product_id,variant_id,location) DO NOTHING;

  PERFORM 1 FROM public.inventory
    WHERE product_id=v_product AND location=p_location
      AND variant_id IN (p_unit_variant_id,v_box_variant_id)
    ORDER BY variant_id FOR UPDATE;

  SELECT quantity INTO v_unit_previous FROM public.inventory
    WHERE product_id=v_product AND variant_id=p_unit_variant_id AND location=p_location;
  SELECT quantity INTO v_box_previous FROM public.inventory
    WHERE product_id=v_product AND variant_id=v_box_variant_id AND location=p_location;

  v_units := CASE WHEN p_direction='seal' THEN p_boxes::numeric*880 ELSE p_packages::numeric*22 END;
  IF p_direction='seal' THEN
    IF v_unit_previous < v_units THEN
      RAISE EXCEPTION 'Saldo legado insuficiente: necessário % un, disponível % un. Nenhuma caixa foi criada.',v_units,v_unit_previous;
    END IF;
    v_unit_after:=v_unit_previous-v_units;
    v_box_after:=v_box_previous+p_boxes;
    v_from_variant:=p_unit_variant_id;
    v_to_variant:=v_box_variant_id;
    v_from_qty:=v_units;
    v_to_qty:=p_boxes;
    v_notes:='Reclassificação confirmada de '||p_boxes||' caixa(s) lacrada(s); baixa contábil estimada de '||v_units||' un do saldo legado, sem presumir a contagem interna.';
  ELSE
    IF v_box_previous < p_boxes THEN
      RAISE EXCEPTION 'Não existem % caixa(s) lacrada(s) disponíveis; saldo atual: % cx.',p_boxes,v_box_previous;
    END IF;
    v_unit_after:=v_unit_previous+v_units;
    v_box_after:=v_box_previous-p_boxes;
    v_from_variant:=v_box_variant_id;
    v_to_variant:=p_unit_variant_id;
    v_from_qty:=p_boxes;
    v_to_qty:=v_units;
    v_notes:='Abertura física de '||p_boxes||' caixa(s): contados '||p_packages||' pacote(s); entrada de '||v_units||' un garantidas (22 un/pacote). Excedentes não presumidos.';
  END IF;

  UPDATE public.inventory SET quantity=v_unit_after,updated_at=now()
    WHERE product_id=v_product AND variant_id=p_unit_variant_id AND location=p_location;
  UPDATE public.inventory SET quantity=v_box_after,updated_at=now()
    WHERE product_id=v_product AND variant_id=v_box_variant_id AND location=p_location;

  INSERT INTO public.inventory_movements
    (product_id,variant_id,movement_type,quantity,previous_balance,new_balance,
     location,reference_type,reference_id,event_key,notes,created_by)
  VALUES
    (v_product,v_from_variant,'out',v_from_qty,
      CASE WHEN p_direction='seal' THEN v_unit_previous ELSE v_box_previous END,
      CASE WHEN p_direction='seal' THEN v_unit_after ELSE v_box_after END,
      p_location,'biscuit_box_conversion',v_event_id,p_event_key||':out',v_notes,auth.uid()::text),
    (v_product,v_to_variant,'in',v_to_qty,
      CASE WHEN p_direction='seal' THEN v_box_previous ELSE v_unit_previous END,
      CASE WHEN p_direction='seal' THEN v_box_after ELSE v_unit_after END,
      p_location,'biscuit_box_conversion',v_event_id,p_event_key||':in',v_notes,auth.uid()::text);

  RETURN jsonb_build_object('success',true,'already_processed',false,'event_key',p_event_key,
    'direction',p_direction,'boxes',p_boxes,'packages',p_packages,
    'unit_balance',v_unit_after,'box_balance',v_box_after,
    'conversion_equivalent_approximate',p_direction='seal');
END;
$function$;

REVOKE ALL ON FUNCTION public.convert_biscuit_closed_box_stock(uuid,text,integer,integer,text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_biscuit_closed_box_stock(uuid,text,integer,integer,text,text,boolean) TO authenticated, service_role;
