import { useCallback, useEffect, useState } from "react";
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

export type BodyMetricCode =
  | "weight_kg"
  | "waist_cm"
  | "hip_cm"
  | "chest_cm"
  | "neck_cm"
  | "arm_left_cm"
  | "arm_right_cm"
  | "thigh_left_cm"
  | "thigh_right_cm"
  | "calf_left_cm"
  | "calf_right_cm"
  | "body_fat_pct"
  | "lean_mass_kg"
  | "skeletal_muscle_mass_kg";

export type BodyMeasurementInput = {
  metric_code: BodyMetricCode;
  value: number;
  unit_code: "kg" | "cm" | "pct";
  method: "scale" | "tape" | "bioimpedance" | "caliper" | "dexa" | "estimated" | "professional" | "other";
  confidence: "low" | "moderate" | "high";
  notes?: string | null;
};

export type BodyMeasurement = {
  id: string;
  assessment_id: string;
  athlete_id: string;
  metric_code: BodyMetricCode;
  value: number | string;
  unit_code: "kg" | "cm" | "pct";
  method: string;
  confidence: "low" | "moderate" | "high";
  notes: string | null;
  created_at: string;
};

export type BodyAssessment = {
  id: string;
  athlete_id: string;
  observed_at: string;
  observed_on: string;
  data_source: string;
  confidence: "low" | "moderate" | "high";
  conditions: Record<string, unknown> | null;
  notes: string | null;
  status: "active" | "superseded" | "voided";
  supersedes_assessment_id: string | null;
  void_reason: string | null;
  created_at: string;
  measurements: BodyMeasurement[];
};

export type BodyRollingState = {
  id: string;
  athlete_id: string;
  as_of_date: string;
  window_days: 7 | 14 | 28;
  weight_observation_count: number;
  weight_first_kg: number | string | null;
  weight_latest_kg: number | string | null;
  weight_change_kg: number | string | null;
  weight_trend_kg_per_week: number | string | null;
  waist_observation_count: number;
  waist_first_cm: number | string | null;
  waist_latest_cm: number | string | null;
  waist_change_cm: number | string | null;
  body_fat_observation_count: number;
  body_fat_first_pct: number | string | null;
  body_fat_latest_pct: number | string | null;
  body_fat_change_pct: number | string | null;
  photo_set_count: number;
  latest_bmi: number | string | null;
  coverage_status: "unobserved" | "sparse" | "partial" | "complete";
  confidence: "low" | "moderate" | "high";
  reason_codes: string[];
  computed_at: string;
};

export type BodyPhoto = {
  id: string;
  photo_set_id: string;
  athlete_id: string;
  angle_code: "front_relaxed" | "left_side_relaxed" | "back_relaxed" | "right_side_relaxed" | "custom";
  capture_order: number;
  object_path: string;
  mime_type: string;
  signed_url: string | null;
};

export type BodyPhotoSet = {
  id: string;
  athlete_id: string;
  captured_at: string;
  captured_on: string;
  protocol_version: string;
  conditions: Record<string, unknown> | null;
  notes: string | null;
  status: "active" | "voided";
  photos: BodyPhoto[];
};

export type BodyPhotoUpload = {
  angle_code: BodyPhoto["angle_code"];
  file: File;
};

function todayIso() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function bodyFileExtension(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export function useHealthBodyM8(athleteId: string | null | undefined) {
  const [assessments, setAssessments] = useState<BodyAssessment[]>([]);
  const [states, setStates] = useState<BodyRollingState[]>([]);
  const [photoSets, setPhotoSets] = useState<BodyPhotoSet[]>([]);
  const [loading, setLoading] = useState(Boolean(athleteId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!athleteId) {
      setAssessments([]);
      setStates([]);
      setPhotoSets([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [assessmentsResult, statesResult, photoSetsResult] = await Promise.all([
      db
        .from("health_body_assessments")
        .select("*")
        .eq("athlete_id", athleteId)
        .order("observed_at", { ascending: false })
        .limit(12),
      db
        .from("health_body_rolling_states")
        .select("*")
        .eq("athlete_id", athleteId)
        .eq("as_of_date", todayIso())
        .order("window_days", { ascending: true }),
      db
        .from("health_body_photo_sets")
        .select("*")
        .eq("athlete_id", athleteId)
        .eq("status", "active")
        .order("captured_at", { ascending: false })
        .limit(6),
    ]);

    const firstError = assessmentsResult.error ?? statesResult.error ?? photoSetsResult.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const rawAssessments = (assessmentsResult.data ?? []) as unknown as Omit<BodyAssessment, "measurements">[];
    const assessmentIds = rawAssessments.map((item) => item.id);

    let measurements: BodyMeasurement[] = [];
    if (assessmentIds.length) {
      const measurementResult = await db
        .from("health_body_measurements")
        .select("*")
        .in("assessment_id", assessmentIds)
        .order("created_at", { ascending: true });

      if (measurementResult.error) {
        setError(measurementResult.error.message);
        setLoading(false);
        return;
      }

      measurements = (measurementResult.data ?? []) as unknown as BodyMeasurement[];
    }

    const measurementsByAssessment = new Map<string, BodyMeasurement[]>();
    for (const measurement of measurements) {
      const bucket = measurementsByAssessment.get(measurement.assessment_id) ?? [];
      bucket.push(measurement);
      measurementsByAssessment.set(measurement.assessment_id, bucket);
    }

    const rawPhotoSets = (photoSetsResult.data ?? []) as unknown as Omit<BodyPhotoSet, "photos">[];
    const photoSetIds = rawPhotoSets.map((item) => item.id);

    let photos: BodyPhoto[] = [];
    if (photoSetIds.length) {
      const photosResult = await db
        .from("health_body_photos")
        .select("*")
        .in("photo_set_id", photoSetIds)
        .eq("status", "active")
        .order("capture_order", { ascending: true });

      if (photosResult.error) {
        setError(photosResult.error.message);
        setLoading(false);
        return;
      }

      const rawPhotos = (photosResult.data ?? []) as unknown as Omit<BodyPhoto, "signed_url">[];
      photos = await Promise.all(
        rawPhotos.map(async (photo) => {
          const { data, error: signedError } = await supabase.storage
            .from("health-private")
            .createSignedUrl(photo.object_path, 3600);

          return {
            ...photo,
            signed_url: signedError ? null : data.signedUrl,
          };
        }),
      );
    }

    const photosBySet = new Map<string, BodyPhoto[]>();
    for (const photo of photos) {
      const bucket = photosBySet.get(photo.photo_set_id) ?? [];
      bucket.push(photo);
      photosBySet.set(photo.photo_set_id, bucket);
    }

    setAssessments(
      rawAssessments.map((assessment) => ({
        ...assessment,
        measurements: measurementsByAssessment.get(assessment.id) ?? [],
      })),
    );
    setStates((statesResult.data ?? []) as unknown as BodyRollingState[]);
    setPhotoSets(
      rawPhotoSets.map((set) => ({
        ...set,
        photos: photosBySet.get(set.id) ?? [],
      })),
    );
    setLoading(false);
  }, [athleteId]);

  const refreshStates = useCallback(async () => {
    if (!athleteId) return;

    for (const windowDays of [7, 14, 28] as const) {
      const { error: rpcError } = await db.rpc("health_m8_refresh_body_state", {
        p_athlete_id: athleteId,
        p_as_of_date: todayIso(),
        p_window_days: windowDays,
      });
      if (rpcError) throw new Error(rpcError.message);
    }
  }, [athleteId]);

  const recordAssessment = useCallback(
    async (input: {
      observedAt?: string;
      observedOn?: string;
      measurements: BodyMeasurementInput[];
      conditions?: Record<string, unknown> | null;
      notes?: string | null;
      supersedesAssessmentId?: string | null;
    }) => {
      if (!athleteId) throw new Error("Atleta não disponível.");
      if (!input.measurements.length) throw new Error("Informe ao menos uma medida corporal.");

      setSaving(true);
      setError(null);
      try {
        const { error: rpcError } = await db.rpc("health_m8_record_body_assessment", {
          p_athlete_id: athleteId,
          p_observed_at: input.observedAt ?? new Date().toISOString(),
          p_observed_on: input.observedOn ?? todayIso(),
          p_client_event_id: crypto.randomUUID(),
          p_measurements: input.measurements,
          p_conditions: input.conditions ?? null,
          p_notes: input.notes ?? null,
          p_data_source: "MEASURED",
          p_confidence: "high",
          p_supersedes_assessment_id: input.supersedesAssessmentId ?? null,
        });

        if (rpcError) throw new Error(rpcError.message);
        await refreshStates();
        await load();
      } finally {
        setSaving(false);
      }
    },
    [athleteId, load, refreshStates],
  );

  const voidAssessment = useCallback(
    async (assessmentId: string) => {
      setSaving(true);
      setError(null);
      try {
        const { error: rpcError } = await db.rpc("health_m8_void_body_assessment", {
          p_assessment_id: assessmentId,
          p_reason: "Anulado pelo usuário",
        });
        if (rpcError) throw new Error(rpcError.message);
        await refreshStates();
        await load();
      } finally {
        setSaving(false);
      }
    },
    [load, refreshStates],
  );

  const uploadPhotoSet = useCallback(
    async (uploads: BodyPhotoUpload[], conditions?: Record<string, unknown> | null) => {
      if (!athleteId) throw new Error("Atleta não disponível.");
      if (!uploads.length) throw new Error("Selecione ao menos uma foto.");

      const supported = new Set(["image/jpeg", "image/png", "image/webp"]);
      const invalid = uploads.find((item) => !supported.has(item.file.type));
      if (invalid) throw new Error("Use imagens JPEG, PNG ou WebP.");

      setSaving(true);
      setError(null);

      const photoSetId = crypto.randomUUID();
      const uploadedPaths: string[] = [];

      try {
        const photoRows: Array<{
          id: string;
          angle_code: BodyPhoto["angle_code"];
          capture_order: number;
          object_path: string;
          mime_type: string;
          notes: null;
        }> = [];

        for (const [index, upload] of uploads.entries()) {
          const photoId = crypto.randomUUID();
          const ext = bodyFileExtension(upload.file.type);
          const objectPath =
            athleteId + "/progress/" + photoSetId + "/" + String(index + 1) + "-" + upload.angle_code + "-" + photoId + "." + ext;

          const { error: uploadError } = await supabase.storage
            .from("health-private")
            .upload(objectPath, upload.file, {
              contentType: upload.file.type,
              upsert: false,
              cacheControl: "3600",
            });

          if (uploadError) throw new Error(uploadError.message);

          uploadedPaths.push(objectPath);
          photoRows.push({
            id: photoId,
            angle_code: upload.angle_code,
            capture_order: index + 1,
            object_path: objectPath,
            mime_type: upload.file.type,
            notes: null,
          });
        }

        const { error: registerError } = await db.rpc("health_m8_register_body_photo_set", {
          p_athlete_id: athleteId,
          p_photo_set_id: photoSetId,
          p_captured_at: new Date().toISOString(),
          p_captured_on: todayIso(),
          p_photos: photoRows,
          p_conditions: conditions ?? null,
          p_notes: null,
          p_assessment_id: null,
        });

        if (registerError) {
          await supabase.storage.from("health-private").remove(uploadedPaths);
          throw new Error(registerError.message);
        }

        await refreshStates();
        await load();
      } catch (cause) {
        if (uploadedPaths.length) {
          await supabase.storage.from("health-private").remove(uploadedPaths);
        }
        throw cause;
      } finally {
        setSaving(false);
      }
    },
    [athleteId, load, refreshStates],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return {
    assessments,
    states,
    photoSets,
    loading,
    saving,
    error,
    reload: load,
    refreshStates: async () => {
      await refreshStates();
      await load();
    },
    recordAssessment,
    voidAssessment,
    uploadPhotoSet,
  };
}
