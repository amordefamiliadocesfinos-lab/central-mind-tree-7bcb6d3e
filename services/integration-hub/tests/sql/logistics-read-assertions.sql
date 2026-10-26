INSERT INTO public.shopee_logistics_read_state(channel_account_id,order_sn,state)
SELECT 'b4027369-5abf-4ac1-ab24-862334fae892',sn,'EXPEDIDO'
FROM unnest(ARRAY['ACTIVE001','DELETED001','DUPLICATE001','MANUAL001','MISSING001']) sn;
DO $$ BEGIN
  ASSERT NOT has_table_privilege('anon','public.shopee_logistics_read_state','SELECT');
  ASSERT NOT has_table_privilege('authenticated','public.shopee_logistics_read_state','INSERT');
  ASSERT NOT has_table_privilege('authenticated','public.shopee_logistics_read_state','UPDATE');
  ASSERT NOT has_table_privilege('authenticated','public.shopee_logistics_read_state','DELETE');
  ASSERT has_table_privilege('service_role','public.shopee_logistics_read_state','INSERT');
END $$;
SET ROLE authenticated;
DO $$ DECLARE n int; c int; BEGIN
  FOR n IN 1..7 LOOP
    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-' || lpad(n::text,12,'0'),false);
    SELECT count(*) INTO c FROM public.shopee_logistics_read_state;
    ASSERT c = CASE WHEN n <= 3 THEN 1 ELSE 0 END, 'role/inactive/unregistered RLS failed';
  END LOOP;
  PERFORM set_config('request.jwt.claim.sub','',false);
  ASSERT (SELECT count(*) FROM public.shopee_logistics_read_state)=0;
END $$;
RESET ROLE;
-- A state previously visible must immediately disappear when the order is deleted.
UPDATE public.orders SET deleted_at=now() WHERE order_number='ACTIVE001';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
DO $$ BEGIN ASSERT (SELECT count(*) FROM public.shopee_logistics_read_state)=0; END $$;
RESET ROLE;
