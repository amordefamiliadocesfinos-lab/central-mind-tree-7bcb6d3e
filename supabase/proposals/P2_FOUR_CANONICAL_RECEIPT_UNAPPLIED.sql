-- UNAPPLIED: full candidate derived from LIVE pg_get_functiondef, snapshot 2026-11-04.
-- Requires P2 schema/internal RPC/receipt adapter in DISPOSABLE DB first.
-- No production call, grant, migration or cutover authorized.
CREATE OR REPLACE FUNCTION public.confirm_purchase_receipt_unguarded_01b(p_receipt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    IF EXISTS (SELECT 1 FROM public.inventory_movements WHERE event_key = v_event_key)
      OR EXISTS (SELECT 1 FROM public.glucodry_sealed_events WHERE event_key=v_event_key)
      OR EXISTS (SELECT 1 FROM public.maltodextrina_sealed_events WHERE event_key=v_event_key)
      OR EXISTS (SELECT 1 FROM public.chocolate_sealed_events WHERE event_key=v_event_key)
      OR EXISTS (SELECT 1 FROM public.trufa_pack_sealed_events WHERE event_key=v_event_key)
      OR EXISTS (SELECT 1 FROM public.amendoim_sealed_events WHERE event_key=v_event_key)
      OR EXISTS (SELECT 1 FROM public.p2_four_sealed_events WHERE event_key=v_event_key||':target') THEN
      RAISE EXCEPTION 'Recebimento possui evento físico já registrado e precisa de reconciliação.';
    END IF;
  END LOOP;

  FOR v_item IN
    SELECT receipt_item.id AS purchase_receipt_item_id, purchase_item.product_id, purchase_item.variant_id,
      purchase_item.purchase_presentation_id,
      receipt_item.operational_received_qty, purchase_item.purchase_unit_label, receipt_item.received_purchase_qty
    FROM public.purchase_receipt_items receipt_item
    JOIN public.purchase_order_items purchase_item ON purchase_item.id = receipt_item.purchase_order_item_id
    WHERE receipt_item.purchase_receipt_id = v_receipt.id
    ORDER BY receipt_item.id
  LOOP
    IF v_item.product_id='af7fe3c4-863c-4d1f-9fcd-b4ecb92e5322'::uuid AND EXISTS (
      SELECT 1 FROM public.purchase_presentations pp WHERE pp.id=v_item.purchase_presentation_id
      AND pp.product_id='af7fe3c4-863c-4d1f-9fcd-b4ecb92e5322'::uuid AND pp.variant_id=v_item.variant_id
      AND pp.is_active AND pp.conversion_factor=100 AND pp.purchase_unit_label='pacote') THEN
      IF v_item.received_purchase_qty IS NULL OR v_item.received_purchase_qty<1
        OR v_item.received_purchase_qty<>trunc(v_item.received_purchase_qty)
        OR v_item.operational_received_qty<>v_item.received_purchase_qty*100
      THEN RAISE EXCEPTION 'et1_receipt_requires_whole_p100'; END IF;
      v_event_key:='purchase_receipt:'||v_receipt.id::text||':'||v_item.purchase_receipt_item_id::text||':'||v_receipt.storage_location_id::text;
      PERFORM public.trufa_pack_move_internal(v_item.variant_id,v_receipt.storage_location_id,
      v_item.received_purchase_qty::integer,'receipt',v_event_key,v_receipt.id);
      v_movement_count:=v_movement_count+1;
    ELSIF v_item.product_id='92088a70-8cc0-40ef-a39d-564603df6866'::uuid AND v_item.purchase_presentation_id='820dead8-61a6-4b54-8b5a-8c6d15b5303e'::uuid THEN
      IF v_item.received_purchase_qty<>trunc(v_item.received_purchase_qty) OR
        v_item.operational_received_qty<>v_item.received_purchase_qty*25000 THEN
        RAISE EXCEPTION 'glucodry_gd2_receipt_requires_whole_sealed_sacks';
      END IF;
      v_event_key := 'purchase_receipt:'||v_receipt.id::text||':'||v_item.purchase_receipt_item_id::text||':'||v_receipt.storage_location_id::text;
      PERFORM public.glucodry_move_sealed_internal(v_receipt.storage_location_id,v_item.received_purchase_qty::integer,
        'purchase_receipt',v_receipt.id,v_event_key,'Recebimento físico de saco original lacrado de Glucodry 25kg');
      v_movement_count:=v_movement_count+1;
    ELSIF v_item.product_id='78fd74e2-1dc8-4c10-94a3-e661de6f8ba8'::uuid AND v_item.purchase_presentation_id='070f55a1-dbb5-431c-8bf4-90c76191b24c'::uuid THEN
      IF v_item.variant_id IS NOT NULL OR v_item.received_purchase_qty<>trunc(v_item.received_purchase_qty)
        OR v_item.operational_received_qty<>v_item.received_purchase_qty*25000
      THEN RAISE EXCEPTION 'malto_receipt_requires_whole_original_25kg_sacks'; END IF;
      v_event_key:='purchase_receipt:'||v_receipt.id::text||':'||v_item.purchase_receipt_item_id::text||':'||v_receipt.storage_location_id::text;
      PERFORM public.maltodextrina_move_sealed_internal(v_receipt.storage_location_id,v_item.received_purchase_qty::integer,
        'purchase_receipt',v_receipt.id,v_event_key,'Recebimento original Maltodextrina 25kg');
      v_movement_count:=v_movement_count+1;
    ELSIF v_item.product_id='c70dd4b4-bc59-4d88-81ef-1a8c47315560'::uuid AND (
      (v_item.variant_id='f6588f52-6e28-4ce9-b492-a95c847d5c0c'::uuid AND v_item.purchase_presentation_id='91a58818-2010-4c6a-93bd-28b1f8f9e5af'::uuid)
      OR (v_item.variant_id='1a3d59a6-4712-4afd-811a-5a72aad76fa9'::uuid AND v_item.purchase_presentation_id='45ead74d-592e-4019-8d10-adc2d93242cc'::uuid)
    ) THEN
      IF v_item.received_purchase_qty<>trunc(v_item.received_purchase_qty)
        OR v_item.received_purchase_qty<1
        OR v_item.operational_received_qty<>v_item.received_purchase_qty*20000 THEN
        RAISE EXCEPTION 'cb3_receipt_requires_whole_original_20kg_sacks';
      END IF;
      v_event_key:='purchase_receipt:'||v_receipt.id::text||':'||v_item.purchase_receipt_item_id::text||':'||v_receipt.storage_location_id::text;
      PERFORM public.chocolate_move_sealed_internal(v_item.variant_id,v_receipt.storage_location_id,
        v_item.received_purchase_qty::integer,'purchase_receipt',v_receipt.id,v_event_key,
        'Recebimento físico de embalagens originais fechadas de Chocolate Base 20kg');
      v_movement_count:=v_movement_count+1;
    ELSIF v_item.product_id='c177f332-a1c7-4276-9cef-7b81af920174'::uuid AND v_item.purchase_presentation_id='bf9ee4e9-d4c4-4f99-81a2-cf25c8df3fef'::uuid THEN
      IF v_item.variant_id IS NOT NULL OR v_item.received_purchase_qty IS NULL
        OR v_item.received_purchase_qty<>trunc(v_item.received_purchase_qty)
        OR v_item.received_purchase_qty<1
        OR v_item.operational_received_qty<>v_item.received_purchase_qty*24000 THEN
        RAISE EXCEPTION 'am3_receipt_requires_whole_original_24kg_sacks';
      END IF;
      v_event_key:='purchase_receipt:'||v_receipt.id::text||':'||
        v_item.purchase_receipt_item_id::text||':'||v_receipt.storage_location_id::text;
      PERFORM public.amendoim_move_sealed_internal(v_receipt.storage_location_id,
        v_item.received_purchase_qty::integer,'purchase_receipt',v_receipt.id,
        v_event_key,'Recebimento físico de saco original lacrado de Amendoim 24kg');
      v_movement_count:=v_movement_count+1;
    ELSIF v_item.product_id IN (
      '0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b'::uuid,
      '6f43ad65-74d5-4db9-b931-1ecd6d124987'::uuid,
      'ef118d1c-e7c7-45e3-b796-3a9908840f3c'::uuid,
      'd913f0f2-4893-4985-9976-fcd9119a57b1'::uuid) THEN
      PERFORM public.p2_four_receipt_adapter_candidate(
        v_item.product_id,v_item.variant_id,v_item.purchase_presentation_id,
        v_item.received_purchase_qty,v_item.operational_received_qty,
        v_receipt.storage_location_id,v_receipt.id,v_item.purchase_receipt_item_id);
      v_movement_count:=v_movement_count+1;
    ELSE
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
    END IF;
  END LOOP;

  PERFORM set_config('app.purchase_receipt_confirmation', 'true', true);
  UPDATE public.purchase_receipts SET status = 'confirmed', received_at = COALESCE(received_at, now()),
    confirmed_at = now(), confirmed_by = COALESCE(confirmed_by, auth.uid()), updated_at = now()
  WHERE id = v_receipt.id;
  v_status := public.recalculate_purchase_order_receiving_status(v_order.id);
  RETURN jsonb_build_object('receipt_id', v_receipt.id, 'purchase_order_id', v_order.id,
    'already_confirmed', false, 'movement_count', v_movement_count, 'purchase_order_status', v_status);
END;
$function$

