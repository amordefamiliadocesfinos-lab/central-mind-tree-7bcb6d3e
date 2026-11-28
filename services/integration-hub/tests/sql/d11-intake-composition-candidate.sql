-- Disposable candidate: first transactional proof for exact official mappings.
-- No route or production migration. Do not use legacy alias or special sealed
-- presentation without a dedicated transaction proof.
CREATE FUNCTION public.commit_shopee_d11_intake(
 p_account uuid,p_lease uuid,p_revision integer,p_observation uuid,p_projection jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v public.shopee_cycle_state%ROWTYPE; e jsonb; o jsonb; raw_item jsonb; line jsonb;
 m public.marketplace_product_mappings%ROWTYPE; c record;
 items jsonb; sn text; item_id text; model_id text; pair text; seen text[]:=ARRAY[]::text[];
 account_name text; qty numeric; price numeric; expected_price numeric; n integer; expected_count integer:=0;
 x jsonb; oid uuid; sep uuid; requested_total numeric;
BEGIN
 IF p_account IS NULL OR p_lease IS NULL OR p_revision IS NULL OR p_revision<1 OR p_observation IS NULL
  OR p_account IN ('8a8ad166-0317-4597-8be6-e43fb46b4d1b','b4027369-5abf-4ac1-ab24-862334fae892')
  OR jsonb_typeof(p_projection) IS DISTINCT FROM 'object'
 THEN RETURN jsonb_build_object('status','intake_scope_refused'); END IF;
 SELECT * INTO v FROM public.shopee_cycle_state WHERE channel_account_id=p_account FOR UPDATE;
 IF NOT FOUND OR v.lease_id IS DISTINCT FROM p_lease OR v.lease_policy_revision IS DISTINCT FROM p_revision
  OR NOT public.check_shopee_cycle_policy_lease(p_account,p_lease,p_revision,'intake')
 THEN RETURN jsonb_build_object('status','intake_scope_refused'); END IF;
 e:=public.read_shopee_cycle_observation(p_account,p_lease,p_revision,'intake');
 IF e IS NULL OR e->>'observation_id' IS DISTINCT FROM p_observation::text
 THEN RETURN jsonb_build_object('status','intake_observation_refused'); END IF;
 sn:=v.candidate_order_sn; o:=e#>'{payload,response,order_list,0}';
 items:=p_projection->'items';
 IF p_projection->>'channel_account_id' IS DISTINCT FROM p_account::text
  OR p_projection->>'order_number' IS DISTINCT FROM sn
  OR o->>'order_sn' IS DISTINCT FROM sn
  OR p_projection->>'external_status' IS DISTINCT FROM o->>'order_status'
  OR jsonb_typeof(items) IS DISTINCT FROM 'array'
  OR jsonb_typeof(o->'item_list') IS DISTINCT FROM 'array'
 THEN RETURN jsonb_build_object('status','intake_projection_refused'); END IF;
 IF jsonb_array_length(items) NOT BETWEEN 1 AND 120 OR jsonb_array_length(o->'item_list') NOT BETWEEN 1 AND 30
  OR coalesce(o->>'total_amount','') !~ '^[0-9]+([.][0-9]+)?$'
  OR coalesce(p_projection->>'total_value','') !~ '^[0-9]+([.][0-9]+)?$'
 THEN RETURN jsonb_build_object('status','intake_projection_refused'); END IF;
 requested_total:=(p_projection->>'total_value')::numeric;
 IF requested_total IS DISTINCT FROM (o->>'total_amount')::numeric
  OR p_projection->>'order_date' IS DISTINCT FROM to_char(to_timestamp((o->>'create_time')::bigint) AT TIME ZONE 'UTC','YYYY-MM-DD')
  OR nullif(btrim(p_projection->>'payment_method'),'') IS DISTINCT FROM nullif(btrim(o->>'payment_method'),'')
  OR nullif(btrim(p_projection->>'buyer_message'),'') IS DISTINCT FROM nullif(btrim(o->>'message_to_seller'),'')
 THEN RETURN jsonb_build_object('status','intake_projection_refused'); END IF;
 SELECT name INTO account_name FROM public.channel_accounts WHERE id=p_account AND is_active;
 IF NOT FOUND OR p_projection->>'marketplace_account' IS DISTINCT FROM account_name
 THEN RETURN jsonb_build_object('status','intake_scope_refused'); END IF;
 -- Same order lock as the canonical writer. Existing (including tombstones)
 -- is a reconciliation problem, never a fallback import.
 PERFORM pg_advisory_xact_lock(hashtext('shopee-api-order:'||p_account::text||':'||sn));
 IF EXISTS(SELECT 1 FROM public.orders WHERE channel='shopee' AND channel_account_id=p_account AND order_number=sn)
 THEN RETURN jsonb_build_object('status','intake_existing_requires_reconciliation'); END IF;
 -- The official scoped identity is unique in Core. Acquire mapping row locks
 -- in stable order; FK component insertions conflict with FOR UPDATE.
 -- This first proof refuses legacy-only mapping or presentation special cases.
 FOR raw_item IN SELECT value FROM jsonb_array_elements(o->'item_list') ORDER BY value->>'item_id',value->>'model_id' LOOP
  item_id:=raw_item->>'item_id'; model_id:=raw_item->>'model_id'; pair:=item_id||':'||model_id;
  IF coalesce(item_id,'') !~ '^[0-9]{1,19}$' OR coalesce(model_id,'') !~ '^[0-9]{1,19}$'
   OR pair=ANY(seen) OR coalesce(raw_item->>'model_quantity_purchased','') !~ '^[1-9][0-9]{0,9}$'
  THEN RETURN jsonb_build_object('status','intake_item_refused'); END IF;
  seen:=array_append(seen,pair); qty:=(raw_item->>'model_quantity_purchased')::numeric;
  price:=NULL;
  IF coalesce(raw_item->>'model_discounted_price','') ~ '^[0-9]+([.][0-9]+)?$' THEN price:=(raw_item->>'model_discounted_price')::numeric;
  ELSIF coalesce(raw_item->>'model_original_price','') ~ '^[0-9]+([.][0-9]+)?$' THEN price:=(raw_item->>'model_original_price')::numeric; END IF;
  SELECT * INTO m FROM public.marketplace_product_mappings
   WHERE marketplace='shopee' AND channel_account_id=p_account AND external_item_id=item_id AND external_model_id=model_id FOR UPDATE;
  IF NOT FOUND OR EXISTS(SELECT 1 FROM public.marketplace_product_mappings z WHERE z.marketplace='shopee'
   AND z.channel_account_id IS NULL AND z.marketplace_account=account_name AND z.external_item_id=item_id AND z.external_model_id=model_id)
  THEN RETURN jsonb_build_object('status','intake_mapping_refused'); END IF;
  PERFORM 1 FROM public.marketplace_product_mapping_items WHERE mapping_id=m.id ORDER BY id FOR SHARE;
  IF EXISTS(SELECT 1 FROM public.marketplace_product_mapping_items WHERE mapping_id=m.id GROUP BY position HAVING count(*)>1)
  THEN RETURN jsonb_build_object('status','intake_mapping_refused'); END IF;
  FOR c IN
   SELECT product_id,variant_id,physical_multiplier,position FROM public.marketplace_product_mapping_items WHERE mapping_id=m.id
   UNION ALL SELECT m.product_id,m.variant_id,m.physical_multiplier,0 WHERE NOT EXISTS(SELECT 1 FROM public.marketplace_product_mapping_items WHERE mapping_id=m.id)
   ORDER BY position
  LOOP
   expected_count:=expected_count+1;
   IF c.product_id IS NULL OR c.physical_multiplier IS NULL OR c.physical_multiplier<=0 OR c.position IS NULL
   THEN RETURN jsonb_build_object('status','intake_mapping_refused'); END IF;
   -- Lock the physical catalog rows used by the canonical writer.
   PERFORM 1 FROM public.products WHERE id=c.product_id AND is_active AND deleted_at IS NULL FOR SHARE;
   IF NOT FOUND THEN RETURN jsonb_build_object('status','intake_mapping_refused'); END IF;
   IF c.variant_id IS NOT NULL THEN
    PERFORM 1 FROM public.product_variants WHERE id=c.variant_id AND product_id=c.product_id AND is_active FOR SHARE;
    IF NOT FOUND THEN RETURN jsonb_build_object('status','intake_mapping_refused'); END IF;
   END IF;
   SELECT count(*) INTO n FROM jsonb_array_elements(items) z WHERE z->>'item_id'=item_id AND z->>'model_id'=model_id
    AND z->>'composition_position'=c.position::text;
   IF n<>1 THEN RETURN jsonb_build_object('status','intake_composition_refused'); END IF;
   SELECT value INTO line FROM jsonb_array_elements(items) WHERE value->>'item_id'=item_id AND value->>'model_id'=model_id
    AND value->>'composition_position'=c.position::text;
   IF nullif(line->>'commercial_presentation_id','') IS NOT NULL
   THEN RETURN jsonb_build_object('status','intake_presentation_requires_proof'); END IF;
   expected_price:=CASE WHEN c.position=coalesce((SELECT min(position) FROM public.marketplace_product_mapping_items WHERE mapping_id=m.id),0) THEN price ELSE 0 END;
   IF line->>'mapping_id' IS DISTINCT FROM m.id::text OR line->>'product_id' IS DISTINCT FROM c.product_id::text
    OR nullif(line->>'variant_id','') IS DISTINCT FROM c.variant_id::text
    OR coalesce(line->>'commercial_quantity','') !~ '^[0-9]+([.][0-9]+)?$'
    OR coalesce(line->>'physical_multiplier','') !~ '^[0-9]+([.][0-9]+)?$'
    OR coalesce(line->>'quantity','') !~ '^[1-9][0-9]{0,9}$'
    OR (line->>'unit_price' IS NOT NULL AND line->>'unit_price' !~ '^[0-9]+([.][0-9]+)?$')
   THEN RETURN jsonb_build_object('status','intake_composition_refused'); END IF;
   IF (line->>'commercial_quantity')::numeric IS DISTINCT FROM qty OR (line->>'physical_multiplier')::numeric IS DISTINCT FROM c.physical_multiplier
    OR (line->>'quantity')::numeric IS DISTINCT FROM qty*c.physical_multiplier
    OR (line->>'unit_price')::numeric IS DISTINCT FROM expected_price
   THEN RETURN jsonb_build_object('status','intake_composition_refused'); END IF;
  END LOOP;
 END LOOP;
 IF expected_count<>jsonb_array_length(items) THEN RETURN jsonb_build_object('status','intake_composition_refused'); END IF;
 e:=public.read_shopee_cycle_observation(p_account,p_lease,p_revision,'intake');
 IF e IS NULL OR e->>'observation_id' IS DISTINCT FROM p_observation::text
 THEN RETURN jsonb_build_object('status','intake_observation_refused'); END IF;
 -- Call the SAME canonical writer. Any mismatch after writing raises and
 -- rolls back the whole RPC transaction, not a partial order or separation.
 x:=public.create_shopee_api_order(p_projection-'items',items);
 oid:=(x->>'order_id')::uuid; sep:=(x->>'separation_id')::uuid;
 IF oid IS NULL OR sep IS NULL OR x->>'already_registered' IS DISTINCT FROM 'false'
  OR NOT EXISTS(SELECT 1 FROM public.orders WHERE id=oid AND channel_account_id=p_account AND order_number=sn
   AND channel='shopee' AND sale_origin='shopee_open_platform' AND deleted_at IS NULL AND status='pendente'
   AND operational_status='todo' AND total_value=requested_total)
  OR NOT EXISTS(SELECT 1 FROM public.order_separation WHERE id=sep AND order_id=oid AND separation_status='todo')
  OR EXISTS(
   (SELECT product_id,variant_id,quantity,unit_price FROM public.order_items WHERE order_id=oid
    EXCEPT ALL SELECT (i->>'product_id')::uuid,nullif(i->>'variant_id','')::uuid,(i->>'quantity')::integer,
     round((i->>'commercial_quantity')::numeric*(i->>'unit_price')::numeric/(i->>'quantity')::numeric,10) FROM jsonb_array_elements(items) i)
   UNION ALL
   (SELECT (i->>'product_id')::uuid,nullif(i->>'variant_id','')::uuid,(i->>'quantity')::integer,
     round((i->>'commercial_quantity')::numeric*(i->>'unit_price')::numeric/(i->>'quantity')::numeric,10) FROM jsonb_array_elements(items) i
    EXCEPT ALL SELECT product_id,variant_id,quantity,unit_price FROM public.order_items WHERE order_id=oid))
 THEN RAISE EXCEPTION 'd11_intake_postwrite_integrity_failed'; END IF;
 RETURN jsonb_build_object('status','intake_written','order_id',oid,'separation_id',sep,'observation_id',p_observation);
END $$;
REVOKE ALL ON FUNCTION public.commit_shopee_d11_intake(uuid,uuid,integer,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_shopee_d11_intake(uuid,uuid,integer,uuid,jsonb) TO service_role;
