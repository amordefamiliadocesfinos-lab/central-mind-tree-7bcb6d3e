-- PR-G / T7 — corte definitivo do legado como writer do navegador.
-- Histórico permanece consultável; novas produções devem nascer em production_facts.

ALTER TABLE public.production_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on production_entries" ON public.production_entries;
DROP POLICY IF EXISTS "Authenticated read production_entries" ON public.production_entries;
CREATE POLICY "Authenticated read production_entries"
ON public.production_entries
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow all on production_logs" ON public.production_logs;
DROP POLICY IF EXISTS "Authenticated read production_logs" ON public.production_logs;
CREATE POLICY "Authenticated read production_logs"
ON public.production_logs
FOR SELECT TO authenticated
USING (true);

REVOKE ALL PRIVILEGES ON TABLE public.production_entries FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.production_logs FROM anon, authenticated;

GRANT SELECT ON TABLE public.production_entries TO authenticated;
GRANT SELECT ON TABLE public.production_logs TO authenticated;

GRANT ALL PRIVILEGES ON TABLE public.production_entries TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.production_logs TO service_role;
