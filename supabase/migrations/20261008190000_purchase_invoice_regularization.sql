-- Regularização explícita de compra faturada a partir de NF-e.
-- Permite corrigir preços/vencimentos somente quando:
-- - compra já confirmada e não cancelada;
-- - não há recebimento físico confirmado;
-- - não há pagamento/conciliação/movimento financeiro registrado;
-- - a soma das parcelas coincide com o total comercial corrigido.
-- Preserva a trilha por notas no pedido e nas obrigações financeiras.

CREATE OR REPLACE FUNCTION public.guard_confirmed_purchase_items()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_purchase_order_id uuid;
  v_status text;
  v_regularization_authorized boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_purchase_order_id := OLD.purchase_order_id;
  ELSE
    v_purchase_order_id := NEW.purchase_order_id;
  END IF;

  SELECT status INTO v_status
  FROM public.purchase_orders
  WHERE id = v_purchase_order_id;

  v_regularization_authorized :=
    COALESCE(current_setting('app.purchase_regularization_authorized', true), '') = '1';

  IF v_status IS NOT NULL
     AND v_status <> 'rascunho'
     AND NOT v_regularization_authorized THEN
    RAISE EXCEPTION 'Itens comerciais da compra são imutáveis após a confirmação. Regularização explícita é necessária.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_purchase_financial_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_cancel_authorized boolean;
  v_regularization_authorized boolean;
BEGIN
  IF OLD.purchase_order_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Obrigação financeira vinculada a compra não pode ser excluída; o histórico deve ser preservado.';
  END IF;

  v_regularization_authorized :=
    COALESCE(current_setting('app.purchase_regularization_authorized', true), '') = '1';

  -- Vínculos estruturais permanecem imutáveis mesmo durante regularização.
  IF NEW.purchase_order_id IS DISTINCT FROM OLD.purchase_order_id
     OR NEW.purchase_installment_number IS DISTINCT FROM OLD.purchase_installment_number
     OR NEW.type IS DISTINCT FROM OLD.type THEN
    RAISE EXCEPTION 'Vínculo estrutural da obrigação da compra não pode ser alterado.';
  END IF;

  IF (
    NEW.value IS DISTINCT FROM OLD.value
    OR NEW.due_date IS DISTINCT FROM OLD.due_date
  ) AND NOT v_regularization_authorized THEN
    RAISE EXCEPTION 'Valor e vencimento da obrigação da compra exigem regularização explícita.';
  END IF;

  IF OLD.lifecycle_status = 'active' AND NEW.lifecycle_status = 'cancelled' THEN
    v_cancel_authorized := COALESCE(current_setting('app.purchase_cancel_authorized', true), '') = '1';
    IF NOT v_cancel_authorized THEN
      RAISE EXCEPTION 'Obrigação vinculada a compra só pode ser cancelada pela rotina canônica da compra.';
    END IF;
    IF COALESCE(OLD.value_paid,0) > 0 OR EXISTS (
      SELECT 1
      FROM public.financial_movements
      WHERE entry_id = OLD.id
    ) THEN
      RAISE EXCEPTION 'Obrigação com pagamento registrado não pode ser cancelada automaticamente.';
    END IF;
  END IF;

  IF OLD.lifecycle_status = 'cancelled'
     AND NEW.lifecycle_status <> OLD.lifecycle_status THEN
    RAISE EXCEPTION 'Obrigação cancelada não pode ser reativada sem regularização explícita.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.regularize_purchase_invoice_values(
  p_purchase_order_id uuid,
  p_item_prices jsonb,
  p_installments jsonb,
  p_invoice_date date,
  p_invoice_number text,
  p_invoice_series text,
  p_access_key text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_purchase public.purchase_orders%ROWTYPE;
  v_item jsonb;
  v_installment jsonb;
  v_existing_financial_count integer;
  v_installment_count integer;
  v_total numeric(20,2);
  v_installments_total numeric(20,2);
  v_note text;
BEGIN
  IF auth.role() <> 'service_role'
     AND COALESCE(public.current_app_user_role(), '') NOT IN ('Administrador','LIDER PRODUÇÃO') THEN
    RAISE EXCEPTION 'purchase_regularization_manager_required';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Informe o motivo da regularização.';
  END IF;

  IF p_invoice_date IS NULL THEN
    RAISE EXCEPTION 'Informe a data da NF-e.';
  END IF;

  IF p_item_prices IS NULL
     OR jsonb_typeof(p_item_prices) <> 'array'
     OR jsonb_array_length(p_item_prices) = 0 THEN
    RAISE EXCEPTION 'Informe os preços confirmados pela NF-e.';
  END IF;

  IF p_installments IS NULL
     OR jsonb_typeof(p_installments) <> 'array'
     OR jsonb_array_length(p_installments) = 0 THEN
    RAISE EXCEPTION 'Informe as parcelas confirmadas pela NF-e.';
  END IF;

  SELECT * INTO v_purchase
  FROM public.purchase_orders
  WHERE id = p_purchase_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido de compra não encontrado.';
  END IF;

  IF v_purchase.status IN ('rascunho','cancelado') THEN
    RAISE EXCEPTION 'A regularização exige compra confirmada e não cancelada.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.purchase_receipts
    WHERE purchase_order_id = p_purchase_order_id
      AND status = 'confirmed'
  ) THEN
    RAISE EXCEPTION 'Compra com recebimento físico confirmado não pode ter valores comerciais regularizados automaticamente.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.financial_entries fe
    WHERE fe.purchase_order_id = p_purchase_order_id
      AND (
        COALESCE(fe.value_paid,0) > 0
        OR fe.payment_date IS NOT NULL
        OR COALESCE(fe.is_conciliated,false) = true
        OR EXISTS (
          SELECT 1
          FROM public.financial_movements fm
          WHERE fm.entry_id = fe.id
        )
      )
  ) THEN
    RAISE EXCEPTION 'Compra com pagamento ou conciliação registrada exige regularização financeira manual.';
  END IF;

  v_installment_count := jsonb_array_length(p_installments);

  SELECT count(*)
  INTO v_existing_financial_count
  FROM public.financial_entries
  WHERE purchase_order_id = p_purchase_order_id
    AND type = 'pagar'
    AND lifecycle_status = 'active';

  IF v_existing_financial_count <> v_installment_count THEN
    RAISE EXCEPTION 'A quantidade de parcelas da NF-e (%) difere das obrigações ativas atuais (%). Revisão manual necessária.',
      v_installment_count, v_existing_financial_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_item_prices) x
    LEFT JOIN public.purchase_order_items poi
      ON poi.id = (x->>'purchase_order_item_id')::uuid
     AND poi.purchase_order_id = p_purchase_order_id
    WHERE poi.id IS NULL
       OR (x->>'unit_price') IS NULL
       OR (x->>'unit_price') !~ '^[0-9]+([.][0-9]{1,10})?$'
       OR (x->>'unit_price')::numeric <= 0
  ) THEN
    RAISE EXCEPTION 'Itens/preços inválidos para esta compra.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_installments) x
    LEFT JOIN public.financial_entries fe
      ON fe.purchase_order_id = p_purchase_order_id
     AND fe.purchase_installment_number = (x->>'installment_number')::integer
     AND fe.type = 'pagar'
     AND fe.lifecycle_status = 'active'
    WHERE fe.id IS NULL
       OR (x->>'installment_number') IS NULL
       OR (x->>'value') IS NULL
       OR (x->>'due_date') IS NULL
       OR (x->>'installment_number') !~ '^[0-9]+$'
       OR (x->>'value') !~ '^[0-9]+([.][0-9]{1,2})?$'
       OR (x->>'due_date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       OR (x->>'value')::numeric <= 0
  ) THEN
    RAISE EXCEPTION 'Parcelas inválidas ou incompatíveis com as obrigações atuais.';
  END IF;

  PERFORM set_config('app.purchase_regularization_authorized', '1', true);
  PERFORM set_config('app.purchase_billing_authorized', '1', true);

  FOR v_item IN
    SELECT * FROM jsonb_array_elements(p_item_prices)
  LOOP
    UPDATE public.purchase_order_items
    SET unit_price = (v_item->>'unit_price')::numeric
    WHERE id = (v_item->>'purchase_order_item_id')::uuid
      AND purchase_order_id = p_purchase_order_id;
  END LOOP;

  SELECT round(
    COALESCE(sum(ordered_purchase_qty * unit_price),0)
      + COALESCE(v_purchase.freight_amount,0),
    2
  )
  INTO v_total
  FROM public.purchase_order_items
  WHERE purchase_order_id = p_purchase_order_id;

  SELECT round(sum((x->>'value')::numeric),2)
  INTO v_installments_total
  FROM jsonb_array_elements(p_installments) x;

  IF v_installments_total <> v_total THEN
    RAISE EXCEPTION 'A soma das parcelas da NF-e (%) deve ser igual ao total comercial corrigido (%).',
      v_installments_total, v_total;
  END IF;

  v_note := format(
    'Regularização pela NF-e %s%s em %s. Motivo: %s. Chave: %s.',
    COALESCE(NULLIF(btrim(p_invoice_number),''),'sem número'),
    CASE
      WHEN NULLIF(btrim(p_invoice_series),'') IS NULL THEN ''
      ELSE ' Série ' || btrim(p_invoice_series)
    END,
    to_char(p_invoice_date,'DD/MM/YYYY'),
    btrim(p_reason),
    COALESCE(NULLIF(btrim(p_access_key),''),'não informada')
  );

  FOR v_installment IN
    SELECT * FROM jsonb_array_elements(p_installments)
  LOOP
    UPDATE public.financial_entries
    SET value = round((v_installment->>'value')::numeric,2),
        due_date = (v_installment->>'due_date')::date,
        issue_date = p_invoice_date,
        notes = concat_ws(E'\n', nullif(notes,''), v_note),
        updated_at = now()
    WHERE purchase_order_id = p_purchase_order_id
      AND type = 'pagar'
      AND lifecycle_status = 'active'
      AND purchase_installment_number = (v_installment->>'installment_number')::integer;
  END LOOP;

  UPDATE public.purchase_orders
  SET billed_at = (p_invoice_date::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      notes = concat_ws(E'\n', nullif(notes,''), '[REGULARIZAÇÃO NF-e] ' || v_note),
      updated_at = now()
  WHERE id = p_purchase_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'purchase_order_id', p_purchase_order_id,
    'commercial_total', v_total,
    'installments_total', v_installments_total,
    'invoice_date', p_invoice_date,
    'invoice_number', p_invoice_number,
    'invoice_series', p_invoice_series
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.regularize_purchase_invoice_values(uuid,jsonb,jsonb,date,text,text,text,text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.regularize_purchase_invoice_values(uuid,jsonb,jsonb,date,text,text,text,text)
TO authenticated, service_role;

COMMENT ON FUNCTION public.regularize_purchase_invoice_values(uuid,jsonb,jsonb,date,text,text,text,text) IS
  'Regulariza preços e parcelas de compra confirmada/faturada com base em NF-e, somente antes de recebimento e pagamento.';
