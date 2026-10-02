-- F01.3 — Compatibilidade OP ↔ Fato Real de Produção
-- Cutover é propositalmente staged: OPs existentes e novas continuam no modo
-- legado até a interface Mobile estar pronta. Uma migration posterior mudará
-- o default para production_facts sem regressão operacional intermediária.

ALTER TABLE public.production_orders
  ADD COLUMN physical_flow_mode text;

UPDATE public.production_orders
SET physical_flow_mode = 'legacy_completion'
WHERE physical_flow_mode IS NULL;

ALTER TABLE public.production_orders
  ALTER COLUMN physical_flow_mode SET DEFAULT 'legacy_completion',
  ALTER COLUMN physical_flow_mode SET NOT NULL;

ALTER TABLE public.production_orders
  ADD CONSTRAINT production_orders_physical_flow_mode_check
  CHECK (physical_flow_mode IN ('legacy_completion','production_facts'));

CREATE INDEX production_orders_physical_flow_mode_idx
  ON public.production_orders(physical_flow_mode, status);

CREATE OR REPLACE FUNCTION public.complete_production_order(
  p_production_order_id uuid,
  p_finished_location text DEFAULT 'Fábrica'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.production_orders;
  v_item record;
  v_component record;
  v_inventory record;
  v_available numeric;
  v_remaining numeric;
  v_take numeric;
  v_previous numeric;
  v_new numeric;
  v_shortages jsonb := '[]'::jsonb;
  v_missing_bom_items jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_location text := COALESCE(NULLIF(btrim(p_finished_location),''),'Fábrica');
  v_key text;
  v_physical_quantity numeric;
  v_physical_items jsonb;
BEGIN
  SELECT * INTO v_order
  FROM public.production_orders
  WHERE id = p_production_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de produção não encontrada';
  END IF;

  IF v_order.status = 'concluido' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'movement_count', 0,
      'shortages', '[]'::jsonb
    );
  END IF;

  IF v_order.status = 'cancelado' THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'cancelled',
      'shortages', '[]'::jsonb
    );
  END IF;

  -- Novo contrato: quando a OP usa production_facts, o fato físico já alterou
  -- estoque no momento do registro. Concluir OP é apenas fechamento administrativo.
  IF v_order.physical_flow_mode = 'production_facts' THEN
    SELECT
      COALESCE(sum(pf.quantity), 0),
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'product_id', grouped.product_id,
            'variant_id', grouped.variant_id,
            'quantity', grouped.quantity
          )
          ORDER BY grouped.product_id, grouped.variant_id
        ),
        '[]'::jsonb
      )
    INTO v_physical_quantity, v_physical_items
    FROM (
      SELECT product_id, variant_id, sum(quantity) AS quantity
      FROM public.production_facts
      WHERE production_order_id = v_order.id
        AND status = 'confirmed'
      GROUP BY product_id, variant_id
    ) grouped
    RIGHT JOIN (SELECT 1 AS singleton) anchor ON true;

    IF COALESCE(v_physical_quantity, 0) <= 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'reason', 'no_physical_facts',
        'movement_count', 0,
        'shortages', '[]'::jsonb
      );
    END IF;

    UPDATE public.production_orders
    SET status = 'concluido',
        completed_at = now(),
        updated_at = now()
    WHERE id = v_order.id;

    RETURN jsonb_build_object(
      'success', true,
      'already_completed', false,
      'physical_flow_mode', 'production_facts',
      'physical_quantity', v_physical_quantity,
      'physical_items', COALESCE(v_physical_items, '[]'::jsonb),
      'movement_count', 0,
      'shortages', '[]'::jsonb
    );
  END IF;

  -- Fluxo legado preservado integralmente para OPs já existentes e durante o
  -- período de transição antes do cutover Mobile.
  IF NOT EXISTS (
    SELECT 1 FROM public.production_order_items
    WHERE production_order_id = v_order.id
  ) THEN
    RETURN jsonb_build_object('success',false,'reason','missing_items','shortages','[]'::jsonb);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.production_order_items
    WHERE production_order_id = v_order.id
      AND produced_quantity <= 0
  ) THEN
    RETURN jsonb_build_object('success',false,'reason','no_produced_quantity','shortages','[]'::jsonb);
  END IF;

  FOR v_item IN
    SELECT item.id,item.product_id,item.variant_id,p.name product_name,pv.variant_name
    FROM public.production_order_items item
    JOIN public.products p ON p.id=item.product_id
    LEFT JOIN public.product_variants pv ON pv.id=item.variant_id
    WHERE item.production_order_id=v_order.id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.product_components pc
      WHERE pc.product_id=v_item.product_id
        AND pc.product_variant_id IS NOT DISTINCT FROM v_item.variant_id
    ) THEN
      v_missing_bom_items := v_missing_bom_items || jsonb_build_array(
        jsonb_build_object(
          'production_order_item_id',v_item.id,
          'product_id',v_item.product_id,
          'variant_id',v_item.variant_id,
          'product_name',v_item.product_name,
          'variant_name',v_item.variant_name
        )
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(v_missing_bom_items)>0 THEN
    RETURN jsonb_build_object(
      'success',false,'reason','missing_bom',
      'missing_bom_items',v_missing_bom_items,
      'shortages','[]'::jsonb
    );
  END IF;

  FOR v_component IN
    SELECT pc.component_id,pc.variant_id,
           sum(pc.qty_per_unit*item.produced_quantity) required_quantity,
           p.name component_name,pv.variant_name,
           COALESCE(pv.sku,p.sku) component_sku
    FROM public.production_order_items item
    JOIN public.product_components pc
      ON pc.product_id=item.product_id
     AND pc.product_variant_id IS NOT DISTINCT FROM item.variant_id
    JOIN public.products p ON p.id=pc.component_id
    LEFT JOIN public.product_variants pv ON pv.id=pc.variant_id
    WHERE item.production_order_id=v_order.id
    GROUP BY pc.component_id,pc.variant_id,p.name,pv.variant_name,p.sku,pv.sku
  LOOP
    v_available := 0;
    FOR v_inventory IN
      SELECT quantity FROM public.inventory
      WHERE product_id=v_component.component_id
        AND variant_id IS NOT DISTINCT FROM v_component.variant_id
      FOR UPDATE
    LOOP
      v_available := v_available + v_inventory.quantity;
    END LOOP;

    IF v_available < v_component.required_quantity THEN
      v_shortages := v_shortages || jsonb_build_array(
        jsonb_build_object(
          'product_id',v_component.component_id,
          'variant_id',v_component.variant_id,
          'component_name',v_component.component_name,
          'component_variant_name',v_component.variant_name,
          'component_sku',v_component.component_sku,
          'required_quantity',v_component.required_quantity,
          'available_quantity',v_available,
          'missing_quantity',v_component.required_quantity-v_available
        )
      );
    END IF;
    v_count := v_count + 1;
  END LOOP;

  IF v_count=0 THEN
    RETURN jsonb_build_object('success',false,'reason','missing_bom','missing_bom_items',v_missing_bom_items,'shortages','[]'::jsonb);
  END IF;

  IF jsonb_array_length(v_shortages)>0 THEN
    RETURN jsonb_build_object('success',false,'reason','insufficient_stock','shortages',v_shortages);
  END IF;

  FOR v_component IN
    SELECT pc.component_id,pc.variant_id,
           sum(pc.qty_per_unit*item.produced_quantity) required_quantity
    FROM public.production_order_items item
    JOIN public.product_components pc
      ON pc.product_id=item.product_id
     AND pc.product_variant_id IS NOT DISTINCT FROM item.variant_id
    WHERE item.production_order_id=v_order.id
    GROUP BY pc.component_id,pc.variant_id
  LOOP
    v_remaining := v_component.required_quantity;
    FOR v_inventory IN
      SELECT id,location,quantity
      FROM public.inventory
      WHERE product_id=v_component.component_id
        AND variant_id IS NOT DISTINCT FROM v_component.variant_id
        AND quantity>0
      ORDER BY quantity DESC,id
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining<=0;
      v_take := LEAST(v_remaining,v_inventory.quantity);
      v_key := 'production:'||v_order.id::text||':consume:'||v_component.component_id::text||':'||COALESCE(v_component.variant_id::text,'simple')||':'||COALESCE(v_inventory.location,'sem-localizacao');

      UPDATE public.inventory
      SET quantity=quantity-v_take,updated_at=now()
      WHERE id=v_inventory.id;

      INSERT INTO public.inventory_movements(
        product_id,variant_id,movement_type,quantity,previous_balance,new_balance,
        location,reference_type,reference_id,event_key,notes
      ) VALUES(
        v_component.component_id,v_component.variant_id,'consume',v_take,
        v_inventory.quantity,v_inventory.quantity-v_take,v_inventory.location,
        'production_order',v_order.id,v_key,
        'Consumo por conclusão da OP '||COALESCE(v_order.internal_production_number,v_order.order_number,v_order.id::text)
      );
      v_remaining := v_remaining-v_take;
    END LOOP;
  END LOOP;

  FOR v_item IN
    SELECT * FROM public.production_order_items
    WHERE production_order_id=v_order.id
    ORDER BY created_at,id
  LOOP
    v_key := 'production:'||v_order.id::text||':finished:'||v_item.product_id::text||':'||COALESCE(v_item.variant_id::text,'simple')||':'||v_location;

    INSERT INTO public.inventory(product_id,variant_id,location,quantity,updated_at)
    VALUES(v_item.product_id,v_item.variant_id,v_location,v_item.produced_quantity,now())
    ON CONFLICT(product_id,variant_id,location)
    DO UPDATE SET quantity=public.inventory.quantity+EXCLUDED.quantity,updated_at=now()
    RETURNING quantity-v_item.produced_quantity,quantity INTO v_previous,v_new;

    INSERT INTO public.inventory_movements(
      product_id,variant_id,movement_type,quantity,previous_balance,new_balance,
      location,reference_type,reference_id,event_key,notes
    ) VALUES(
      v_item.product_id,v_item.variant_id,'in',v_item.produced_quantity,
      v_previous,v_new,v_location,'production_order',v_order.id,v_key,
      'Entrada por conclusão da OP '||COALESCE(v_order.internal_production_number,v_order.order_number,v_order.id::text)
    );
  END LOOP;

  UPDATE public.production_orders
  SET status='concluido',completed_at=now(),updated_at=now()
  WHERE id=v_order.id;

  RETURN jsonb_build_object(
    'success',true,
    'already_completed',false,
    'physical_flow_mode','legacy_completion',
    'movement_count',v_count,
    'shortages','[]'::jsonb
  );
END;
$function$;
