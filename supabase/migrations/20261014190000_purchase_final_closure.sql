-- Registro auditavel para compras parcialmente recebidas e encerradas.
CREATE TABLE IF NOT EXISTS public.purchase_final_closures (
 purchase_order_id uuid PRIMARY KEY REFERENCES public.purchase_orders(id),
 reason text NOT NULL CHECK(length(trim(reason)) >= 5),
 effective_amount numeric(20,2) NOT NULL CHECK(effective_amount > 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid DEFAULT auth.uid()
);
CREATE TABLE IF NOT EXISTS public.purchase_final_closure_items (
 purchase_order_item_id uuid PRIMARY KEY REFERENCES public.purchase_order_items(id),
 purchase_order_id uuid NOT NULL REFERENCES public.purchase_final_closures(purchase_order_id),
 ordered_qty numeric NOT NULL,
 received_qty numeric NOT NULL,
 not_delivered_qty numeric NOT NULL CHECK(not_delivered_qty >= 0),
 unit_price numeric(20,2) NOT NULL
);
ALTER TABLE public.purchase_final_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_final_closure_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY purchase_final_closures_read ON public.purchase_final_closures FOR SELECT TO authenticated USING(true);
CREATE POLICY purchase_final_closure_items_read ON public.purchase_final_closure_items FOR SELECT TO authenticated USING(true);
