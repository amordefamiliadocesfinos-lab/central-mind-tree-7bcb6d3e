-- F6-I verification. Execute only inside an explicit transaction and ROLLBACK.
BEGIN;

DO $$
DECLARE
  v_order_number text := 'F6I-VALIDATION-261014';
  v_channel_account_id uuid := '8a8ad166-0317-4597-8be6-e43fb46b4d1b';
  v_product_id uuid := '92088a70-8cc0-40ef-a39d-564603df6866';
  v_first jsonb;
  v_second jsonb;
  v_order_id uuid;
BEGIN
  DELETE FROM public.orders
  WHERE channel = 'shopee'
    AND channel_account_id = v_channel_account_id
    AND order_number = v_order_number;

  v_first := public.create_shopee_api_order(
    jsonb_build_object(
      'channel_account_id', v_channel_account_id,
      'marketplace_account', 'SHOPEE VIVIANE',
      'order_number', v_order_number,
      'order_date', '2026-10-14',
      'total_value', 39.90,
      'payment_method', 'Pix',
      'external_status', 'READY_TO_SHIP'
    ),
    jsonb_build_array(jsonb_build_object(
      'product_id', v_product_id,
      'variant_id', NULL,
      'quantity', 1000,
      'commercial_quantity', 1,
      'physical_multiplier', 1000,
      'unit_price', 39.90,
      'external_item_key', 'code:SH-002-006|variation:1 kg',
      'item_id', '58261505740',
      'model_id', '149554569657',
      'mapping_id', 'dbc15870-e45a-4fe5-a86b-114208d1b5ed',
      'composition_position', 0
    ))
  );

  v_order_id := (v_first->>'order_id')::uuid;

  IF COALESCE((v_first->>'already_registered')::boolean, true) THEN
    RAISE EXCEPTION 'F6-I first write unexpectedly treated as duplicate';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = v_order_id
      AND order_number = v_order_number
      AND channel = 'shopee'
      AND channel_account_id = v_channel_account_id
      AND marketplace_account = 'SHOPEE VIVIANE'
      AND status = 'pendente'
      AND operational_status = 'todo'
      AND order_type = 'stock'
      AND payment_status = 'pendente'
      AND sale_origin = 'shopee_open_platform'
      AND contact_id IS NULL
  ) THEN
    RAISE EXCEPTION 'F6-I order contract mismatch';
  END IF;

  IF (
    SELECT count(*) FROM public.order_items WHERE order_id = v_order_id
  ) <> 1 THEN
    RAISE EXCEPTION 'F6-I order item count mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.order_items
    WHERE order_id = v_order_id
      AND product_id = v_product_id
      AND variant_id IS NULL
      AND quantity = 1000
      AND commercial_quantity = 1
      AND commercial_conversion_factor = 1000
      AND unit_price = 39.90
  ) THEN
    RAISE EXCEPTION 'F6-I order item contract mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.order_separation
    WHERE order_id = v_order_id
      AND separation_status = 'todo'
  ) THEN
    RAISE EXCEPTION 'F6-I separation TODO missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.inventory_movements
    WHERE reference_id = v_order_id
  ) THEN
    RAISE EXCEPTION 'F6-I prohibited stock movement detected';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.financial_entries
    WHERE order_id = v_order_id
  ) THEN
    RAISE EXCEPTION 'F6-I prohibited financial entry detected';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.production_orders
    WHERE source_order_id = v_order_id
  ) THEN
    RAISE EXCEPTION 'F6-I prohibited production order detected';
  END IF;

  v_second := public.create_shopee_api_order(
    jsonb_build_object(
      'channel_account_id', v_channel_account_id,
      'marketplace_account', 'SHOPEE VIVIANE',
      'order_number', v_order_number,
      'order_date', '2026-10-14',
      'total_value', 39.90,
      'payment_method', 'Pix',
      'external_status', 'READY_TO_SHIP'
    ),
    jsonb_build_array(jsonb_build_object(
      'product_id', v_product_id,
      'variant_id', NULL,
      'quantity', 1000,
      'commercial_quantity', 1,
      'physical_multiplier', 1000,
      'unit_price', 39.90,
      'external_item_key', 'code:SH-002-006|variation:1 kg',
      'item_id', '58261505740',
      'model_id', '149554569657',
      'mapping_id', 'dbc15870-e45a-4fe5-a86b-114208d1b5ed',
      'composition_position', 0
    ))
  );

  IF NOT COALESCE((v_second->>'already_registered')::boolean, false)
    OR (v_second->>'order_id')::uuid <> v_order_id THEN
    RAISE EXCEPTION 'F6-I idempotency mismatch';
  END IF;

  IF (
    SELECT count(*) FROM public.orders
    WHERE channel = 'shopee'
      AND channel_account_id = v_channel_account_id
      AND order_number = v_order_number
      AND deleted_at IS NULL
  ) <> 1 THEN
    RAISE EXCEPTION 'F6-I duplicate order created';
  END IF;
END $$;

ROLLBACK;
