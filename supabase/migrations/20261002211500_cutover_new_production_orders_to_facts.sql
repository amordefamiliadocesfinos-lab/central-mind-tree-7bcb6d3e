-- F01.5 — Cutover do fluxo físico para novas OPs.
-- As OPs legadas existentes permanecem explicitamente em legacy_completion.
-- No momento do cutover, todas as OPs legadas existentes estavam concluídas.

ALTER TABLE public.production_orders
  ALTER COLUMN physical_flow_mode SET DEFAULT 'production_facts';
