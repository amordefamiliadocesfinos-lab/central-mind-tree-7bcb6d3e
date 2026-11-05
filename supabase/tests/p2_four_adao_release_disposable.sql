-- One-shot test in disposable DB. Requires P2 canonical minimal fixture and
-- P2_FOUR_ADAO_ORDER_RELEASE_UNAPPLIED.sql loaded before this test.
BEGIN;
DO $guard$
BEGIN
 IF to_regclass('public.p2_disposable_test_marker') IS NULL
 THEN RAISE EXCEPTION 'p2_adao_release_test_disposable_only';END IF;
END $guard$;
ALTER TABLE public.orders ADD COLUMN channel text;
ALTER TABLE public.orders ADD COLUMN channel_account_id uuid;
ALTER TABLE public.orders ADD COLUMN marketplace_account text;
CREATE TRIGGER a_p3_adao_four_order_account_quarantine
BEFORE UPDATE OF channel,channel_account_id,marketplace_account ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.p3_adao_four_protect_order();
CREATE TRIGGER a_p3_adao_four_order_item_quarantine
BEFORE INSERT OR UPDATE OF order_id,product_id,variant_id,commercial_presentation_id
ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.p3_adao_four_protect_order();
DO $test$
DECLARE
 adao uuid:='b4027369-5abf-4ac1-ab24-862334fae892';
 o uuid:=gen_random_uuid();
 other uuid:=gen_random_uuid();
 oi uuid:=gen_random_uuid();
 blocked boolean;
BEGIN
 INSERT INTO public.orders(id,channel,channel_account_id,marketplace_account)
 VALUES(o,'shopee',adao,'SHOPEE ADÃO'),
       (other,'shopee',gen_random_uuid(),'OTHER');
 -- Canonical original unit is accepted for order CREATE with no stock debit.
 INSERT INTO public.order_items(id,order_id,product_id,quantity,commercial_quantity,commercial_presentation_id)
 VALUES(oi,o,'0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b',790,2,
 '008d57c4-63b6-4c30-80fd-161ca368fd66');
 IF EXISTS(SELECT 1 FROM public.p2_four_sealed_events)
 THEN RAISE EXCEPTION 'p2_order_create_mutated_sealed_stock';END IF;
 -- Canonical ML2 original box also accepted with proper mass.
 INSERT INTO public.order_items(id,order_id,product_id,quantity,commercial_quantity,commercial_presentation_id)
 VALUES(gen_random_uuid(),o,'0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b',10665,1,
 'b1bdfd2f-0278-4273-9e19-2544c8a3d758');
 -- Unknown presentation is rejected, including original gram quantity.
 blocked:=false;
 BEGIN
  INSERT INTO public.order_items(id,order_id,product_id,quantity,commercial_quantity,commercial_presentation_id)
  VALUES(gen_random_uuid(),o,'6f43ad65-74d5-4db9-b931-1ecd6d124987',1000,1,NULL);
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%p2_four_adao_requires_canonical_original_presentation%'
  THEN blocked:=true;ELSE RAISE;END IF;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'p2_null_presentation_released';END IF;
 -- Wrong mass is rejected even with matching product/presentation pair.
 blocked:=false;
 BEGIN
  INSERT INTO public.order_items(id,order_id,product_id,quantity,commercial_quantity,commercial_presentation_id)
  VALUES(gen_random_uuid(),o,'ef118d1c-e7c7-45e3-b796-3a9908840f3c',999,1,
   'f093c456-f757-4efe-b575-8177b8b1d607');
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%p2_four_adao_requires_canonical_original_presentation%'
  THEN blocked:=true;ELSE RAISE;END IF;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'p2_wrong_mass_released';END IF;
 -- Other accounts remain unchanged by P3 rule.
 INSERT INTO public.order_items(id,order_id,product_id,quantity,commercial_quantity,commercial_presentation_id)
 VALUES(gen_random_uuid(),other,'6f43ad65-74d5-4db9-b931-1ecd6d124987',1000,1,NULL);
 -- Reassigning an ambiguous existing line into Adão is rejected.
 blocked:=false;
 BEGIN
  UPDATE public.orders SET channel_account_id=adao,marketplace_account='SHOPEE ADÃO' WHERE id=other;
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%p2_four_adao_requires_canonical_original_presentation%'
  THEN blocked:=true;ELSE RAISE;END IF;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'p2_account_reassignment_bypassed';END IF;
END $test$;
ROLLBACK;
