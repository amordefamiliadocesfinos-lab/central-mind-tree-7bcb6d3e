-- Manual containment only; preserves all data and global defaults. Not automatically executed.
BEGIN;
SET LOCAL lock_timeout='3s';
REVOKE ALL ON SCHEMA nucleo_identity FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA nucleo_identity FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA nucleo_identity FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.nucleo_identity_context_read(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.nucleo_identity_assignments_read(uuid) FROM PUBLIC,anon,authenticated;
DO $$BEGIN
 IF has_schema_privilege('authenticated','nucleo_identity','USAGE') OR has_function_privilege('authenticated','public.nucleo_identity_context_read(uuid)','EXECUTE') OR has_function_privilege('authenticated','public.nucleo_identity_assignments_read(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'IDENTITY_CONTAINMENT_FAILED'; END IF;
END $$;
COMMIT;
