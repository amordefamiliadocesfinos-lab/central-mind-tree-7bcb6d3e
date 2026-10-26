-- F6-Q.6D.1: retain deletion as an operational exclusion for Shopee import.
-- Scope: the API writer only. No records or stock movements are changed.
-- Reuse the previously approved F6-I function, adding a fail-closed tombstone guard.

CREATE OR REPLACE FUNCTION public.create_shopee_api_order(
  p_order jsonb,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel_account_id uuid := NULLIF(btrim(p_order->>'channel_account_id'), '')::uuid;
  v_requested_account text := p_order->>'marketplace_account';
  v_account text;
  v_order_number text := NULLIF(btrim(p_order->>'order_number'), '');
  v_order_date date := NULLIF(p_order->>'order_date', '')::date;
  v_total numeric := NULLIF(p_order->>'total_value', '')::numeric;
  v_payment_method text := NULLIF(btrim(p_order->>'payment_method'), '');
  v_external_status text := NULLIF(btrim(p_order->>'external_status'), '');
  v_order public.orders%ROWTYPE;
  v_item jsonb;
  v_existing_id uuid;
  v_existing_deleted_at timestamptz;
  v_separation_id uuid;
  v_position integer := 0;
  v_quantity numeric;
  v_commercial_quantity numeric;
  v_multiplier numeric;
  v_unit_price numeric;
BEGIN
  IF v_channel_account_id IS NULL OR v_order_number IS NULL OR v_order_date IS NULL THEN
    RAISE EXCEPTION 'F6-I: channel_account_id, order_number e order_date são obrigatórios.';
  END IF;

  IF length(v_order_number) > 300 THEN
    RAISE EXCEPTION 'F6-I: order_number excede o limite.';
  END IF;

  IF v_total IS NOT NULL AND (v_total < 0 OR v_total::text IN ('NaN', 'Infinity', '-Infinity')) THEN
    RAISE EXCEPTION 'F6-I: total_value inválido.';
  END IF;

  SELECT ca.name INTO v_account
  FROM public.channel_accounts ca
  JOIN public.digital_platforms dp ON dp.id = ca.platform_id
  WHERE ca.id = v_channel_account_id
    AND ca.is_active = true
    AND dp.is_active = true
    AND dp.group_type = 'marketplace'
    AND dp.parent_id IS NULL
    AND lower(dp.name) LIKE 'shopee%';

  IF v_account IS NULL THEN
    RAISE EXCEPTION 'F6-I: conta Shopee canônica não encontrada ou inativa.';
  END IF;

  IF v_requested_account IS NOT NULL AND v_requested_account <> v_account THEN
    RAISE EXCEPTION 'F6-I: marketplace_account diverge da conta canônica.';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'F6-I: o pedido precisa de ao menos um item.';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'F6-I: o pedido precisa de ao menos um item.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('shopee-api-order:' || v_channel_account_id::text || ':' || v_order_number));

  -- Any prior record, including soft-deleted, blocks silent recreation.
  SELECT id, deleted_at INTO v_existing_id, v_existing_deleted_at
  FROM public.orders
  WHERE channel = 'shopee'
    AND channel_account_id = v_channel_account_id
    AND order_number = v_order_number
  ORDER BY (deleted_at IS NULL) DESC, created_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL AND v_existing_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'F6-Q.6D.1: pedido Shopee excluido anteriormente; reimportacao automatica bloqueada.';
  END IF;

  IF v_existing_id IS NOT NULL THEN
    SELECT id INTO v_separation_id
    FROM public.order_separation
    WHERE order_id = v_existing_id;

    RETURN jsonb_build_object(
      'order_id', v_existing_id,
      'already_registered', true,
      'separation_id', v_separation_id
    );
  END IF;

  -- Validate every line before the first insert.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF NULLIF(btrim(v_item->>'product_id'), '') IS NULL THEN
      RAISE EXCEPTION 'F6-I: item sem product_id.';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = (v_item->>'product_id')::uuid
        AND p.deleted_at IS NULL
        AND p.is_active = true
    ) THEN
      RAISE EXCEPTION 'F6-I: product_id não pertence a produto ativo.';
    END IF;

    IF NULLIF(btrim(v_item->>'variant_id'), '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.product_variants pv
        WHERE pv.id = (v_item->>'variant_id')::uuid
          AND pv.product_id = (v_item->>'product_id')::uuid
          AND pv.is_active = true
      ) THEN
      RAISE EXCEPTION 'F6-I: variant_id não pertence ao produto informado.';
    END IF;

    v_quantity := NULLIF(v_item->>'quantity', '')::numeric;
    v_commercial_quantity := NULLIF(v_item->>'commercial_quantity', '')::numeric;
    v_multiplier := NULLIF(v_item->>'physical_multiplier', '')::numeric;
    v_unit_price := NULLIF(v_item->>'unit_price', '')::numeric;

    IF v_quantity IS NULL OR v_quantity <= 0 OR v_quantity > 2147483647
      OR v_quantity::text IN ('NaN', 'Infinity', '-Infinity') OR trunc(v_quantity) <> v_quantity THEN
      RAISE EXCEPTION 'F6-I: quantity física deve ser inteiro positivo.';
    END IF;
    IF v_commercial_quantity IS NULL OR v_commercial_quantity <= 0
      OR v_commercial_quantity::text IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'F6-I: commercial_quantity inválida.';
    END IF;
    IF v_multiplier IS NULL OR v_multiplier <= 0
      OR v_multiplier::text IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'F6-I: physical_multiplier inválido.';
    END IF;
    IF abs(v_quantity - (v_commercial_quantity * v_multiplier)) > 0.000001 THEN
      RAISE EXCEPTION 'F6-I: quantity diverge de commercial_quantity × physical_multiplier.';
    END IF;
    IF v_unit_price IS NOT NULL AND (v_unit_price < 0 OR v_unit_price::text IN ('NaN', 'Infinity', '-Infinity')) THEN
      RAISE EXCEPTION 'F6-I: unit_price inválido.';
    END IF;
  END LOOP;

  INSERT INTO public.orders (
    order_number,
    customer_name,
    customer_contact,
    contact_id,
    channel,
    channel_account_id,
    marketplace_account,
    status,
    operational_status,
    total_value,
    order_date,
    due_date,
    order_type,
    payment_status,
    payment_method,
    financial_account_id,
    discount_amount,
    shipping_amount,
    delivery_snapshot,
    marketplace_metadata,
    operational_destination,
    logistics_mode,
    operational_destination_details,
    sale_origin
  ) VALUES (
    v_order_number,
    NULL,
    NULL,
    NULL,
    'shopee',
    v_channel_account_id,
    v_account,
    'pendente',
    'todo',
    v_total,
    v_order_date,
    NULL,
    'stock',
    'pendente',
    v_payment_method,
    NULL,
    0,
    0,
    '{}'::jsonb,
    jsonb_strip_nulls(jsonb_build_object(
      'marketplace', 'shopee',
      'source', 'shopee_open_platform',
      'environment', 'live',
      'external_status', v_external_status
    )),
    NULL,
    NULL,
    '{}'::jsonb,
    'shopee_open_platform'
  )
  RETURNING * INTO v_order;

  -- Monetary precision policy:
  -- order_items.unit_price is numeric(20,10). Some commercial totals are not
  -- exactly divisible by physical quantity (for example 40.42 / 6).
  -- Persist the physical unit price at the column's 10-decimal precision and
  -- compare/reconcile monetary totals at currency precision (2 decimals).
  -- Literal decimal equality before monetary rounding is not a valid invariant.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_position := v_position + 1;

    INSERT INTO public.order_items (
      order_id,
      product_id,
      variant_id,
      quantity,
      unit_price,
      notes,
      commercial_presentation_id,
      commercial_presentation_name,
      commercial_unit_label,
      commercial_conversion_factor,
      commercial_quantity,
      physical_unit_label
    ) VALUES (
      v_order.id,
      (v_item->>'product_id')::uuid,
      NULLIF(btrim(v_item->>'variant_id'), '')::uuid,
      (v_item->>'quantity')::integer,
      CASE
        WHEN NULLIF(v_item->>'unit_price', '') IS NULL THEN NULL
        ELSE round((
          (v_item->>'commercial_quantity')::numeric
          * (v_item->>'unit_price')::numeric
        ) / (v_item->>'quantity')::numeric, 10)
      END,
      concat_ws(' | ',
        'Shopee Open Platform',
        'external_item_key=' || COALESCE(NULLIF(v_item->>'external_item_key', ''), 'null'),
        'item_id=' || COALESCE(NULLIF(v_item->>'item_id', ''), 'null'),
        'model_id=' || COALESCE(NULLIF(v_item->>'model_id', ''), 'null'),
        'mapping_id=' || COALESCE(NULLIF(v_item->>'mapping_id', ''), 'null'),
        'composition_position=' || COALESCE(NULLIF(v_item->>'composition_position', ''), (v_position - 1)::text),
        'commercial_quantity=' || COALESCE(NULLIF(v_item->>'commercial_quantity', ''), 'null'),
        'physical_multiplier=' || COALESCE(NULLIF(v_item->>'physical_multiplier', ''), 'null'),
        'external_commercial_unit_price=' || COALESCE(NULLIF(v_item->>'unit_price', ''), 'null')
      ),
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL
    );
  END LOOP;

  INSERT INTO public.order_separation (
    order_id,
    separation_status
  ) VALUES (
    v_order.id,
    'todo'
  )
  ON CONFLICT (order_id) DO NOTHING
  RETURNING id INTO v_separation_id;

  IF v_separation_id IS NULL THEN
    SELECT id INTO v_separation_id
    FROM public.order_separation
    WHERE order_id = v_order.id;
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'already_registered', false,
    'separation_id', v_separation_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_shopee_api_order(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_shopee_api_order(jsonb, jsonb) TO service_role;
