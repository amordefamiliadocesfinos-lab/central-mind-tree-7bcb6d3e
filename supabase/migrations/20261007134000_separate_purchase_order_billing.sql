-- Uso real 2026-10-07 — separar pedido, faturamento, pagamento e recebimento.
-- Verdades canônicas:
-- 1) confirmar pedido = pedido efetivamente realizado com fornecedor; marca ordered_at;
-- 2) faturamento = cria obrigação financeira, sem registrar pagamento;
-- 3) recebimento = fato físico e única entrada de estoque;
-- 4) pagamento continua no Financeiro, independente do status físico da compra.

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS billed_at timestamptz NULL;

ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_billing_status_check;

ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_billing_status_check
  CHECK (billing_status IN ('pending','invoiced'));

-- Compras históricas que já possuem obrigação financeira foram, por definição,
-- faturadas/financeiramente comprometidas no fluxo antigo.
UPDATE public.purchase_orders po
SET billing_status = 'invoiced',
    billed_at = COALESCE(
      po.billed_at,
      (
        SELECT min(fe.created_at)
        FROM public.financial_entries fe
        WHERE fe.purchase_order_id = po.id
          AND fe.type = 'pagar'
      ),
      po.ordered_at,
      po.created_at
    )
WHERE EXISTS (
  SELECT 1
  FROM public.financial_entries fe
  WHERE fe.purchase_order_id = po.id
    AND fe.type = 'pagar'
);

CREATE OR REPLACE FUNCTION public.guard_purchase_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_received_lines integer;
  v_fully_received_lines integer;
  v_item_count integer;
  v_cancel_authorized boolean;
  v_confirm_authorized boolean;
BEGIN
  IF new.status = old.status THEN
    RETURN new;
  END IF;

  v_cancel_authorized := coalesce(current_setting('app.purchase_cancel_authorized', true), '') = '1';
  v_confirm_authorized := coalesce(current_setting('app.purchase_confirm_authorized', true), '') = '1';

  IF old.status = 'rascunho' AND new.status = 'confirmado' THEN
    IF NOT v_confirm_authorized THEN
      RAISE EXCEPTION 'Compra em rascunho só pode ser confirmada pela rotina canônica de pedido.';
    END IF;
  ELSIF old.status = 'rascunho' AND new.status <> 'cancelado' THEN
    RAISE EXCEPTION 'Compra em rascunho deve ser confirmada antes de avançar.';
  ELSIF old.status = 'confirmado' AND new.status NOT IN ('em_transito','parcialmente_recebido','recebido','cancelado') THEN
    RAISE EXCEPTION 'Transição inválida para compra confirmada.';
  ELSIF old.status = 'em_transito' AND new.status NOT IN ('parcialmente_recebido','recebido','cancelado') THEN
    RAISE EXCEPTION 'Transição inválida para compra em trânsito.';
  ELSIF old.status = 'parcialmente_recebido' AND new.status <> 'recebido' THEN
    RAISE EXCEPTION 'Compra parcialmente recebida só pode avançar para recebido.';
  ELSIF old.status IN ('recebido','cancelado') THEN
    RAISE EXCEPTION 'Compra recebida ou cancelada não pode mudar de status.';
  END IF;

  -- Estados físicos dependem apenas de recebimentos confirmados, nunca de faturamento/pagamento.
  IF new.status IN ('parcialmente_recebido','recebido') THEN
    SELECT count(*) INTO v_item_count
    FROM public.purchase_order_items
    WHERE purchase_order_id = new.id;

    SELECT
      count(*) FILTER (WHERE coalesce(r.received_qty,0) > 0),
      count(*) FILTER (WHERE coalesce(r.received_qty,0) >= i.ordered_purchase_qty)
    INTO v_received_lines, v_fully_received_lines
    FROM public.purchase_order_items i
    LEFT JOIN (
      SELECT pri.purchase_order_item_id, sum(pri.received_purchase_qty) AS received_qty
      FROM public.purchase_receipt_items pri
      JOIN public.purchase_receipts pr
        ON pr.id = pri.purchase_receipt_id
       AND pr.status = 'confirmed'
      GROUP BY pri.purchase_order_item_id
    ) r ON r.purchase_order_item_id = i.id
    WHERE i.purchase_order_id = new.id;

    IF new.status = 'parcialmente_recebido' AND v_received_lines = 0 THEN
      RAISE EXCEPTION 'Status parcialmente recebido exige recebimento físico confirmado.';
    END IF;

    IF new.status = 'recebido' AND (v_item_count = 0 OR v_fully_received_lines <> v_item_count) THEN
      RAISE EXCEPTION 'Status recebido exige recebimento comercial total confirmado.';
    END IF;
  END IF;

  IF new.status = 'cancelado' AND old.status <> 'rascunho' THEN
    IF NOT v_cancel_authorized THEN
      RAISE EXCEPTION 'Compra confirmada só pode ser cancelada pela rotina canônica de cancelamento.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.purchase_receipts
      WHERE purchase_order_id = new.id
        AND status = 'confirmed'
    ) THEN
      RAISE EXCEPTION 'Compra com recebimento físico confirmado exige reversão antes do cancelamento.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.financial_entries
      WHERE purchase_order_id = new.id
        AND lifecycle_status = 'active'
    ) THEN
      RAISE EXCEPTION 'Cancele as obrigações financeiras pela rotina canônica antes de cancelar a compra.';
    END IF;
  END IF;

  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_purchase_billing_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF new.billing_status IS DISTINCT FROM old.billing_status
     OR new.billed_at IS DISTINCT FROM old.billed_at THEN
    IF coalesce(current_setting('app.purchase_billing_authorized', true), '') <> '1' THEN
      RAISE EXCEPTION 'Faturamento da compra só pode ser alterado pela rotina canônica.';
    END IF;
  END IF;
  RETURN new;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_purchase_billing_fields ON public.purchase_orders;
CREATE TRIGGER trg_guard_purchase_billing_fields
BEFORE UPDATE OF billing_status, billed_at ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.guard_purchase_billing_fields();

CREATE OR REPLACE FUNCTION public.confirm_purchase_order(
  p_purchase_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_purchase public.purchase_orders%ROWTYPE;
  v_total numeric(20,2);
BEGIN
  IF auth.role() <> 'service_role'
     AND COALESCE(public.current_app_user_role(), '') NOT IN ('Administrador','VENDA','LIDER PRODUÇÃO') THEN
    RAISE EXCEPTION 'operations_order_write_required';
  END IF;

  SELECT * INTO v_purchase
  FROM public.purchase_orders
  WHERE id = p_purchase_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido de compra não encontrado.';
  END IF;

  IF v_purchase.status = 'confirmado' THEN
    RETURN jsonb_build_object(
      'purchase_order_id', v_purchase.id,
      'status', v_purchase.status,
      'already_confirmed', true,
      'ordered_at', v_purchase.ordered_at
    );
  END IF;

  IF v_purchase.status <> 'rascunho' THEN
    RAISE EXCEPTION 'Somente compras em rascunho podem ser confirmadas como pedido.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.purchase_order_items
    WHERE purchase_order_id = p_purchase_order_id
  ) THEN
    RAISE EXCEPTION 'A compra precisa ter ao menos um item antes da confirmação.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.purchase_order_items
    WHERE purchase_order_id = p_purchase_order_id
      AND unit_price IS NULL
  ) THEN
    RAISE EXCEPTION 'Todos os itens precisam ter preço comercial antes da confirmação.';
  END IF;

  SELECT round(
    coalesce(sum(ordered_purchase_qty * unit_price),0)
      + coalesce(v_purchase.freight_amount,0),
    2
  )
  INTO v_total
  FROM public.purchase_order_items
  WHERE purchase_order_id = p_purchase_order_id;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'O total comercial da compra deve ser maior que zero.';
  END IF;

  PERFORM set_config('app.purchase_confirm_authorized', '1', true);

  UPDATE public.purchase_orders
  SET status = 'confirmado',
      ordered_at = coalesce(ordered_at, now()),
      updated_at = now()
  WHERE id = p_purchase_order_id
  RETURNING * INTO v_purchase;

  RETURN jsonb_build_object(
    'purchase_order_id', v_purchase.id,
    'status', v_purchase.status,
    'already_confirmed', false,
    'ordered_at', v_purchase.ordered_at,
    'billing_status', v_purchase.billing_status,
    'commercial_total', v_total
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.confirm_purchase_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_purchase_order(uuid) TO authenticated, service_role;

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

REVOKE ALL ON FUNCTION public.register_purchase_billing(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_purchase_billing(uuid,jsonb) TO authenticated, service_role;

-- O fluxo combinado antigo deixa de ser caminho operacional para usuários autenticados.
REVOKE EXECUTE ON FUNCTION public.confirm_purchase_with_financial_entries(uuid,jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_purchase_with_financial_entries(uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_purchase_with_financial_entries(
  p_purchase_order_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_purchase public.purchase_orders%ROWTYPE;
  v_cancelled_count integer;
BEGIN
  IF auth.role() <> 'service_role'
     AND COALESCE(public.current_app_user_role(), '') NOT IN ('Administrador','VENDA','LIDER PRODUÇÃO') THEN
    RAISE EXCEPTION 'operations_order_write_required';
  END IF;

  SELECT * INTO v_purchase
  FROM public.purchase_orders
  WHERE id = p_purchase_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido de compra não encontrado.';
  END IF;

  IF v_purchase.status = 'cancelado' THEN
    RETURN jsonb_build_object(
      'purchase_order_id', p_purchase_order_id,
      'status', 'cancelado',
      'already_cancelled', true
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.purchase_receipts
    WHERE purchase_order_id = p_purchase_order_id
      AND status = 'confirmed'
  ) THEN
    RAISE EXCEPTION 'Compra com recebimento físico confirmado não pode ser cancelada sem reversão de estoque.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.financial_entries fe
    WHERE fe.purchase_order_id = p_purchase_order_id
      AND (
        coalesce(fe.value_paid,0) > 0
        OR EXISTS (
          SELECT 1 FROM public.financial_movements fm
          WHERE fm.entry_id = fe.id
        )
      )
  ) THEN
    RAISE EXCEPTION 'Compra com pagamento parcial ou total exige regularização financeira antes do cancelamento.';
  END IF;

  PERFORM set_config('app.purchase_cancel_authorized', '1', true);

  UPDATE public.financial_entries
  SET lifecycle_status = 'cancelled',
      cancelled_at = now(),
      cancelled_reason = coalesce(nullif(trim(p_reason),''), 'Compra cancelada pela rotina canônica.'),
      updated_at = now()
  WHERE purchase_order_id = p_purchase_order_id
    AND lifecycle_status = 'active';
  GET DIAGNOSTICS v_cancelled_count = ROW_COUNT;

  UPDATE public.purchase_orders
  SET status = 'cancelado',
      updated_at = now()
  WHERE id = p_purchase_order_id;

  RETURN jsonb_build_object(
    'purchase_order_id', p_purchase_order_id,
    'status', 'cancelado',
    'already_cancelled', false,
    'cancelled_financial_entries', v_cancelled_count
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_purchase_with_financial_entries(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_purchase_with_financial_entries(uuid,text) TO authenticated, service_role;

COMMENT ON FUNCTION public.confirm_purchase_order(uuid) IS
  'Confirma o pedido comercial com fornecedor e marca ordered_at. Não cria financeiro nem altera estoque.';
COMMENT ON FUNCTION public.register_purchase_billing(uuid,jsonb) IS
  'Registra faturamento/condição financeira de pedido já confirmado e cria contas a pagar. Não registra pagamento nem estoque.';
