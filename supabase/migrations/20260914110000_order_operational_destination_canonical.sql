-- F12.1: o Pedido é a fonte canônica do destino operacional.
-- order_separation conserva apenas o estado físico de separação e impressão.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS operational_destination text,
  ADD COLUMN IF NOT EXISTS logistics_mode text,
  ADD COLUMN IF NOT EXISTS operational_destination_details jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_operational_destination_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_operational_destination_check
  CHECK (operational_destination IS NULL OR operational_destination IN (
    'retirada_fabrica',
    'transportadora',
    'entrega_propria',
    'uber_entrega',
    'correios',
    'marketplace_logistica',
    'academia_ponto_logistico',
    'outro'
  ));

-- Preserva dados históricos sem transformar order_separation em autoridade futura.
UPDATE public.orders AS o
SET operational_destination = CASE os.operational_destination
  WHEN 'academia_ponto_logistico' THEN 'academia_ponto_logistico'
  WHEN 'retirada_fabrica' THEN 'retirada_fabrica'
  WHEN 'uber' THEN 'uber_entrega'
  WHEN 'outro' THEN 'outro'
  ELSE NULL
END
FROM public.order_separation AS os
WHERE os.order_id = o.id
  AND o.operational_destination IS NULL
  AND os.operational_destination IS NOT NULL;

UPDATE public.orders AS o
SET logistics_mode = os.logistics_mode
FROM public.order_separation AS os
WHERE os.order_id = o.id
  AND o.logistics_mode IS NULL
  AND os.logistics_mode IS NOT NULL;

-- Mantém o contrato unificado de venda: a venda cria demanda comercial e pode
-- receber destino operacional sem executar baixa física de estoque.
CREATE OR REPLACE FUNCTION public.create_unified_sale(p_order jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_item jsonb;
  v_total numeric := 0;
  v_subtotal numeric := 0;
  v_discount numeric := GREATEST(COALESCE((p_order->>'discount_amount')::numeric, 0), 0);
  v_shipping numeric := GREATEST(COALESCE((p_order->>'shipping_amount')::numeric, 0), 0);
  v_financial_id uuid;
  v_category_id uuid;
  v_payment_status text := COALESCE(NULLIF(p_order->>'payment_status', ''), 'pendente');
  v_financial_due date := COALESCE(NULLIF(p_order->>'financial_due_date', '')::date, current_date);
  v_sale_origin text := COALESCE(NULLIF(btrim(p_order->>'sale_origin'), ''), 'operacoes');
  v_sale_request_key uuid := NULLIF(btrim(p_order->>'sale_request_key'), '')::uuid;
  v_crm_order_confirmed boolean := COALESCE((p_order->>'crm_order_confirmed')::boolean, false);
  v_operational_destination text := NULLIF(btrim(p_order->>'operational_destination'), '');
  v_logistics_mode text := NULLIF(btrim(p_order->>'logistics_mode'), '');
  v_operational_destination_details jsonb := COALESCE(p_order->'operational_destination_details', '{}'::jsonb);
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Adicione ao menos um produto à venda.'; END IF;
  IF v_payment_status NOT IN ('pendente', 'pago', 'parcial') THEN RAISE EXCEPTION 'Situação financeira inválida.'; END IF;
  IF v_operational_destination IS NOT NULL AND v_operational_destination NOT IN ('retirada_fabrica', 'transportadora', 'entrega_propria', 'uber_entrega', 'correios', 'marketplace_logistica', 'academia_ponto_logistico', 'outro') THEN RAISE EXCEPTION 'Destino operacional inválido.'; END IF;
  IF jsonb_typeof(v_operational_destination_details) <> 'object' THEN RAISE EXCEPTION 'Detalhes do destino operacional inválidos.'; END IF;
  IF v_sale_request_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('unified-sale:' || v_sale_request_key::text));
    SELECT * INTO v_order FROM public.orders WHERE sale_request_key = v_sale_request_key LIMIT 1;
    IF FOUND THEN
      SELECT id INTO v_financial_id FROM public.financial_entries WHERE order_id = v_order.id AND type = 'receber' ORDER BY created_at LIMIT 1;
      RETURN jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'financial_entry_id', v_financial_id, 'total_value', v_order.total_value, 'already_registered', true);
    END IF;
  END IF;
  SELECT COALESCE(sum(GREATEST(COALESCE((x->>'quantity')::numeric, 0), 0) * GREATEST(COALESCE((x->>'unit_price')::numeric, 0), 0)), 0) INTO v_subtotal FROM jsonb_array_elements(p_items) x;
  v_total := GREATEST(v_subtotal - v_discount + v_shipping, 0);
  IF v_total <= 0 THEN RAISE EXCEPTION 'O total da venda deve ser maior que zero.'; END IF;
  IF v_payment_status = 'pago' AND NULLIF(p_order->>'financial_account_id', '') IS NULL THEN RAISE EXCEPTION 'Selecione a conta que recebeu o pagamento.'; END IF;
  INSERT INTO public.orders (order_number, customer_name, customer_contact, contact_id, channel, status, total_value, order_date, due_date, delivery_date, financial_due_date, notes, order_type, payment_status, payment_method, financial_account_id, discount_amount, shipping_amount, marketplace_account, channel_account_id, sale_origin, sale_request_key, operational_destination, logistics_mode, operational_destination_details)
  VALUES (COALESCE(NULLIF(p_order->>'order_number', ''), 'PED-' || floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint), NULLIF(p_order->>'customer_name', ''), NULLIF(p_order->>'customer_contact', ''), NULLIF(p_order->>'contact_id', '')::uuid, COALESCE(NULLIF(p_order->>'channel', ''), 'direto'), 'pendente', v_total, COALESCE(NULLIF(p_order->>'order_date', '')::date, current_date), NULLIF(p_order->>'delivery_date', '')::date, NULLIF(p_order->>'delivery_date', '')::date, v_financial_due, NULLIF(p_order->>'notes', ''), COALESCE(NULLIF(p_order->>'order_type', ''), 'production'), v_payment_status, NULLIF(p_order->>'payment_method', ''), NULLIF(p_order->>'financial_account_id', '')::uuid, v_discount, v_shipping, NULLIF(p_order->>'marketplace_account', ''), NULLIF(p_order->>'channel_account_id', '')::uuid, v_sale_origin, v_sale_request_key, v_operational_destination, v_logistics_mode, v_operational_destination_details)
  RETURNING * INTO v_order;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF NULLIF(v_item->>'product_id', '') IS NULL OR COALESCE((v_item->>'quantity')::numeric, 0) <= 0 THEN RAISE EXCEPTION 'Produto ou quantidade inválida.'; END IF;
    INSERT INTO public.order_items(order_id, product_id, variant_id, quantity, unit_price, notes)
    VALUES (v_order.id, (v_item->>'product_id')::uuid, NULLIF(v_item->>'variant_id', '')::uuid, (v_item->>'quantity')::numeric, COALESCE((v_item->>'unit_price')::numeric, 0), NULLIF(v_item->>'notes', ''));
  END LOOP;
  SELECT id INTO v_category_id FROM public.financial_categories WHERE is_active = true AND type IN ('receber', 'ambos') AND lower(name) IN ('venda de produtos', 'vendas') ORDER BY CASE WHEN lower(name) = 'venda de produtos' THEN 0 ELSE 1 END LIMIT 1;
  INSERT INTO public.financial_entries (type, description, value, due_date, original_due_date, competence_date, order_id, contact_id, category_id, account_id, payment_method, sales_channel, marketplace_account, notes)
  VALUES ('receber', 'Pedido ' || v_order.order_number || ' - ' || COALESCE(v_order.customer_name, 'Cliente'), v_total, v_financial_due, v_financial_due, v_order.order_date, v_order.id, v_order.contact_id, v_category_id, v_order.financial_account_id, v_order.payment_method, v_order.channel, v_order.marketplace_account, 'Gerado automaticamente pelo fluxo unificado de venda') RETURNING id INTO v_financial_id;
  IF v_payment_status = 'pago' THEN INSERT INTO public.financial_movements(entry_id, account_id, value, movement_date, notes) VALUES (v_financial_id, v_order.financial_account_id, v_total, COALESCE(NULLIF(p_order->>'payment_date', '')::date, current_date), 'Recebimento registrado na venda'); END IF;
  IF v_crm_order_confirmed AND v_order.contact_id IS NOT NULL THEN
    UPDATE public.contacts SET funnel_status = 'fechado', updated_at = now() WHERE id = v_order.contact_id;
    INSERT INTO public.contact_history (contact_id, event_type, interaction_type, event_code, description, interaction_date, event_metadata)
    VALUES (v_order.contact_id, 'sale_won', 'venda', 'sale_won', 'Venda registrada — pedido ' || v_order.order_number || ' · resultado CRM-RES-021', now(), jsonb_build_object('result_code', 'CRM-RES-021', 'order_id', v_order.id, 'sale_origin', v_sale_origin));
  END IF;
  RETURN jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'financial_entry_id', v_financial_id, 'total_value', v_total, 'already_registered', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_unified_sale(jsonb, jsonb) TO authenticated;
