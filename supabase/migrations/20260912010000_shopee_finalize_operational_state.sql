-- FASE 9: pedidos Shopee importados já representam expedição física.
-- A baixa continua exclusivamente no motor canônico; esta RPC apenas
-- consolida a verdade operacional depois que a baixa for bem-sucedida.

CREATE OR REPLACE FUNCTION public.import_shopee_order_with_stock(p_order jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_item jsonb;
  v_external_order_id text := NULLIF(trim(p_order->>'external_order_id'), '');
  v_channel_account_id uuid := NULLIF(trim(p_order->>'channel_account_id'), '')::uuid;
  v_requested_account text := NULLIF(trim(p_order->>'marketplace_account'), '');
  v_account text;
  v_total numeric := GREATEST(COALESCE((p_order->>'commercial_total')::numeric, 0), 0);
  v_items_total numeric := 0;
  v_stock_result jsonb;
  v_existing_id uuid;
  v_contact_id uuid;
  v_contact_matches uuid[];
  v_document_raw text := COALESCE(p_order->>'document', '');
  v_phone_raw text := COALESCE(p_order->>'customer_contact', '');
  v_recipient_name text := NULLIF(trim(p_order->>'customer_name'), '');
  v_document text;
  v_phone text;
BEGIN
  IF v_external_order_id IS NULL THEN
    RAISE EXCEPTION 'ID externo é obrigatório.';
  END IF;

  IF v_channel_account_id IS NULL AND v_requested_account IS NOT NULL THEN
    SELECT ca.id, ca.name INTO v_channel_account_id, v_account
    FROM public.channel_accounts ca
    JOIN public.digital_platforms dp ON dp.id = ca.platform_id
    WHERE ca.is_active AND dp.is_active AND dp.group_type = 'marketplace'
      AND dp.parent_id IS NULL AND lower(dp.name) LIKE 'shopee%'
      AND lower(btrim(ca.name)) = lower(btrim(v_requested_account));
  ELSE
    SELECT ca.name INTO v_account
    FROM public.channel_accounts ca
    JOIN public.digital_platforms dp ON dp.id = ca.platform_id
    WHERE ca.id = v_channel_account_id AND ca.is_active AND dp.is_active
      AND dp.group_type = 'marketplace' AND dp.parent_id IS NULL
      AND lower(dp.name) LIKE 'shopee%';
  END IF;

  IF v_account IS NULL THEN
    RAISE EXCEPTION 'Conta Shopee não cadastrada ou inativa na fonte canônica.';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'O pedido Shopee precisa ter ao menos um item.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('shopee:' || v_account || ':' || v_external_order_id));
  SELECT id INTO v_existing_id
  FROM public.orders
  WHERE order_number = v_external_order_id AND channel = 'shopee'
    AND lower(btrim(COALESCE(marketplace_account, ''))) = lower(btrim(v_account))
    AND deleted_at IS NULL
  LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('order_id', v_existing_id, 'already_imported', true, 'movement_count', 0);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF NULLIF(v_item->>'product_id', '') IS NULL
      OR COALESCE((v_item->>'quantity')::numeric, 0) <= 0
      OR COALESCE((v_item->>'physical_multiplier')::numeric, 0) <= 0 THEN
      RAISE EXCEPTION 'Item Shopee sem produto mestre, quantidade ou multiplicador válidos.';
    END IF;
    v_items_total := v_items_total
      + GREATEST(COALESCE((v_item->>'commercial_quantity')::numeric, 0), 0)
      * GREATEST(COALESCE((v_item->>'unit_price')::numeric, 0), 0);
  END LOOP;
  IF v_total = 0 THEN v_total := v_items_total; END IF;

  v_document := regexp_replace(v_document_raw, '\D', '', 'g');
  IF position('*' IN v_document_raw) = 0 AND length(v_document) >= 11 THEN
    SELECT array_agg(id) INTO v_contact_matches
    FROM (SELECT id FROM public.contacts WHERE regexp_replace(COALESCE(document, ''), '\D', '', 'g') = v_document LIMIT 2) matches;
    IF COALESCE(array_length(v_contact_matches, 1), 0) = 1 THEN v_contact_id := v_contact_matches[1]; END IF;
  END IF;
  IF v_contact_id IS NULL THEN
    v_phone := regexp_replace(v_phone_raw, '\D', '', 'g');
    IF position('*' IN v_phone_raw) = 0 AND length(v_phone) >= 10 THEN
      SELECT array_agg(id) INTO v_contact_matches
      FROM (SELECT id FROM public.contacts WHERE phone_normalized = v_phone LIMIT 2) matches;
      IF COALESCE(array_length(v_contact_matches, 1), 0) = 1 THEN v_contact_id := v_contact_matches[1]; END IF;
    END IF;
  END IF;
  IF v_contact_id IS NULL AND v_recipient_name IS NOT NULL THEN
    INSERT INTO public.contacts (name, type, funnel_status, document, phone, whatsapp)
    VALUES (
      v_recipient_name, 'cliente', NULL,
      CASE WHEN position('*' IN v_document_raw) = 0 AND length(v_document) >= 11 THEN v_document ELSE NULL END,
      CASE WHEN position('*' IN v_phone_raw) = 0 AND length(v_phone) >= 10 THEN v_phone ELSE NULL END,
      CASE WHEN position('*' IN v_phone_raw) = 0 AND length(v_phone) >= 10 THEN v_phone ELSE NULL END
    ) RETURNING id INTO v_contact_id;
  END IF;

  INSERT INTO public.orders (
    order_number, customer_name, customer_contact, contact_id, channel, channel_account_id,
    marketplace_account, status, total_value, order_date, due_date, delivery_date,
    discount_amount, shipping_amount, notes, order_type, delivery_snapshot, marketplace_metadata
  ) VALUES (
    v_external_order_id, COALESCE(v_recipient_name, NULLIF(p_order->>'buyer_username', '')),
    NULLIF(v_phone_raw, ''), v_contact_id, 'shopee', v_channel_account_id, v_account,
    'enviado', v_total,
    COALESCE(NULLIF(left(p_order->>'order_date', 10), '')::date, current_date),
    COALESCE(NULLIF(left(p_order->>'shipping_at', 10), '')::date, NULLIF(left(p_order->>'order_date', 10), '')::date, current_date),
    NULLIF(left(p_order->>'shipping_at', 10), '')::date,
    GREATEST(COALESCE((p_order->>'seller_discount')::numeric, 0), 0),
    GREATEST(COALESCE((p_order->>'shipping_fee')::numeric, 0), 0),
    'Importado via XLSX Shopee.', 'stock',
    jsonb_strip_nulls(jsonb_build_object(
      'recipient_name', v_recipient_name, 'document', NULLIF(v_document_raw, ''),
      'phone', NULLIF(v_phone_raw, ''), 'address', NULLIF(p_order->>'address', ''),
      'number', NULLIF(p_order->>'address_number', ''), 'complement', NULLIF(p_order->>'address_complement', ''),
      'neighborhood', NULLIF(p_order->>'neighborhood', ''), 'city', NULLIF(p_order->>'city', ''),
      'state', NULLIF(p_order->>'state', ''), 'zip_code', NULLIF(p_order->>'zip_code', '')
    )),
    jsonb_strip_nulls(jsonb_build_object(
      'marketplace', 'shopee', 'account', v_account,
      'external_status', NULLIF(p_order->>'external_status', ''),
      'tracking_number', NULLIF(p_order->>'tracking_number', ''),
      'buyer_username', NULLIF(p_order->>'buyer_username', ''),
      'paid_at', NULLIF(p_order->>'paid_at', ''), 'shipping_at', NULLIF(p_order->>'shipping_at', '')
    ))
  ) RETURNING * INTO v_order;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.order_items (order_id, product_id, variant_id, quantity, unit_price, notes)
    VALUES (
      v_order.id, (v_item->>'product_id')::uuid, NULLIF(v_item->>'variant_id', '')::uuid,
      (v_item->>'quantity')::numeric, COALESCE((v_item->>'unit_price')::numeric, 0),
      concat_ws(' | ', 'Shopee comercial: ' || COALESCE(v_item->>'commercial_quantity', '0'),
        'Multiplicador físico: ' || COALESCE(v_item->>'physical_multiplier', '0'),
        NULLIF(v_item->>'external_item_key', ''), NULLIF(v_item->>'variation', ''), NULLIF(v_item->>'product_title', ''))
    );
  END LOOP;

  -- Se houver falta ou qualquer outro erro na saída física, a exceção aborta
  -- toda a transação antes de consolidar status operacional ou Separação.
  v_stock_result := public.apply_order_stock_event(v_order.id, 'external_shipped');

  UPDATE public.orders
  SET operational_status = 'finalized', updated_at = now()
  WHERE id = v_order.id;

  -- Shopee já chega como expedida: não há impressão local fictícia nem uma
  -- segunda etapa manual. A reconciliação preserva os campos de impressão.
  INSERT INTO public.order_separation (
    order_id, separation_status, finalized_at, finalized_by
  ) VALUES (
    v_order.id, 'finalized', now(), auth.uid()
  )
  ON CONFLICT (order_id) DO UPDATE
  SET separation_status = 'finalized',
      finalized_at = COALESCE(public.order_separation.finalized_at, now()),
      finalized_by = COALESCE(public.order_separation.finalized_by, auth.uid()),
      updated_at = now();

  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'already_imported', false,
    'movement_count', COALESCE((v_stock_result->>'movement_count')::integer, 0),
    'contact_id', v_contact_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_shopee_order_with_stock(jsonb, jsonb) TO authenticated;
