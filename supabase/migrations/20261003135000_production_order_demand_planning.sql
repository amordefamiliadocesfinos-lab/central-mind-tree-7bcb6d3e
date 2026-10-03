-- F03 — Planejamento de Produção / OP
-- Mantém OP como planejamento, liga múltiplos Pedidos como origem da demanda
-- e consolida uma única OP ativa por identidade física no fluxo do Planejamento.

CREATE TABLE IF NOT EXISTS public.production_order_demands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id uuid NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  demand_quantity_snapshot numeric NOT NULL CHECK (demand_quantity_snapshot > 0),
  order_reference_snapshot text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS production_order_demands_unique_origin_identity
ON public.production_order_demands (
  production_order_id,
  order_id,
  product_id,
  COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

CREATE INDEX IF NOT EXISTS production_order_demands_order_idx
ON public.production_order_demands(order_id);

CREATE INDEX IF NOT EXISTS production_order_demands_identity_idx
ON public.production_order_demands(product_id, variant_id);

ALTER TABLE public.production_order_demands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read production order demands" ON public.production_order_demands;
CREATE POLICY "Authenticated can read production order demands"
ON public.production_order_demands FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role manages production order demands" ON public.production_order_demands;
CREATE POLICY "Service role manages production order demands"
ON public.production_order_demands FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.plan_production_need(
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity integer,
  p_order_demands jsonb DEFAULT '[]'::jsonb,
  p_scheduled_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.production_orders%ROWTYPE;
  v_active_count integer;
  v_item_id uuid;
  v_demand jsonb;
  v_order_id uuid;
  v_demand_qty numeric;
  v_reference text;
  v_is_manufactured boolean;
  v_existing_demand_id uuid;
  v_primary_order_id uuid;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_quantity');
  END IF;

  PERFORM public.assert_physical_identity(p_product_id, p_variant_id, 'plan_production_need');

  SELECT is_manufactured INTO v_is_manufactured
  FROM public.products
  WHERE id = p_product_id;

  IF COALESCE(v_is_manufactured, false) = false THEN
    RETURN jsonb_build_object('success', false, 'reason', 'product_not_manufactured');
  END IF;

  -- Serializa o planejamento da mesma identidade física.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_product_id::text || ':' || COALESCE(p_variant_id::text, 'simple'), 0));

  SELECT count(*) INTO v_active_count
  FROM public.production_orders po
  WHERE po.status IN ('aberto', 'producao')
    AND po.physical_flow_mode = 'production_facts'
    AND po.product_id = p_product_id
    AND po.variant_id IS NOT DISTINCT FROM p_variant_id;

  IF v_active_count > 1 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'multiple_active_orders');
  END IF;

  SELECT * INTO v_order
  FROM public.production_orders po
  WHERE po.status IN ('aberto', 'producao')
    AND po.physical_flow_mode = 'production_facts'
    AND po.product_id = p_product_id
    AND po.variant_id IS NOT DISTINCT FROM p_variant_id
  ORDER BY po.created_at
  LIMIT 1
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    INSERT INTO public.production_orders (
      product_id, variant_id, target_quantity, status, scheduled_date,
      physical_flow_mode, notes
    ) VALUES (
      p_product_id, p_variant_id, p_quantity, 'aberto', p_scheduled_date,
      'production_facts', 'Planejada a partir da necessidade líquida operacional.'
    ) RETURNING * INTO v_order;

    INSERT INTO public.production_order_items (
      production_order_id, product_id, variant_id, planned_quantity
    ) VALUES (
      v_order.id, p_product_id, p_variant_id, p_quantity
    ) RETURNING id INTO v_item_id;
  ELSE
    UPDATE public.production_orders
    SET target_quantity = target_quantity + p_quantity,
        scheduled_date = CASE
          WHEN scheduled_date IS NULL THEN p_scheduled_date
          WHEN p_scheduled_date IS NULL THEN scheduled_date
          ELSE LEAST(scheduled_date, p_scheduled_date)
        END,
        updated_at = now()
    WHERE id = v_order.id
    RETURNING * INTO v_order;

    SELECT id INTO v_item_id
    FROM public.production_order_items
    WHERE production_order_id = v_order.id
      AND product_id = p_product_id
      AND variant_id IS NOT DISTINCT FROM p_variant_id
    ORDER BY created_at
    LIMIT 1
    FOR UPDATE;

    IF v_item_id IS NULL THEN
      INSERT INTO public.production_order_items (
        production_order_id, product_id, variant_id, planned_quantity
      ) VALUES (
        v_order.id, p_product_id, p_variant_id, p_quantity
      ) RETURNING id INTO v_item_id;
    ELSE
      UPDATE public.production_order_items
      SET planned_quantity = planned_quantity + p_quantity,
          updated_at = now()
      WHERE id = v_item_id;
    END IF;
  END IF;

  -- Mantém na OP os processos canônicos do produto, sem duplicar.
  INSERT INTO public.production_order_processes (production_order_id, process_id, is_required)
  SELECT v_order.id, pp.process_id, COALESCE(pp.is_required, true)
  FROM public.product_processes pp
  WHERE pp.product_id = p_product_id
    AND COALESCE(pp.is_active, true) = true
  ON CONFLICT (production_order_id, process_id) DO NOTHING;

  IF jsonb_typeof(COALESCE(p_order_demands, '[]'::jsonb)) = 'array' THEN
    FOR v_demand IN SELECT value FROM jsonb_array_elements(COALESCE(p_order_demands, '[]'::jsonb))
    LOOP
      BEGIN
        v_order_id := NULLIF(v_demand->>'order_id', '')::uuid;
        v_demand_qty := NULLIF(v_demand->>'quantity', '')::numeric;
        v_reference := NULLIF(v_demand->>'reference', '');
      EXCEPTION WHEN OTHERS THEN
        CONTINUE;
      END;

      IF v_order_id IS NULL OR v_demand_qty IS NULL OR v_demand_qty <= 0 THEN
        CONTINUE;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = v_order_id AND o.deleted_at IS NULL) THEN
        CONTINUE;
      END IF;

      IF v_primary_order_id IS NULL THEN
        v_primary_order_id := v_order_id;
      END IF;

      SELECT id INTO v_existing_demand_id
      FROM public.production_order_demands
      WHERE production_order_id = v_order.id
        AND order_id = v_order_id
        AND product_id = p_product_id
        AND variant_id IS NOT DISTINCT FROM p_variant_id
      LIMIT 1
      FOR UPDATE;

      IF v_existing_demand_id IS NULL THEN
        INSERT INTO public.production_order_demands (
          production_order_id, order_id, product_id, variant_id,
          demand_quantity_snapshot, order_reference_snapshot
        ) VALUES (
          v_order.id, v_order_id, p_product_id, p_variant_id,
          v_demand_qty, v_reference
        );
      ELSE
        UPDATE public.production_order_demands
        SET demand_quantity_snapshot = v_demand_qty,
            order_reference_snapshot = v_reference,
            updated_at = now()
        WHERE id = v_existing_demand_id;
      END IF;
    END LOOP;
  END IF;

  -- Compatibilidade transitória com telas antigas que ainda leem source_order_id.
  -- A verdade N:N permanece em production_order_demands.
  IF v_primary_order_id IS NOT NULL AND v_order.source_order_id IS NULL THEN
    UPDATE public.production_orders
    SET source_order_id = v_primary_order_id,
        updated_at = now()
    WHERE id = v_order.id
    RETURNING * INTO v_order;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'production_order_id', v_order.id,
    'internal_production_number', v_order.internal_production_number,
    'target_quantity', v_order.target_quantity,
    'status', v_order.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.plan_production_need(uuid,uuid,integer,jsonb,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plan_production_need(uuid,uuid,integer,jsonb,date) TO authenticated, service_role;
