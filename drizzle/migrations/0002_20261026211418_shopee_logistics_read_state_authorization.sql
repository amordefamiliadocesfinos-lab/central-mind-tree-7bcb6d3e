-- F6-Q.6D.2L: use the same active operational roles as canonical orders.
-- Separate migration also hardens installations that already applied 2K.
REVOKE ALL ON public.shopee_logistics_read_state FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.shopee_logistics_read_state TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.shopee_logistics_read_state TO service_role;

DROP POLICY IF EXISTS "Read logistics only for active canonical orders"
  ON public.shopee_logistics_read_state;
CREATE POLICY "Read logistics only for active canonical orders"
  ON public.shopee_logistics_read_state FOR SELECT TO authenticated
  USING (
    (SELECT public.current_app_user_role()) IN ('Administrador', 'VENDA', 'LIDER PRODUÇÃO')
    AND channel_account_id = 'b4027369-5abf-4ac1-ab24-862334fae892'::uuid
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.channel_account_id = shopee_logistics_read_state.channel_account_id
        AND o.order_number = shopee_logistics_read_state.order_sn
        AND o.sale_origin = 'shopee_open_platform'
        AND o.deleted_at IS NULL
    )
    -- A duplicate active row must not override a historical tombstone.
    AND NOT EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.channel_account_id = shopee_logistics_read_state.channel_account_id
        AND o.order_number = shopee_logistics_read_state.order_sn
        AND o.deleted_at IS NOT NULL
    )
  );