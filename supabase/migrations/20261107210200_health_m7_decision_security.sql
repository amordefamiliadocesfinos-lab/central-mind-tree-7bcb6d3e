-- M7 Health — Nutrition Decision Security

ALTER TABLE public.health_nutrition_decisions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.health_nutrition_decisions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.health_nutrition_decisions TO authenticated;

CREATE POLICY health_nutrition_decisions_select
ON public.health_nutrition_decisions
FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

REVOKE ALL ON FUNCTION public.health_m7_evaluate_nutrition_decision(uuid,date,integer)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.health_m7_evaluate_nutrition_decision(uuid,date,integer)
TO authenticated;
