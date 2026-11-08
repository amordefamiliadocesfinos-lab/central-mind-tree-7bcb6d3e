-- M9 Health — integrity hardening and minimal internal biomarker catalog.

ALTER TABLE public.health_sleep_periods
ADD CONSTRAINT health_sleep_periods_minutes_bounds_check CHECK (
  (declared_sleep_minutes IS NULL OR declared_sleep_minutes <= 2880)
  AND (calculated_time_in_bed_minutes IS NULL OR calculated_time_in_bed_minutes <= 2880)
  AND (calculated_sleep_minutes IS NULL OR calculated_sleep_minutes <= 2880)
  AND (awake_during_period_minutes IS NULL OR awake_during_period_minutes <= 2880)
  AND (awakenings_count IS NULL OR awakenings_count <= 500)
),
ADD CONSTRAINT health_sleep_periods_timestamp_order_check CHECK (
  (sleep_start_at IS NULL OR final_wake_at IS NULL OR final_wake_at >= sleep_start_at)
  AND (bed_at IS NULL OR out_of_bed_at IS NULL OR out_of_bed_at >= bed_at)
);

ALTER TABLE public.health_sleep_device_observations
ADD CONSTRAINT health_sleep_device_nonnegative_check CHECK (numeric_value >= 0);

ALTER TABLE public.health_clinical_documents
ADD CONSTRAINT health_clinical_documents_safe_path_check CHECK (
  object_path LIKE athlete_id::text || '/clinical/%'
  AND object_path !~ '(^|/)\.\.(/|$)'
),
ADD CONSTRAINT health_clinical_documents_mime_check CHECK (
  mime_type IN ('application/pdf','image/jpeg','image/png','image/webp')
);

ALTER TABLE public.health_clinical_document_extractions
ADD CONSTRAINT health_clinical_extractions_finalization_check CHECK (
  (status <> 'confirmed' OR (confirmed_by_auth_user_id IS NOT NULL AND confirmed_at IS NOT NULL))
  AND (status <> 'rejected' OR (rejected_by_auth_user_id IS NOT NULL AND rejected_at IS NOT NULL))
  AND NOT (confirmed_at IS NOT NULL AND rejected_at IS NOT NULL)
);

ALTER TABLE public.health_biomarker_results
ADD CONSTRAINT health_biomarker_results_normalized_pair_check CHECK (
  (normalized_value IS NULL AND normalized_unit_ucum IS NULL)
  OR (normalized_value IS NOT NULL AND normalized_unit_ucum IS NOT NULL)
),
ADD CONSTRAINT health_biomarker_results_reference_order_check CHECK (
  reference_low IS NULL OR reference_high IS NULL OR reference_low <= reference_high
);

ALTER TABLE public.health_vital_observations
ADD CONSTRAINT health_vital_observations_shape_check CHECK (
  (metric_code='blood_pressure' AND secondary_numeric_value IS NOT NULL)
  OR (metric_code<>'blood_pressure' AND secondary_numeric_value IS NULL)
),
ADD CONSTRAINT health_vital_observations_plausible_bounds_check CHECK (
  (metric_code='blood_pressure' AND numeric_value BETWEEN 20 AND 350 AND secondary_numeric_value BETWEEN 10 AND 250)
  OR (metric_code='resting_heart_rate' AND numeric_value BETWEEN 10 AND 300)
  OR (metric_code='temperature' AND numeric_value BETWEEN 20 AND 50)
  OR (metric_code='oxygen_saturation' AND numeric_value BETWEEN 1 AND 100)
  OR (metric_code='respiratory_rate' AND numeric_value BETWEEN 1 AND 100)
  OR (metric_code='blood_glucose' AND numeric_value BETWEEN 1 AND 2000)
);

INSERT INTO public.health_biomarker_catalog (
  canonical_code,display_name,category,expected_value_type,status
) VALUES
  ('glucose','Glicose','glycemic_metabolic','numeric','active'),
  ('hba1c','Hemoglobina glicada (HbA1c)','glycemic_metabolic','numeric','active'),
  ('total_cholesterol','Colesterol total','lipid','numeric','active'),
  ('ldl_cholesterol','LDL colesterol','lipid','numeric','active'),
  ('hdl_cholesterol','HDL colesterol','lipid','numeric','active'),
  ('triglycerides','Triglicerídeos','lipid','numeric','active'),
  ('creatinine','Creatinina','renal','numeric','active'),
  ('urea','Ureia','renal','numeric','active'),
  ('alt','ALT / TGP','hepatic','numeric','active'),
  ('ast','AST / TGO','hepatic','numeric','active'),
  ('tsh','TSH','thyroid','numeric','active'),
  ('free_t4','T4 livre','thyroid','numeric','active'),
  ('hemoglobin','Hemoglobina','hematologic','numeric','active'),
  ('hematocrit','Hematócrito','hematologic','numeric','active'),
  ('ferritin','Ferritina','nutritional','numeric','active'),
  ('vitamin_b12','Vitamina B12','nutritional','numeric','active'),
  ('folate','Folato','nutritional','numeric','active'),
  ('vitamin_d_25oh','Vitamina D 25-OH','nutritional','numeric','active')
ON CONFLICT (canonical_code) DO NOTHING;

INSERT INTO public.health_biomarker_aliases (normalized_alias,canonical_code,mapping_confidence) VALUES
  ('glicose','glucose','reviewed'),('glucose','glucose','reviewed'),
  ('hemoglobina glicada','hba1c','reviewed'),('hba1c','hba1c','reviewed'),('a1c','hba1c','reviewed'),
  ('colesterol total','total_cholesterol','reviewed'),
  ('ldl','ldl_cholesterol','reviewed'),('ldl colesterol','ldl_cholesterol','reviewed'),
  ('hdl','hdl_cholesterol','reviewed'),('hdl colesterol','hdl_cholesterol','reviewed'),
  ('triglicerídeos','triglycerides','reviewed'),('triglicerideos','triglycerides','reviewed'),('triglycerides','triglycerides','reviewed'),
  ('creatinina','creatinine','reviewed'),('creatinine','creatinine','reviewed'),
  ('ureia','urea','reviewed'),('urea','urea','reviewed'),
  ('tgp','alt','reviewed'),('alt','alt','reviewed'),
  ('tgo','ast','reviewed'),('ast','ast','reviewed'),
  ('tsh','tsh','reviewed'),
  ('t4 livre','free_t4','reviewed'),('t4l','free_t4','reviewed'),('free t4','free_t4','reviewed'),
  ('hemoglobina','hemoglobin','reviewed'),('hemoglobin','hemoglobin','reviewed'),
  ('hematócrito','hematocrit','reviewed'),('hematocrito','hematocrit','reviewed'),('hematocrit','hematocrit','reviewed'),
  ('ferritina','ferritin','reviewed'),('ferritin','ferritin','reviewed'),
  ('vitamina b12','vitamin_b12','reviewed'),('b12','vitamin_b12','reviewed'),
  ('folato','folate','reviewed'),('ácido fólico','folate','reviewed'),('acido folico','folate','reviewed'),
  ('vitamina d','vitamin_d_25oh','reviewed'),('25-oh vitamina d','vitamin_d_25oh','reviewed'),('25(oh)d','vitamin_d_25oh','reviewed')
ON CONFLICT DO NOTHING;
