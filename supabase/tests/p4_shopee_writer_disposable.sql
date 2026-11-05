-- CI disposable only, no external Shopee, no production data.
DO $test$
DECLARE
  adao uuid:='b4027369-5abf-4ac1-ab24-862334fae892';
  pairs jsonb:=jsonb_build_array(
    jsonb_build_object('product_id','0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b','quantity',1185,'commercial_quantity',3,'physical_multiplier',395,'commercial_presentation_id','008d57c4-63b6-4c30-80fd-161ca368fd66','unit_price',5,'item_id','22494563568','model_id','229430754376'),
    jsonb_build_object('product_id','0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b','quantity',2370,'commercial_quantity',6,'physical_multiplier',395,'commercial_presentation_id','008d57c4-63b6-4c30-80fd-161ca368fd66','unit_price',5,'item_id','22494563568','model_id','229430754377'),
    jsonb_build_object('product_id','0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b','quantity',3555,'commercial_quantity',9,'physical_multiplier',395,'commercial_presentation_id','008d57c4-63b6-4c30-80fd-161ca368fd66','unit_price',5,'item_id','22494563568','model_id','229430754374'),
    jsonb_build_object('product_id','0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b','quantity',4740,'commercial_quantity',12,'physical_multiplier',395,'commercial_presentation_id','008d57c4-63b6-4c30-80fd-161ca368fd66','unit_price',5,'item_id','22494563568','model_id','229430754375'),
    jsonb_build_object('product_id','0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b','quantity',10665,'commercial_quantity',1,'physical_multiplier',10665,'commercial_presentation_id','b1bdfd2f-0278-4273-9e19-2544c8a3d758','unit_price',99,'item_id','23695375744','model_id','169421574726'),
    jsonb_build_object('product_id','6f43ad65-74d5-4db9-b931-1ecd6d124987','quantity',1000,'commercial_quantity',1,'physical_multiplier',1000,'commercial_presentation_id','684d4a55-5d3a-4c18-be47-818a1a3bc074','unit_price',25,'item_id','23994544114','model_id','189613441090'),
    jsonb_build_object('product_id','ef118d1c-e7c7-45e3-b796-3a9908840f3c','quantity',1000,'commercial_quantity',1,'physical_multiplier',1000,'commercial_presentation_id','f093c456-f757-4efe-b575-8177b8b1d607','unit_price',19,'item_id','58211501155','model_id','219189984127')
  );
  o jsonb; o2 jsonb; oid uuid; illegal boolean;
BEGIN
 o:=public.create_shopee_api_order(
 jsonb_build_object('channel_account_id',adao,'marketplace_account','SHOPEE ADÃO','order_number','P4-DISPOSABLE-SEVEN','order_date','2026-11-05','total_value',238),
 pairs);
 oid:=(o->>'order_id')::uuid;
 IF (o->>'already_registered')::boolean THEN RAISE EXCEPTION 'first P4 order idempotent unexpectedly';END IF;
 IF (SELECT count(*) FROM public.order_items WHERE order_id=oid)<>7 THEN RAISE EXCEPTION 'seven lines not written';END IF;
 IF EXISTS(SELECT 1 FROM public.order_items oi JOIN public.commercial_presentations cp
  ON cp.id=oi.commercial_presentation_id WHERE oi.order_id=oid AND (
    oi.commercial_presentation_name IS DISTINCT FROM cp.name OR
    oi.commercial_unit_label IS DISTINCT FROM cp.commercial_unit_label OR
    oi.commercial_conversion_factor IS DISTINCT FROM cp.conversion_factor OR
    oi.physical_unit_label IS DISTINCT FROM 'g' OR
    oi.quantity IS DISTINCT FROM oi.commercial_quantity*cp.conversion_factor))
 THEN RAISE EXCEPTION 'canonical snapshot mismatch';END IF;
 IF EXISTS (SELECT 1 FROM public.order_items WHERE order_id=oid AND commercial_presentation_id IS NULL)
 THEN RAISE EXCEPTION 'missing canonical P2 presentation';END IF;
 IF (SELECT count(*) FROM public.order_separation WHERE order_id=oid AND separation_status='todo')<>1
 THEN RAISE EXCEPTION 'missing TODO separation';END IF;
 o2:=public.create_shopee_api_order(
 jsonb_build_object('channel_account_id',adao,'marketplace_account','SHOPEE ADÃO','order_number','P4-DISPOSABLE-SEVEN','order_date','2026-11-05'),
 pairs);
 IF (o2->>'already_registered')::boolean IS DISTINCT FROM true OR o2->>'order_id'<>o->>'order_id'
 THEN RAISE EXCEPTION 'idempotency broken';END IF;
 IF (SELECT count(*) FROM public.order_items WHERE order_id=oid)<>7 THEN RAISE EXCEPTION 'duplicate items';END IF;
 illegal:=false;
 BEGIN
 PERFORM public.create_shopee_api_order(
 jsonb_build_object('channel_account_id',adao,'marketplace_account','SHOPEE ADÃO','order_number','P4-DISPOSABLE-INVALID','order_date','2026-11-05'),
 jsonb_build_array(jsonb_build_object('product_id','6f43ad65-74d5-4db9-b931-1ecd6d124987','quantity',999,'commercial_quantity',1,'physical_multiplier',999,'commercial_presentation_id','684d4a55-5d3a-4c18-be47-818a1a3bc074','unit_price',10)));
 EXCEPTION WHEN OTHERS THEN
 IF SQLERRM LIKE '%shopee_commercial_presentation_quantity_mismatch%' THEN illegal:=true; ELSE RAISE;END IF;
 END;
 IF NOT illegal THEN RAISE EXCEPTION 'wrong P2 factor accepted';END IF;
 illegal:=false;
 BEGIN
 PERFORM public.create_shopee_api_order(
 jsonb_build_object('channel_account_id',adao,'marketplace_account','SHOPEE ADÃO','order_number','P4-DISPOSABLE-WRONG-PRODUCT','order_date','2026-11-05'),
 jsonb_build_array(jsonb_build_object('product_id','6f43ad65-74d5-4db9-b931-1ecd6d124987','quantity',395,'commercial_quantity',1,'physical_multiplier',395,'commercial_presentation_id','008d57c4-63b6-4c30-80fd-161ca368fd66','unit_price',10)));
 EXCEPTION WHEN OTHERS THEN
 IF SQLERRM LIKE '%shopee_commercial_presentation_identity_mismatch%' THEN illegal:=true; ELSE RAISE; END IF;
 END;
 IF NOT illegal THEN RAISE EXCEPTION 'foreign presentation accepted'; END IF;
 PERFORM public.create_shopee_api_order(
 jsonb_build_object('channel_account_id','8a8ad166-0317-4597-8be6-e43fb46b4d1b','marketplace_account','SHOPEE VIVIANE','order_number','P4-DISPOSABLE-LEGACY','order_date','2026-11-05'),
 jsonb_build_array(jsonb_build_object('product_id','92088a70-8cc0-40ef-a39d-564603df6866','quantity',1000,'commercial_quantity',1,'physical_multiplier',1000,'unit_price',19)));
 IF (SELECT count(*) FROM public.order_items WHERE commercial_presentation_id IS NULL
 AND commercial_presentation_name IS NULL AND commercial_quantity IS NULL
 AND physical_unit_label IS NULL)<>1 THEN RAISE EXCEPTION 'legacy no-presentation regression';END IF;
 IF has_function_privilege('authenticated','public.create_shopee_api_order(jsonb,jsonb)','EXECUTE')
 OR has_function_privilege('anon','public.create_shopee_api_order(jsonb,jsonb)','EXECUTE')
 OR NOT has_function_privilege('service_role','public.create_shopee_api_order(jsonb,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'writer grants regression';END IF;
END $test$;
SELECT 'p4_canonical_writer_seven_models_idempotency_and_negative_tests_passed' AS proof;
