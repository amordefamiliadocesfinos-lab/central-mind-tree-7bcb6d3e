-- F11-B: a quantidade combinada na compra é referência comercial. A entrada
-- física confirmada pode divergir, inclusive excedendo-a, sem reescrever o pedido.
CREATE OR REPLACE FUNCTION public.confirm_purchase_receipt(p_receipt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receipt public.purchase_receipts%ROWTYPE;
  v_order public.purchase_orders%ROWTYPE;
  v_location_name text;
  v_item record;
  v_previous_balance numeric;
  v_new_balance numeric;
  v_event_key text;
  v_status text;
  v_movement_count integer := 0;
BEGIN
  SELECT * INTO v_receipt FROM public.purchase_receipts WHERE id = p_receipt_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recebimento não encontrado.'; END IF;
  IF v_receipt.status = 'confirmed' THEN
    RETURN jsonb_build_object('receipt_id', v_receipt.id, 'already_confirmed', true, 'movement_count', 0);
  END IF;
  IF v_receipt.status = 'cancelled' THEN RAISE EXCEPTION 'Recebimento cancelado não pode ser confirmado.'; END IF;

  SELECT * INTO v_order FROM public.purchase_orders WHERE id = v_receipt.purchase_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido de compra não encontrado.'; END IF;
  IF v_order.status = 'cancelado' THEN RAISE EXCEPTION 'Pedido de compra cancelado não pode receber material.'; END IF;
  IF v_order.status NOT IN ('confirmado', 'em_transito', 'parcialmente_recebido') THEN
    RAISE EXCEPTION 'Pedido de compra precisa estar confirmado ou em trânsito para receber material.';
  END IF;

  SELECT name INTO v_location_name FROM public.storage_locations WHERE id = v_receipt.storage_location_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Local de estoque inválido ou inativo para o recebimento.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.purchase_receipt_items WHERE purchase_receipt_id = v_receipt.id) THEN
    RAISE EXCEPTION 'Recebimento precisa ter ao menos um item.';
  END IF;

  -- A pré-validação continua integral e atômica. Não há mais comparação com
  -- ordered_purchase_qty: divergência é registrada pelo histórico, não bloqueada.
  FOR v_item IN
    SELECT purchase_item.id AS purchase_order_item_id, purchase_item.product_id,
      purchase_item.variant_id, receipt_item.id AS purchase_receipt_item_id,
      receipt_item.operational_received_qty
    FROM public.purchase_receipt_items receipt_item
    JOIN public.purchase_order_items purchase_item ON purchase_item.id = receipt_item.purchase_order_item_id
    WHERE receipt_item.purchase_receipt_id = v_receipt.id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.products product
      WHERE product.id = v_item.product_id
        AND ((COALESCE(product.variation_mode, 'sem_variacao') = 'sem_variacao' AND v_item.variant_id IS NULL)
          OR (product.variation_mode = 'variacoes_fisicas' AND EXISTS (
            SELECT 1 FROM public.product_variants variant WHERE variant.id = v_item.variant_id AND variant.product_id = product.id
          )))
    ) THEN
      RAISE EXCEPTION 'Identidade física inválida no item de recebimento %.', v_item.purchase_order_item_id;
    END IF;
    v_event_key := 'purchase_receipt:' || v_receipt.id::text || ':' || v_item.purchase_receipt_item_id::text || ':' || v_receipt.storage_location_id::text;
    IF EXISTS (SELECT 1 FROM public.inventory_movements WHERE event_key = v_event_key) THEN
      RAISE EXCEPTION 'Recebimento possui evento físico já registrado e precisa de reconciliação.';
    END IF;
  END LOOP;

  FOR v_item IN
    SELECT receipt_item.id AS purchase_receipt_item_id, purchase_item.product_id, purchase_item.variant_id,
      receipt_item.operational_received_qty, purchase_item.purchase_unit_label, receipt_item.received_purchase_qty
    FROM public.purchase_receipt_items receipt_item
    JOIN public.purchase_order_items purchase_item ON purchase_item.id = receipt_item.purchase_order_item_id
    WHERE receipt_item.purchase_receipt_id = v_receipt.id
    ORDER BY receipt_item.id
  LOOP
    INSERT INTO public.inventory (product_id, variant_id, location, location_id, quantity, updated_at)
    VALUES (v_item.product_id, v_item.variant_id, v_location_name, v_receipt.storage_location_id, v_item.operational_received_qty, now())
    ON CONFLICT (product_id, variant_id, location) DO UPDATE SET
      quantity = public.inventory.quantity + EXCLUDED.quantity,
      location_id = EXCLUDED.location_id,
      updated_at = now()
    RETURNING quantity - v_item.operational_received_qty, quantity INTO v_previous_balance, v_new_balance;

    v_event_key := 'purchase_receipt:' || v_receipt.id::text || ':' || v_item.purchase_receipt_item_id::text || ':' || v_receipt.storage_location_id::text;
    INSERT INTO public.inventory_movements (
      product_id, variant_id, movement_type, quantity, previous_balance, new_balance,
      location, reference_type, reference_id, event_key, notes
    ) VALUES (
      v_item.product_id, v_item.variant_id, 'in', v_item.operational_received_qty,
      v_previous_balance, v_new_balance, v_location_name, 'purchase_receipt', v_receipt.id, v_event_key,
      'Entrada por recebimento de compra: ' || v_item.received_purchase_qty || ' ' || v_item.purchase_unit_label
    );
    v_movement_count := v_movement_count + 1;
  END LOOP;

  PERFORM set_config('app.purchase_receipt_confirmation', 'true', true);
  UPDATE public.purchase_receipts SET status = 'confirmed', received_at = COALESCE(received_at, now()),
    confirmed_at = now(), confirmed_by = COALESCE(confirmed_by, auth.uid()), updated_at = now()
  WHERE id = v_receipt.id;
  v_status := public.recalculate_purchase_order_receiving_status(v_order.id);
  RETURN jsonb_build_object('receipt_id', v_receipt.id, 'purchase_order_id', v_order.id,
    'already_confirmed', false, 'movement_count', v_movement_count, 'purchase_order_status', v_status);
END;
$$;
