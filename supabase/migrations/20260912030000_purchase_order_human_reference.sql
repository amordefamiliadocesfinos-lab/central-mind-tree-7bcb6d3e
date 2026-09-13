-- F11.3.1: identificação humana operacional para Pedido de Compra.
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS internal_purchase_number text;

CREATE SEQUENCE IF NOT EXISTS public.purchase_order_number_seq START WITH 1;

CREATE OR REPLACE FUNCTION public.assign_internal_purchase_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.internal_purchase_number IS NULL OR btrim(NEW.internal_purchase_number) = '' THEN
    NEW.internal_purchase_number := 'PC-' || lpad(nextval('public.purchase_order_number_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS purchase_orders_assign_internal_number ON public.purchase_orders;
CREATE TRIGGER purchase_orders_assign_internal_number
  BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.assign_internal_purchase_number();

UPDATE public.purchase_orders
SET internal_purchase_number = 'PC-' || lpad(nextval('public.purchase_order_number_seq')::text, 5, '0')
WHERE internal_purchase_number IS NULL OR btrim(internal_purchase_number) = '';

CREATE UNIQUE INDEX IF NOT EXISTS purchase_orders_internal_purchase_number_key
  ON public.purchase_orders(internal_purchase_number);
