-- E6 — Motor Econômico Shopee V2: regras versionadas + evidências.
-- Escopo deliberadamente limitado: não cria prediction snapshots (E7) nem reconciliação (E8).

CREATE TABLE public.economic_rule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engine_key text NOT NULL,
  engine_version text NOT NULL,
  rule_key text NOT NULL,
  rule_version text NOT NULL,
  marketplace text NOT NULL,
  channel_account_id uuid REFERENCES public.channel_accounts(id) ON DELETE RESTRICT,
  marketplace_product_mapping_id uuid REFERENCES public.marketplace_product_mappings(id) ON DELETE RESTRICT,
  effective_from date NOT NULL,
  effective_to date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'retired')),
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_summary text,
  supersedes_rule_version_id uuid REFERENCES public.economic_rule_versions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE (engine_key, rule_key, rule_version, channel_account_id, marketplace_product_mapping_id)
);

CREATE INDEX economic_rule_versions_lookup_idx
  ON public.economic_rule_versions (
    marketplace,
    channel_account_id,
    marketplace_product_mapping_id,
    effective_from,
    effective_to
  );

CREATE INDEX economic_rule_versions_active_idx
  ON public.economic_rule_versions (engine_key, status, effective_from, effective_to);

CREATE TRIGGER update_economic_rule_versions_updated_at
  BEFORE UPDATE ON public.economic_rule_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.economic_rule_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_version_id uuid NOT NULL REFERENCES public.economic_rule_versions(id) ON DELETE RESTRICT,
  evidence_type text NOT NULL,
  source_ref text NOT NULL CHECK (btrim(source_ref) <> ''),
  observed_from date,
  observed_to date,
  marketplace_product_mapping_id uuid REFERENCES public.marketplace_product_mappings(id) ON DELETE RESTRICT,
  is_offer_specific boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (observed_to IS NULL OR observed_from IS NULL OR observed_to >= observed_from)
);

CREATE INDEX economic_rule_evidence_rule_idx
  ON public.economic_rule_evidence (rule_version_id);

CREATE INDEX economic_rule_evidence_offer_idx
  ON public.economic_rule_evidence (marketplace_product_mapping_id)
  WHERE marketplace_product_mapping_id IS NOT NULL;

ALTER TABLE public.economic_rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economic_rule_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read economic rule versions"
  ON public.economic_rule_versions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users read economic rule evidence"
  ON public.economic_rule_evidence
  FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public.economic_rule_versions TO authenticated;
GRANT SELECT ON public.economic_rule_evidence TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.economic_rule_versions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.economic_rule_evidence FROM anon, authenticated;

-- Migra para a persistência canônica as quatro referências históricas congeladas
-- do Motor V0.6 / MV2-12A. São regras por Conta + vigência, NÃO por Oferta.
WITH historical(account_name, note) AS (
  VALUES
    ('Adão', 'Ads Fácil não foi observado no recorte recente utilizado.'),
    ('Viviane', 'Devolução Fácil e Afiliado apareceram em parte do histórico.'),
    ('Priscila', 'Recarga e Devolução Fácil apareceram; Ads Fácil mudou ao longo do período.'),
    ('Neto', 'Recarga e Devolução Fácil apareceram; Ads Fácil mudou ao longo do período.')
),
inserted AS (
  INSERT INTO public.economic_rule_versions (
    engine_key,
    engine_version,
    rule_key,
    rule_version,
    marketplace,
    channel_account_id,
    marketplace_product_mapping_id,
    effective_from,
    effective_to,
    status,
    parameters,
    source_summary
  )
  SELECT
    'shopee-economic-v2',
    '2.0.0',
    'structural-regime',
    'mv2-12a-2026-07-02_2026-10-02-v1',
    'shopee',
    ca.id,
    NULL,
    DATE '2026-07-02',
    DATE '2026-10-02',
    'active',
    jsonb_build_object(
      'commissionPct', 12,
      'transactionPct', 2,
      'servicePct', 3.5
    ),
    historical.note
  FROM historical
  JOIN public.channel_accounts ca
    ON lower(btrim(ca.name)) = lower(btrim(historical.account_name))
  JOIN public.digital_platforms dp
    ON dp.id = ca.platform_id
   AND dp.group_type = 'marketplace'
   AND dp.parent_id IS NULL
   AND lower(dp.name) LIKE 'shopee%'
  ON CONFLICT DO NOTHING
  RETURNING id, channel_account_id
)
INSERT INTO public.economic_rule_evidence (
  rule_version_id,
  evidence_type,
  source_ref,
  observed_from,
  observed_to,
  marketplace_product_mapping_id,
  is_offer_specific,
  payload
)
SELECT
  inserted.id,
  'historical_observation',
  'MV2-12A / checkpoint canônico V0.6',
  DATE '2026-07-02',
  DATE '2026-10-02',
  NULL,
  false,
  jsonb_build_object(
    'scope', 'account_period',
    'offer_specific', false,
    'principle', 'historico orienta; transacao real decide'
  )
FROM inserted;
