-- G7 — atribuição econômica explícita de fatos financeiros a B6/B7.
-- Não duplica o fato financeiro: financial_entries continua soberana.
-- Esta tabela registra apenas a alocação econômica auditável do valor existente.

CREATE TABLE public.economic_financial_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_entry_id uuid NOT NULL REFERENCES public.financial_entries(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES public.orders(id) ON DELETE RESTRICT,
  incident_id uuid REFERENCES public.operational_incidents(id) ON DELETE RESTRICT,
  block text NOT NULL CHECK (block IN ('B6','B7')),
  subcategory text NOT NULL CHECK (btrim(subcategory) <> ''),
  effect text NOT NULL DEFAULT 'COST' CHECK (effect IN ('COST','RECOVERY','BENEFIT')),
  allocated_value numeric NOT NULL CHECK (allocated_value >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX economic_financial_attributions_entry_idx
  ON public.economic_financial_attributions(financial_entry_id);

CREATE INDEX economic_financial_attributions_order_idx
  ON public.economic_financial_attributions(order_id, block);

CREATE INDEX economic_financial_attributions_incident_idx
  ON public.economic_financial_attributions(incident_id, block);

CREATE UNIQUE INDEX economic_financial_attributions_unique_scope
  ON public.economic_financial_attributions(
    financial_entry_id,
    block,
    COALESCE(order_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(incident_id, '00000000-0000-0000-0000-000000000000'::uuid),
    subcategory,
    effect
  );

CREATE OR REPLACE FUNCTION public.assert_economic_financial_attribution()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_entry_value numeric;
  v_entry_status text;
  v_allocated numeric;
BEGIN
  IF NEW.block = 'B6' AND NEW.order_id IS NULL THEN
    RAISE EXCEPTION 'B6 exige Pedido para atribuição econômica direta.';
  END IF;

  IF NEW.block = 'B7' AND NEW.incident_id IS NULL THEN
    RAISE EXCEPTION 'B7 exige Incidente Operacional explícito.';
  END IF;

  SELECT abs(value), lifecycle_status
    INTO v_entry_value, v_entry_status
  FROM public.financial_entries
  WHERE id = NEW.financial_entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lançamento financeiro não encontrado.';
  END IF;

  IF v_entry_status <> 'active' THEN
    RAISE EXCEPTION 'Não é permitido atribuir lançamento financeiro inativo/cancelado.';
  END IF;

  SELECT COALESCE(sum(allocated_value),0)
    INTO v_allocated
  FROM public.economic_financial_attributions
  WHERE financial_entry_id = NEW.financial_entry_id
    AND id IS DISTINCT FROM NEW.id;

  IF v_allocated + NEW.allocated_value > v_entry_value + 0.000001 THEN
    RAISE EXCEPTION 'Soma das atribuições econômicas excede o valor do lançamento financeiro.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER economic_financial_attribution_guard
  BEFORE INSERT OR UPDATE OF financial_entry_id, order_id, incident_id, block, allocated_value
  ON public.economic_financial_attributions
  FOR EACH ROW EXECUTE FUNCTION public.assert_economic_financial_attribution();

REVOKE ALL ON public.economic_financial_attributions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.economic_financial_attributions TO authenticated;

ALTER TABLE public.economic_financial_attributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users operate economic financial attributions"
  ON public.economic_financial_attributions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
