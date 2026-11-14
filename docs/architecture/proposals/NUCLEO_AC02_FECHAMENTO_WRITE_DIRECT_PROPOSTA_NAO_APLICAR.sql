-- AC-02 / proposta de FECHAMENTO DA ESCRITA DIRETA. APENAS CI DESCARTÁVEL.
-- Complementa a proposta de ledger #817/#821; NÃO É migration produtiva.
-- Importante: NÃO abre escritor substituto. O próximo gateway precisará de
-- mecanismo próprio de sessão ativa e permissão mínima, sujeito a novo aceite.
BEGIN;
DO $guard$
BEGIN
 IF to_regclass('public.nucleo_ac02_handoff_events') IS NULL THEN
  RAISE EXCEPTION 'AC02 ledger proposal must exist before write gate';
 END IF;
END $guard$;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.nucleo_ac02_handoff_events
 FROM PUBLIC, anon, authenticated, service_role;
DROP POLICY IF EXISTS nucleo_ac02_handoff_insert ON public.nucleo_ac02_handoff_events;
-- Sem INSERT efetivo via Data API/JWT. SELECT mantém RLS de gestor/destinatário.
-- Qualquer escritor futuro precisará de autorização específica, não de SERVICE_ROLE
-- exposto no cliente, nem de função SECURITY DEFINER pública.
COMMIT;
