-- F11 Health — RLS, Data API grants, and evaluator permissions.
-- Authenticated clients can read authorized decisions; writes are evaluator-RPC only.

ALTER TABLE public.health_integrated_decision_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_integrated_decisions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
  public.health_integrated_decision_runs,
  public.health_integrated_decisions
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON
  public.health_integrated_decision_runs,
  public.health_integrated_decisions
TO authenticated;

CREATE POLICY health_integrated_decision_runs_select
ON public.health_integrated_decision_runs
FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_integrated_decisions_select
ON public.health_integrated_decisions
FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

REVOKE ALL ON FUNCTION public.health_f11_evaluate_integrated_decision(uuid,date,integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.health_f11_evaluate_integrated_decision(uuid,date,integer)
TO authenticated;
