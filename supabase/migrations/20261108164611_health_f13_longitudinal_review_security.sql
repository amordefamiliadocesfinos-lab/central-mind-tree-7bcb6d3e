-- F13 Health — RLS, Data API grants, and RPC permissions.

ALTER TABLE public.health_longitudinal_review_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_longitudinal_review_outcomes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
  public.health_longitudinal_review_runs,
  public.health_longitudinal_review_outcomes
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON
  public.health_longitudinal_review_runs,
  public.health_longitudinal_review_outcomes
TO authenticated;

CREATE POLICY health_longitudinal_review_runs_select
ON public.health_longitudinal_review_runs
FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_longitudinal_review_outcomes_select
ON public.health_longitudinal_review_outcomes
FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

REVOKE ALL ON FUNCTION public.health_f13_generate_longitudinal_review(uuid,date,integer)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.health_f13_record_review_outcome(uuid,text,text[],text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.health_f13_generate_longitudinal_review(uuid,date,integer)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.health_f13_record_review_outcome(uuid,text,text[],text)
TO authenticated;
