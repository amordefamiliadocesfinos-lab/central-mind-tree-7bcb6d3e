-- M6 Health — Nutrition State Security

ALTER TABLE public.health_nutrition_daily_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_nutrition_rolling_states ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.health_nutrition_daily_states FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.health_nutrition_rolling_states FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.health_nutrition_daily_states TO authenticated;
GRANT SELECT ON public.health_nutrition_rolling_states TO authenticated;

CREATE POLICY health_nutrition_daily_states_select
ON public.health_nutrition_daily_states
FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_nutrition_rolling_states_select
ON public.health_nutrition_rolling_states
FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

REVOKE ALL ON FUNCTION public.health_m6_target_status(numeric,numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.health_m6_target_status(numeric,numeric,numeric) TO authenticated;

REVOKE ALL ON FUNCTION public.health_m6_refresh_daily_state(uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.health_m6_refresh_daily_state(uuid,date) TO authenticated;

REVOKE ALL ON FUNCTION public.health_m6_refresh_rolling_state(uuid,date,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.health_m6_refresh_rolling_state(uuid,date,integer) TO authenticated;
