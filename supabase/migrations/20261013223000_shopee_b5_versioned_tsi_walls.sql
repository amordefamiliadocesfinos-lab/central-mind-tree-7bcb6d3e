-- G6 — externaliza para regras versionadas as bandas TSI e paredes econômicas
-- já caracterizadas/testadas no Motor Shopee V2.
-- NÃO amplia vigência. Apenas enriquece as regras históricas existentes.

UPDATE public.economic_rule_versions
SET parameters = parameters || jsonb_build_object(
  'tsiBands', jsonb_build_array(
    jsonb_build_object('minInclusive', 0,   'maxExclusive', 80,  'amount', 4,  'label', '< R$80'),
    jsonb_build_object('minInclusive', 80,  'maxExclusive', 100, 'amount', 16, 'label', 'R$80–99,99'),
    jsonb_build_object('minInclusive', 100, 'maxExclusive', 200, 'amount', 20, 'label', 'R$100–199,99'),
    jsonb_build_object('minInclusive', 200, 'maxExclusive', NULL, 'amount', 26, 'label', '≥ R$200')
  ),
  'walls', jsonb_build_array(80, 100, 200),
  'roundingMode', 'component_to_cent'
)
WHERE engine_key = 'shopee-economic-v2'
  AND rule_key = 'structural-regime'
  AND marketplace = 'shopee'
  AND NOT (parameters ? 'tsiBands');

UPDATE public.economic_rule_versions
SET source_summary = concat_ws(
  ' ',
  nullif(btrim(source_summary), ''),
  'G6: bandas TSI e paredes econômicas caracterizadas pelo conjunto legado de testes foram incorporadas aos parâmetros versionados sem ampliar a vigência da regra.'
)
WHERE engine_key = 'shopee-economic-v2'
  AND rule_key = 'structural-regime'
  AND marketplace = 'shopee'
  AND parameters ? 'tsiBands'
  AND coalesce(source_summary, '') NOT LIKE '%G6:%';
