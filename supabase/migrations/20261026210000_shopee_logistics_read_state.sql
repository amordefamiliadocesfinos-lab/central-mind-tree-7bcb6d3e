-- F6-Q.6D.2K: sanitized Shopee logistics state, independent from physical separation.
CREATE TABLE IF NOT EXISTS public.shopee_logistics_read_state (
  channel_account_id uuid NOT NULL REFERENCES public.channel_accounts(id),
  order_sn text NOT NULL CHECK (order_sn ~ '^[A-Za-z0-9]{8,100}$'),
  state text NOT NULL CHECK (state IN ('AGUARDANDO_ORGANIZACAO','ENVIO_JA_ORGANIZADO','EXPEDIDO','BLOQUEADO','INDETERMINADO')),
  reason text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_account_id,order_sn),
  CONSTRAINT shopee_logistics_reason_sanitized CHECK (reason IS NULL OR (length(reason)<=100 AND reason ~ '^[A-Za-z0-9_:-]+$'))
);
ALTER TABLE public.shopee_logistics_read_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shopee_logistics_read_state FROM anon, authenticated;
GRANT SELECT ON public.shopee_logistics_read_state TO authenticated;
CREATE POLICY "Read logistics only for active canonical orders" ON public.shopee_logistics_read_state
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.channel_account_id=shopee_logistics_read_state.channel_account_id
        AND o.order_number=shopee_logistics_read_state.order_sn
        AND o.deleted_at IS NULL
    )
  );
-- Deliberately no INSERT/UPDATE/DELETE grant or policy for browser roles.
