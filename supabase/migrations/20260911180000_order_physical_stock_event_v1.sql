-- FASE 3: um pedido expedido gera uma única saída física.
-- Não altera schema nem reescreve o histórico: consolida os contratos já
-- existentes de OP-01 e Separação.

CREATE OR REPLACE FUNCTION public.apply_order_stock_event(
  p_order_id uuid,
  p_event text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_inventory record;
  v_available numeric;
  v_remaining numeric;
  v_take numeric;
  v_key text;
  v_movement_count integer := 0;
BEGIN
  IF p_event NOT IN ('confirmed', 'cancelled', 'shipped', 'external_shipped') THEN
    RAISE EXCEPTION 'Evento de estoque de pedido inválido: %', p_event;
  END IF;

  -- Serializa tentativas concorrentes para o mesmo pedido antes de consultar
  -- movimentos ou saldos.
  PERFORM 1 FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  -- Criar, confirmar ou cancelar não é uma saída física nesta fase.
  IF p_event IN ('confirmed', 'cancelled') THEN
    RETURN jsonb_build_object('event', p_event, 'applied', false, 'already_applied', false, 'movement_count', 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'Pedido sem itens não pode ser finalizado fisicamente';
  END IF;

  -- Uma saída já registrada, inclusive por importação externa, encerra a
  -- consequência física do pedido e torna retries inofensivos.
  IF EXISTS (
    SELECT 1
    FROM public.inventory_movements
    WHERE reference_id = p_order_id
      AND movement_type = 'out'
      AND (
        reference_type = 'order'
        OR (
          reference_type = 'order_stock_event'
          AND event_key LIKE 'order:' || p_order_id::text || ':physical_out:%'
        )
      )
  ) THEN
    RETURN jsonb_build_object('event', p_event, 'applied', false, 'already_applied', true, 'movement_count', 0);
  END IF;

  -- Pré-validação por identidade física. Cada saldo é bloqueado antes de
  -- qualquer UPDATE, de modo que falta em uma variante nunca deixe baixa
  -- parcial em outra identidade/localização.
  FOR v_item IN
    SELECT
      oi.product_id,
      oi.variant_id,
      sum(oi.quantity) AS required_quantity,
      p.name AS product_name,
      pv.variant_name
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    LEFT JOIN public.product_variants pv ON pv.id = oi.variant_id
    WHERE oi.order_id = p_order_id
    GROUP BY oi.product_id, oi.variant_id, p.name, pv.variant_name
  LOOP
    v_available := 0;
    FOR v_inventory IN
      SELECT quantity
      FROM public.inventory
      WHERE product_id = v_item.product_id
        AND variant_id IS NOT DISTINCT FROM v_item.variant_id
      FOR UPDATE
    LOOP
      v_available := v_available + v_inventory.quantity;
    END LOOP;

    IF v_available < v_item.required_quantity THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = format(
          'Estoque insuficiente para finalizar: %s%s — necessário %s, disponível %s, faltam %s.',
          v_item.product_name,
          CASE WHEN v_item.variant_name IS NULL THEN '' ELSE ' · ' || v_item.variant_name END,
          v_item.required_quantity,
          v_available,
          v_item.required_quantity - v_available
        ),
        DETAIL = jsonb_build_object(
          'product_id', v_item.product_id,
          'variant_id', v_item.variant_id,
          'required_quantity', v_item.required_quantity,
          'available_quantity', v_available,
          'missing_quantity', v_item.required_quantity - v_available
        )::text;
    END IF;
  END LOOP;

  -- Consome os saldos distribuídos somente depois da pré-validação completa.
  -- O agrupamento impede que order_items repetidos gerem baixa independente
  -- para a mesma identidade física.
  FOR v_item IN
    SELECT product_id, variant_id, sum(quantity) AS required_quantity
    FROM public.order_items
    WHERE order_id = p_order_id
    GROUP BY product_id, variant_id
  LOOP
    v_remaining := v_item.required_quantity;
    FOR v_inventory IN
      SELECT id, location, quantity
      FROM public.inventory
      WHERE product_id = v_item.product_id
        AND variant_id IS NOT DISTINCT FROM v_item.variant_id
        AND quantity > 0
      ORDER BY quantity DESC, id
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_remaining, v_inventory.quantity);
      v_key := 'order:' || p_order_id::text || ':physical_out:' || v_item.product_id::text || ':'
        || COALESCE(v_item.variant_id::text, 'simple') || ':' || COALESCE(v_inventory.location, 'sem-localizacao');

      UPDATE public.inventory
      SET quantity = quantity - v_take,
          updated_at = now()
      WHERE id = v_inventory.id;

      INSERT INTO public.inventory_movements (
        product_id, variant_id, movement_type, quantity, previous_balance, new_balance,
        location, reference_type, reference_id, event_key, notes
      ) VALUES (
        v_item.product_id, v_item.variant_id, 'out', v_take,
        v_inventory.quantity, v_inventory.quantity - v_take,
        v_inventory.location, 'order_stock_event', p_order_id, v_key,
        'Saída física única por expedição de pedido'
      );

      v_remaining := v_remaining - v_take;
      v_movement_count := v_movement_count + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('event', p_event, 'applied', true, 'already_applied', false, 'movement_count', v_movement_count);
END;
$$;

-- Status legados permanecem como compatibilidade de apresentação/histórico.
-- Eles não decidem mais a saída física: a UI de Pedido encaminha a
-- finalização ao mesmo contrato da Separação.
CREATE OR REPLACE FUNCTION public.transition_order_status_with_stock(
  p_order_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET status = p_status,
      updated_at = now()
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  RETURN jsonb_build_object('stock_event', NULL, 'movement_count', 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_order_separation(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_separation public.order_separation;
  v_stock_result jsonb;
BEGIN
  INSERT INTO public.order_separation (order_id)
  VALUES (p_order_id)
  ON CONFLICT (order_id) DO NOTHING;

  SELECT * INTO v_separation
  FROM public.order_separation
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF v_separation.separation_status = 'finalized' THEN
    UPDATE public.orders
    SET operational_status = 'finalized', updated_at = now()
    WHERE id = p_order_id;
    RETURN jsonb_build_object('already_finalized', true, 'stock_result', NULL);
  END IF;

  v_stock_result := public.apply_order_stock_event(p_order_id, 'shipped');

  UPDATE public.order_separation
  SET separation_status = 'finalized',
      finalized_at = now(),
      finalized_by = auth.uid()
  WHERE order_id = p_order_id;

  UPDATE public.orders
  SET operational_status = 'finalized',
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('already_finalized', false, 'stock_result', v_stock_result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_order_stock_event(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_order_status_with_stock(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_order_separation(uuid) TO authenticated;
