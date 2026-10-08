-- E6 correção — seed das regras históricas usando os nomes canônicos reais.
-- Não assume SHOPEE CELIVIO = histórico "Neto"; sem evidência, nenhuma regra é criada para Celivio.

WITH historical(canonical_account_name, source_label, note) AS (
  VALUES
    ('SHOPEE ADÃO', 'Adão', 'Ads Fácil não foi observado no recorte recente utilizado.'),
    ('SHOPEE VIVIANE', 'Viviane', 'Devolução Fácil e Afiliado apareceram em parte do histórico.'),
    ('SHOPEE PRISCILA', 'Priscila', 'Recarga e Devolução Fácil apareceram; Ads Fácil mudou ao longo do período.')
),
eligible_accounts AS (
  SELECT
    ca.id AS channel_account_id,
    historical.source_label,
    historical.note
  FROM historical
  JOIN public.channel_accounts ca
    ON lower(btrim(ca.name)) = lower(btrim(historical.canonical_account_name))
  JOIN public.digital_platforms dp
    ON dp.id = ca.platform_id
   AND dp.group_type = 'marketplace'
   AND dp.parent_id IS NULL
   AND lower(dp.name) LIKE 'shopee%'
),
inserted_rules AS (
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
    eligible_accounts.channel_account_id,
    NULL,
    DATE '2026-07-02',
    DATE '2026-10-02',
    'active',
    jsonb_build_object(
      'commissionPct', 12,
      'transactionPct', 2,
      'servicePct', 3.5
    ),
    eligible_accounts.note
  FROM eligible_accounts
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.economic_rule_versions existing
    WHERE existing.engine_key = 'shopee-economic-v2'
      AND existing.rule_key = 'structural-regime'
      AND existing.rule_version = 'mv2-12a-2026-07-02_2026-10-02-v1'
      AND existing.channel_account_id = eligible_accounts.channel_account_id
      AND existing.marketplace_product_mapping_id IS NULL
  )
  RETURNING id, channel_account_id
),
all_target_rules AS (
  SELECT
    erv.id,
    erv.channel_account_id
  FROM public.economic_rule_versions erv
  JOIN eligible_accounts ea
    ON ea.channel_account_id = erv.channel_account_id
  WHERE erv.engine_key = 'shopee-economic-v2'
    AND erv.rule_key = 'structural-regime'
    AND erv.rule_version = 'mv2-12a-2026-07-02_2026-10-02-v1'
    AND erv.marketplace_product_mapping_id IS NULL
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
  all_target_rules.id,
  'historical_observation',
  'MV2-12A / checkpoint canônico V0.6',
  DATE '2026-07-02',
  DATE '2026-10-02',
  NULL,
  false,
  jsonb_build_object(
    'scope', 'account_period',
    'offer_specific', false,
    'canonical_account_name', ca.name,
    'principle', 'historico orienta; transacao real decide'
  )
FROM all_target_rules
JOIN public.channel_accounts ca
  ON ca.id = all_target_rules.channel_account_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.economic_rule_evidence evidence
  WHERE evidence.rule_version_id = all_target_rules.id
    AND evidence.source_ref = 'MV2-12A / checkpoint canônico V0.6'
    AND evidence.is_offer_specific = false
);
