-- E8 — Motor Econômico Shopee V2: reconciliação append-only.
-- Previsto (snapshot E7) permanece imutável. Cada reconciliação é um novo registro histórico.

CREATE TABLE public.economic_prediction_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_snapshot_id uuid NOT NULL REFERENCES public.economic_prediction_snapshots(id) ON DELETE RESTRICT,
  reconciliation_version integer NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'partial', 'reconciled', 'inconclusive')),
  order_id uuid REFERENCES public.orders(id) ON DELETE RESTRICT,
  marketplace_settlement_id uuid REFERENCES public.marketplace_settlements(id) ON DELETE RESTRICT,
  financial_entry_id uuid REFERENCES public.financial_entries(id) ON DELETE RESTRICT,
  observed_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  financial_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  comparison_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  pending_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prediction_snapshot_id, reconciliation_version)
);

CREATE INDEX economic_prediction_reconciliations_snapshot_idx
  ON public.economic_prediction_reconciliations (
    prediction_snapshot_id,
    reconciliation_version DESC,
    created_at DESC
  );

CREATE INDEX economic_prediction_reconciliations_order_idx
  ON public.economic_prediction_reconciliations (order_id)
  WHERE order_id IS NOT NULL;

ALTER TABLE public.economic_prediction_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read economic prediction reconciliations"
  ON public.economic_prediction_reconciliations
  FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public.economic_prediction_reconciliations TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.economic_prediction_reconciliations FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.prevent_economic_prediction_reconciliation_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Economic prediction reconciliations are append-only.';
END;
$$;

CREATE TRIGGER prevent_economic_prediction_reconciliation_update
  BEFORE UPDATE ON public.economic_prediction_reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_economic_prediction_reconciliation_mutation();

CREATE TRIGGER prevent_economic_prediction_reconciliation_delete
  BEFORE DELETE ON public.economic_prediction_reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_economic_prediction_reconciliation_mutation();

REVOKE ALL ON FUNCTION public.prevent_economic_prediction_reconciliation_mutation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prevent_economic_prediction_reconciliation_mutation() TO authenticated;

CREATE OR REPLACE FUNCTION public.create_economic_prediction_reconciliation(
  p_prediction_snapshot_id uuid,
  p_status text,
  p_order_id uuid,
  p_marketplace_settlement_id uuid,
  p_financial_entry_id uuid,
  p_observed_snapshot jsonb,
  p_financial_snapshot jsonb,
  p_comparison_snapshot jsonb,
  p_pending_snapshot jsonb,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_version integer;
  v_snapshot public.economic_prediction_snapshots%ROWTYPE;
  v_order public.orders%ROWTYPE;
BEGIN
  IF auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF p_status NOT IN ('pending', 'partial', 'reconciled', 'inconclusive') THEN
    RAISE EXCEPTION 'Status de reconciliação inválido.';
  END IF;

  SELECT * INTO v_snapshot
  FROM public.economic_prediction_snapshots
  WHERE id = p_prediction_snapshot_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Snapshot econômico não encontrado.';
  END IF;

  IF p_order_id IS NOT NULL THEN
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id
      AND deleted_at IS NULL
      AND lower(COALESCE(channel, '')) = 'shopee';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Pedido Shopee não encontrado.';
    END IF;

    IF v_snapshot.channel_account_id IS NOT NULL
       AND v_order.channel_account_id IS DISTINCT FROM v_snapshot.channel_account_id THEN
      RAISE EXCEPTION 'Pedido pertence a outra Conta Shopee.';
    END IF;

    IF v_order.order_date < v_snapshot.created_at::date THEN
      RAISE EXCEPTION 'Pedido anterior ao congelamento não pode reconciliar previsão prospectiva.';
    END IF;

    IF v_snapshot.product_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.order_items oi
      WHERE oi.order_id = p_order_id
        AND oi.product_id = v_snapshot.product_id
        AND (
          v_snapshot.variant_id IS NULL
          OR oi.variant_id = v_snapshot.variant_id
        )
    ) THEN
      RAISE EXCEPTION 'Pedido não contém a identidade física do snapshot.';
    END IF;
  END IF;

  IF p_marketplace_settlement_id IS NOT NULL THEN
    IF p_order_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.marketplace_settlement_orders mso
      WHERE mso.settlement_id = p_marketplace_settlement_id
        AND mso.order_id = p_order_id
    ) THEN
      RAISE EXCEPTION 'Settlement não está vinculado ao Pedido selecionado.';
    END IF;
  END IF;

  IF p_financial_entry_id IS NOT NULL THEN
    IF p_order_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.financial_entries fe
      WHERE fe.id = p_financial_entry_id
        AND fe.type = 'receber'
        AND (
          fe.order_id = p_order_id
          OR EXISTS (
            SELECT 1
            FROM public.financial_order_links fol
            WHERE fol.financial_entry_id = fe.id
              AND fol.order_id = p_order_id
          )
        )
    ) THEN
      RAISE EXCEPTION 'Lançamento financeiro não está vinculado ao Pedido selecionado.';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('economic-reconciliation:' || p_prediction_snapshot_id::text));

  SELECT COALESCE(max(reconciliation_version), 0) + 1
    INTO v_version
  FROM public.economic_prediction_reconciliations
  WHERE prediction_snapshot_id = p_prediction_snapshot_id;

  INSERT INTO public.economic_prediction_reconciliations (
    prediction_snapshot_id,
    reconciliation_version,
    status,
    order_id,
    marketplace_settlement_id,
    financial_entry_id,
    observed_snapshot,
    financial_snapshot,
    comparison_snapshot,
    pending_snapshot,
    notes,
    created_by
  )
  VALUES (
    p_prediction_snapshot_id,
    v_version,
    p_status,
    p_order_id,
    p_marketplace_settlement_id,
    p_financial_entry_id,
    COALESCE(p_observed_snapshot, '{}'::jsonb),
    COALESCE(p_financial_snapshot, '{}'::jsonb),
    COALESCE(p_comparison_snapshot, '{}'::jsonb),
    COALESCE(p_pending_snapshot, '[]'::jsonb),
    p_notes,
    auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_economic_prediction_reconciliation(
  uuid, text, uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_economic_prediction_reconciliation(
  uuid, text, uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, text
) TO authenticated;
