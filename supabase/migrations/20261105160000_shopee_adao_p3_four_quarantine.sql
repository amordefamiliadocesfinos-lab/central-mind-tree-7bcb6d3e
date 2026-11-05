-- P3 mappings Shopee Adao: fail closed until P2 four-family physical routing is activated.
-- This guard deliberately does NOT alter existing orders, inventory, mappings,
-- presentations or historical ledgers. It protects NEW Shopee Adao order lines.
-- It is independent from HUB release/digest and from grams balances.
-- Remove both triggers only in an separately authorized, atomic P2 operational cutover.
CREATE OR REPLACE FUNCTION public.p3_adao_four_protect_order()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $p3$
DECLARE
  v_protected boolean := false;
BEGIN
  IF TG_TABLE_NAME = 'order_items' THEN
    IF NEW.product_id NOT IN (
      '0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b'::uuid, -- Italac
      '6f43ad65-74d5-4db9-b931-1ecd6d124987'::uuid, -- Sorbato
      'ef118d1c-e7c7-45e3-b796-3a9908840f3c'::uuid, -- Acido Citrico
      'd913f0f2-4893-4985-9976-fcd9119a57b1'::uuid  -- Ivoti
    ) THEN
      RETURN NEW;
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = NEW.order_id AND o.channel = 'shopee'
        AND (o.channel_account_id = 'b4027369-5abf-4ac1-ab24-862334fae892'::uuid
             OR o.marketplace_account = 'SHOPEE ADÃO')
    ) INTO v_protected;
  ELSIF TG_TABLE_NAME = 'orders' THEN
    IF NEW.channel <> 'shopee'
      OR NOT (
        NEW.channel_account_id = 'b4027369-5abf-4ac1-ab24-862334fae892'::uuid
        OR NEW.marketplace_account = 'SHOPEE ADÃO'
      ) THEN
      RETURN NEW;
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.order_items oi
      WHERE oi.order_id = NEW.id AND oi.product_id IN (
        '0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b'::uuid,
        '6f43ad65-74d5-4db9-b931-1ecd6d124987'::uuid,
        'ef118d1c-e7c7-45e3-b796-3a9908840f3c'::uuid,
        'd913f0f2-4893-4985-9976-fcd9119a57b1'::uuid
      )
    ) INTO v_protected;
  END IF;
  IF v_protected THEN
    RAISE EXCEPTION 'p3_adao_four_original_packages_quarantined_before_p2_cutover';
  END IF;
  RETURN NEW;
END;
$p3$;

REVOKE ALL ON FUNCTION public.p3_adao_four_protect_order()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER a_p3_adao_four_order_item_quarantine
BEFORE INSERT OR UPDATE OF order_id, product_id, variant_id, commercial_presentation_id
ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.p3_adao_four_protect_order();

CREATE TRIGGER a_p3_adao_four_order_account_quarantine
BEFORE UPDATE OF channel, channel_account_id, marketplace_account
ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.p3_adao_four_protect_order();
