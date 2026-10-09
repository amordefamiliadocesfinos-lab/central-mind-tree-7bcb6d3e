-- E7 — Motor Econômico Shopee V2: snapshot imutável de previsão.
-- Guarda a previsão usada na decisão. Regras futuras não reescrevem o passado.

CREATE TABLE public.economic_prediction_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_key uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  snapshot_schema_version text NOT NULL DEFAULT '1.0.0',
  engine_key text NOT NULL,
  engine_version text NOT NULL,
  rule_version_id uuid REFERENCES public.economic_rule_versions(id) ON DELETE RESTRICT,
  rule_version text,
  marketplace text NOT NULL,
  channel_account_id uuid REFERENCES public.channel_accounts(id) ON DELETE RESTRICT,
  marketplace_product_mapping_id uuid REFERENCES public.marketplace_product_mappings(id) ON DELETE RESTRICT,
  product_id uuid REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  commercial_presentation_id uuid REFERENCES public.commercial_presentations(id) ON DELETE RESTRICT,
  effective_at date NOT NULL,
  confidence text NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  input_snapshot jsonb NOT NULL,
  result_snapshot jsonb NOT NULL,
  evidence_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  pending_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  decision_note text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX economic_prediction_snapshots_context_idx
  ON public.economic_prediction_snapshots (
    marketplace,
    channel_account_id,
    marketplace_product_mapping_id,
    effective_at,
    created_at
  );

CREATE INDEX economic_prediction_snapshots_rule_idx
  ON public.economic_prediction_snapshots (rule_version_id)
  WHERE rule_version_id IS NOT NULL;

ALTER TABLE public.economic_prediction_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read economic prediction snapshots"
  ON public.economic_prediction_snapshots
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users create economic prediction snapshots"
  ON public.economic_prediction_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

GRANT SELECT, INSERT ON public.economic_prediction_snapshots TO authenticated;
REVOKE UPDATE, DELETE ON public.economic_prediction_snapshots FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.prevent_economic_prediction_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Economic prediction snapshots are immutable.';
END;
$$;

CREATE TRIGGER prevent_economic_prediction_snapshot_update
  BEFORE UPDATE ON public.economic_prediction_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.prevent_economic_prediction_snapshot_mutation();

CREATE TRIGGER prevent_economic_prediction_snapshot_delete
  BEFORE DELETE ON public.economic_prediction_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.prevent_economic_prediction_snapshot_mutation();

REVOKE ALL ON FUNCTION public.prevent_economic_prediction_snapshot_mutation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prevent_economic_prediction_snapshot_mutation() TO authenticated;
