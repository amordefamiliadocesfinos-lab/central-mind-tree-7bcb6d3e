-- Run only in isolated P4 fixture DB, using existing canonical writer SQL.
BEGIN;
\ir d11-intake-composition-fixture.sql
-- Fixture-only sabotage demonstrates rollback on a real post-write mismatch.
CREATE FUNCTION public.d11_fixture_corrupt_item() RETURNS trigger LANGUAGE plpgsql AS $corrupt$
BEGIN
 IF current_setting('d11.fixture_corrupt',true)='on' THEN NEW.quantity:=NEW.quantity+1; END IF;
 RETURN NEW;
END $corrupt$;
CREATE TRIGGER d11_fixture_corrupt BEFORE INSERT ON public.order_items
 FOR EACH ROW EXECUTE FUNCTION public.d11_fixture_corrupt_item();
SET LOCAL ROLE service_role;
DO $$ DECLARE a uuid:='cccccccc-cccc-4ccc-8ccc-cccccccccccc'; l uuid; obs uuid; x jsonb; projection jsonb; oid uuid; 
BEGIN
 ASSERT NOT has_function_privilege('authenticated','public.commit_shopee_d11_intake(uuid,uuid,integer,uuid,jsonb)','EXECUTE');
 l:=(public.acquire_shopee_cycle(a)->>'lease_id')::uuid;
 obs:=public.d11_fixture_observe(a,'fixture_intake_1');
 projection:=public.d11_fixture_projection();
 ASSERT public.commit_shopee_d11_intake(a,l,1,gen_random_uuid(),projection)->>'status'='intake_observation_refused';
 ASSERT public.commit_shopee_d11_intake(a,l,1,obs,jsonb_set(projection,'{items,0,quantity}','7'))->>'status'='intake_composition_refused';
 ASSERT public.commit_shopee_d11_intake(a,l,1,obs,jsonb_set(projection,'{items,1,unit_price}','10'))->>'status'='intake_composition_refused';
 ASSERT public.commit_shopee_d11_intake(a,l,1,obs,projection#-'{items,1}')->>'status'='intake_composition_refused';
 ASSERT public.commit_shopee_d11_intake(a,l,1,obs,jsonb_set(projection,'{total_value}','21'))->>'status'='intake_projection_refused';
 ASSERT NOT EXISTS(SELECT 1 FROM public.orders WHERE channel_account_id=a);
 BEGIN
  PERFORM set_config('d11.fixture_corrupt','on',true);
  PERFORM public.commit_shopee_d11_intake(a,l,1,obs,projection);
  RAISE EXCEPTION 'fixture corruption unexpectedly accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'d11_intake_postwrite_integrity_failed' THEN RAISE; END IF;
 END;
 ASSERT NOT EXISTS(SELECT 1 FROM public.orders WHERE channel_account_id=a);
 ASSERT NOT EXISTS(SELECT 1 FROM public.order_items);
 ASSERT NOT EXISTS(SELECT 1 FROM public.order_separation);
 x:=public.commit_shopee_d11_intake(a,l,1,obs,projection);
 ASSERT x->>'status'='intake_written',x::text;
 oid:=(x->>'order_id')::uuid;
 ASSERT (SELECT marketplace_metadata->>'buyer_message' FROM public.orders WHERE id=oid)='fixture packing note';
 ASSERT (SELECT count(*) FROM public.order_items WHERE order_id=oid)=2;
 ASSERT (SELECT sum(quantity) FROM public.order_items WHERE order_id=oid)=10;
 ASSERT (SELECT count(*) FROM public.order_separation WHERE order_id=oid AND separation_status='todo')=1;
 ASSERT public.commit_shopee_d11_intake(a,l,1,obs,projection)->>'status'='intake_existing_requires_reconciliation';
 ASSERT (SELECT count(*) FROM public.orders WHERE channel_account_id=a)=1;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'D11 canonical writer composition and exact receipt proof passed (rolled back)' AS proof;
