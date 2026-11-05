-- UNAPPLIED: full candidate derived from LIVE pg_get_functiondef, snapshot 2026-11-04.
-- Requires P2 schema/internal RPC/dispatch adapter in DISPOSABLE DB first.
-- No production call, grant, migration or cutover authorized.
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
  OR EXISTS (SELECT 1 FROM public.p2_four_sealed_events WHERE reference_type='order_stock_event' AND reference_id=p_order_id)
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

  -- P2: route original physical presentations before generic grams.
  -- Mixed order remains one transaction; adapter errors abort all debits.
  FOR v_item IN
    SELECT oi.id,oi.product_id,oi.variant_id,oi.commercial_presentation_id,
           oi.commercial_quantity,oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id=p_order_id AND oi.product_id IN (
      '0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b'::uuid,
      '6f43ad65-74d5-4db9-b931-1ecd6d124987'::uuid,
      'ef118d1c-e7c7-45e3-b796-3a9908840f3c'::uuid,
      'd913f0f2-4893-4985-9976-fcd9119a57b1'::uuid)
    ORDER BY oi.id
  LOOP
    PERFORM public.p2_four_dispatch_adapter_candidate(
      v_item.product_id,v_item.variant_id,v_item.commercial_presentation_id,
      v_item.commercial_quantity,v_item.quantity,p_order_id,v_item.id
    );
    v_movement_count:=v_movement_count+1;
  END LOOP;

  FOR v_item IN
    SELECT oi.product_id,oi.variant_id,sum(oi.quantity) required_quantity,
           p.name product_name,pv.variant_name,COALESCE(pv.unit,p.unit) unit
    FROM public.order_items oi JOIN public.products p ON p.id=oi.product_id
    LEFT JOIN public.product_variants pv ON pv.id=oi.variant_id
    WHERE oi.order_id=p_order_id AND oi.product_id NOT IN (
      '0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b'::uuid,
      '6f43ad65-74d5-4db9-b931-1ecd6d124987'::uuid,
      'ef118d1c-e7c7-45e3-b796-3a9908840f3c'::uuid,
      'd913f0f2-4893-4985-9976-fcd9119a57b1'::uuid)
      AND oi.commercial_presentation_id IS DISTINCT FROM '8dd3b126-36bd-4bb2-a695-bdbfefdc8507'::uuid
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

