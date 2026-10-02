-- F01.2 — Motor transacional canônico do Fato Real de Produção.

CREATE OR REPLACE FUNCTION public.register_production_fact(
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity numeric,
  p_event_key text,
  p_location text DEFAULT 'Fábrica'::text,
  p_operator_user_id uuid DEFAULT NULL,
  p_operator_name text DEFAULT NULL,
  p_production_order_id uuid DEFAULT NULL,
  p_occurred_at timestamptz DEFAULT now()
)
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
  v_available numeric;
  v_remaining numeric;
  v_take numeric;
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
  WHERE name = v_location
    AND is_active = true
  LIMIT 1;

  IF v_location_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_location', 'location', v_location);
  END IF;

  IF p_operator_user_id IS NOT NULL THEN
    SELECT name INTO v_operator_name
    FROM public.app_users
    WHERE id = p_operator_user_id
      AND is_active = true;

    IF v_operator_name IS NULL THEN
      RETURN jsonb_build_object('success', false, 'reason', 'invalid_operator');
    END IF;
  ELSE
    v_operator_name := NULLIF(btrim(p_operator_name), '');
  END IF;

  -- Vínculo explícito: só aceita OP do novo contrato físico e com item compatível.
  IF v_resolved_order_id IS NOT NULL THEN
    SELECT physical_flow_mode, status
    INTO v_order_mode, v_order_status
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
      SELECT 1
      FROM public.production_order_items poi
      WHERE poi.production_order_id = v_resolved_order_id
        AND poi.product_id = p_product_id
        AND poi.variant_id IS NOT DISTINCT FROM p_variant_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'reason', 'production_order_item_mismatch');
    END IF;
  ELSE
    -- Associação automática somente quando for determinística: exatamente uma
    -- OP ativa, do novo modo, contém a mesma identidade física.
    SELECT count(DISTINCT po.id), min(po.id)
    INTO v_candidate_count, v_resolved_order_id
    FROM public.production_orders po
    JOIN public.production_order_items poi ON poi.production_order_id = po.id
    WHERE po.physical_flow_mode = 'production_facts'
      AND po.status IN ('aberto', 'producao')
      AND poi.product_id = p_product_id
      AND poi.variant_id IS NOT DISTINCT FROM p_variant_id;

    IF v_candidate_count <> 1 THEN
      v_resolved_order_id := NULL;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.product_components pc
    WHERE pc.product_id = p_product_id
      AND pc.product_variant_id IS NOT DISTINCT FROM p_variant_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'missing_bom');
  END IF;

  -- Trava e valida todo estoque necessário antes de qualquer transformação.
  FOR v_component IN
    SELECT
      pc.component_id,
      pc.variant_id,
      sum(pc.qty_per_unit) AS qty_per_unit_snapshot,
      sum(pc.qty_per_unit * p_quantity) AS required_quantity,
      p.name AS component_name,
      pv.variant_name AS component_variant_name,
      COALESCE(pv.sku, p.sku) AS component_sku,
      COALESCE(pv.unit, p.unit) AS unit_snapshot
    FROM public.product_components pc
    JOIN public.products p ON p.id = pc.component_id
    LEFT JOIN public.product_variants pv ON pv.id = pc.variant_id
    WHERE pc.product_id = p_product_id
      AND pc.product_variant_id IS NOT DISTINCT FROM p_variant_id
    GROUP BY pc.component_id, pc.variant_id, p.name, pv.variant_name, p.sku, pv.sku, p.unit, pv.unit
  LOOP
    v_available := 0;

    FOR v_inventory IN
      SELECT id, quantity
      FROM public.inventory
      WHERE product_id = v_component.component_id
        AND variant_id IS NOT DISTINCT FROM v_component.variant_id
      FOR UPDATE
    LOOP
      v_available := v_available + v_inventory.quantity;
    END LOOP;

    IF v_available < v_component.required_quantity THEN
      v_shortages := v_shortages || jsonb_build_array(
        jsonb_build_object(
          'product_id', v_component.component_id,
          'variant_id', v_component.variant_id,
          'component_name', v_component.component_name,
          'component_variant_name', v_component.component_variant_name,
          'component_sku', v_component.component_sku,
          'unit', v_component.unit_snapshot,
          'required_quantity', v_component.required_quantity,
          'available_quantity', v_available,
          'missing_quantity', v_component.required_quantity - v_available
        )
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(v_shortages) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'insufficient_stock',
      'shortages', v_shortages
    );
  END IF;

  -- A UNIQUE(event_key) é a autoridade final contra corridas de requisições.
  INSERT INTO public.production_facts(
    product_id,
    variant_id,
    quantity,
    location,
    location_id,
    operator_name,
    operator_user_id,
    occurred_at,
    production_order_id,
    source,
    status,
    event_key,
    created_by
  ) VALUES (
    p_product_id,
    p_variant_id,
    p_quantity,
    v_location,
    v_location_id,
    v_operator_name,
    p_operator_user_id,
    COALESCE(p_occurred_at, now()),
    v_resolved_order_id,
    'mobile',
    'confirmed',
    p_event_key,
    auth.uid()
  )
  ON CONFLICT (event_key) DO NOTHING
  RETURNING id INTO v_fact_id;

  IF v_fact_id IS NULL THEN
    SELECT * INTO v_existing
    FROM public.production_facts
    WHERE event_key = p_event_key;

    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'production_fact_id', v_existing.id,
      'product_id', v_existing.product_id,
      'variant_id', v_existing.variant_id,
      'quantity', v_existing.quantity,
      'location', v_existing.location,
      'production_order_id', v_existing.production_order_id,
      'consumption_count', 0,
      'inventory_movement_count', 0
    );
  END IF;

  -- Congela a BOM efetivamente usada nesse fato.
  INSERT INTO public.production_fact_consumptions(
    production_fact_id,
    component_id,
    variant_id,
    qty_per_unit_snapshot,
    quantity_consumed,
    unit_snapshot
  )
  SELECT
    v_fact_id,
    pc.component_id,
    pc.variant_id,
    sum(pc.qty_per_unit),
    sum(pc.qty_per_unit * p_quantity),
    COALESCE(pv.unit, p.unit)
  FROM public.product_components pc
  JOIN public.products p ON p.id = pc.component_id
  LEFT JOIN public.product_variants pv ON pv.id = pc.variant_id
  WHERE pc.product_id = p_product_id
    AND pc.product_variant_id IS NOT DISTINCT FROM p_variant_id
  GROUP BY pc.component_id, pc.variant_id, p.unit, pv.unit;

  GET DIAGNOSTICS v_consumption_count = ROW_COUNT;

  -- Consome componentes físicos. As linhas já estão protegidas por FOR UPDATE.
  FOR v_component IN
    SELECT component_id, variant_id, quantity_consumed
    FROM public.production_fact_consumptions
    WHERE production_fact_id = v_fact_id
    ORDER BY component_id, variant_id
  LOOP
    v_remaining := v_component.quantity_consumed;

    FOR v_inventory IN
      SELECT id, location, quantity
      FROM public.inventory
      WHERE product_id = v_component.component_id
        AND variant_id IS NOT DISTINCT FROM v_component.variant_id
        AND quantity > 0
      ORDER BY quantity DESC, id
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_remaining, v_inventory.quantity);

      UPDATE public.inventory
      SET quantity = quantity - v_take,
          updated_at = now()
      WHERE id = v_inventory.id;

      INSERT INTO public.inventory_movements(
        product_id,
        variant_id,
        movement_type,
        quantity,
        previous_balance,
        new_balance,
        location,
        reference_type,
        reference_id,
        event_key,
        notes
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
        'Consumo por fato real de produção'
      );

      v_remaining := v_remaining - v_take;
      v_movement_count := v_movement_count + 1;
    END LOOP;
  END LOOP;

  -- Credita o produto acabado no local físico informado.
  INSERT INTO public.inventory(
    product_id,
    variant_id,
    location,
    location_id,
    quantity,
    updated_at
  ) VALUES (
    p_product_id,
    p_variant_id,
    v_location,
    v_location_id,
    p_quantity,
    now()
  )
  ON CONFLICT(product_id, variant_id, location)
  DO UPDATE SET
    quantity = public.inventory.quantity + EXCLUDED.quantity,
    location_id = COALESCE(public.inventory.location_id, EXCLUDED.location_id),
    updated_at = now()
  RETURNING quantity - p_quantity, quantity
  INTO v_previous, v_new;

  v_finished_key := 'production_fact:' || v_fact_id::text || ':finished:' ||
                    p_product_id::text || ':' || COALESCE(p_variant_id::text, 'simple') || ':' ||
                    v_location_id::text;

  INSERT INTO public.inventory_movements(
    product_id,
    variant_id,
    movement_type,
    quantity,
    previous_balance,
    new_balance,
    location,
    reference_type,
    reference_id,
    event_key,
    notes
  ) VALUES (
    p_product_id,
    p_variant_id,
    'in',
    p_quantity,
    v_previous,
    v_new,
    v_location,
    'production_fact',
    v_fact_id,
    v_finished_key,
    'Entrada por fato real de produção'
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
    'consumption_count', v_consumption_count,
    'inventory_movement_count', v_movement_count
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.register_production_fact(uuid, uuid, numeric, text, text, uuid, text, uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_production_fact(uuid, uuid, numeric, text, text, uuid, text, uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_production_fact(uuid, uuid, numeric, text, text, uuid, text, uuid, timestamptz) TO service_role;
