-- Central de Separação V1: camada física independente do status comercial
-- do pedido. A saída de estoque continua sendo responsabilidade exclusiva do
-- contrato OP-01 (apply_order_stock_event).

CREATE TABLE IF NOT EXISTS public.order_separation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  separation_status text NOT NULL DEFAULT 'todo'
    CHECK (separation_status IN ('todo', 'preparing', 'finalized')),
  operational_destination text NULL
    CHECK (operational_destination IN ('academia_ponto_logistico', 'retirada_fabrica', 'uber', 'outro')),
  logistics_mode text NULL,
  first_printed_at timestamptz NULL,
  first_printed_by uuid NULL,
  print_count integer NOT NULL DEFAULT 0 CHECK (print_count >= 0),
  finalized_at timestamptz NULL,
  finalized_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('order_pdf', 'shipping_label', 'declaration', 'receipt', 'other')),
  file_url text NOT NULL,
  file_name text NULL,
  source text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL
);

CREATE INDEX IF NOT EXISTS order_separation_status_idx
  ON public.order_separation(separation_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS order_documents_order_id_idx
  ON public.order_documents(order_id, created_at DESC);

DROP TRIGGER IF EXISTS update_order_separation_updated_at ON public.order_separation;
CREATE TRIGGER update_order_separation_updated_at
  BEFORE UPDATE ON public.order_separation
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.order_separation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users manage order separation"
  ON public.order_separation FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users manage order documents"
  ON public.order_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Backfill apenas dos pedidos operacionais ainda ativos; não infere destino.
INSERT INTO public.order_separation (order_id)
SELECT o.id
FROM public.orders o
WHERE o.deleted_at IS NULL
  AND o.status NOT IN ('cancelado', 'concluido')
ON CONFLICT (order_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.mark_order_separation_printed(p_order_id uuid)
RETURNS public.order_separation
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_separation public.order_separation;
BEGIN
  INSERT INTO public.order_separation (order_id, separation_status, first_printed_at, first_printed_by, print_count)
  VALUES (p_order_id, 'preparing', now(), auth.uid(), 1)
  ON CONFLICT (order_id) DO UPDATE
  SET separation_status = CASE
        WHEN public.order_separation.separation_status = 'todo' THEN 'preparing'
        ELSE public.order_separation.separation_status
      END,
      first_printed_at = COALESCE(public.order_separation.first_printed_at, now()),
      first_printed_by = COALESCE(public.order_separation.first_printed_by, auth.uid()),
      print_count = public.order_separation.print_count + 1
  RETURNING * INTO v_separation;

  RETURN v_separation;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_order_separation(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_separation public.order_separation;
  v_stock_result jsonb;
BEGIN
  INSERT INTO public.order_separation (order_id)
  VALUES (p_order_id)
  ON CONFLICT (order_id) DO NOTHING;

  SELECT * INTO v_separation
  FROM public.order_separation
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF v_separation.separation_status = 'finalized' THEN
    RETURN jsonb_build_object('already_finalized', true, 'stock_result', NULL);
  END IF;

  -- Não cria inventory_movements aqui: reutiliza o motor OP-01, cuja chave de
  -- evento impede baixa dupla inclusive se o pedido já tiver sido expedido.
  v_stock_result := public.apply_order_stock_event(p_order_id, 'shipped');

  UPDATE public.order_separation
  SET separation_status = 'finalized',
      finalized_at = now(),
      finalized_by = auth.uid()
  WHERE order_id = p_order_id;

  RETURN jsonb_build_object('already_finalized', false, 'stock_result', v_stock_result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_order_separation_printed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_order_separation(uuid) TO authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.order_separation;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.order_documents;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;
