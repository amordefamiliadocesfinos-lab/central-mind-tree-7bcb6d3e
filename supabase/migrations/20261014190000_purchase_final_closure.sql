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

CREATE OR REPLACE FUNCTION public.finalize_partial_purchase(p_id uuid,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order public.purchase_orders%ROWTYPE; v_total numeric; v_missing numeric; v_received numeric;
BEGIN
 IF auth.role()<>'service_role' AND coalesce(public.current_app_user_role(),'') NOT IN ('Administrador','VENDA','LIDER PRODUÇÃO') THEN
   RAISE EXCEPTION 'operations_order_write_required';
 END IF;
 IF length(trim(coalesce(p_reason,'')))<5 THEN RAISE EXCEPTION 'Motivo obrigatorio.'; END IF;
 SELECT * INTO v_order FROM public.purchase_orders WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pedido inexistente.'; END IF;
 IF EXISTS (SELECT 1 FROM public.purchase_final_closures WHERE purchase_order_id=p_id) THEN
   RETURN jsonb_build_object('success',true,'already_finalized',true);
 END IF;
 IF v_order.status<>'parcialmente_recebido' OR v_order.billing_status<>'pending' OR coalesce(v_order.freight_amount,0)<>0 THEN
   RAISE EXCEPTION 'Requer compra parcialmente recebida, nao faturada e sem frete pendente.';
 END IF;
 IF EXISTS (SELECT 1 FROM public.financial_entries WHERE purchase_order_id=p_id AND lifecycle_status='active') THEN
   RAISE EXCEPTION 'Regularize obrigacoes financeiras antes do encerramento.';
 END IF;
 IF EXISTS (SELECT 1 FROM public.purchase_receipts WHERE purchase_order_id=p_id AND status='draft') THEN
   RAISE EXCEPTION 'Resolva recebimentos em rascunho.';
 END IF;
 SELECT coalesce(sum(greatest(i.ordered_purchase_qty-coalesce(r.qty,0),0)),0),
        coalesce(sum(least(i.ordered_purchase_qty,coalesce(r.qty,0))*i.unit_price),0),
        coalesce(sum(coalesce(r.qty,0)),0)
 INTO v_missing,v_total,v_received
 FROM public.purchase_order_items i
 LEFT JOIN (SELECT ri.purchase_order_item_id,sum(ri.received_purchase_qty) qty
            FROM public.purchase_receipt_items ri JOIN public.purchase_receipts pr ON pr.id=ri.purchase_receipt_id
            WHERE pr.purchase_order_id=p_id AND pr.status='confirmed' GROUP BY ri.purchase_order_item_id) r
 ON r.purchase_order_item_id=i.id
 WHERE i.purchase_order_id=p_id;
 IF v_missing<=0 OR v_received<=0 OR v_total<=0 THEN RAISE EXCEPTION 'Saldo parcial invalido.'; END IF;
 INSERT INTO public.purchase_final_closures(purchase_order_id,reason,effective_amount)
 VALUES(p_id,trim(p_reason),round(v_total,2));
 INSERT INTO public.purchase_final_closure_items(purchase_order_item_id,purchase_order_id,ordered_qty,received_qty,not_delivered_qty,unit_price)
 SELECT i.id,p_id,i.ordered_purchase_qty,coalesce(r.qty,0),greatest(i.ordered_purchase_qty-coalesce(r.qty,0),0),i.unit_price
 FROM public.purchase_order_items i LEFT JOIN (
 SELECT ri.purchase_order_item_id,sum(ri.received_purchase_qty) qty
 FROM public.purchase_receipt_items ri JOIN public.purchase_receipts pr ON pr.id=ri.purchase_receipt_id
 WHERE pr.purchase_order_id=p_id AND pr.status='confirmed' GROUP BY ri.purchase_order_item_id
 ) r ON r.purchase_order_item_id=i.id WHERE i.purchase_order_id=p_id;
 RETURN jsonb_build_object('success',true,'already_finalized',false,'effective_amount',round(v_total,2));
END $$;
REVOKE ALL ON FUNCTION public.finalize_partial_purchase(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finalize_partial_purchase(uuid,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.guard_finalized_purchase_receipts()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.purchase_final_closures WHERE purchase_order_id=NEW.purchase_order_id) THEN
   RAISE EXCEPTION 'Compra encerrada: nao pode receber novamente.';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER purchase_final_receipt_insert BEFORE INSERT ON public.purchase_receipts
FOR EACH ROW EXECUTE FUNCTION public.guard_finalized_purchase_receipts();
CREATE TRIGGER purchase_final_receipt_confirm BEFORE UPDATE OF status ON public.purchase_receipts
FOR EACH ROW WHEN(NEW.status='confirmed' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.guard_finalized_purchase_receipts();
