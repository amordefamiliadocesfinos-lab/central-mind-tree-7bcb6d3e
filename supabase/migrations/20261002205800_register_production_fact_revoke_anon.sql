-- F01.4 — endurecimento de permissão do motor de Fato Real de Produção.
-- O ambiente possui default privilege explícito de EXECUTE para anon em funções.
-- Esta RPC altera estoque físico e deve ser executável somente por usuários autenticados
-- ou service_role.

REVOKE ALL ON FUNCTION public.register_production_fact(
  uuid, uuid, numeric, text, text, uuid, text, uuid, timestamptz
) FROM anon;

REVOKE ALL ON FUNCTION public.register_production_fact(
  uuid, uuid, numeric, text, text, uuid, text, uuid, timestamptz
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.register_production_fact(
  uuid, uuid, numeric, text, text, uuid, text, uuid, timestamptz
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.register_production_fact(
  uuid, uuid, numeric, text, text, uuid, text, uuid, timestamptz
) TO service_role;
