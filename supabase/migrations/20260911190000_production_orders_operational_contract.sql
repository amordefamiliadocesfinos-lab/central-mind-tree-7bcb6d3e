-- FASE 4: contrato operacional de Ordens de Produção.
-- OP é autônoma do pedido; sua conclusão é o único fato que transforma
-- componentes em produto acabado.

ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS internal_production_number text;

CREATE SEQUENCE IF NOT EXISTS public.production_order_internal_number_seq;

-- Atribui uma identidade humana apenas onde ela ainda não existe, preservando
-- order_number histórico e UUID técnico.
UPDATE public.production_orders
SET internal_production_number = 'OP-' || lpad(nextval('public.production_order_internal_number_seq')::text, 5, '0')
WHERE internal_production_number IS NULL;

DO $$
DECLARE v_max bigint;
BEGIN
  SELECT COALESCE(max((regexp_match(internal_production_number, '^OP-([0-9]+)$'))[1]::bigint), 0)
    INTO v_max
  FROM public.production_orders;
  PERFORM setval('public.production_order_internal_number_seq', GREATEST(v_max, 1), v_max > 0);
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS production_orders_internal_number_unique
  ON public.production_orders (internal_production_number)
  WHERE internal_production_number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assign_internal_production_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.internal_production_number IS NULL OR btrim(NEW.internal_production_number) = '' THEN
    NEW.internal_production_number := 'OP-' || lpad(nextval('public.production_order_internal_number_seq')::text, 5, '0');
  END IF;

  -- Novas OPs deixam de usar timestamp/base36. order_number continua como
  -- compatibilidade, mas recebe a mesma identificação humana.
  IF NEW.order_number IS NULL OR btrim(NEW.order_number) = '' THEN
    NEW.order_number := NEW.internal_production_number;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_internal_production_number_trigger ON public.production_orders;
CREATE TRIGGER assign_internal_production_number_trigger
  BEFORE INSERT ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.assign_internal_production_number();

CREATE OR REPLACE FUNCTION public.complete_production_order(
  p_production_order_id uuid,
  p_finished_location text DEFAULT 'Fábrica'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.production_orders;
  v_component record;
  v_inventory record;
  v_available numeric;
  v_remaining numeric;
  v_take numeric;
  v_finished_previous numeric;
  v_finished_new numeric;
  v_shortages jsonb := '[]'::jsonb;
  v_component_count integer := 0;
  v_finished_location text := COALESCE(NULLIF(btrim(p_finished_location), ''), 'Fábrica');
  v_event_key text;
BEGIN
  SELECT * INTO v_order
  FROM public.production_orders
  WHERE id = p_production_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de produção não encontrada';
  END IF;
  IF v_order.status = 'concluido' THEN
    RETURN jsonb_build_object('success', true, 'already_completed', true, 'movement_count', 0);
  END IF;
  IF v_order.status = 'cancelado' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'cancelled', 'shortages', '[]'::jsonb);
  END IF;
  IF v_order.consolidated_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_consolidated_quantity', 'shortages', '[]'::jsonb);
  END IF;
  IF v_order.product_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'missing_product', 'shortages', '[]'::jsonb);
  END IF;

  -- Pré-valida a BOM consolidada e todos os saldos antes de qualquer update.
  FOR v_component IN
    SELECT
      pc.component_id,
      pc.variant_id,
      sum(pc.qty_per_unit * v_order.consolidated_quantity) AS required_quantity,
      p.name AS component_name,
      pv.variant_name,
      COALESCE(pv.sku, p.sku) AS component_sku
    FROM public.product_components pc
    JOIN public.products p ON p.id = pc.component_id
    LEFT JOIN public.product_variants pv ON pv.id = pc.variant_id
    WHERE pc.product_id = v_order.product_id
      AND pc.product_variant_id IS NOT DISTINCT FROM v_order.variant_id
    GROUP BY pc.component_id, pc.variant_id, p.name, pv.variant_name, p.sku, pv.sku
  LOOP
    v_component_count := v_component_count + 1;
    v_available := 0;
    FOR v_inventory IN
      SELECT quantity
      FROM public.inventory
      WHERE product_id = v_component.component_id
        AND variant_id IS NOT DISTINCT FROM v_component.variant_id
      FOR UPDATE
    LOOP
      v_available := v_available + v_inventory.quantity;
    END LOOP;

    IF v_available < v_component.required_quantity THEN
      v_shortages := v_shortages || jsonb_build_array(jsonb_build_object(
        'product_id', v_component.component_id,
        'variant_id', v_component.variant_id,
        'component_name', v_component.component_name,
        'component_variant_name', v_component.variant_name,
        'component_sku', v_component.component_sku,
        'required_quantity', v_component.required_quantity,
        'available_quantity', v_available,
        'missing_quantity', v_component.required_quantity - v_available
      ));
    END IF;
  END LOOP;

  IF v_component_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'missing_bom', 'shortages', '[]'::jsonb);
  END IF;
  IF jsonb_array_length(v_shortages) > 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'insufficient_stock', 'shortages', v_shortages);
  END IF;

  -- Consumo apenas após toda a pré-validação. Uma componente pode estar
  -- distribuída entre locais, mas a identidade sempre é produto + variante.
  FOR v_component IN
    SELECT component_id, variant_id, sum(qty_per_unit * v_order.consolidated_quantity) AS required_quantity
    FROM public.product_components
    WHERE product_id = v_order.product_id
      AND product_variant_id IS NOT DISTINCT FROM v_order.variant_id
    GROUP BY component_id, variant_id
  LOOP
    v_remaining := v_component.required_quantity;
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
      v_event_key := 'production:' || v_order.id::text || ':consume:' || v_component.component_id::text || ':'
        || COALESCE(v_component.variant_id::text, 'simple') || ':' || COALESCE(v_inventory.location, 'sem-localizacao');

      UPDATE public.inventory
      SET quantity = quantity - v_take, updated_at = now()
      WHERE id = v_inventory.id;

      INSERT INTO public.inventory_movements (
        product_id, variant_id, movement_type, quantity, previous_balance, new_balance,
        location, reference_type, reference_id, event_key, notes
      ) VALUES (
        v_component.component_id, v_component.variant_id, 'consume', v_take,
        v_inventory.quantity, v_inventory.quantity - v_take,
        v_inventory.location, 'production_order', v_order.id, v_event_key,
        'Consumo por conclusão da OP ' || COALESCE(v_order.internal_production_number, v_order.order_number, v_order.id::text)
      );
      v_remaining := v_remaining - v_take;
    END LOOP;
  END LOOP;

  -- Crédito do acabado, também no mesmo commit. O RETURNING mantém os saldos
  -- registrados no movimento coerentes mesmo se outra OP creditar o mesmo item.
  INSERT INTO public.inventory (product_id, variant_id, location, quantity, updated_at)
  VALUES (v_order.product_id, v_order.variant_id, v_finished_location, v_order.consolidated_quantity, now())
  ON CONFLICT (product_id, variant_id, location)
  DO UPDATE SET quantity = public.inventory.quantity + EXCLUDED.quantity, updated_at = now()
  RETURNING quantity - v_order.consolidated_quantity, quantity INTO v_finished_previous, v_finished_new;

  v_event_key := 'production:' || v_order.id::text || ':finished:' || v_order.product_id::text || ':'
    || COALESCE(v_order.variant_id::text, 'simple') || ':' || v_finished_location;
  INSERT INTO public.inventory_movements (
    product_id, variant_id, movement_type, quantity, previous_balance, new_balance,
    location, reference_type, reference_id, event_key, notes
  ) VALUES (
    v_order.product_id, v_order.variant_id, 'in', v_order.consolidated_quantity,
    v_finished_previous, v_finished_new,
    v_finished_location, 'production_order', v_order.id, v_event_key,
    'Entrada por conclusão da OP ' || COALESCE(v_order.internal_production_number, v_order.order_number, v_order.id::text)
  );

  -- Nenhuma atualização de orders.status/operational_status acontece aqui.
  UPDATE public.production_orders
  SET status = 'concluido',
      completed_at = now(),
      updated_at = now()
  WHERE id = v_order.id;

  RETURN jsonb_build_object('success', true, 'already_completed', false, 'movement_count', 1, 'shortages', '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_production_order(uuid, text) TO authenticated;
