-- Frete pertence ao pedido de compra. Não representa frete de venda/pedido
-- comercial e não cria lançamento financeiro automaticamente.
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS freight_amount numeric NOT NULL DEFAULT 0
  CHECK (freight_amount >= 0);

