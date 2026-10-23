-- M13: exactly reuse existing canonical entrypoints, extended with Maltodextrina.
INSERT INTO public.commercial_presentations(id,product_id,variant_id,name,commercial_unit_label,conversion_factor,is_active,notes,composition_mode)
VALUES('2bad0e25-0000-4000-8000-000000002500'::uuid,'78fd74e2-1dc8-4c10-94a3-e661de6f8ba8'::uuid,NULL,'Saco original fechado 25 kg','saco',1,true,'Apenas saco original lacrado; físico separado das gramas.','single')
ON CONFLICT(id) DO NOTHING;

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
      OR EXISTS (SELECT 1 FROM public.amendoim_sealed_events WHERE event_key=v_event_key) THEN
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


CREATE OR REPLACE FUNCTION public.apply_order_stock_event(p_order_id uuid, p_event text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item record; v_inventory record; v_remaining numeric; v_take numeric; v_applied numeric;
  v_key text; v_movement_count integer:=0; v_shortages jsonb:='[]'::jsonb; v_incident_key text;
BEGIN
  IF p_event NOT IN ('confirmed','cancelled','shipped','external_shipped') THEN
    RAISE EXCEPTION 'Evento de estoque de pedido inválido: %',p_event;
  END IF;
  PERFORM 1 FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF p_event IN ('confirmed','cancelled') THEN
    RETURN jsonb_build_object('event',p_event,'applied',false,'already_applied',false,'movement_count',0,'adjustment_required',false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id=p_order_id) THEN
    RAISE EXCEPTION 'Pedido sem itens não pode ser finalizado fisicamente';
  END IF;

  IF EXISTS (SELECT 1 FROM public.chocolate_sealed_events WHERE reference_type='order_stock_event' AND reference_id=p_order_id)
  OR EXISTS (SELECT 1 FROM public.glucodry_sealed_events WHERE reference_type='order_stock_event' AND reference_id=p_order_id)
  OR EXISTS (SELECT 1 FROM public.maltodextrina_sealed_events WHERE reference_type='order_stock_event' AND reference_id=p_order_id)
  OR EXISTS (SELECT 1 FROM public.trufa_pack_sealed_events WHERE reference_id=p_order_id AND direction='ship')
  OR EXISTS (SELECT 1 FROM public.amendoim_sealed_events WHERE reference_type='order_stock_event' AND reference_id=p_order_id)
    THEN RETURN jsonb_build_object('event',p_event,'applied',false,'already_applied',true,'movement_count',0,'adjustment_required',false);
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.inventory_movements WHERE reference_id=p_order_id AND movement_type='out'
      AND (reference_type='order' OR (reference_type='order_stock_event' AND event_key LIKE 'order:'||p_order_id::text||':physical_out:%'))
  ) OR EXISTS (
    SELECT 1 FROM public.operational_incidents WHERE source_type='order_separation' AND source_id=p_order_id
  ) THEN
    RETURN jsonb_build_object(
      'event',p_event,'applied',false,'already_applied',true,'movement_count',0,
      'adjustment_required',EXISTS(SELECT 1 FROM public.operational_incidents WHERE source_type='order_separation' AND source_id=p_order_id AND status IN ('open','in_review'))
    );
  END IF;

  -- GD2 uses sealed-sack stock, never the legacy grams inventory.
  FOR v_item IN
    SELECT oi.id,oi.quantity,oi.commercial_quantity,oi.commercial_presentation_id
    FROM public.order_items oi WHERE oi.order_id=p_order_id AND oi.commercial_presentation_id='8dd3b126-36bd-4bb2-a695-bdbfefdc8507'::uuid
    ORDER BY oi.id
  LOOP
    IF v_item.quantity<>1 OR v_item.commercial_quantity<>1 THEN
      RAISE EXCEPTION 'glucodry_gd2_one_sealed_sack_per_order_line';
    END IF;
    SELECT ss.storage_location_id INTO v_inventory
      FROM public.glucodry_sealed_stock ss
      WHERE ss.sacks>0 ORDER BY ss.storage_location_id LIMIT 1 FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'glucodry_gd2_no_sealed_sacks_available';
    END IF;
    PERFORM public.glucodry_move_sealed_internal(v_inventory.storage_location_id,-1,
      'order_stock_event',p_order_id,'order:'||p_order_id::text||':sealed_out:'||v_item.id::text,
      'Separação: saída física de 1 saco Glucodry lacrado');
    v_movement_count:=v_movement_count+1;
  END LOOP;

  -- M13: original 25kg sacks never consume loose grams.
  FOR v_item IN
    SELECT oi.id,oi.product_id,oi.variant_id,oi.quantity,oi.commercial_quantity
    FROM public.order_items oi WHERE oi.order_id=p_order_id AND oi.commercial_presentation_id='2bad0e25-0000-4000-8000-000000002500'::uuid
    ORDER BY oi.id
  LOOP
    IF v_item.product_id<>'78fd74e2-1dc8-4c10-94a3-e661de6f8ba8'::uuid OR v_item.variant_id IS NOT NULL
       OR v_item.quantity<>v_item.commercial_quantity
       OR v_item.quantity<>trunc(v_item.quantity) OR v_item.quantity<1
    THEN RAISE EXCEPTION 'malto_original_sack_order_invalid';END IF;
    FOR v_remaining IN 1..v_item.quantity::integer LOOP
      SELECT ss.storage_location_id INTO v_inventory
      FROM public.maltodextrina_sealed_stock ss WHERE ss.sacks>0
      ORDER BY ss.storage_location_id LIMIT 1 FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'malto_no_sealed_sacks_available'; END IF;
      PERFORM public.maltodextrina_move_sealed_internal(v_inventory.storage_location_id,-1,
        'order_stock_event',p_order_id,
        'order:'||p_order_id::text||':malto_sealed:'||v_item.id::text||':'||v_remaining::text,
        'Saída física de saco original Maltodextrina 25kg');
      v_movement_count:=v_movement_count+1;
    END LOOP;
  END LOOP;

  -- CB3 physically ships ORIGINAL sealed 20kg bags, never draws opened grams.
  FOR v_item IN
    SELECT oi.id,oi.product_id,oi.variant_id,oi.quantity,oi.commercial_quantity,
           oi.commercial_presentation_id
    FROM public.order_items oi
    WHERE oi.order_id=p_order_id AND oi.commercial_presentation_id IN
      ('c8b30000-0000-4000-8000-000000000001'::uuid,'c8b30000-0000-4000-8000-000000000002'::uuid)
    ORDER BY oi.id
  LOOP
    IF v_item.product_id<>'c70dd4b4-bc59-4d88-81ef-1a8c47315560'::uuid
      OR NOT ((v_item.commercial_presentation_id='c8b30000-0000-4000-8000-000000000001'::uuid AND v_item.variant_id='f6588f52-6e28-4ce9-b492-a95c847d5c0c'::uuid)
        OR (v_item.commercial_presentation_id='c8b30000-0000-4000-8000-000000000002'::uuid AND v_item.variant_id='1a3d59a6-4712-4afd-811a-5a72aad76fa9'::uuid))
      OR v_item.quantity<>v_item.commercial_quantity
      OR v_item.quantity<>trunc(v_item.quantity) OR v_item.quantity<1 THEN
      RAISE EXCEPTION 'cb3_order_requires_correct_sealed_cover_and_whole_sacks';
    END IF;
    FOR v_inventory IN
      SELECT ss.storage_location_id,ss.sacks
      FROM public.chocolate_sealed_stock ss
      WHERE ss.variant_id=v_item.variant_id AND ss.sacks>0 ORDER BY ss.storage_location_id FOR UPDATE
    LOOP
      EXIT WHEN v_item.quantity<=0;
      v_take:=least(v_item.quantity,v_inventory.sacks);
      PERFORM public.chocolate_move_sealed_internal(v_item.variant_id,v_inventory.storage_location_id,
        -(v_take::integer),'order_stock_event',p_order_id,
        'order:'||p_order_id::text||':cb3_out:'||v_item.id::text||':'||v_inventory.storage_location_id::text,
        'Expedição física de Chocolate Base CB3 em sacos lacrados');
      v_item.quantity:=v_item.quantity-v_take;
      v_movement_count:=v_movement_count+1;
    END LOOP;
    IF v_item.quantity>0 THEN RAISE EXCEPTION 'cb3_sealed_sacks_insufficient_for_shipment';END IF;
  END LOOP;

  -- AM3: saco ORIGINAL de 24kg sai do E24, nunca do EG em gramas.
  FOR v_item IN
    SELECT oi.id,oi.product_id,oi.variant_id,oi.quantity,oi.commercial_quantity,
           oi.commercial_presentation_id
    FROM public.order_items oi
    WHERE oi.order_id=p_order_id AND oi.commercial_presentation_id='a3400000-0000-4000-8000-000000002400'::uuid
    ORDER BY oi.id
  LOOP
    IF v_item.product_id<>'c177f332-a1c7-4276-9cef-7b81af920174'::uuid
      OR v_item.variant_id IS NOT NULL
      OR v_item.quantity<>v_item.commercial_quantity
      OR v_item.quantity IS NULL
      OR v_item.quantity<>trunc(v_item.quantity)
      OR v_item.quantity<1 THEN
      RAISE EXCEPTION 'am3_order_requires_whole_original_sealed_sacks';
    END IF;
    FOR v_inventory IN
      SELECT ss.storage_location_id,ss.sacks FROM public.amendoim_sealed_stock ss
      WHERE ss.sacks>0 ORDER BY ss.storage_location_id FOR UPDATE
    LOOP
      EXIT WHEN v_item.quantity<=0;
      v_take:=least(v_item.quantity,v_inventory.sacks);
      PERFORM public.amendoim_move_sealed_internal(v_inventory.storage_location_id,
        -(v_take::integer),'order_stock_event',p_order_id,
        'order:'||p_order_id::text||':am3_out:'||v_item.id::text||':'||v_inventory.storage_location_id::text,
        'Expedição de Amendoim Torrado AM3 em sacos originais lacrados');
      v_item.quantity:=v_item.quantity-v_take;
      v_movement_count:=v_movement_count+1;
    END LOOP;
    IF v_item.quantity>0 THEN
      RAISE EXCEPTION 'am3_insufficient_original_closed_sacks_for_shipment';
    END IF;
  END LOOP;

  FOR v_item IN
    SELECT oi.id,oi.variant_id,oi.quantity,oi.commercial_quantity
    FROM public.order_items oi JOIN public.commercial_presentations cp ON cp.id=oi.commercial_presentation_id
    WHERE oi.order_id=p_order_id AND oi.product_id='af7fe3c4-863c-4d1f-9fcd-b4ecb92e5322'::uuid
      AND cp.product_id='af7fe3c4-863c-4d1f-9fcd-b4ecb92e5322'::uuid AND cp.variant_id=oi.variant_id
      AND cp.composition_mode='single' AND cp.conversion_factor=100 AND cp.commercial_unit_label='pacote'
    ORDER BY oi.id
  LOOP
    IF v_item.commercial_quantity IS NULL OR v_item.commercial_quantity<1
      OR v_item.commercial_quantity<>trunc(v_item.commercial_quantity)
      OR v_item.quantity<>v_item.commercial_quantity*100 THEN
      RAISE EXCEPTION 'et1_order_requires_whole_p100'; END IF;
    v_remaining:=v_item.commercial_quantity;
    FOR v_inventory IN SELECT storage_location_id,packs FROM public.trufa_pack_sealed_stock
      WHERE variant_id=v_item.variant_id AND packs>0 ORDER BY storage_location_id FOR UPDATE LOOP
      EXIT WHEN v_remaining<=0;
      v_take:=least(v_remaining,v_inventory.packs);
      PERFORM public.trufa_pack_move_internal(v_item.variant_id,v_inventory.storage_location_id,
      -(v_take::integer),'ship','order:'||p_order_id::text||':p100:'||v_item.id::text||':'||v_inventory.storage_location_id::text,p_order_id);
      v_remaining:=v_remaining-v_take;v_movement_count:=v_movement_count+1;
    END LOOP;
    IF v_remaining>0 THEN RAISE EXCEPTION 'et1_insufficient_original_p100';END IF;
  END LOOP;

  FOR v_item IN
    SELECT oi.product_id,oi.variant_id,sum(oi.quantity) required_quantity,
           p.name product_name,pv.variant_name,COALESCE(pv.unit,p.unit) unit
    FROM public.order_items oi JOIN public.products p ON p.id=oi.product_id
    LEFT JOIN public.product_variants pv ON pv.id=oi.variant_id
    WHERE oi.order_id=p_order_id AND oi.commercial_presentation_id IS DISTINCT FROM '8dd3b126-36bd-4bb2-a695-bdbfefdc8507'::uuid
      AND oi.commercial_presentation_id IS DISTINCT FROM '2bad0e25-0000-4000-8000-000000002500'::uuid
      AND (oi.commercial_presentation_id IS NULL OR oi.commercial_presentation_id NOT IN ('c8b30000-0000-4000-8000-000000000001'::uuid,'c8b30000-0000-4000-8000-000000000002'::uuid))
      AND oi.commercial_presentation_id IS DISTINCT FROM 'a3400000-0000-4000-8000-000000002400'::uuid
      AND NOT (oi.product_id='af7fe3c4-863c-4d1f-9fcd-b4ecb92e5322'::uuid AND EXISTS(
        SELECT 1 FROM public.commercial_presentations cp WHERE cp.id=oi.commercial_presentation_id
        AND cp.product_id='af7fe3c4-863c-4d1f-9fcd-b4ecb92e5322'::uuid AND cp.variant_id=oi.variant_id
        AND cp.composition_mode='single' AND cp.conversion_factor=100 AND cp.commercial_unit_label='pacote'))
    GROUP BY oi.product_id,oi.variant_id,p.name,pv.variant_name,p.unit,pv.unit
    ORDER BY oi.product_id,oi.variant_id
  LOOP
    v_remaining:=v_item.required_quantity; v_applied:=0;
    FOR v_inventory IN
      SELECT id,location,quantity FROM public.inventory
      WHERE product_id=v_item.product_id AND variant_id IS NOT DISTINCT FROM v_item.variant_id AND quantity>0
      ORDER BY id FOR UPDATE
    LOOP
      EXIT WHEN v_remaining<=0;
      v_take:=LEAST(v_remaining,v_inventory.quantity);
      v_key:='order:'||p_order_id::text||':physical_out:'||v_item.product_id::text||':'||COALESCE(v_item.variant_id::text,'simple')||':'||COALESCE(v_inventory.location,'sem-localizacao');
      UPDATE public.inventory SET quantity=quantity-v_take,updated_at=now() WHERE id=v_inventory.id;
      INSERT INTO public.inventory_movements(
        product_id,variant_id,movement_type,quantity,previous_balance,new_balance,location,
        reference_type,reference_id,event_key,notes
      ) VALUES (
        v_item.product_id,v_item.variant_id,'out',v_take,v_inventory.quantity,v_inventory.quantity-v_take,
        v_inventory.location,'order_stock_event',p_order_id,v_key,'Saída física por expedição de pedido'
      );
      v_remaining:=v_remaining-v_take; v_applied:=v_applied+v_take; v_movement_count:=v_movement_count+1;
    END LOOP;

    IF v_remaining>0 THEN
      v_incident_key:='order_separation_shortage:'||p_order_id::text||':'||v_item.product_id::text||':'||COALESCE(v_item.variant_id::text,'simple');
      INSERT INTO public.operational_incidents(
        area,incident_type,status,severity,title,description,source_type,source_id,
        product_id,variant_id,expected_quantity,applied_quantity,pending_quantity,unit,event_key,metadata
      ) VALUES (
        'separation','stock_shortage','open','critical','Saída física com saldo sistêmico insuficiente',
        'A separação foi finalizada fisicamente; a diferença precisa ser regularizada no estoque.',
        'order_separation',p_order_id,v_item.product_id,v_item.variant_id,v_item.required_quantity,v_applied,v_remaining,
        v_item.unit,v_incident_key,
        jsonb_build_object('product_name',v_item.product_name,'variant_name',v_item.variant_name,'event',p_event)
      ) ON CONFLICT(event_key) DO UPDATE SET
        status='open',expected_quantity=EXCLUDED.expected_quantity,applied_quantity=EXCLUDED.applied_quantity,
        pending_quantity=EXCLUDED.pending_quantity,metadata=EXCLUDED.metadata,updated_at=now();
      v_shortages:=v_shortages||jsonb_build_array(jsonb_build_object(
        'product_id',v_item.product_id,'variant_id',v_item.variant_id,'product_name',v_item.product_name,
        'variant_name',v_item.variant_name,'unit',v_item.unit,'required_quantity',v_item.required_quantity,
        'applied_quantity',v_applied,'missing_quantity',v_remaining
      ));
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'event',p_event,'applied',true,'already_applied',false,'movement_count',v_movement_count,
    'adjustment_required',jsonb_array_length(v_shortages)>0,'shortages',v_shortages
  );
END; $function$

