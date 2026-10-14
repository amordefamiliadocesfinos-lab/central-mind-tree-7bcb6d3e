-- F6-I verification. Execute only inside an explicit transaction and ROLLBACK.
BEGIN;

-- Test-only trigger: assign a synthetic internal number before the real numbering
-- trigger, so nextval() cannot leave a persistent sequence increment on rollback.
CREATE TEMP TABLE f6i_test_context (marker integer) ON COMMIT DROP;
CREATE FUNCTION pg_temp.f6i_test_internal_number()
RETURNS trigger LANGUAGE plpgsql AS $test$
BEGIN
  IF NEW.order_number LIKE 'F6I-VALIDATION-%' THEN
    NEW.internal_order_number := NEW.order_number;
  END IF;
  RETURN NEW;
END;
$test$;
CREATE TRIGGER aaa_f6i_test_internal_number BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION pg_temp.f6i_test_internal_number();

CREATE TEMP TABLE f6i_sequence_before AS
SELECT last_value, is_called FROM public.orders_internal_number_seq;
CREATE TEMP TABLE f6i_prohibited_before (
  table_name text PRIMARY KEY, row_count bigint, fingerprint text
) ON COMMIT DROP;
DO $baseline$
DECLARE v_table text; v_count bigint; v_hash text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['inventory', 'inventory_movements', 'financial_entries',
    'financial_movements', 'contacts', 'contact_history', 'service_conversations', 'production_orders']
  LOOP
    EXECUTE format('SELECT count(*), md5(coalesce(string_agg(to_jsonb(x)::text, ''|'' ORDER BY to_jsonb(x)::text), '''')) FROM public.%I x', v_table)
      INTO v_count, v_hash;
    INSERT INTO f6i_prohibited_before VALUES (v_table, v_count, v_hash);
  END LOOP;
END;
$baseline$;

DO $$
DECLARE
  v_order_number text := 'F6I-VALIDATION-261014';
  v_channel_account_id uuid := '8a8ad166-0317-4597-8be6-e43fb46b4d1b';
  v_product_id uuid := '92088a70-8cc0-40ef-a39d-564603df6866';
  v_first jsonb;
  v_second jsonb;
  v_order_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.orders
  WHERE channel = 'shopee'
    AND channel_account_id = v_channel_account_id
    AND order_number = v_order_number) THEN
    RAISE EXCEPTION 'F6-I validation identity already exists; do not delete existing data';
  END IF;

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
      AND commercial_presentation_id IS NULL
      AND commercial_presentation_name IS NULL
      AND commercial_unit_label IS NULL
      AND commercial_conversion_factor IS NULL
      AND commercial_quantity IS NULL
      AND physical_unit_label IS NULL
      AND unit_price = 0.0399
  ) THEN
    RAISE EXCEPTION 'F6-I physical order item / commercial snapshot contract mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.order_separation
    WHERE order_id = v_order_id
      AND separation_status = 'todo'
  ) THEN
    RAISE EXCEPTION 'F6-I separation TODO missing';
  END IF;

  IF (SELECT count(*) FROM public.order_separation WHERE order_id = v_order_id) <> 1 THEN
    RAISE EXCEPTION 'F6-I separation count mismatch';
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
    OR (v_second->>'order_id')::uuid <> v_order_id
    OR v_second->>'separation_id' IS DISTINCT FROM v_first->>'separation_id' THEN
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
  IF (SELECT count(*) FROM public.order_items WHERE order_id = v_order_id) <> 1
    OR (SELECT count(*) FROM public.order_separation WHERE order_id = v_order_id AND separation_status = 'todo') <> 1 THEN
    RAISE EXCEPTION 'F6-I duplicate items or separation created';
  END IF;
END $;

DO $alfajor_money$
DECLARE
  v_order_number text := 'F6I-VALIDATION-ALFAJOR-261014';
  v_channel_account_id uuid := '8a8ad166-0317-4597-8be6-e43fb46b4d1b';
  v_product_id uuid := '62cf9f63-be04-4261-ad11-569028dd1125';
  v_white uuid := 'd89e1dba-ca80-4136-b9f3-225fb80b6dfb';
  v_dark uuid := 'e4d756c8-f324-4ac0-b9ff-6adae24f5310';
  v_result jsonb;
  v_order_id uuid;
  v_stored_total numeric;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.orders
    WHERE channel = 'shopee'
      AND channel_account_id = v_channel_account_id
      AND order_number = v_order_number
  ) THEN
    RAISE EXCEPTION 'F6-I alfajor validation identity already exists';
  END IF;

  v_result := public.create_shopee_api_order(
    jsonb_build_object(
      'channel_account_id', v_channel_account_id,
      'marketplace_account', 'SHOPEE VIVIANE',
      'order_number', v_order_number,
      'order_date', '2026-10-14',
      'total_value', 40.42,
      'payment_method', 'Pix',
      'external_status', 'READY_TO_SHIP'
    ),
    jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product_id,
        'variant_id', v_white,
        'quantity', 6,
        'commercial_quantity', 2,
        'physical_multiplier', 3,
        'unit_price', 20.21,
        'external_item_key', 'code:SH-002-015|variation:',
        'item_id', '23298665306',
        'model_id', '0',
        'mapping_id', '11111111-1111-4111-8111-111111111111',
        'composition_position', 0
      ),
      jsonb_build_object(
        'product_id', v_product_id,
        'variant_id', v_dark,
        'quantity', 6,
        'commercial_quantity', 2,
        'physical_multiplier', 3,
        'unit_price', 0,
        'external_item_key', 'code:SH-002-015|variation:',
        'item_id', '23298665306',
        'model_id', '0',
        'mapping_id', '11111111-1111-4111-8111-111111111111',
        'composition_position', 1
      )
    )
  );

  v_order_id := (v_result->>'order_id')::uuid;

  SELECT sum(quantity::numeric * unit_price)
    INTO v_stored_total
  FROM public.order_items
  WHERE order_id = v_order_id;

  IF round(v_stored_total, 2) <> 40.42 THEN
    RAISE EXCEPTION 'F6-I alfajor monetary reconciliation mismatch: %', v_stored_total;
  END IF;

  IF (
    SELECT count(*)
    FROM public.order_items
    WHERE order_id = v_order_id
      AND commercial_presentation_id IS NULL
      AND commercial_presentation_name IS NULL
      AND commercial_unit_label IS NULL
      AND commercial_conversion_factor IS NULL
      AND commercial_quantity IS NULL
      AND physical_unit_label IS NULL
  ) <> 2 THEN
    RAISE EXCEPTION 'F6-I alfajor commercial snapshot must remain null';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.order_items
    WHERE order_id = v_order_id
      AND variant_id = v_white
      AND quantity = 6
      AND unit_price = 6.7366666667
  ) THEN
    RAISE EXCEPTION 'F6-I alfajor physical unit price precision mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.order_items
    WHERE order_id = v_order_id
      AND variant_id = v_dark
      AND quantity = 6
      AND unit_price = 0
  ) THEN
    RAISE EXCEPTION 'F6-I alfajor secondary composition line must keep zero price';
  END IF;
END;
$alfajor_money$;

DO $isolation$
DECLARE v_row record; v_count bigint; v_hash text;
BEGIN
  FOR v_row IN SELECT * FROM f6i_prohibited_before LOOP
    EXECUTE format('SELECT count(*), md5(coalesce(string_agg(to_jsonb(x)::text, ''|'' ORDER BY to_jsonb(x)::text), '''')) FROM public.%I x', v_row.table_name)
      INTO v_count, v_hash;
    IF v_count IS DISTINCT FROM v_row.row_count OR v_hash IS DISTINCT FROM v_row.fingerprint THEN
      RAISE EXCEPTION 'F6-I prohibited write on %', v_row.table_name;
    END IF;
  END LOOP;
  IF EXISTS (SELECT last_value, is_called FROM public.orders_internal_number_seq EXCEPT SELECT * FROM f6i_sequence_before) THEN
    RAISE EXCEPTION 'F6-I validation changed the persistent numbering sequence';
  END IF;
END;
$isolation$;

ROLLBACK;
