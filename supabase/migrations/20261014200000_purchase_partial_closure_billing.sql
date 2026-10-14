-- PR #256: faturamento de compra parcialmente encerrada preservando o contrato de cartão.
CREATE OR REPLACE FUNCTION public.register_purchase_billing(
  p_purchase_order_id uuid,
  p_installments jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_purchase public.purchase_orders%ROWTYPE;
  v_supplier_name text;
  v_total numeric(20,2);
  v_installments_total numeric(20,2);
  v_installment_count integer;
  v_distinct_installment_count integer;
  v_min_installment integer;
  v_max_installment integer;
  v_existing_count integer;
  v_entry_ids jsonb;
BEGIN
  IF auth.role() <> 'service_role'
     AND COALESCE(public.current_app_user_role(), '') NOT IN ('Administrador','VENDA','LIDER PRODUÇÃO') THEN
    RAISE EXCEPTION 'operations_order_write_required';
  END IF;

  IF p_installments IS NULL
     OR jsonb_typeof(p_installments) <> 'array'
     OR jsonb_array_length(p_installments) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos uma parcela financeira.';
  END IF;

  SELECT * INTO v_purchase
  FROM public.purchase_orders
  WHERE id = p_purchase_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido de compra não encontrado.';
  END IF;

  IF v_purchase.status IN ('rascunho','cancelado') THEN
    RAISE EXCEPTION 'O pedido precisa estar confirmado e não cancelado antes do faturamento.';
  END IF;

  IF v_purchase.billing_status = 'invoiced' THEN
    SELECT coalesce(jsonb_agg(id ORDER BY purchase_installment_number), '[]'::jsonb)
    INTO v_entry_ids
    FROM public.financial_entries
    WHERE purchase_order_id = p_purchase_order_id
      AND type = 'pagar';

    RETURN jsonb_build_object(
      'purchase_order_id', p_purchase_order_id,
      'billing_status', 'invoiced',
      'already_invoiced', true,
      'billed_at', v_purchase.billed_at,
      'financial_entry_ids', v_entry_ids
    );
  END IF;

  SELECT count(*) INTO v_existing_count
  FROM public.financial_entries
  WHERE purchase_order_id = p_purchase_order_id;

  IF v_existing_count > 0 THEN
    RAISE EXCEPTION 'Esta compra já possui obrigações financeiras vinculadas e exige regularização explícita.';
  END IF;

  SELECT round(
    coalesce(sum(ordered_purchase_qty * unit_price),0)
      + coalesce(v_purchase.freight_amount,0),
    2
  )
  INTO v_total
  FROM public.purchase_order_items
  WHERE purchase_order_id = p_purchase_order_id;

  IF EXISTS (SELECT 1 FROM public.purchase_final_closures WHERE purchase_order_id = p_purchase_order_id) THEN
    SELECT effective_amount INTO v_total FROM public.purchase_final_closures
    WHERE purchase_order_id = p_purchase_order_id;
  END IF;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'O total comercial da compra deve ser maior que zero.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_installments) AS installment
    WHERE (installment->>'installment_number') IS NULL
       OR (installment->>'value') IS NULL
       OR (installment->>'due_date') IS NULL
       OR (installment->>'installment_number') !~ '^[0-9]+$'
       OR (installment->>'value') !~ '^[0-9]+([.][0-9]{1,2})?$'
       OR (installment->>'due_date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       OR (installment->>'installment_number')::integer <= 0
       OR (installment->>'value')::numeric <= 0
  ) THEN
    RAISE EXCEPTION 'Parcelas inválidas. Informe número, valor positivo e vencimento válido.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_installments) installment
    WHERE (installment ? 'account_id' OR installment ? 'payment_method')
      AND (coalesce(installment->>'payment_method','') <> 'cartao'
        OR coalesce(installment->>'account_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}
  FROM jsonb_array_elements(p_installments) AS installment;

  SELECT
    count(*)::integer,
    count(DISTINCT (installment->>'installment_number')::integer)::integer,
    min((installment->>'installment_number')::integer),
    max((installment->>'installment_number')::integer),
    round(sum((installment->>'value')::numeric),2)
  INTO
    v_installment_count,
    v_distinct_installment_count,
    v_min_installment,
    v_max_installment,
    v_installments_total
  FROM jsonb_array_elements(p_installments) AS installment;

  IF v_distinct_installment_count <> v_installment_count
     OR v_min_installment <> 1
     OR v_max_installment <> v_installment_count THEN
    RAISE EXCEPTION 'As parcelas devem ser numeradas sequencialmente a partir de 1, sem duplicidade.';
  END IF;

  IF v_installments_total <> v_total THEN
    RAISE EXCEPTION 'A soma das parcelas (%) deve ser igual ao total comercial da compra (%).',
      v_installments_total, v_total;
  END IF;

  SELECT name INTO v_supplier_name
  FROM public.contacts
  WHERE id = v_purchase.supplier_contact_id;

  WITH inserted AS (
    INSERT INTO public.financial_entries (
      type,
      description,
      value,
      due_date,
      contact_id,
      document_number,
      notes,
      purchase_order_id,
      purchase_installment_number,
      payment_method,
      account_id
    )
    SELECT
      'pagar',
      format(
        'Compra %s — %s · Parcela %s/%s',
        coalesce(v_purchase.internal_purchase_number, left(v_purchase.id::text,8)),
        coalesce(v_supplier_name,'Fornecedor'),
        (installment->>'installment_number')::integer,
        v_installment_count
      ),
      round((installment->>'value')::numeric,2),
      (installment->>'due_date')::date,
      v_purchase.supplier_contact_id,
      v_purchase.internal_purchase_number,
      'Gerado automaticamente no faturamento da compra. Não representa pagamento.',
      p_purchase_order_id,
      (installment->>'installment_number')::integer,
      nullif(installment->>'payment_method',''),
      nullif(installment->>'account_id','')::uuid
    FROM jsonb_array_elements(p_installments) AS installment
    ORDER BY (installment->>'installment_number')::integer
    RETURNING id, purchase_installment_number
  )
  SELECT coalesce(jsonb_agg(id ORDER BY purchase_installment_number), '[]'::jsonb)
  INTO v_entry_ids
  FROM inserted;

  PERFORM set_config('app.purchase_billing_authorized', '1', true);

  UPDATE public.purchase_orders
  SET billing_status = 'invoiced',
      billed_at = coalesce(billed_at, now()),
      updated_at = now()
  WHERE id = p_purchase_order_id
  RETURNING * INTO v_purchase;

  RETURN jsonb_build_object(
    'purchase_order_id', p_purchase_order_id,
    'billing_status', v_purchase.billing_status,
    'already_invoiced', false,
    'billed_at', v_purchase.billed_at,
    'commercial_total', v_total,
    'financial_entry_ids', v_entry_ids
  );
END;
$function$;

        OR NOT EXISTS(
          SELECT 1 FROM public.financial_accounts fa
          WHERE fa.id=(installment->>'account_id')::uuid
            AND fa.type='cartao' AND fa.is_active=true
        )
      )
  ) THEN
    RAISE EXCEPTION 'Cartão financeiro inválido ou inativo.';
  END IF;

  PERFORM (installment->>'due_date')::date
  FROM jsonb_array_elements(p_installments) AS installment;

  SELECT
    count(*)::integer,
    count(DISTINCT (installment->>'installment_number')::integer)::integer,
    min((installment->>'installment_number')::integer),
    max((installment->>'installment_number')::integer),
    round(sum((installment->>'value')::numeric),2)
  INTO
    v_installment_count,
    v_distinct_installment_count,
    v_min_installment,
    v_max_installment,
    v_installments_total
  FROM jsonb_array_elements(p_installments) AS installment;

  IF v_distinct_installment_count <> v_installment_count
     OR v_min_installment <> 1
     OR v_max_installment <> v_installment_count THEN
    RAISE EXCEPTION 'As parcelas devem ser numeradas sequencialmente a partir de 1, sem duplicidade.';
  END IF;

  IF v_installments_total <> v_total THEN
    RAISE EXCEPTION 'A soma das parcelas (%) deve ser igual ao total comercial da compra (%).',
      v_installments_total, v_total;
  END IF;

  SELECT name INTO v_supplier_name
  FROM public.contacts
  WHERE id = v_purchase.supplier_contact_id;

  WITH inserted AS (
    INSERT INTO public.financial_entries (
      type,
      description,
      value,
      due_date,
      contact_id,
      document_number,
      notes,
      purchase_order_id,
      purchase_installment_number
    )
    SELECT
      'pagar',
      format(
        'Compra %s — %s · Parcela %s/%s',
        coalesce(v_purchase.internal_purchase_number, left(v_purchase.id::text,8)),
        coalesce(v_supplier_name,'Fornecedor'),
        (installment->>'installment_number')::integer,
        v_installment_count
      ),
      round((installment->>'value')::numeric,2),
      (installment->>'due_date')::date,
      v_purchase.supplier_contact_id,
      v_purchase.internal_purchase_number,
      'Gerado automaticamente no faturamento da compra. Não representa pagamento.',
      p_purchase_order_id,
      (installment->>'installment_number')::integer
    FROM jsonb_array_elements(p_installments) AS installment
    ORDER BY (installment->>'installment_number')::integer
    RETURNING id, purchase_installment_number
  )
  SELECT coalesce(jsonb_agg(id ORDER BY purchase_installment_number), '[]'::jsonb)
  INTO v_entry_ids
  FROM inserted;

  PERFORM set_config('app.purchase_billing_authorized', '1', true);

  UPDATE public.purchase_orders
  SET billing_status = 'invoiced',
      billed_at = coalesce(billed_at, now()),
      updated_at = now()
  WHERE id = p_purchase_order_id
  RETURNING * INTO v_purchase;

  RETURN jsonb_build_object(
    'purchase_order_id', p_purchase_order_id,
    'billing_status', v_purchase.billing_status,
    'already_invoiced', false,
    'billed_at', v_purchase.billed_at,
    'commercial_total', v_total,
    'financial_entry_ids', v_entry_ids
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.register_purchase_billing(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.register_purchase_billing(uuid,jsonb) TO authenticated,service_role;
