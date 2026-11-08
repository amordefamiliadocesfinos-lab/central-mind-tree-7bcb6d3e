import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type LooseTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

type LooseDatabase = {
  public: {
    Tables: Record<string, LooseTable>;
    Views: Record<string, never>;
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const db = supabase as unknown as SupabaseClient<LooseDatabase>;

export type ClinicalDocument = {
  id: string;
  athlete_id: string;
  document_type: string;
  original_filename: string;
  document_date: string | null;
  provider_name: string | null;
  object_path: string;
  mime_type: string;
  data_source: string;
  status: string;
  created_at: string;
  signed_url?: string | null;
};

export type LabReport = {
  id: string;
  athlete_id: string;
  document_id: string | null;
  extraction_id: string | null;
  laboratory_name: string | null;
  collected_at: string | null;
  resulted_at: string | null;
  fasting_status: string | null;
  data_source: string;
  confidence: string;
  status: string;
  notes: string | null;
  created_at: string;
};

export type BiomarkerResult = {
  id: string;
  lab_report_id: string;
  athlete_id: string;
  original_analyte_name: string;
  canonical_code: string | null;
  original_result_text: string;
  numeric_value: number | null;
  original_unit: string | null;
  normalized_value: number | null;
  normalized_unit_ucum: string | null;
  original_reference_text: string | null;
  original_flag: string | null;
  method_text: string | null;
  confidence: string;
  created_at: string;
};

export type BiomarkerState = {
  id: string;
  athlete_id: string;
  canonical_code: string;
  as_of_date: string;
  latest_result_id: string | null;
  previous_result_id: string | null;
  latest_numeric_value: number | null;
  previous_numeric_value: number | null;
  comparison_unit: string | null;
  observation_count: number;
  comparability_status: string;
  direction_status: string;
  current_reference_text: string | null;
  current_flag: string | null;
  confidence: string;
  reason_codes: string[];
  algorithm_version: string;
};

export type VitalObservation = {
  id: string;
  athlete_id: string;
  observed_at: string;
  observed_on: string;
  metric_code: string;
  numeric_value: number;
  secondary_numeric_value: number | null;
  unit_code: string;
  condition_text: string | null;
  device_text: string | null;
  data_source: string;
  confidence: string;
  status: string;
  created_at: string;
};

export type BiomarkerInput = {
  original_analyte_name: string;
  original_result_text: string;
  numeric_value?: number | null;
  original_unit?: string | null;
  original_reference_text?: string | null;
  original_flag?: string | null;
  method_text?: string | null;
};

function safeFileName(value: string) {
  return value.normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "documento";
}

function todayIso() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function clientEventId() {
  return crypto.randomUUID();
}

export function useHealthExamsM9(athleteId: string | null | undefined) {
  const [documents, setDocuments] = useState<ClinicalDocument[]>([]);
  const [reports, setReports] = useState<LabReport[]>([]);
  const [results, setResults] = useState<BiomarkerResult[]>([]);
  const [states, setStates] = useState<BiomarkerState[]>([]);
  const [vitals, setVitals] = useState<VitalObservation[]>([]);
  const [loading, setLoading] = useState(Boolean(athleteId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!athleteId) {
      setDocuments([]);
      setReports([]);
      setResults([]);
      setStates([]);
      setVitals([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [documentResult, reportResult, stateResult, vitalResult] = await Promise.all([
      db.from("health_clinical_documents").select("*")
        .eq("athlete_id", athleteId).order("created_at", { ascending: false }).limit(100),
      db.from("health_lab_reports").select("*")
        .eq("athlete_id", athleteId).order("collected_at", { ascending: false }).order("created_at", { ascending: false }).limit(100),
      db.from("health_biomarker_longitudinal_states").select("*")
        .eq("athlete_id", athleteId).order("as_of_date", { ascending: false }).limit(250),
      db.from("health_vital_observations").select("*")
        .eq("athlete_id", athleteId).order("observed_at", { ascending: false }).limit(100),
    ]);

    const firstError = documentResult.error ?? reportResult.error ?? stateResult.error ?? vitalResult.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const nextReports = (reportResult.data ?? []) as LabReport[];
    let nextResults: BiomarkerResult[] = [];
    if (nextReports.length) {
      const resultResult = await db.from("health_biomarker_results").select("*")
        .eq("athlete_id", athleteId)
        .in("lab_report_id", nextReports.map((report) => report.id))
        .order("created_at", { ascending: true });
      if (resultResult.error) {
        setError(resultResult.error.message);
        setLoading(false);
        return;
      }
      nextResults = (resultResult.data ?? []) as BiomarkerResult[];
    }

    const docs = (documentResult.data ?? []) as ClinicalDocument[];
    const docsWithUrls = await Promise.all(docs.map(async (document) => {
      if (document.status !== "active") return document;
      const signed = await supabase.storage.from("health-private").createSignedUrl(document.object_path, 60 * 10);
      return { ...document, signed_url: signed.error ? null : signed.data.signedUrl };
    }));

    setDocuments(docsWithUrls);
    setReports(nextReports);
    setResults(nextResults);
    setStates((stateResult.data ?? []) as BiomarkerState[]);
    setVitals((vitalResult.data ?? []) as VitalObservation[]);
    setLoading(false);
  }, [athleteId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const uploadDocument = useCallback(async (file: File, options?: {
    documentType?: string;
    documentDate?: string | null;
    providerName?: string | null;
  }) => {
    if (!athleteId) throw new Error("Atleta não disponível.");

    setSaving(true);
    setError(null);
    const documentId = crypto.randomUUID();
    const objectPath = `${athleteId}/clinical/${documentId}/${safeFileName(file.name)}`;

    try {
      const upload = await supabase.storage.from("health-private").upload(objectPath, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (upload.error) throw upload.error;

      const register = await db.rpc("health_m9_register_clinical_document", {
        p_athlete_id: athleteId,
        p_document_id: documentId,
        p_document_type: options?.documentType ?? "laboratory_report",
        p_original_filename: file.name,
        p_document_date: options?.documentDate ?? null,
        p_provider_name: options?.providerName?.trim() || null,
        p_object_path: objectPath,
        p_mime_type: file.type || "application/octet-stream",
        p_sha256: null,
        p_data_source: "USER_REPORTED",
        p_notes: null,
      });
      if (register.error) {
        await supabase.storage.from("health-private").remove([objectPath]);
        throw register.error;
      }

      await reload();
      return documentId;
    } finally {
      setSaving(false);
    }
  }, [athleteId, reload]);

  const voidDocument = useCallback(async (documentId: string) => {
    setSaving(true);
    setError(null);
    try {
      const result = await db.rpc("health_m9_void_clinical_document", {
        p_document_id: documentId,
        p_reason: "Anulado pelo usuário",
      });
      if (result.error) throw new Error(result.error.message);
      await reload();
    } finally {
      setSaving(false);
    }
  }, [reload]);

  const recordLabReport = useCallback(async (input: {
    laboratoryName?: string | null;
    collectedAt?: string | null;
    resultedAt?: string | null;
    fastingStatus?: string | null;
    notes?: string | null;
    biomarkers: BiomarkerInput[];
  }) => {
    if (!athleteId) throw new Error("Atleta não disponível.");
    if (!input.biomarkers.length) throw new Error("Adicione ao menos um biomarcador.");

    setSaving(true);
    setError(null);
    try {
      const result = await db.rpc("health_m9_record_lab_report", {
        p_athlete_id: athleteId,
        p_client_event_id: clientEventId(),
        p_laboratory_name: input.laboratoryName?.trim() || null,
        p_collected_at: input.collectedAt ? new Date(input.collectedAt).toISOString() : null,
        p_resulted_at: input.resultedAt ? new Date(input.resultedAt).toISOString() : null,
        p_fasting_status: input.fastingStatus ?? null,
        p_collection_context: null,
        p_data_source: "USER_REPORTED",
        p_confidence: "moderate",
        p_notes: input.notes?.trim() || null,
        p_document_id: null,
        p_extraction_id: null,
        p_results: input.biomarkers,
        p_supersedes_lab_report_id: null,
      });
      if (result.error) throw new Error(result.error.message);
      await reload();
      return result.data;
    } finally {
      setSaving(false);
    }
  }, [athleteId, reload]);

  const recordVital = useCallback(async (input: {
    metricCode: string;
    numericValue: number;
    secondaryNumericValue?: number | null;
    unitCode: string;
    conditionText?: string | null;
    deviceText?: string | null;
  }) => {
    if (!athleteId) throw new Error("Atleta não disponível.");
    setSaving(true);
    setError(null);
    try {
      const now = new Date();
      const result = await db.rpc("health_m9_record_vital_observation", {
        p_athlete_id: athleteId,
        p_observed_at: now.toISOString(),
        p_observed_on: todayIso(),
        p_metric_code: input.metricCode,
        p_numeric_value: input.numericValue,
        p_secondary_numeric_value: input.secondaryNumericValue ?? null,
        p_unit_code: input.unitCode,
        p_condition_text: input.conditionText?.trim() || null,
        p_device_text: input.deviceText?.trim() || null,
        p_data_source: "USER_REPORTED",
        p_confidence: "moderate",
        p_client_event_id: clientEventId(),
        p_supersedes_vital_observation_id: null,
      });
      if (result.error) throw new Error(result.error.message);
      await reload();
    } finally {
      setSaving(false);
    }
  }, [athleteId, reload]);

  const reportResults = useCallback((reportId: string) =>
    results.filter((result) => result.lab_report_id === reportId),
  [results]);

  const latestStatesByCode = useMemo(() => {
    const map = new Map<string, BiomarkerState>();
    for (const state of states) {
      if (!map.has(state.canonical_code)) map.set(state.canonical_code, state);
    }
    return map;
  }, [states]);

  return {
    documents,
    reports,
    results,
    states,
    vitals,
    latestStatesByCode,
    reportResults,
    loading,
    saving,
    error,
    reload,
    uploadDocument,
    voidDocument,
    recordLabReport,
    recordVital,
  };
}
