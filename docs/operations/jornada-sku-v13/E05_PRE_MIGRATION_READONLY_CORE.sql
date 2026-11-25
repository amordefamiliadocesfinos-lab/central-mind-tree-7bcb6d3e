-- E05/P4 -> Gate de implantação Core / SOMENTE SELECT.
-- Executar apenas com acesso consultivo autorizado no Lovable Cloud oficial.
-- Fonte de verdade: mapeamentos reais do Core, nao exportacao Shopee.
-- Resultado esperado antes da migracao: 168 mappings, 4 contas, 0 duplicidades,
-- 0 chaves divergentes, 24 ressalvas fisicas, tabelas de SKU ainda ausentes.
WITH scope AS (
 SELECT m.id,m.channel_account_id,m.external_item_id,m.external_model_id,
        m.external_item_key,c.name AS account_name
 FROM public.marketplace_product_mappings m
 JOIN public.channel_accounts c ON c.id=m.channel_account_id
 WHERE c.name IN ('SHOPEE ADÃO','SHOPEE VIVIANE','SHOPEE CELIVIO','SHOPEE PRISCILA')
   AND m.marketplace='shopee'
   AND m.external_item_id IN ('23093522370','22798142097','23094148715','23194255040',
                               '21999552311','23293645454','22398650119','22194274841')
), duplicate_identity AS (
 SELECT channel_account_id,external_item_id,external_model_id FROM scope
 GROUP BY 1,2,3 HAVING count(*)<>1
), exception_40g AS (
 SELECT s.id FROM scope s WHERE s.external_item_id
   IN ('23093522370','22798142097','23094148715','23194255040')
 AND EXISTS(
  SELECT 1 FROM public.marketplace_product_mapping_items mi
  JOIN public.products p ON p.id=mi.product_id
  WHERE mi.mapping_id=s.id AND p.sku='TRF-ART-040-M'
 )
), summary AS (
 SELECT
  (SELECT count(*) FROM scope) AS model_count,
  (SELECT count(DISTINCT channel_account_id) FROM scope) AS account_count,
  (SELECT count(*) FROM duplicate_identity) AS duplicate_pairs,
  (SELECT count(*) FROM scope WHERE external_item_key
   IS DISTINCT FROM ('official:item:'||external_item_id||'|model:'||external_model_id)) AS bad_official_keys,
  (SELECT count(*) FROM exception_40g) AS exception_count,
  to_regclass('public.marketplace_seller_sku_state') IS NOT NULL AS state_table_present,
  to_regclass('public.marketplace_seller_sku_events') IS NOT NULL AS event_table_present,
  to_regprocedure('public.record_marketplace_seller_sku_state(uuid,uuid,bigint,jsonb)') IS NOT NULL AS writer_present,
  to_regprocedure('public.read_marketplace_seller_sku_consultive(uuid,text,text)') IS NOT NULL AS reader_present
)
SELECT *, (
 model_count=168 AND account_count=4 AND duplicate_pairs=0
 AND bad_official_keys=0 AND exception_count=24
 AND NOT state_table_present AND NOT event_table_present
 AND NOT writer_present AND NOT reader_present
) AS pre_migration_snapshot_matches
FROM summary;
