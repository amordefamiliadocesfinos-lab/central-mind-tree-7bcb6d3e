-- F01.3 — Compatibilidade sem dupla transformação física.
-- Preserva o motor legado intacto e transforma complete_production_order em
-- um roteador: legado continua físico; production_facts fecha apenas a OP.

ALTER FUNCTION public.complete_production_order(uuid, text)
  RENAME TO complete_production_order_legacy;

REVOKE ALL ON FUNCTION public.complete_production_order_legacy(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_production_order_legacy(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.complete_production_order_legacy(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.complete_production_order_legacy(uuid, text) TO service_role;

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
  v_physical_quantity numeric := 0;
  v_physical_items jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_order
  FROM public.production_orders
  WHERE id = p_production_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de produção não encontrada';
  END IF;

  IF v_order.physical_flow_mode = 'legacy_completion' THEN
    RETURN public.complete_production_order_legacy(
      p_production_order_id,
      p_finished_location
    );
  END IF;

  IF v_order.status = 'concluido' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'physical_flow_mode', 'production_facts',
      'movement_count', 0,
      'shortages', '[]'::jsonb
    );
  END IF;

  IF v_order.status = 'cancelado' THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'cancelled',
      'physical_flow_mode', 'production_facts',
      'movement_count', 0,
      'shortages', '[]'::jsonb
    );
  END IF;

  SELECT COALESCE(sum(quantity), 0)
  INTO v_physical_quantity
  FROM public.production_facts
  WHERE production_order_id = v_order.id
    AND status = 'confirmed';

  SELECT COALESCE(
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
  INTO v_physical_items
  FROM (
    SELECT product_id, variant_id, sum(quantity) AS quantity
    FROM public.production_facts
    WHERE production_order_id = v_order.id
      AND status = 'confirmed'
    GROUP BY product_id, variant_id
  ) grouped;

  IF v_physical_quantity <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'no_physical_facts',
      'physical_flow_mode', 'production_facts',
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
    'physical_items', v_physical_items,
    'movement_count', 0,
    'shortages', '[]'::jsonb
  );
END;
$function$;
