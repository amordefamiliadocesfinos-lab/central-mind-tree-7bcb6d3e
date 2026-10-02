-- F01.3 — Compatibilidade OP ↔ Fato Real de Produção
-- Cutover propositalmente staged: enquanto o Mobile não estiver pronto,
-- OPs existentes e novas continuam no modo legado para não causar regressão.

ALTER TABLE public.production_orders
  ADD COLUMN physical_flow_mode text;

UPDATE public.production_orders
SET physical_flow_mode = 'legacy_completion'
WHERE physical_flow_mode IS NULL;

ALTER TABLE public.production_orders
  ALTER COLUMN physical_flow_mode SET DEFAULT 'legacy_completion',
  ALTER COLUMN physical_flow_mode SET NOT NULL;

ALTER TABLE public.production_orders
  ADD CONSTRAINT production_orders_physical_flow_mode_check
  CHECK (physical_flow_mode IN ('legacy_completion','production_facts'));

CREATE INDEX production_orders_physical_flow_mode_idx
  ON public.production_orders(physical_flow_mode, status);
