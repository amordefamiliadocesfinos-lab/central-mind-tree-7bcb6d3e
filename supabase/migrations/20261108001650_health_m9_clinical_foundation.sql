-- M9B Health — Clinical documents, exams, biomarkers, and vital observations foundation.
-- Original clinical facts are preserved; interpretation is out of scope.

CREATE TABLE public.health_clinical_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (
    document_type IN ('laboratory_report','medical_report','imaging_report','device_report','other_health_document')
  ),
  original_filename text NOT NULL CHECK (btrim(original_filename) <> ''),
  document_date date NULL,
  provider_name text NULL,
  object_path text NOT NULL CHECK (btrim(object_path) <> ''),
  mime_type text NOT NULL CHECK (btrim(mime_type) <> ''),
  sha256 text NULL,
  data_source text NOT NULL DEFAULT 'USER_REPORTED' CHECK (
    data_source IN ('USER_REPORTED','IMPORTED','PROFESSIONAL_RECORDED')
  ),
  notes text NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','superseded','voided')),
  supersedes_document_id uuid NULL REFERENCES public.health_clinical_documents(id) ON DELETE RESTRICT,
  void_reason text NULL,
  status_changed_at timestamptz NULL,
  created_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, athlete_id),
  CHECK (supersedes_document_id IS NULL OR supersedes_document_id <> id),
  CHECK ((status='voided' AND NULLIF(btrim(void_reason),'') IS NOT NULL) OR status <> 'voided')
);

CREATE INDEX health_clinical_documents_athlete_date_idx
ON public.health_clinical_documents(athlete_id, document_date DESC, created_at DESC);

CREATE INDEX health_clinical_documents_status_idx
ON public.health_clinical_documents(athlete_id, status, created_at DESC);

CREATE TABLE public.health_clinical_document_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending','extracting','extracted','review_required','confirmed','rejected','failed')
  ),
  engine_provider text NULL,
  engine_version text NULL,
  structured_payload jsonb NULL,
  field_confidences jsonb NULL,
  warnings jsonb NULL,
  error_message text NULL,
  confirmed_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at timestamptz NULL,
  rejected_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  rejected_at timestamptz NULL,
  created_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, athlete_id),
  CONSTRAINT health_clinical_extractions_document_athlete_fkey
    FOREIGN KEY (document_id, athlete_id)
    REFERENCES public.health_clinical_documents(id, athlete_id)
    ON DELETE RESTRICT
);

CREATE INDEX health_clinical_extractions_document_idx
ON public.health_clinical_document_extractions(athlete_id, document_id, created_at DESC);

CREATE INDEX health_clinical_extractions_status_idx
ON public.health_clinical_document_extractions(athlete_id, status, updated_at DESC);

CREATE TABLE public.health_lab_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  document_id uuid NULL,
  extraction_id uuid NULL,
  laboratory_name text NULL,
  collected_at timestamptz NULL,
  resulted_at timestamptz NULL,
  fasting_status text NULL CHECK (fasting_status IS NULL OR fasting_status IN ('fasting','non_fasting','unknown')),
  collection_context jsonb NULL,
  data_source text NOT NULL DEFAULT 'USER_REPORTED' CHECK (
    data_source IN ('USER_REPORTED','IMPORTED','PROFESSIONAL_RECORDED')
  ),
  confidence text NOT NULL DEFAULT 'moderate' CHECK (confidence IN ('low','moderate','high')),
  client_event_id uuid NULL,
  notes text NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','superseded','voided')),
  supersedes_lab_report_id uuid NULL REFERENCES public.health_lab_reports(id) ON DELETE RESTRICT,
  void_reason text NULL,
  status_changed_at timestamptz NULL,
  created_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, athlete_id),
  UNIQUE (athlete_id, client_event_id),
  CHECK (supersedes_lab_report_id IS NULL OR supersedes_lab_report_id <> id),
  CHECK ((status='voided' AND NULLIF(btrim(void_reason),'') IS NOT NULL) OR status <> 'voided'),
  CONSTRAINT health_lab_reports_document_athlete_fkey
    FOREIGN KEY (document_id, athlete_id)
    REFERENCES public.health_clinical_documents(id, athlete_id)
    ON DELETE RESTRICT,
  CONSTRAINT health_lab_reports_extraction_athlete_fkey
    FOREIGN KEY (extraction_id, athlete_id)
    REFERENCES public.health_clinical_document_extractions(id, athlete_id)
    ON DELETE RESTRICT
);

CREATE INDEX health_lab_reports_athlete_date_idx
ON public.health_lab_reports(athlete_id, collected_at DESC, resulted_at DESC, created_at DESC);

CREATE INDEX health_lab_reports_status_idx
ON public.health_lab_reports(athlete_id, status, created_at DESC);

CREATE TABLE public.health_biomarker_catalog (
  canonical_code text PRIMARY KEY CHECK (btrim(canonical_code) <> ''),
  display_name text NOT NULL CHECK (btrim(display_name) <> ''),
  category text NOT NULL CHECK (btrim(category) <> ''),
  expected_value_type text NOT NULL DEFAULT 'mixed' CHECK (expected_value_type IN ('numeric','text','qualitative','mixed')),
  external_coding_system text NULL,
  external_code text NULL,
  coding_version text NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.health_biomarker_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_alias text NOT NULL CHECK (btrim(normalized_alias) <> ''),
  provider_name text NULL,
  canonical_code text NOT NULL REFERENCES public.health_biomarker_catalog(canonical_code) ON DELETE RESTRICT,
  mapping_confidence text NOT NULL DEFAULT 'reviewed' CHECK (mapping_confidence IN ('low','moderate','high','reviewed')),
  mapping_version text NOT NULL DEFAULT 'M9_BIOMARKER_ALIAS_V1' CHECK (btrim(mapping_version) <> ''),
  reviewed_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX health_biomarker_aliases_unique_idx
ON public.health_biomarker_aliases(lower(normalized_alias), COALESCE(lower(provider_name),''));

CREATE INDEX health_biomarker_aliases_code_idx
ON public.health_biomarker_aliases(canonical_code);

CREATE TABLE public.health_biomarker_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_report_id uuid NOT NULL,
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  original_analyte_name text NOT NULL CHECK (btrim(original_analyte_name) <> ''),
  canonical_code text NULL REFERENCES public.health_biomarker_catalog(canonical_code) ON DELETE RESTRICT,
  original_result_text text NOT NULL CHECK (btrim(original_result_text) <> ''),
  numeric_value numeric(20,6) NULL,
  original_unit text NULL,
  normalized_value numeric(20,6) NULL,
  normalized_unit_ucum text NULL,
  original_reference_text text NULL,
  reference_low numeric(20,6) NULL,
  reference_high numeric(20,6) NULL,
  original_flag text NULL,
  method_text text NULL,
  confidence text NOT NULL DEFAULT 'moderate' CHECK (confidence IN ('low','moderate','high')),
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT health_biomarker_results_report_athlete_fkey
    FOREIGN KEY (lab_report_id, athlete_id)
    REFERENCES public.health_lab_reports(id, athlete_id)
    ON DELETE RESTRICT
);

CREATE INDEX health_biomarker_results_report_idx
ON public.health_biomarker_results(lab_report_id, athlete_id);

CREATE INDEX health_biomarker_results_code_idx
ON public.health_biomarker_results(athlete_id, canonical_code, created_at DESC)
WHERE canonical_code IS NOT NULL;

CREATE TABLE public.health_biomarker_longitudinal_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  canonical_code text NOT NULL REFERENCES public.health_biomarker_catalog(canonical_code) ON DELETE RESTRICT,
  as_of_date date NOT NULL,
  latest_result_id uuid NULL REFERENCES public.health_biomarker_results(id) ON DELETE SET NULL,
  previous_result_id uuid NULL REFERENCES public.health_biomarker_results(id) ON DELETE SET NULL,
  latest_numeric_value numeric(20,6) NULL,
  previous_numeric_value numeric(20,6) NULL,
  comparison_unit text NULL,
  observation_count integer NOT NULL DEFAULT 0 CHECK (observation_count >= 0),
  comparability_status text NOT NULL CHECK (comparability_status IN ('unobserved','single_observation','comparable','not_comparable')),
  direction_status text NOT NULL CHECK (direction_status IN ('higher','lower','stable','unknown')),
  current_reference_text text NULL,
  current_flag text NULL,
  confidence text NOT NULL CHECK (confidence IN ('low','moderate','high')),
  reason_codes text[] NOT NULL DEFAULT '{}'::text[],
  algorithm_version text NOT NULL DEFAULT 'M9_BIOMARKER_STATE_V1',
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, canonical_code, as_of_date)
);

CREATE INDEX health_biomarker_states_athlete_date_idx
ON public.health_biomarker_longitudinal_states(athlete_id, as_of_date DESC, canonical_code);

CREATE TABLE public.health_vital_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  observed_at timestamptz NOT NULL,
  observed_on date NOT NULL,
  metric_code text NOT NULL CHECK (
    metric_code IN ('blood_pressure','resting_heart_rate','temperature','oxygen_saturation','respiratory_rate','blood_glucose')
  ),
  numeric_value numeric(14,4) NOT NULL,
  secondary_numeric_value numeric(14,4) NULL,
  unit_code text NOT NULL CHECK (btrim(unit_code) <> ''),
  condition_text text NULL,
  device_text text NULL,
  data_source text NOT NULL DEFAULT 'USER_REPORTED' CHECK (
    data_source IN ('USER_REPORTED','MEASURED','IMPORTED','PROFESSIONAL_RECORDED')
  ),
  confidence text NOT NULL DEFAULT 'moderate' CHECK (confidence IN ('low','moderate','high')),
  client_event_id uuid NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','superseded','voided')),
  supersedes_vital_observation_id uuid NULL REFERENCES public.health_vital_observations(id) ON DELETE RESTRICT,
  void_reason text NULL,
  status_changed_at timestamptz NULL,
  created_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, athlete_id),
  UNIQUE (athlete_id, client_event_id),
  CHECK (supersedes_vital_observation_id IS NULL OR supersedes_vital_observation_id <> id),
  CHECK ((status='voided' AND NULLIF(btrim(void_reason),'') IS NOT NULL) OR status <> 'voided')
);

CREATE INDEX health_vital_observations_metric_idx
ON public.health_vital_observations(athlete_id, metric_code, observed_on DESC, observed_at DESC);

CREATE INDEX health_vital_observations_status_idx
ON public.health_vital_observations(athlete_id, status, observed_on DESC);
