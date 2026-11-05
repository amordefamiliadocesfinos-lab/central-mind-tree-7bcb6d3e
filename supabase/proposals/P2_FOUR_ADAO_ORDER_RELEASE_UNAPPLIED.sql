-- P2 Adão release: replaces indiscriminate quarantine with canonical presentation gate.
-- No order creation, inventory change, balance initialization or trigger deletion.
-- Keep both existing P3 triggers enabled; they invoke this same guarded function.
-- A mapped ORIGINAL is admitted to order registration only with exact presentation
-- and integer physical mass. Dispatch is independently protected by the P2 writer.
CREATE OR REPLACE FUNCTION public.p3_adao_four_protect_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $p2$
DECLARE
 v_adao boolean:=false;
 v_approved boolean:=false;
BEGIN
 IF TG_TABLE_NAME='order_items' THEN
   IF NEW.product_id NOT IN (
      '0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b'::uuid,
      '6f43ad65-74d5-4db9-b931-1ecd6d124987'::uuid,
      'ef118d1c-e7c7-45e3-b796-3a9908840f3c'::uuid,
      'd913f0f2-4893-4985-9976-fcd9119a57b1'::uuid
   ) THEN RETURN NEW; END IF;
   SELECT EXISTS(SELECT 1 FROM public.orders o WHERE o.id=NEW.order_id
     AND o.channel='shopee'
     AND (o.channel_account_id='b4027369-5abf-4ac1-ab24-862334fae892'::uuid
          OR o.marketplace_account='SHOPEE ADÃO')) INTO v_adao;
   IF NOT v_adao THEN RETURN NEW; END IF;
   SELECT EXISTS(
      SELECT 1 FROM (VALUES
       ('0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b'::uuid,'b1bdfd2f-0278-4273-9e19-2544c8a3d758'::uuid,10665),
       ('0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b'::uuid,'008d57c4-63b6-4c30-80fd-161ca368fd66'::uuid,395),
       ('6f43ad65-74d5-4db9-b931-1ecd6d124987'::uuid,'684d4a55-5d3a-4c18-be47-818a1a3bc074'::uuid,1000),
       ('ef118d1c-e7c7-45e3-b796-3a9908840f3c'::uuid,'f093c456-f757-4efe-b575-8177b8b1d607'::uuid,1000),
       ('d913f0f2-4893-4985-9976-fcd9119a57b1'::uuid,'40809f6d-687c-493b-ac4d-67a602cceba0'::uuid,9800)
      ) AS expected(product_id,presentation_id,factor)
      WHERE NEW.product_id=expected.product_id
        AND NEW.commercial_presentation_id=expected.presentation_id
        AND NEW.variant_id IS NULL
        AND NEW.commercial_quantity>0
        AND NEW.commercial_quantity=trunc(NEW.commercial_quantity)
        AND NEW.quantity=NEW.commercial_quantity*expected.factor
   ) INTO v_approved;
 ELSIF TG_TABLE_NAME='orders' THEN
   IF NEW.channel<>'shopee' OR NOT (
       NEW.channel_account_id='b4027369-5abf-4ac1-ab24-862334fae892'::uuid
       OR NEW.marketplace_account='SHOPEE ADÃO'
   ) THEN RETURN NEW; END IF;
   -- Account reassignment must not smuggle ambiguous P2 items into Adão.
   SELECT NOT EXISTS (
     SELECT 1 FROM public.order_items oi WHERE oi.order_id=NEW.id
       AND oi.product_id IN (
         '0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b'::uuid,
         '6f43ad65-74d5-4db9-b931-1ecd6d124987'::uuid,
         'ef118d1c-e7c7-45e3-b796-3a9908840f3c'::uuid,
         'd913f0f2-4893-4985-9976-fcd9119a57b1'::uuid
       )
       AND NOT EXISTS (
         SELECT 1 FROM (VALUES
          ('0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b'::uuid,'b1bdfd2f-0278-4273-9e19-2544c8a3d758'::uuid,10665),
          ('0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b'::uuid,'008d57c4-63b6-4c30-80fd-161ca368fd66'::uuid,395),
          ('6f43ad65-74d5-4db9-b931-1ecd6d124987'::uuid,'684d4a55-5d3a-4c18-be47-818a1a3bc074'::uuid,1000),
          ('ef118d1c-e7c7-45e3-b796-3a9908840f3c'::uuid,'f093c456-f757-4efe-b575-8177b8b1d607'::uuid,1000),
          ('d913f0f2-4893-4985-9976-fcd9119a57b1'::uuid,'40809f6d-687c-493b-ac4d-67a602cceba0'::uuid,9800)
         ) AS expected(product_id,presentation_id,factor)
         WHERE oi.product_id=expected.product_id
           AND oi.commercial_presentation_id=expected.presentation_id
           AND oi.variant_id IS NULL
           AND oi.commercial_quantity>0
           AND oi.commercial_quantity=trunc(oi.commercial_quantity)
           AND oi.quantity=oi.commercial_quantity*expected.factor
       )
   ) INTO v_approved;
 ELSE
   RAISE EXCEPTION 'p2_four_unexpected_trigger_table';
 END IF;
 IF NOT COALESCE(v_approved,false) THEN
    RAISE EXCEPTION 'p2_four_adao_requires_canonical_original_presentation';
 END IF;
 RETURN NEW;
END;
$p2$;
