-- M9 Health — performance hardening for foreign-key maintenance paths.
-- No business-rule changes. Adds leading indexes for FKs flagged by post-DDL audit.

CREATE INDEX health_biomarker_aliases_reviewed_by_idx
ON public.health_biomarker_aliases(reviewed_by_auth_user_id)
WHERE reviewed_by_auth_user_id IS NOT NULL;

CREATE INDEX health_biomarker_states_canonical_code_idx
ON public.health_biomarker_longitudinal_states(canonical_code);

CREATE INDEX health_biomarker_states_latest_result_idx
ON public.health_biomarker_longitudinal_states(latest_result_id)
WHERE latest_result_id IS NOT NULL;

CREATE INDEX health_biomarker_states_previous_result_idx
ON public.health_biomarker_longitudinal_states(previous_result_id)
WHERE previous_result_id IS NOT NULL;

CREATE INDEX health_biomarker_results_canonical_code_fk_idx
ON public.health_biomarker_results(canonical_code)
WHERE canonical_code IS NOT NULL;

CREATE INDEX health_clinical_extractions_confirmed_by_idx
ON public.health_clinical_document_extractions(confirmed_by_auth_user_id)
WHERE confirmed_by_auth_user_id IS NOT NULL;

CREATE INDEX health_clinical_extractions_rejected_by_idx
ON public.health_clinical_document_extractions(rejected_by_auth_user_id)
WHERE rejected_by_auth_user_id IS NOT NULL;

CREATE INDEX health_clinical_extractions_created_by_idx
ON public.health_clinical_document_extractions(created_by_auth_user_id)
WHERE created_by_auth_user_id IS NOT NULL;

CREATE INDEX health_clinical_extractions_document_athlete_fk_idx
ON public.health_clinical_document_extractions(document_id, athlete_id);

CREATE INDEX health_clinical_documents_created_by_idx
ON public.health_clinical_documents(created_by_auth_user_id)
WHERE created_by_auth_user_id IS NOT NULL;

CREATE INDEX health_clinical_documents_supersedes_idx
ON public.health_clinical_documents(supersedes_document_id)
WHERE supersedes_document_id IS NOT NULL;

CREATE INDEX health_lab_reports_created_by_idx
ON public.health_lab_reports(created_by_auth_user_id)
WHERE created_by_auth_user_id IS NOT NULL;

CREATE INDEX health_lab_reports_document_athlete_idx
ON public.health_lab_reports(document_id, athlete_id)
WHERE document_id IS NOT NULL;

CREATE INDEX health_lab_reports_extraction_athlete_idx
ON public.health_lab_reports(extraction_id, athlete_id)
WHERE extraction_id IS NOT NULL;

CREATE INDEX health_lab_reports_supersedes_idx
ON public.health_lab_reports(supersedes_lab_report_id)
WHERE supersedes_lab_report_id IS NOT NULL;

CREATE INDEX health_recovery_checkins_created_by_idx
ON public.health_recovery_checkins(created_by_auth_user_id)
WHERE created_by_auth_user_id IS NOT NULL;

CREATE INDEX health_sleep_device_observations_created_by_idx
ON public.health_sleep_device_observations(created_by_auth_user_id)
WHERE created_by_auth_user_id IS NOT NULL;

CREATE INDEX health_vital_observations_created_by_idx
ON public.health_vital_observations(created_by_auth_user_id)
WHERE created_by_auth_user_id IS NOT NULL;

CREATE INDEX health_vital_observations_supersedes_idx
ON public.health_vital_observations(supersedes_vital_observation_id)
WHERE supersedes_vital_observation_id IS NOT NULL;
