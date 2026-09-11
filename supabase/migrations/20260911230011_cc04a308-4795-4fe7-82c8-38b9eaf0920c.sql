-- 1) Internal human order number (additive, does not touch order_number)
CREATE SEQUENCE IF NOT EXISTS public.orders_internal_number_seq;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS internal_order_number text;

CREATE OR REPLACE FUNCTION public.set_internal_order_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.internal_order_number IS NULL OR btrim(NEW.internal_order_number) = '' THEN
    NEW.internal_order_number := 'PED-' || lpad(nextval('public.orders_internal_number_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_internal_number ON public.orders;
CREATE TRIGGER trg_orders_internal_number
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_internal_order_number();

-- Idempotent backfill in stable order
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.orders WHERE internal_order_number IS NULL ORDER BY created_at, id LOOP
    UPDATE public.orders
    SET internal_order_number = 'PED-' || lpad(nextval('public.orders_internal_number_seq')::text, 5, '0')
    WHERE id = r.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS orders_internal_order_number_key ON public.orders (internal_order_number);

-- 2) Operational dimension (additive; legacy status kept intact)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS operational_status text NOT NULL DEFAULT 'todo';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_operational_status_check') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_operational_status_check
      CHECK (operational_status IN ('todo','preparing','finalized','cancelled'));
  END IF;
END $$;

UPDATE public.orders o
SET operational_status = CASE
  WHEN o.status = 'cancelado' THEN 'cancelled'
  WHEN s.separation_status = 'finalized' THEN 'finalized'
  WHEN s.separation_status = 'preparing' THEN 'preparing'
  WHEN s.separation_status = 'todo' THEN 'todo'
  WHEN o.status IN ('enviado','entregue','concluido') THEN 'finalized'
  WHEN o.status IN ('pronto','produzido','producao') THEN 'preparing'
  ELSE 'todo'
END
FROM (SELECT id FROM public.orders) x
LEFT JOIN public.order_separation s ON s.order_id = x.id
WHERE o.id = x.id;

CREATE INDEX IF NOT EXISTS orders_operational_status_idx ON public.orders (operational_status);

-- 3) Sync order <-> separation
CREATE OR REPLACE FUNCTION public.mark_order_separation_printed(p_order_id uuid)
RETURNS order_separation
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_separation public.order_separation;
BEGIN
  INSERT INTO public.order_separation (order_id, separation_status, first_printed_at, first_printed_by, print_count)
  VALUES (p_order_id, 'preparing', now(), auth.uid(), 1)
  ON CONFLICT (order_id) DO UPDATE
  SET separation_status = CASE
        WHEN public.order_separation.separation_status = 'todo' THEN 'preparing'
        ELSE public.order_separation.separation_status
      END,
      first_printed_at = COALESCE(public.order_separation.first_printed_at, now()),
      first_printed_by = COALESCE(public.order_separation.first_printed_by, auth.uid()),
      print_count = public.order_separation.print_count + 1
  RETURNING * INTO v_separation;

  UPDATE public.orders
  SET operational_status = 'preparing'
  WHERE id = p_order_id
    AND operational_status NOT IN ('finalized','cancelled');

  RETURN v_separation;
END;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_order_separation(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_separation public.order_separation;
  v_stock_result jsonb;
BEGIN
  INSERT INTO public.order_separation (order_id)
  VALUES (p_order_id)
  ON CONFLICT (order_id) DO NOTHING;

  SELECT * INTO v_separation
  FROM public.order_separation
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF v_separation.separation_status = 'finalized' THEN
    UPDATE public.orders
    SET operational_status = 'finalized'
    WHERE id = p_order_id AND operational_status <> 'cancelled';
    RETURN jsonb_build_object('already_finalized', true, 'stock_result', NULL);
  END IF;

  v_stock_result := public.apply_order_stock_event(p_order_id, 'shipped');

  UPDATE public.order_separation
  SET separation_status = 'finalized',
      finalized_at = now(),
      finalized_by = auth.uid()
  WHERE order_id = p_order_id;

  UPDATE public.orders
  SET operational_status = 'finalized'
  WHERE id = p_order_id AND operational_status <> 'cancelled';

  RETURN jsonb_build_object('already_finalized', false, 'stock_result', v_stock_result);
END;
$function$;

-- Legacy cancellation keeps operational dimension in sync
CREATE OR REPLACE FUNCTION public.sync_order_operational_status_from_legacy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelado' AND NEW.operational_status IS DISTINCT FROM 'cancelled' THEN
    NEW.operational_status := 'cancelled';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_sync_operational_status ON public.orders;
CREATE TRIGGER trg_orders_sync_operational_status
BEFORE INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.sync_order_operational_status_from_legacy();

-- Safe manual operational transitions (no stock effect)
CREATE OR REPLACE FUNCTION public.set_order_operational_status(p_order_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current text;
BEGIN
  IF p_status NOT IN ('todo','preparing','cancelled') THEN
    RAISE EXCEPTION 'Situação operacional inválida para alteração manual: %', p_status;
  END IF;

  SELECT operational_status INTO v_current FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF v_current IN ('finalized','cancelled') AND p_status <> 'cancelled' THEN
    RAISE EXCEPTION 'Pedido já finalizado ou cancelado não pode voltar para %', p_status;
  END IF;

  IF p_status = 'cancelled' THEN
    UPDATE public.orders SET status = 'cancelado', operational_status = 'cancelled' WHERE id = p_order_id;
  ELSE
    UPDATE public.orders SET operational_status = p_status WHERE id = p_order_id;

    INSERT INTO public.order_separation (order_id, separation_status)
    VALUES (p_order_id, p_status)
    ON CONFLICT (order_id) DO UPDATE
    SET separation_status = CASE
          WHEN public.order_separation.separation_status = 'finalized' THEN 'finalized'
          ELSE EXCLUDED.separation_status
        END;
  END IF;

  RETURN jsonb_build_object('order_id', p_order_id, 'operational_status', p_status);
END;
$function$;