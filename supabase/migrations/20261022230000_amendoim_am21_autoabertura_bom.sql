-- AM-2.1: complementa AM-2 sem criar novos estoques de apresentações.
-- Migração reaproveita exatamente as assinaturas e funções oficiais de produção.
-- Alterar estritamente o consumo de BOM do Amendoim (gramas) e a liberação E24.
-- No legacy, somar E24 à disponibilidade ANTES da checagem de falta, como no Chocolate CB3.

-- AM-2.1: autoabertura contábil E24 para consumo de produção (mesmo padrão do CB3).
-- A operação não acrescenta outra identidade de estoque para pacotes comerciais.
ALTER TABLE public.amendoim_sealed_events DROP CONSTRAINT IF EXISTS amendoim_sealed_events_reference_type_check;
ALTER TABLE public.amendoim_sealed_events ADD CONSTRAINT amendoim_sealed_events_reference_type_check
  CHECK(reference_type IN ('amendoim_legacy_reclassify','amendoim_physical_open','amendoim_production_auto_open'));
-- Produção pode executar via backend sem auth.uid de operador. Rastreabilidade permanece em reference_id.
ALTER TABLE public.amendoim_sealed_events ALTER COLUMN created_by DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.ensure_amendoim_production_material(
  p_reference_id uuid,p_required_g numeric,p_ref_type text DEFAULT 'production_fact'
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $am21$
DECLARE
  v_product constant uuid:='c177f332-a1c7-4276-9cef-7b81af920174'::uuid;
  v_location text:='Fábrica';v_location_id uuid;
  v_open numeric;v_short numeric;v_needed integer;v_take integer;
  v_old_sacks integer;v_old_g numeric;v_new_g numeric;v_event_key text;
  v_event uuid:=gen_random_uuid();
BEGIN
  IF p_reference_id IS NULL OR p_required_g IS NULL OR p_required_g<0
   OR p_ref_type NOT IN ('production_fact','production_order') THEN
    RAISE EXCEPTION 'am21_invalid_production_request';END IF;
  IF p_ref_type='production_fact' AND NOT EXISTS(
    SELECT 1 FROM public.production_facts WHERE id=p_reference_id
  ) THEN RAISE EXCEPTION 'am21_production_fact_missing';END IF;
  IF p_ref_type='production_order' AND NOT EXISTS(
    SELECT 1 FROM public.production_orders WHERE id=p_reference_id
  ) THEN RAISE EXCEPTION 'am21_production_order_missing';END IF;

  SELECT id INTO v_location_id FROM public.storage_locations
   WHERE name=v_location AND is_active LIMIT 1;
  IF v_location_id IS NULL THEN RAISE EXCEPTION 'am21_factory_not_found';END IF;
  -- Same location-level advisory lock AM-2 conversion uses.
  PERFORM pg_advisory_xact_lock(hashtextextended('am2:location:'||v_location_id::text,0));

  INSERT INTO public.inventory(product_id,variant_id,location,location_id,quantity,updated_at)
    VALUES(v_product,NULL,v_location,v_location_id,0,now())
    ON CONFLICT(product_id,variant_id,location) DO NOTHING;
  SELECT quantity INTO v_open FROM public.inventory
   WHERE product_id=v_product AND variant_id IS NULL AND location=v_location FOR UPDATE;
  v_short:=greatest(0,p_required_g-coalesce(v_open,0));
  IF v_short<=0 THEN RETURN 0;END IF;
  v_needed:=ceil(v_short/24000)::integer;

  SELECT sacks INTO v_old_sacks FROM public.amendoim_sealed_stock
    WHERE storage_location_id=v_location_id FOR UPDATE;
  IF coalesce(v_old_sacks,0)=0 THEN RETURN 0;END IF;
  v_take:=least(v_needed,v_old_sacks);
  IF v_take<=0 THEN RETURN 0;END IF;
  v_event_key:='amendoim:auto_open:'||p_ref_type||':'||p_reference_id::text||':'||v_event::text;

  UPDATE public.amendoim_sealed_stock SET sacks=sacks-v_take,updated_at=now()
   WHERE storage_location_id=v_location_id;
  UPDATE public.inventory SET quantity=quantity+v_take*24000,updated_at=now()
   WHERE product_id=v_product AND variant_id IS NULL AND location=v_location
   RETURNING quantity-v_take*24000,quantity INTO v_old_g,v_new_g;

  INSERT INTO public.amendoim_sealed_events(
    event_key,storage_location_id,movement_type,sacks,previous_balance,new_balance,
    grams_delta,grams_previous,grams_new,reference_type,reference_id,notes,created_by)
  VALUES(v_event_key||':sacks',v_location_id,'out',v_take,v_old_sacks,v_old_sacks-v_take,
    v_take*24000,v_old_g,v_new_g,'amendoim_production_auto_open',p_reference_id,
    'Autoabertura de E24 pela BOM, sem passo adicional ao operador',auth.uid());

  INSERT INTO public.inventory_movements(
    product_id,variant_id,movement_type,quantity,previous_balance,new_balance,
    location,reference_type,reference_id,event_key,notes)
  VALUES(v_product,NULL,'in',v_take*24000,v_old_g,v_new_g,v_location,
    'amendoim_production_auto_open',p_reference_id,v_event_key||':grams',
    'Liberação automática do E24 em gramas para consumo de produção');
  RETURN v_take;
END;$am21$;
REVOKE ALL ON FUNCTION public.ensure_amendoim_production_material(uuid,numeric,text)
 FROM PUBLIC,anon,authenticated;


CREATE OR REPLACE FUNCTION public.register_production_fact(p_product_id uuid, p_variant_id uuid, p_quantity numeric, p_event_key text, p_location text DEFAULT 'Fábrica'::text, p_operator_user_id uuid DEFAULT NULL::uuid, p_operator_name text DEFAULT NULL::text, p_production_order_id uuid DEFAULT NULL::uuid, p_occurred_at timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing public.production_facts;
  v_fact_id uuid;
  v_location text := COALESCE(NULLIF(btrim(p_location), ''), 'Fábrica');
  v_location_id uuid;
  v_operator_name text;
  v_resolved_order_id uuid := p_production_order_id;
  v_candidate_count integer := 0;
  v_order_mode text;
  v_order_status text;
  v_component record;
  v_inventory record;
  v_remaining numeric;
  v_take numeric;
  v_applied numeric;
  v_previous numeric;
  v_new numeric;
  v_shortages jsonb := '[]'::jsonb;
  v_consumption_count integer := 0;
  v_movement_count integer := 0;
  v_finished_key text;
BEGIN
  IF p_event_key IS NULL OR btrim(p_event_key) = '' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'missing_event_key');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_event_key, 0));

  SELECT * INTO v_existing
  FROM public.production_facts
  WHERE event_key = p_event_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'production_fact_id', v_existing.id,
      'product_id', v_existing.product_id,
      'variant_id', v_existing.variant_id,
      'quantity', v_existing.quantity,
      'location', v_existing.location,
      'production_order_id', v_existing.production_order_id,
      'material_adjustment_required', EXISTS (
        SELECT 1 FROM public.production_fact_consumptions pfc
        WHERE pfc.production_fact_id = v_existing.id
          AND pfc.adjustment_status = 'pending'
      ),
      'consumption_count', 0,
      'inventory_movement_count', 0
    );
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_quantity');
  END IF;

  PERFORM public.assert_physical_identity(p_product_id, p_variant_id, 'production_fact');

  SELECT id INTO v_location_id
  FROM public.storage_locations
  WHERE name = v_location AND is_active = true
  LIMIT 1;

  IF v_location_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_location', 'location', v_location);
  END IF;

  IF p_operator_user_id IS NOT NULL THEN
    SELECT name INTO v_operator_name
    FROM public.app_users
    WHERE id = p_operator_user_id AND is_active = true;
    IF v_operator_name IS NULL THEN
      RETURN jsonb_build_object('success', false, 'reason', 'invalid_operator');
    END IF;
  ELSE
    v_operator_name := NULLIF(btrim(p_operator_name), '');
  END IF;

  IF v_resolved_order_id IS NOT NULL THEN
    SELECT physical_flow_mode, status INTO v_order_mode, v_order_status
    FROM public.production_orders
    WHERE id = v_resolved_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'reason', 'production_order_not_found');
    END IF;
    IF v_order_status = 'cancelado' THEN
      RETURN jsonb_build_object('success', false, 'reason', 'production_order_cancelled');
    END IF;
    IF v_order_mode <> 'production_facts' THEN
      RETURN jsonb_build_object('success', false, 'reason', 'production_order_legacy_mode');
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.production_order_items poi
      WHERE poi.production_order_id = v_resolved_order_id
        AND poi.product_id = p_product_id
        AND poi.variant_id IS NOT DISTINCT FROM p_variant_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'reason', 'production_order_item_mismatch');
    END IF;
  ELSE
    SELECT count(*), max(candidate.id::text)::uuid
    INTO v_candidate_count, v_resolved_order_id
    FROM (
      SELECT DISTINCT po.id
      FROM public.production_orders po
      JOIN public.production_order_items poi ON poi.production_order_id = po.id
      WHERE po.physical_flow_mode = 'production_facts'
        AND po.status IN ('aberto', 'producao')
        AND poi.product_id = p_product_id
        AND poi.variant_id IS NOT DISTINCT FROM p_variant_id
    ) candidate;
    IF v_candidate_count <> 1 THEN v_resolved_order_id := NULL; END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.product_components pc
    WHERE pc.product_id = p_product_id
      AND pc.product_variant_id IS NOT DISTINCT FROM p_variant_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'missing_bom');
  END IF;

  INSERT INTO public.production_facts(
    product_id, variant_id, quantity, location, location_id,
    operator_name, operator_user_id, occurred_at,
    production_order_id, source, status, event_key, created_by
  ) VALUES (
    p_product_id, p_variant_id, p_quantity, v_location, v_location_id,
    v_operator_name, p_operator_user_id, COALESCE(p_occurred_at, now()),
    v_resolved_order_id, 'mobile', 'confirmed', p_event_key, auth.uid()
  )
  ON CONFLICT (event_key) DO NOTHING
  RETURNING id INTO v_fact_id;

  IF v_fact_id IS NULL THEN
    SELECT * INTO v_existing FROM public.production_facts WHERE event_key = p_event_key;
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'production_fact_id', v_existing.id,
      'product_id', v_existing.product_id,
      'variant_id', v_existing.variant_id,
      'quantity', v_existing.quantity,
      'location', v_existing.location,
      'production_order_id', v_existing.production_order_id,
      'material_adjustment_required', EXISTS (
        SELECT 1 FROM public.production_fact_consumptions pfc
        WHERE pfc.production_fact_id = v_existing.id
          AND pfc.adjustment_status = 'pending'
      ),
      'consumption_count', 0,
      'inventory_movement_count', 0
    );
  END IF;

  INSERT INTO public.production_fact_consumptions(
    production_fact_id, component_id, variant_id,
    qty_per_unit_snapshot, quantity_consumed, quantity_applied,
    adjustment_status, unit_snapshot
  )
  SELECT
    v_fact_id,
    pc.component_id,
    pc.variant_id,
    sum(pc.qty_per_unit),
    sum(pc.qty_per_unit * p_quantity),
    0,
    CASE WHEN sum(pc.qty_per_unit * p_quantity) <= 0 THEN 'applied' ELSE 'pending' END,
    COALESCE(pv.unit, p.unit)
  FROM public.product_components pc
  JOIN public.products p ON p.id = pc.component_id
  LEFT JOIN public.product_variants pv ON pv.id = pc.variant_id
  WHERE pc.product_id = p_product_id
    AND pc.product_variant_id IS NOT DISTINCT FROM p_variant_id
  GROUP BY pc.component_id, pc.variant_id, p.unit, pv.unit;

  GET DIAGNOSTICS v_consumption_count = ROW_COUNT;

  FOR v_component IN
    SELECT pfc.id, pfc.component_id, pfc.variant_id,
           pfc.quantity_consumed, pfc.unit_snapshot,
           p.name AS component_name,
           pv.variant_name AS component_variant_name
    FROM public.production_fact_consumptions pfc
    JOIN public.products p ON p.id = pfc.component_id
    LEFT JOIN public.product_variants pv ON pv.id = pfc.variant_id
    WHERE pfc.production_fact_id = v_fact_id
    ORDER BY pfc.component_id, pfc.variant_id
  LOOP
    v_remaining := v_component.quantity_consumed;
    v_applied := 0;

    IF v_component.component_id = '6e757550-a9b6-4644-8164-8c802760e373'::uuid
       AND v_component.variant_id = 'fcf97062-683f-4921-b941-5236613c32fb'::uuid THEN
      PERFORM public.ensure_portogel_production_material(v_fact_id, v_remaining);
    END IF;

    IF v_component.component_id='c70dd4b4-bc59-4d88-81ef-1a8c47315560'::uuid
      AND v_component.variant_id IN ('f6588f52-6e28-4ce9-b492-a95c847d5c0c'::uuid,'1a3d59a6-4712-4afd-811a-5a72aad76fa9'::uuid) THEN
      PERFORM public.ensure_chocolate_production_material(v_fact_id,v_component.variant_id,v_remaining,'production_fact');
    END IF;

    IF v_component.component_id='c177f332-a1c7-4276-9cef-7b81af920174'::uuid AND v_component.variant_id IS NULL THEN
      PERFORM public.ensure_amendoim_production_material(v_fact_id,v_remaining,'production_fact');
    END IF;

    FOR v_inventory IN
      SELECT id, location, quantity
      FROM public.inventory
      WHERE product_id = v_component.component_id
        AND variant_id IS NOT DISTINCT FROM v_component.variant_id
        AND quantity > 0
      ORDER BY id
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_remaining, v_inventory.quantity);

      UPDATE public.inventory
      SET quantity = quantity - v_take, updated_at = now()
      WHERE id = v_inventory.id;

      INSERT INTO public.inventory_movements(
        product_id, variant_id, movement_type, quantity,
        previous_balance, new_balance, location,
        reference_type, reference_id, event_key, notes
      ) VALUES (
        v_component.component_id,
        v_component.variant_id,
        'consume',
        v_take,
        v_inventory.quantity,
        v_inventory.quantity - v_take,
        v_inventory.location,
        'production_fact',
        v_fact_id,
        'production_fact:' || v_fact_id::text || ':consume:' || v_inventory.id::text,
        'Consumo disponível no registro do fato real de produção'
      );

      v_remaining := v_remaining - v_take;
      v_applied := v_applied + v_take;
      v_movement_count := v_movement_count + 1;
    END LOOP;

    UPDATE public.production_fact_consumptions
    SET quantity_applied = v_applied,
        adjustment_status = CASE WHEN v_remaining <= 0 THEN 'applied' ELSE 'pending' END
    WHERE id = v_component.id;

    IF v_remaining > 0 THEN
      v_shortages := v_shortages || jsonb_build_array(jsonb_build_object(
        'product_id', v_component.component_id,
        'variant_id', v_component.variant_id,
        'component_name', v_component.component_name,
        'component_variant_name', v_component.component_variant_name,
        'unit', v_component.unit_snapshot,
        'required_quantity', v_component.quantity_consumed,
        'applied_quantity', v_applied,
        'missing_quantity', v_remaining
      ));
    END IF;
  END LOOP;

  INSERT INTO public.inventory(
    product_id, variant_id, location, location_id, quantity, updated_at
  ) VALUES (
    p_product_id, p_variant_id, v_location, v_location_id, p_quantity, now()
  )
  ON CONFLICT(product_id, variant_id, location)
  DO UPDATE SET
    quantity = public.inventory.quantity + EXCLUDED.quantity,
    location_id = COALESCE(public.inventory.location_id, EXCLUDED.location_id),
    updated_at = now()
  RETURNING quantity - p_quantity, quantity INTO v_previous, v_new;

  v_finished_key := 'production_fact:' || v_fact_id::text || ':finished:' ||
                    p_product_id::text || ':' || COALESCE(p_variant_id::text, 'simple') || ':' ||
                    v_location_id::text;

  INSERT INTO public.inventory_movements(
    product_id, variant_id, movement_type, quantity,
    previous_balance, new_balance, location,
    reference_type, reference_id, event_key, notes
  ) VALUES (
    p_product_id, p_variant_id, 'in', p_quantity,
    v_previous, v_new, v_location,
    'production_fact', v_fact_id, v_finished_key,
    CASE WHEN jsonb_array_length(v_shortages) > 0
      THEN 'Entrada por fato real de produção com consumo de materiais pendente'
      ELSE 'Entrada por fato real de produção'
    END
  );

  v_movement_count := v_movement_count + 1;

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'production_fact_id', v_fact_id,
    'product_id', p_product_id,
    'variant_id', p_variant_id,
    'quantity', p_quantity,
    'location', v_location,
    'production_order_id', v_resolved_order_id,
    'material_adjustment_required', jsonb_array_length(v_shortages) > 0,
    'shortages', v_shortages,
    'consumption_count', v_consumption_count,
    'inventory_movement_count', v_movement_count
  );
END;
$function$


;

CREATE OR REPLACE FUNCTION public.reconcile_production_fact_materials(p_production_fact_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fact public.production_facts;
  v_consumption record;
  v_inventory record;
  v_remaining numeric;
  v_take numeric;
  v_before_applied numeric;
  v_shortages jsonb := '[]'::jsonb;
  v_movement_count integer := 0;
BEGIN
  SELECT * INTO v_fact
  FROM public.production_facts
  WHERE id = p_production_fact_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'production_fact_not_found');
  END IF;

  FOR v_consumption IN
    SELECT pfc.id, pfc.component_id, pfc.variant_id,
           pfc.quantity_consumed, pfc.quantity_applied,
           p.name AS component_name,
           pv.variant_name AS component_variant_name,
           pfc.unit_snapshot
    FROM public.production_fact_consumptions pfc
    JOIN public.products p ON p.id = pfc.component_id
    LEFT JOIN public.product_variants pv ON pv.id = pfc.variant_id
    WHERE pfc.production_fact_id = p_production_fact_id
      AND pfc.quantity_applied < pfc.quantity_consumed
    ORDER BY pfc.component_id, pfc.variant_id
    FOR UPDATE OF pfc
  LOOP
    v_remaining := v_consumption.quantity_consumed - v_consumption.quantity_applied;

    IF v_consumption.component_id = '6e757550-a9b6-4644-8164-8c802760e373'::uuid
       AND v_consumption.variant_id = 'fcf97062-683f-4921-b941-5236613c32fb'::uuid THEN
      PERFORM public.ensure_portogel_production_material(p_production_fact_id, v_remaining);
    END IF;

    IF v_consumption.component_id='c70dd4b4-bc59-4d88-81ef-1a8c47315560'::uuid
      AND v_consumption.variant_id IN ('f6588f52-6e28-4ce9-b492-a95c847d5c0c'::uuid,'1a3d59a6-4712-4afd-811a-5a72aad76fa9'::uuid) THEN
      PERFORM public.ensure_chocolate_production_material(p_production_fact_id,v_consumption.variant_id,v_remaining,'production_fact');
    END IF;

    IF v_consumption.component_id='c177f332-a1c7-4276-9cef-7b81af920174'::uuid AND v_consumption.variant_id IS NULL THEN
      PERFORM public.ensure_amendoim_production_material(p_production_fact_id,v_remaining,'production_fact');
    END IF;

    FOR v_inventory IN
      SELECT id, location, quantity
      FROM public.inventory
      WHERE product_id = v_consumption.component_id
        AND variant_id IS NOT DISTINCT FROM v_consumption.variant_id
        AND quantity > 0
      ORDER BY id
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_remaining, v_inventory.quantity);
      v_before_applied := v_consumption.quantity_consumed - v_remaining;

      UPDATE public.inventory
      SET quantity = quantity - v_take,
          updated_at = now()
      WHERE id = v_inventory.id;

      INSERT INTO public.inventory_movements(
        product_id, variant_id, movement_type, quantity,
        previous_balance, new_balance, location,
        reference_type, reference_id, event_key, notes
      ) VALUES (
        v_consumption.component_id,
        v_consumption.variant_id,
        'consume',
        v_take,
        v_inventory.quantity,
        v_inventory.quantity - v_take,
        v_inventory.location,
        'production_fact_reconciliation',
        p_production_fact_id,
        'production_fact:' || p_production_fact_id::text || ':reconcile:' ||
          v_consumption.id::text || ':' || v_inventory.id::text || ':' || v_before_applied::text,
        'Regularização de consumo pendente da produção'
      );

      v_remaining := v_remaining - v_take;
      v_movement_count := v_movement_count + 1;
    END LOOP;

    UPDATE public.production_fact_consumptions
    SET quantity_applied = quantity_consumed - v_remaining,
        adjustment_status = CASE WHEN v_remaining <= 0 THEN 'applied' ELSE 'pending' END
    WHERE id = v_consumption.id;

    IF v_remaining > 0 THEN
      v_shortages := v_shortages || jsonb_build_array(jsonb_build_object(
        'component_id', v_consumption.component_id,
        'variant_id', v_consumption.variant_id,
        'component_name', v_consumption.component_name,
        'component_variant_name', v_consumption.component_variant_name,
        'unit', v_consumption.unit_snapshot,
        'missing_quantity', v_remaining
      ));
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'production_fact_id', p_production_fact_id,
    'all_resolved', jsonb_array_length(v_shortages) = 0,
    'shortages', v_shortages,
    'inventory_movement_count', v_movement_count
  );
END;
$function$


;

CREATE OR REPLACE FUNCTION public.complete_production_order_legacy(p_production_order_id uuid, p_finished_location text DEFAULT 'Fábrica'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_order public.production_orders; v_item record; v_component record; v_inventory record; v_available numeric; v_remaining numeric; v_take numeric; v_previous numeric; v_new numeric; v_shortages jsonb:='[]'::jsonb; v_missing_bom_items jsonb:='[]'::jsonb; v_count integer:=0; v_location text:=COALESCE(NULLIF(btrim(p_finished_location),''),'Fábrica'); v_key text;
BEGIN
  SELECT * INTO v_order FROM public.production_orders WHERE id=p_production_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem de produção não encontrada'; END IF;
  IF v_order.status='concluido' THEN RETURN jsonb_build_object('success',true,'already_completed',true,'movement_count',0,'shortages','[]'::jsonb); END IF;
  IF v_order.status='cancelado' THEN RETURN jsonb_build_object('success',false,'reason','cancelled','shortages','[]'::jsonb); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.production_order_items WHERE production_order_id=v_order.id) THEN RETURN jsonb_build_object('success',false,'reason','missing_items','shortages','[]'::jsonb); END IF;
  IF EXISTS (SELECT 1 FROM public.production_order_items WHERE production_order_id=v_order.id AND produced_quantity<=0) THEN RETURN jsonb_build_object('success',false,'reason','no_produced_quantity','shortages','[]'::jsonb); END IF;
  FOR v_item IN SELECT item.id,item.product_id,item.variant_id,p.name product_name,pv.variant_name FROM public.production_order_items item JOIN public.products p ON p.id=item.product_id LEFT JOIN public.product_variants pv ON pv.id=item.variant_id WHERE item.production_order_id=v_order.id LOOP
    IF NOT EXISTS (SELECT 1 FROM public.product_components pc WHERE pc.product_id=v_item.product_id AND pc.product_variant_id IS NOT DISTINCT FROM v_item.variant_id) THEN
      v_missing_bom_items:=v_missing_bom_items||jsonb_build_array(jsonb_build_object('production_order_item_id',v_item.id,'product_id',v_item.product_id,'variant_id',v_item.variant_id,'product_name',v_item.product_name,'variant_name',v_item.variant_name));
    END IF;
  END LOOP;
  IF jsonb_array_length(v_missing_bom_items)>0 THEN RETURN jsonb_build_object('success',false,'reason','missing_bom','missing_bom_items',v_missing_bom_items,'shortages','[]'::jsonb); END IF;
  FOR v_component IN SELECT pc.component_id,pc.variant_id,sum(pc.qty_per_unit*item.produced_quantity) required_quantity,p.name component_name,pv.variant_name,COALESCE(pv.sku,p.sku) component_sku FROM public.production_order_items item JOIN public.product_components pc ON pc.product_id=item.product_id AND pc.product_variant_id IS NOT DISTINCT FROM item.variant_id JOIN public.products p ON p.id=pc.component_id LEFT JOIN public.product_variants pv ON pv.id=pc.variant_id WHERE item.production_order_id=v_order.id GROUP BY pc.component_id,pc.variant_id,p.name,pv.variant_name,p.sku,pv.sku LOOP
    v_available:=0; FOR v_inventory IN SELECT quantity FROM public.inventory WHERE product_id=v_component.component_id AND variant_id IS NOT DISTINCT FROM v_component.variant_id FOR UPDATE LOOP v_available:=v_available+v_inventory.quantity; END LOOP;
    IF v_component.component_id='c70dd4b4-bc59-4d88-81ef-1a8c47315560'::uuid
      AND v_component.variant_id IN ('f6588f52-6e28-4ce9-b492-a95c847d5c0c'::uuid,'1a3d59a6-4712-4afd-811a-5a72aad76fa9'::uuid) THEN
      v_available:=v_available+COALESCE((SELECT sum(sacks)*20000 FROM public.chocolate_sealed_stock
      WHERE variant_id=v_component.variant_id AND storage_location_id=(
        SELECT id FROM public.storage_locations WHERE name='Fábrica' AND is_active LIMIT 1)),0);
    END IF;
    IF v_component.component_id='c177f332-a1c7-4276-9cef-7b81af920174'::uuid AND v_component.variant_id IS NULL THEN
      v_available:=v_available+COALESCE((SELECT sum(sacks)*24000 FROM public.amendoim_sealed_stock
        WHERE storage_location_id=(SELECT id FROM public.storage_locations WHERE name='Fábrica' AND is_active LIMIT 1)),0);
    END IF;
    IF v_available<v_component.required_quantity THEN v_shortages:=v_shortages||jsonb_build_array(jsonb_build_object('product_id',v_component.component_id,'variant_id',v_component.variant_id,'component_name',v_component.component_name,'component_variant_name',v_component.variant_name,'component_sku',v_component.component_sku,'required_quantity',v_component.required_quantity,'available_quantity',v_available,'missing_quantity',v_component.required_quantity-v_available)); END IF;
    v_count:=v_count+1;
  END LOOP;
  IF v_count=0 THEN RETURN jsonb_build_object('success',false,'reason','missing_bom','missing_bom_items',v_missing_bom_items,'shortages','[]'::jsonb); END IF;
  IF jsonb_array_length(v_shortages)>0 THEN RETURN jsonb_build_object('success',false,'reason','insufficient_stock','shortages',v_shortages); END IF;
  FOR v_component IN SELECT pc.component_id,pc.variant_id,sum(pc.qty_per_unit*item.produced_quantity) required_quantity FROM public.production_order_items item JOIN public.product_components pc ON pc.product_id=item.product_id AND pc.product_variant_id IS NOT DISTINCT FROM item.variant_id WHERE item.production_order_id=v_order.id GROUP BY pc.component_id,pc.variant_id LOOP
    v_remaining:=v_component.required_quantity;
    IF v_component.component_id='c70dd4b4-bc59-4d88-81ef-1a8c47315560'::uuid
      AND v_component.variant_id IN ('f6588f52-6e28-4ce9-b492-a95c847d5c0c'::uuid,'1a3d59a6-4712-4afd-811a-5a72aad76fa9'::uuid) THEN
      PERFORM public.ensure_chocolate_production_material(v_order.id,v_component.variant_id,
        v_remaining,'production_order');
    END IF;
    IF v_component.component_id='c177f332-a1c7-4276-9cef-7b81af920174'::uuid AND v_component.variant_id IS NULL THEN
      PERFORM public.ensure_amendoim_production_material(v_order.id,v_remaining,'production_order');
    END IF;
    FOR v_inventory IN SELECT id,location,quantity FROM public.inventory WHERE product_id=v_component.component_id AND variant_id IS NOT DISTINCT FROM v_component.variant_id AND quantity>0 ORDER BY quantity DESC,id FOR UPDATE LOOP EXIT WHEN v_remaining<=0; v_take:=LEAST(v_remaining,v_inventory.quantity); v_key:='production:'||v_order.id::text||':consume:'||v_component.component_id::text||':'||COALESCE(v_component.variant_id::text,'simple')||':'||COALESCE(v_inventory.location,'sem-localizacao'); UPDATE public.inventory SET quantity=quantity-v_take,updated_at=now() WHERE id=v_inventory.id; INSERT INTO public.inventory_movements(product_id,variant_id,movement_type,quantity,previous_balance,new_balance,location,reference_type,reference_id,event_key,notes) VALUES(v_component.component_id,v_component.variant_id,'consume',v_take,v_inventory.quantity,v_inventory.quantity-v_take,v_inventory.location,'production_order',v_order.id,v_key,'Consumo por conclusão da OP '||COALESCE(v_order.internal_production_number,v_order.order_number,v_order.id::text)); v_remaining:=v_remaining-v_take; END LOOP;
  END LOOP;
  FOR v_item IN SELECT * FROM public.production_order_items WHERE production_order_id=v_order.id ORDER BY created_at,id LOOP
    v_key:='production:'||v_order.id::text||':finished:'||v_item.product_id::text||':'||COALESCE(v_item.variant_id::text,'simple')||':'||v_location;
    INSERT INTO public.inventory(product_id,variant_id,location,quantity,updated_at) VALUES(v_item.product_id,v_item.variant_id,v_location,v_item.produced_quantity,now()) ON CONFLICT(product_id,variant_id,location) DO UPDATE SET quantity=public.inventory.quantity+EXCLUDED.quantity,updated_at=now() RETURNING quantity-v_item.produced_quantity,quantity INTO v_previous,v_new;
    INSERT INTO public.inventory_movements(product_id,variant_id,movement_type,quantity,previous_balance,new_balance,location,reference_type,reference_id,event_key,notes) VALUES(v_item.product_id,v_item.variant_id,'in',v_item.produced_quantity,v_previous,v_new,v_location,'production_order',v_order.id,v_key,'Entrada por conclusão da OP '||COALESCE(v_order.internal_production_number,v_order.order_number,v_order.id::text));
  END LOOP;
  UPDATE public.production_orders SET status='concluido',completed_at=now(),updated_at=now() WHERE id=v_order.id;
  RETURN jsonb_build_object('success',true,'already_completed',false,'movement_count',v_count,'shortages','[]'::jsonb);
END; $function$;
