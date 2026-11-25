-- Jornada SKU V1.3: pos-migracao apenas SELECT.
-- Executar SOMENTE apos aplicacao expressamente autorizada no Lovable Cloud oficial.
-- Na primeira implantacao, antes de popular: 0 estados e 0 eventos.
SELECT
 to_regclass('public.marketplace_seller_sku_state') IS NOT NULL AS state_table_present,
 to_regclass('public.marketplace_seller_sku_events') IS NOT NULL AS events_table_present,
 (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.marketplace_seller_sku_state')) AS state_rls_enabled,
 (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.marketplace_seller_sku_events')) AS events_rls_enabled,
 (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='marketplace_seller_sku_state'
  AND policyname='seller_sku_state_admin_read') AS state_admin_policies,
 (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='marketplace_seller_sku_events'
  AND policyname='seller_sku_events_admin_read') AS event_admin_policies,
 has_table_privilege('anon','public.marketplace_seller_sku_state','SELECT') AS anon_state_can_select,
 has_table_privilege('authenticated','public.marketplace_seller_sku_state','INSERT') AS authenticated_state_can_insert,
 has_table_privilege('authenticated','public.marketplace_seller_sku_events','UPDATE') AS authenticated_events_can_update,
 has_function_privilege('authenticated',
   'public.record_marketplace_seller_sku_state(uuid,uuid,bigint,jsonb)','EXECUTE') AS admin_writer_rpc_is_executable_by_authenticated,
 has_function_privilege('authenticated',
   'public.read_marketplace_seller_sku_consultive(uuid,text,text)','EXECUTE') AS authenticated_can_consultive_read,
 has_function_privilege('service_role',
   'public.read_marketplace_seller_sku_consultive(uuid,text,text)','EXECUTE') AS core_service_role_can_consultive_read,
 (SELECT count(*) FROM public.marketplace_seller_sku_state) AS state_rows,
 (SELECT count(*) FROM public.marketplace_seller_sku_events) AS event_rows;
-- O GRANT EXECUTE em authenticated NAO significa permissao de escrita generica:
-- a RPC valida usuario autenticado ativo/administrador no banco, revision, idempotencia e evidencia.
-- Resultado esperado no primeiro gate: tabelas/RLS true, policies 1,
-- anon SELECT false, inserts/updates diretos false,
-- authenticated writer EXECUTE true mas negado internamente a nao-admin,
-- authenticated consultive false, service_role consultive true,
-- state_rows=0, event_rows=0.
