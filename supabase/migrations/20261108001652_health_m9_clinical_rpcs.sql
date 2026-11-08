-- M9B Health — Clinical documents, exams, biomarkers, and vital observations RPCs.
-- Extraction is staging until explicitly confirmed.

CREATE OR REPLACE FUNCTION public.health_m9_register_clinical_document(
  p_athlete_id uuid,
  p_document_id uuid,
  p_document_type text,
  p_original_filename text,
  p_document_date date,
  p_provider_name text,
  p_object_path text,
  p_mime_type text,
  p_sha256 text,
  p_data_source text,
  p_notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.health_can_write_athlete(p_athlete_id) THEN RAISE EXCEPTION 'not authorized for athlete'; END IF;
  IF p_document_id IS NULL OR NULLIF(btrim(p_original_filename),'') IS NULL OR NULLIF(btrim(p_object_path),'') IS NULL THEN
    RAISE EXCEPTION 'document id, filename, and object path are required';
  END IF;
  IF p_object_path NOT LIKE p_athlete_id::text || '/clinical/%' OR p_object_path ~ '(^|/)\.\.(/|$)' THEN
    RAISE EXCEPTION 'invalid clinical document path';
  END IF;
  IF p_mime_type NOT IN ('application/pdf','image/jpeg','image/png','image/webp') THEN
    RAISE EXCEPTION 'unsupported clinical document mime type';
  END IF;

  SELECT d.id INTO v_existing
  FROM public.health_clinical_documents d
  WHERE d.id=p_document_id AND d.athlete_id=p_athlete_id;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  INSERT INTO public.health_clinical_documents (
    id,athlete_id,document_type,original_filename,document_date,provider_name,object_path,mime_type,
    sha256,data_source,notes,status
  ) VALUES (
    p_document_id,p_athlete_id,p_document_type,btrim(p_original_filename),p_document_date,
    NULLIF(btrim(p_provider_name),''),p_object_path,p_mime_type,NULLIF(btrim(p_sha256),''),
    p_data_source,NULLIF(btrim(p_notes),''),'active'
  );

  RETURN p_document_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m9_void_clinical_document(
  p_document_id uuid,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_athlete_id uuid;
  v_status text;
BEGIN
  SELECT d.athlete_id,d.status INTO v_athlete_id,v_status
  FROM public.health_clinical_documents d WHERE d.id=p_document_id FOR UPDATE;
  IF v_athlete_id IS NULL THEN RAISE EXCEPTION 'clinical document not found'; END IF;
  IF auth.uid() IS NULL OR NOT public.health_can_write_athlete(v_athlete_id) THEN RAISE EXCEPTION 'not authorized for athlete'; END IF;
  IF v_status <> 'active' THEN RETURN p_document_id; END IF;
  IF NULLIF(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'void reason is required'; END IF;

  UPDATE public.health_clinical_documents
  SET status='voided',void_reason=btrim(p_reason),status_changed_at=now()
  WHERE id=p_document_id;

  RETURN p_document_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m9_refresh_biomarker_state(
  p_athlete_id uuid,
  p_as_of_date date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_code text;
  v_count integer := 0;
  v_total integer := 0;
  v_latest record;
  v_previous record;
  v_comparability text;
  v_direction text;
  v_confidence text;
  v_reasons text[];
  v_latest_value numeric;
  v_previous_value numeric;
  v_unit text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.health_can_write_athlete(p_athlete_id) THEN RAISE EXCEPTION 'not authorized for athlete'; END IF;
  IF p_as_of_date IS NULL THEN RAISE EXCEPTION 'as_of_date is required'; END IF;

  DELETE FROM public.health_biomarker_longitudinal_states s
  WHERE s.athlete_id=p_athlete_id AND s.as_of_date=p_as_of_date
    AND NOT EXISTS (
      SELECT 1
      FROM public.health_biomarker_results r
      JOIN public.health_lab_reports l ON l.id=r.lab_report_id AND l.athlete_id=r.athlete_id
      WHERE r.athlete_id=p_athlete_id AND r.canonical_code=s.canonical_code AND l.status='active'
        AND COALESCE(l.collected_at::date,l.resulted_at::date,l.created_at::date) <= p_as_of_date
    );

  FOR v_code IN
    SELECT DISTINCT r.canonical_code
    FROM public.health_biomarker_results r
    JOIN public.health_lab_reports l ON l.id=r.lab_report_id AND l.athlete_id=r.athlete_id
    WHERE r.athlete_id=p_athlete_id AND r.canonical_code IS NOT NULL AND l.status='active'
      AND COALESCE(l.collected_at::date,l.resulted_at::date,l.created_at::date) <= p_as_of_date
  LOOP
    SELECT COUNT(*)::integer INTO v_count
    FROM public.health_biomarker_results r
    JOIN public.health_lab_reports l ON l.id=r.lab_report_id AND l.athlete_id=r.athlete_id
    WHERE r.athlete_id=p_athlete_id AND r.canonical_code=v_code AND l.status='active'
      AND COALESCE(l.collected_at::date,l.resulted_at::date,l.created_at::date) <= p_as_of_date;

    SELECT r.id,r.numeric_value,r.original_unit,r.normalized_value,r.normalized_unit_ucum,
           r.original_reference_text,r.original_flag,r.method_text,
           COALESCE(l.collected_at,l.resulted_at,l.created_at) AS event_at
    INTO v_latest
    FROM public.health_biomarker_results r
    JOIN public.health_lab_reports l ON l.id=r.lab_report_id AND l.athlete_id=r.athlete_id
    WHERE r.athlete_id=p_athlete_id AND r.canonical_code=v_code AND l.status='active'
      AND COALESCE(l.collected_at::date,l.resulted_at::date,l.created_at::date) <= p_as_of_date
    ORDER BY COALESCE(l.collected_at,l.resulted_at,l.created_at) DESC,r.created_at DESC
    LIMIT 1;

    SELECT r.id,r.numeric_value,r.original_unit,r.normalized_value,r.normalized_unit_ucum,
           r.original_reference_text,r.original_flag,r.method_text,
           COALESCE(l.collected_at,l.resulted_at,l.created_at) AS event_at
    INTO v_previous
    FROM public.health_biomarker_results r
    JOIN public.health_lab_reports l ON l.id=r.lab_report_id AND l.athlete_id=r.athlete_id
    WHERE r.athlete_id=p_athlete_id AND r.canonical_code=v_code AND l.status='active'
      AND COALESCE(l.collected_at::date,l.resulted_at::date,l.created_at::date) <= p_as_of_date
    ORDER BY COALESCE(l.collected_at,l.resulted_at,l.created_at) DESC,r.created_at DESC
    OFFSET 1 LIMIT 1;

    v_reasons := '{}'::text[];
    v_comparability := 'single_observation';
    v_direction := 'unknown';
    v_confidence := 'moderate';
    v_latest_value := NULL;
    v_previous_value := NULL;
    v_unit := NULL;

    IF v_count <= 1 THEN
      v_reasons := array_append(v_reasons,'SINGLE_OBSERVATION_ONLY');
    ELSE
      IF v_latest.method_text IS NOT NULL AND v_previous.method_text IS NOT NULL
         AND lower(v_latest.method_text) <> lower(v_previous.method_text) THEN
        v_comparability := 'not_comparable';
        v_confidence := 'low';
        v_reasons := array_append(v_reasons,'METHOD_NOT_COMPARABLE');
      ELSIF v_latest.normalized_value IS NOT NULL AND v_previous.normalized_value IS NOT NULL
         AND v_latest.normalized_unit_ucum IS NOT NULL
         AND v_latest.normalized_unit_ucum = v_previous.normalized_unit_ucum THEN
        v_comparability := 'comparable';
        v_latest_value := v_latest.normalized_value;
        v_previous_value := v_previous.normalized_value;
        v_unit := v_latest.normalized_unit_ucum;
      ELSIF v_latest.numeric_value IS NOT NULL AND v_previous.numeric_value IS NOT NULL
         AND v_latest.original_unit IS NOT NULL AND v_latest.original_unit = v_previous.original_unit THEN
        v_comparability := 'comparable';
        v_latest_value := v_latest.numeric_value;
        v_previous_value := v_previous.numeric_value;
        v_unit := v_latest.original_unit;
      ELSIF v_latest.numeric_value IS NULL OR v_previous.numeric_value IS NULL THEN
        v_comparability := 'not_comparable';
        v_confidence := 'low';
        v_reasons := array_append(v_reasons,'NON_NUMERIC_RESULT');
      ELSE
        v_comparability := 'not_comparable';
        v_confidence := 'low';
        v_reasons := array_append(v_reasons,'UNIT_NOT_COMPARABLE');
      END IF;

      IF v_comparability='comparable' THEN
        v_confidence := 'high';
        v_direction := CASE WHEN v_latest_value>v_previous_value THEN 'higher' WHEN v_latest_value<v_previous_value THEN 'lower' ELSE 'stable' END;
        v_reasons := array_append(v_reasons,'COMPARABLE_HISTORY_AVAILABLE');
      END IF;

      IF v_latest.original_reference_text IS DISTINCT FROM v_previous.original_reference_text THEN
        v_reasons := array_append(v_reasons,'REFERENCE_RANGE_CHANGED');
      END IF;
    END IF;

    INSERT INTO public.health_biomarker_longitudinal_states (
      athlete_id,canonical_code,as_of_date,latest_result_id,previous_result_id,
      latest_numeric_value,previous_numeric_value,comparison_unit,observation_count,
      comparability_status,direction_status,current_reference_text,current_flag,
      confidence,reason_codes,algorithm_version,computed_at
    ) VALUES (
      p_athlete_id,v_code,p_as_of_date,v_latest.id,v_previous.id,
      v_latest_value,v_previous_value,v_unit,v_count,v_comparability,v_direction,
      v_latest.original_reference_text,v_latest.original_flag,v_confidence,v_reasons,
      'M9_BIOMARKER_STATE_V1',now()
    ) ON CONFLICT (athlete_id,canonical_code,as_of_date)
    DO UPDATE SET
      latest_result_id=EXCLUDED.latest_result_id,
      previous_result_id=EXCLUDED.previous_result_id,
      latest_numeric_value=EXCLUDED.latest_numeric_value,
      previous_numeric_value=EXCLUDED.previous_numeric_value,
      comparison_unit=EXCLUDED.comparison_unit,
      observation_count=EXCLUDED.observation_count,
      comparability_status=EXCLUDED.comparability_status,
      direction_status=EXCLUDED.direction_status,
      current_reference_text=EXCLUDED.current_reference_text,
      current_flag=EXCLUDED.current_flag,
      confidence=EXCLUDED.confidence,
      reason_codes=EXCLUDED.reason_codes,
      algorithm_version=EXCLUDED.algorithm_version,
      computed_at=EXCLUDED.computed_at;

    v_total := v_total + 1;
  END LOOP;

  RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m9_record_lab_report(
  p_athlete_id uuid,
  p_client_event_id uuid,
  p_results jsonb,
  p_laboratory_name text DEFAULT NULL,
  p_collected_at timestamptz DEFAULT NULL,
  p_resulted_at timestamptz DEFAULT NULL,
  p_fasting_status text DEFAULT NULL,
  p_collection_context jsonb DEFAULT NULL,
  p_data_source text DEFAULT 'USER_REPORTED',
  p_confidence text DEFAULT 'moderate',
  p_notes text DEFAULT NULL,
  p_document_id uuid DEFAULT NULL,
  p_extraction_id uuid DEFAULT NULL,
  p_supersedes_lab_report_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing uuid;
  v_report_id uuid;
  v_previous_status text;
  v_result jsonb;
  v_canonical_code text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.health_can_write_athlete(p_athlete_id) THEN RAISE EXCEPTION 'not authorized for athlete'; END IF;
  IF p_results IS NULL OR jsonb_typeof(p_results) <> 'array' OR jsonb_array_length(p_results)=0 THEN RAISE EXCEPTION 'results must be a non-empty JSON array'; END IF;

  IF p_client_event_id IS NOT NULL THEN
    SELECT l.id INTO v_existing FROM public.health_lab_reports l
    WHERE l.athlete_id=p_athlete_id AND l.client_event_id=p_client_event_id;
    IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  END IF;

  IF p_document_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.health_clinical_documents d
    WHERE d.id=p_document_id AND d.athlete_id=p_athlete_id AND d.status='active'
  ) THEN RAISE EXCEPTION 'active clinical document not found'; END IF;

  IF p_extraction_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.health_clinical_document_extractions e
    WHERE e.id=p_extraction_id AND e.athlete_id=p_athlete_id
  ) THEN RAISE EXCEPTION 'clinical extraction not found'; END IF;

  IF p_supersedes_lab_report_id IS NOT NULL THEN
    SELECT l.status INTO v_previous_status
    FROM public.health_lab_reports l
    WHERE l.id=p_supersedes_lab_report_id AND l.athlete_id=p_athlete_id FOR UPDATE;
    IF v_previous_status IS NULL THEN RAISE EXCEPTION 'lab report to supersede not found'; END IF;
    IF v_previous_status <> 'active' THEN RAISE EXCEPTION 'lab report to supersede is not active'; END IF;
  END IF;

  INSERT INTO public.health_lab_reports (
    athlete_id,document_id,extraction_id,laboratory_name,collected_at,resulted_at,fasting_status,
    collection_context,data_source,confidence,client_event_id,notes,status,supersedes_lab_report_id
  ) VALUES (
    p_athlete_id,p_document_id,p_extraction_id,NULLIF(btrim(p_laboratory_name),''),p_collected_at,p_resulted_at,
    p_fasting_status,p_collection_context,p_data_source,p_confidence,p_client_event_id,NULLIF(btrim(p_notes),''),
    'active',p_supersedes_lab_report_id
  ) RETURNING id INTO v_report_id;

  FOR v_result IN SELECT value FROM jsonb_array_elements(p_results)
  LOOP
    IF NULLIF(btrim(v_result->>'original_analyte_name'),'') IS NULL OR NULLIF(btrim(v_result->>'original_result_text'),'') IS NULL THEN
      RAISE EXCEPTION 'biomarker result missing original name or result text';
    END IF;

    v_canonical_code := NULLIF(v_result->>'canonical_code','');
    IF v_canonical_code IS NULL THEN
      SELECT a.canonical_code INTO v_canonical_code
      FROM public.health_biomarker_aliases a
      WHERE lower(a.normalized_alias)=lower(btrim(v_result->>'original_analyte_name'))
        AND (a.provider_name IS NULL OR lower(a.provider_name)=lower(COALESCE(NULLIF(btrim(p_laboratory_name),''),'')))
      ORDER BY (a.provider_name IS NOT NULL) DESC,a.created_at DESC
      LIMIT 1;
    END IF;

    INSERT INTO public.health_biomarker_results (
      lab_report_id,athlete_id,original_analyte_name,canonical_code,original_result_text,
      numeric_value,original_unit,normalized_value,normalized_unit_ucum,original_reference_text,
      reference_low,reference_high,original_flag,method_text,confidence,notes
    ) VALUES (
      v_report_id,p_athlete_id,btrim(v_result->>'original_analyte_name'),v_canonical_code,
      btrim(v_result->>'original_result_text'),NULLIF(v_result->>'numeric_value','')::numeric,
      NULLIF(btrim(v_result->>'original_unit'),''),NULLIF(v_result->>'normalized_value','')::numeric,
      NULLIF(btrim(v_result->>'normalized_unit_ucum'),''),NULLIF(btrim(v_result->>'original_reference_text'),''),
      NULLIF(v_result->>'reference_low','')::numeric,NULLIF(v_result->>'reference_high','')::numeric,
      NULLIF(btrim(v_result->>'original_flag'),''),NULLIF(btrim(v_result->>'method_text'),''),
      COALESCE(NULLIF(v_result->>'confidence',''),p_confidence),NULLIF(btrim(v_result->>'notes'),'')
    );
  END LOOP;

  IF p_supersedes_lab_report_id IS NOT NULL THEN
    UPDATE public.health_lab_reports
    SET status='superseded',status_changed_at=now()
    WHERE id=p_supersedes_lab_report_id AND athlete_id=p_athlete_id AND status='active';
  END IF;

  PERFORM public.health_m9_refresh_biomarker_state(p_athlete_id,COALESCE(p_collected_at::date,p_resulted_at::date,current_date));
  RETURN v_report_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m9_void_lab_report(
  p_lab_report_id uuid,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_athlete_id uuid;
  v_status text;
BEGIN
  SELECT l.athlete_id,l.status INTO v_athlete_id,v_status
  FROM public.health_lab_reports l WHERE l.id=p_lab_report_id FOR UPDATE;
  IF v_athlete_id IS NULL THEN RAISE EXCEPTION 'lab report not found'; END IF;
  IF auth.uid() IS NULL OR NOT public.health_can_write_athlete(v_athlete_id) THEN RAISE EXCEPTION 'not authorized for athlete'; END IF;
  IF v_status <> 'active' THEN RETURN p_lab_report_id; END IF;
  IF NULLIF(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'void reason is required'; END IF;
  UPDATE public.health_lab_reports
  SET status='voided',void_reason=btrim(p_reason),status_changed_at=now()
  WHERE id=p_lab_report_id;
  PERFORM public.health_m9_refresh_biomarker_state(v_athlete_id,current_date);
  RETURN p_lab_report_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m9_stage_clinical_extraction(
  p_extraction_id uuid,
  p_document_id uuid,
  p_status text,
  p_engine_provider text DEFAULT NULL,
  p_engine_version text DEFAULT NULL,
  p_structured_payload jsonb DEFAULT NULL,
  p_field_confidences jsonb DEFAULT NULL,
  p_warnings jsonb DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_athlete_id uuid;
  v_current_status text;
BEGIN
  SELECT d.athlete_id INTO v_athlete_id
  FROM public.health_clinical_documents d
  WHERE d.id=p_document_id AND d.status='active';
  IF v_athlete_id IS NULL THEN RAISE EXCEPTION 'active clinical document not found'; END IF;
  IF auth.uid() IS NULL OR NOT public.health_can_write_athlete(v_athlete_id) THEN RAISE EXCEPTION 'not authorized for athlete'; END IF;
  IF p_extraction_id IS NULL THEN RAISE EXCEPTION 'extraction id is required'; END IF;
  IF p_status NOT IN ('pending','extracting','extracted','review_required','failed') THEN RAISE EXCEPTION 'invalid staging status'; END IF;

  SELECT e.status INTO v_current_status
  FROM public.health_clinical_document_extractions e
  WHERE e.id=p_extraction_id AND e.athlete_id=v_athlete_id FOR UPDATE;

  IF v_current_status IN ('confirmed','rejected') THEN RAISE EXCEPTION 'finalized extraction cannot be staged again'; END IF;

  IF v_current_status IS NULL THEN
    INSERT INTO public.health_clinical_document_extractions (
      id,document_id,athlete_id,status,engine_provider,engine_version,structured_payload,
      field_confidences,warnings,error_message
    ) VALUES (
      p_extraction_id,p_document_id,v_athlete_id,p_status,NULLIF(btrim(p_engine_provider),''),
      NULLIF(btrim(p_engine_version),''),p_structured_payload,p_field_confidences,p_warnings,
      NULLIF(btrim(p_error_message),'')
    );
  ELSE
    UPDATE public.health_clinical_document_extractions
    SET status=p_status,engine_provider=COALESCE(NULLIF(btrim(p_engine_provider),''),engine_provider),
        engine_version=COALESCE(NULLIF(btrim(p_engine_version),''),engine_version),
        structured_payload=COALESCE(p_structured_payload,structured_payload),
        field_confidences=COALESCE(p_field_confidences,field_confidences),
        warnings=COALESCE(p_warnings,warnings),error_message=NULLIF(btrim(p_error_message),''),updated_at=now()
    WHERE id=p_extraction_id AND athlete_id=v_athlete_id;
  END IF;

  RETURN p_extraction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m9_confirm_clinical_extraction(
  p_extraction_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_extraction record;
  v_payload jsonb;
  v_report_id uuid;
BEGIN
  SELECT e.*,d.provider_name AS document_provider
  INTO v_extraction
  FROM public.health_clinical_document_extractions e
  JOIN public.health_clinical_documents d ON d.id=e.document_id AND d.athlete_id=e.athlete_id
  WHERE e.id=p_extraction_id
  FOR UPDATE OF e;

  IF v_extraction.id IS NULL THEN RAISE EXCEPTION 'clinical extraction not found'; END IF;
  IF auth.uid() IS NULL OR NOT public.health_can_write_athlete(v_extraction.athlete_id) THEN RAISE EXCEPTION 'not authorized for athlete'; END IF;
  IF v_extraction.status='confirmed' THEN
    SELECT l.id INTO v_report_id FROM public.health_lab_reports l
    WHERE l.extraction_id=p_extraction_id AND l.athlete_id=v_extraction.athlete_id
    ORDER BY l.created_at DESC LIMIT 1;
    RETURN v_report_id;
  END IF;
  IF v_extraction.status NOT IN ('extracted','review_required') THEN RAISE EXCEPTION 'extraction is not ready for confirmation'; END IF;

  v_payload := v_extraction.structured_payload;
  IF v_payload IS NULL OR jsonb_typeof(v_payload) <> 'object' OR jsonb_typeof(v_payload->'results') <> 'array' THEN
    RAISE EXCEPTION 'extraction payload is incomplete';
  END IF;

  v_report_id := public.health_m9_record_lab_report(
    p_athlete_id => v_extraction.athlete_id,
    p_client_event_id => p_extraction_id,
    p_results => v_payload->'results',
    p_laboratory_name => COALESCE(NULLIF(v_payload->>'laboratory_name',''),v_extraction.document_provider),
    p_collected_at => NULLIF(v_payload->>'collected_at','')::timestamptz,
    p_resulted_at => NULLIF(v_payload->>'resulted_at','')::timestamptz,
    p_fasting_status => NULLIF(v_payload->>'fasting_status',''),
    p_collection_context => v_payload->'collection_context',
    p_data_source => 'IMPORTED',
    p_confidence => COALESCE(NULLIF(v_payload->>'confidence',''),'moderate'),
    p_notes => NULLIF(v_payload->>'notes',''),
    p_document_id => v_extraction.document_id,
    p_extraction_id => p_extraction_id,
    p_supersedes_lab_report_id => NULL
  );

  UPDATE public.health_clinical_document_extractions
  SET status='confirmed',confirmed_by_auth_user_id=auth.uid(),confirmed_at=now(),updated_at=now()
  WHERE id=p_extraction_id;

  RETURN v_report_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m9_reject_clinical_extraction(
  p_extraction_id uuid,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_athlete_id uuid;
  v_status text;
BEGIN
  SELECT e.athlete_id,e.status INTO v_athlete_id,v_status
  FROM public.health_clinical_document_extractions e WHERE e.id=p_extraction_id FOR UPDATE;
  IF v_athlete_id IS NULL THEN RAISE EXCEPTION 'clinical extraction not found'; END IF;
  IF auth.uid() IS NULL OR NOT public.health_can_write_athlete(v_athlete_id) THEN RAISE EXCEPTION 'not authorized for athlete'; END IF;
  IF v_status='rejected' THEN RETURN p_extraction_id; END IF;
  IF v_status='confirmed' THEN RAISE EXCEPTION 'confirmed extraction cannot be rejected'; END IF;
  IF NULLIF(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'rejection reason is required'; END IF;

  UPDATE public.health_clinical_document_extractions
  SET status='rejected',rejected_by_auth_user_id=auth.uid(),rejected_at=now(),
      error_message=concat_ws(E'\n',error_message,'Rejected: ' || btrim(p_reason)),updated_at=now()
  WHERE id=p_extraction_id;
  RETURN p_extraction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m9_record_vital_observation(
  p_athlete_id uuid,
  p_observed_at timestamptz,
  p_observed_on date,
  p_metric_code text,
  p_numeric_value numeric,
  p_secondary_numeric_value numeric,
  p_unit_code text,
  p_condition_text text,
  p_device_text text,
  p_data_source text,
  p_confidence text,
  p_client_event_id uuid,
  p_supersedes_vital_observation_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing uuid;
  v_previous_metric text;
  v_previous_status text;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.health_can_write_athlete(p_athlete_id) THEN RAISE EXCEPTION 'not authorized for athlete'; END IF;
  IF p_observed_at IS NULL OR p_observed_on IS NULL OR p_numeric_value IS NULL OR NULLIF(btrim(p_unit_code),'') IS NULL THEN RAISE EXCEPTION 'vital observation missing required fields'; END IF;

  IF p_client_event_id IS NOT NULL THEN
    SELECT v.id INTO v_existing FROM public.health_vital_observations v
    WHERE v.athlete_id=p_athlete_id AND v.client_event_id=p_client_event_id;
    IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  END IF;

  IF p_supersedes_vital_observation_id IS NOT NULL THEN
    SELECT v.metric_code,v.status INTO v_previous_metric,v_previous_status
    FROM public.health_vital_observations v
    WHERE v.id=p_supersedes_vital_observation_id AND v.athlete_id=p_athlete_id FOR UPDATE;
    IF v_previous_status IS NULL THEN RAISE EXCEPTION 'vital observation to supersede not found'; END IF;
    IF v_previous_status <> 'active' OR v_previous_metric <> p_metric_code THEN RAISE EXCEPTION 'vital supersession is not compatible'; END IF;
  END IF;

  INSERT INTO public.health_vital_observations (
    athlete_id,observed_at,observed_on,metric_code,numeric_value,secondary_numeric_value,unit_code,
    condition_text,device_text,data_source,confidence,client_event_id,status,supersedes_vital_observation_id
  ) VALUES (
    p_athlete_id,p_observed_at,p_observed_on,p_metric_code,p_numeric_value,p_secondary_numeric_value,
    btrim(p_unit_code),NULLIF(btrim(p_condition_text),''),NULLIF(btrim(p_device_text),''),p_data_source,
    p_confidence,p_client_event_id,'active',p_supersedes_vital_observation_id
  ) RETURNING id INTO v_id;

  IF p_supersedes_vital_observation_id IS NOT NULL THEN
    UPDATE public.health_vital_observations
    SET status='superseded',status_changed_at=now()
    WHERE id=p_supersedes_vital_observation_id AND athlete_id=p_athlete_id AND status='active';
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_m9_void_vital_observation(
  p_vital_observation_id uuid,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_athlete_id uuid;
  v_status text;
BEGIN
  SELECT v.athlete_id,v.status INTO v_athlete_id,v_status
  FROM public.health_vital_observations v WHERE v.id=p_vital_observation_id FOR UPDATE;
  IF v_athlete_id IS NULL THEN RAISE EXCEPTION 'vital observation not found'; END IF;
  IF auth.uid() IS NULL OR NOT public.health_can_write_athlete(v_athlete_id) THEN RAISE EXCEPTION 'not authorized for athlete'; END IF;
  IF v_status <> 'active' THEN RETURN p_vital_observation_id; END IF;
  IF NULLIF(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'void reason is required'; END IF;
  UPDATE public.health_vital_observations
  SET status='voided',void_reason=btrim(p_reason),status_changed_at=now()
  WHERE id=p_vital_observation_id;
  RETURN p_vital_observation_id;
END;
$$;
