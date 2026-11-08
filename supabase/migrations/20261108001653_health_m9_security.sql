-- M9 Health — RLS, Data API grants, and RPC execute permissions.
-- Facts and derived states are SELECT-only to authenticated clients; writes are RPC-only.

ALTER TABLE public.health_sleep_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_recovery_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_sleep_device_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_sleep_recovery_rolling_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_clinical_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_clinical_document_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_lab_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_biomarker_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_biomarker_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_biomarker_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_biomarker_longitudinal_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_vital_observations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
  public.health_sleep_periods,
  public.health_recovery_checkins,
  public.health_sleep_device_observations,
  public.health_sleep_recovery_rolling_states,
  public.health_clinical_documents,
  public.health_clinical_document_extractions,
  public.health_lab_reports,
  public.health_biomarker_results,
  public.health_biomarker_catalog,
  public.health_biomarker_aliases,
  public.health_biomarker_longitudinal_states,
  public.health_vital_observations
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON
  public.health_sleep_periods,
  public.health_recovery_checkins,
  public.health_sleep_device_observations,
  public.health_sleep_recovery_rolling_states,
  public.health_clinical_documents,
  public.health_clinical_document_extractions,
  public.health_lab_reports,
  public.health_biomarker_results,
  public.health_biomarker_longitudinal_states,
  public.health_vital_observations
TO authenticated;

GRANT SELECT ON public.health_biomarker_catalog TO authenticated;

CREATE POLICY health_sleep_periods_select
ON public.health_sleep_periods FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_recovery_checkins_select
ON public.health_recovery_checkins FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_sleep_device_observations_select
ON public.health_sleep_device_observations FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_sleep_recovery_states_select
ON public.health_sleep_recovery_rolling_states FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_clinical_documents_select
ON public.health_clinical_documents FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_clinical_extractions_select
ON public.health_clinical_document_extractions FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_lab_reports_select
ON public.health_lab_reports FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_biomarker_results_select
ON public.health_biomarker_results FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_biomarker_states_select
ON public.health_biomarker_longitudinal_states FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_vital_observations_select
ON public.health_vital_observations FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_biomarker_catalog_select
ON public.health_biomarker_catalog FOR SELECT TO authenticated
USING (true);

-- No policy/grant for health_biomarker_aliases in v1.
-- Aliases remain an internal mapping resource used by privileged RPCs.

DO $$
DECLARE
  v_proc regprocedure;
BEGIN
  FOR v_proc IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'health_m9_%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_proc);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_proc);
  END LOOP;
END;
$$;
