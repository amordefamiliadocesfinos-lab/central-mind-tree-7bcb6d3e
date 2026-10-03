-- F01.5 ajuste de uso real
-- A realidade física não é bloqueada por divergência de matéria-prima.
-- O sistema consome o saldo disponível, dá entrada integral no acabado e
-- mantém o consumo faltante como pendência explícita para regularização.

ALTER TABLE public.production_fact_consumptions
  ADD COLUMN IF NOT EXISTS quantity_applied numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjustment_status text NOT NULL DEFAULT 'pending';

UPDATE public.production_fact_consumptions
SET quantity_applied = quantity_consumed,
    adjustment_status = 'applied'
WHERE quantity_applied = 0
  AND quantity_consumed > 0;

ALTER TABLE public.production_fact_consumptions
  DROP CONSTRAINT IF EXISTS production_fact_consumptions_quantity_applied_check,
  ADD CONSTRAINT production_fact_consumptions_quantity_applied_check
    CHECK (quantity_applied >= 0 AND quantity_applied <= quantity_consumed),
  DROP CONSTRAINT IF EXISTS production_fact_consumptions_adjustment_status_check,
  ADD CONSTRAINT production_fact_consumptions_adjustment_status_check
    CHECK (adjustment_status IN ('pending','applied'));

CREATE INDEX IF NOT EXISTS production_fact_consumptions_pending_idx
  ON public.production_fact_consumptions(production_fact_id, adjustment_status)
  WHERE adjustment_status = 'pending';

CREATE TABLE IF NOT EXISTS public.production_fact_process_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_fact_id uuid NOT NULL UNIQUE REFERENCES public.production_facts(id) ON DELETE CASCADE,
  process_id uuid NOT NULL REFERENCES public.processes(id) ON DELETE RESTRICT,
  operator_user_id uuid NULL REFERENCES public.app_users(id) ON DELETE SET NULL,
  operator_name text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  value_per_unit_snapshot numeric NOT NULL DEFAULT 0 CHECK (value_per_unit_snapshot >= 0),
  total_value numeric NOT NULL DEFAULT 0 CHECK (total_value >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.production_fact_process_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read production fact process entries"
ON public.production_fact_process_entries;
CREATE POLICY "Authenticated users read production fact process entries"
ON public.production_fact_process_entries
FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.production_fact_process_entries TO authenticated;
GRANT ALL ON public.production_fact_process_entries TO service_role;

CREATE OR REPLACE FUNCTION public.attach_production_fact_process(
  p_production_fact_id uuid,
  p_process_id uuid,
  p_operator_user_id uuid DEFAULT NULL,
  p_operator_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fact public.production_facts;
  v_process public.processes;
  v_operator_name text;
BEGIN
  SELECT * INTO v_fact
  FROM public.production_facts
  WHERE id = p_production_fact_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'production_fact_not_found');
  END IF;

  SELECT * INTO v_process
  FROM public.processes
  WHERE id = p_process_id
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_process');
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
    v_operator_name := COALESCE(NULLIF(btrim(p_operator_name), ''), NULLIF(btrim(v_fact.operator_name), ''));
  END IF;

  IF v_operator_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'missing_operator');
  END IF;

  INSERT INTO public.production_fact_process_entries(
    production_fact_id,
    process_id,
    operator_user_id,
    operator_name,
    quantity,
    value_per_unit_snapshot,
    total_value,
    updated_at
  ) VALUES (
    v_fact.id,
    v_process.id,
    p_operator_user_id,
    v_operator_name,
    v_fact.quantity,
    COALESCE(v_process.value_per_unit, 0),
    v_fact.quantity * COALESCE(v_process.value_per_unit, 0),
    now()
  )
  ON CONFLICT (production_fact_id)
  DO UPDATE SET
    process_id = EXCLUDED.process_id,
    operator_user_id = EXCLUDED.operator_user_id,
    operator_name = EXCLUDED.operator_name,
    quantity = EXCLUDED.quantity,
    value_per_unit_snapshot = EXCLUDED.value_per_unit_snapshot,
    total_value = EXCLUDED.total_value,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'production_fact_id', v_fact.id,
    'process_id', v_process.id,
    'operator_name', v_operator_name,
    'quantity', v_fact.quantity,
    'value_per_unit', COALESCE(v_process.value_per_unit, 0)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.attach_production_fact_process(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.attach_production_fact_process(uuid, uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.attach_production_fact_process(uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attach_production_fact_process(uuid, uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.reconcile_production_fact_materials(
  p_production_fact_id uuid
)
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
$function$;

REVOKE ALL ON FUNCTION public.reconcile_production_fact_materials(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_production_fact_materials(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.reconcile_production_fact_materials(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_production_fact_materials(uuid) TO service_role;

-- Substitui o motor bloqueante: falta de saldo vira pendência, não recusa o fato físico.
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
$function$;

REVOKE ALL ON FUNCTION public.register_production_fact(uuid, uuid, numeric, text, text, uuid, text, uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_production_fact(uuid, uuid, numeric, text, text, uuid, text, uuid, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.register_production_fact(uuid, uuid, numeric, text, text, uuid, text, uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_production_fact(uuid, uuid, numeric, text, text, uuid, text, uuid, timestamptz) TO service_role;
