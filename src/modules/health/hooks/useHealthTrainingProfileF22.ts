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
    Functions: Record<
      string,
      { Args: Record<string, unknown>; Returns: unknown }
    >;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const db = supabase as unknown as SupabaseClient<LooseDatabase>;

export type HealthTrainingProfileF22 = {
  athlete_id: string;
  training_level: "beginner" | "intermediate" | "advanced";
  training_level_source: string;
  baseline_state: "collecting" | "partial" | "established" | "recalibrating";
  calibration_active: boolean;
  calibration_policy: "non_limiting";
  overall_data_confidence: "unknown" | "low" | "medium" | "high";
  technical_data_confidence: "unknown" | "low" | "medium" | "high";
  rir_data_confidence: "unknown" | "low" | "medium" | "high";
  volume_tolerance_confidence: "unknown" | "low" | "medium" | "high";
  recovery_confidence: "unknown" | "low" | "medium" | "high";
  notes: string | null;
};

export type HealthExerciseCalibrationSummaryF22 = {
  total: number;
  unknown: number;
  collecting: number;
  established: number;
  recalibrating: number;
  observedSets: number;
};

const emptySummary: HealthExerciseCalibrationSummaryF22 = {
  total: 0,
  unknown: 0,
  collecting: 0,
  established: 0,
  recalibrating: 0,
  observedSets: 0,
};

export function useHealthTrainingProfileF22(
  athleteId: string | null | undefined,
) {
  const [profile, setProfile] = useState<HealthTrainingProfileF22 | null>(null);
  const [exerciseRows, setExerciseRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(Boolean(athleteId));
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!athleteId) {
      setProfile(null);
      setExerciseRows([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const [profileResult, exerciseResult] = await Promise.all([
      db
        .from("health_training_profiles")
        .select("*")
        .eq("athlete_id", athleteId)
        .maybeSingle(),
      db
        .from("health_exercise_calibration_profiles")
        .select(
          "exercise_id,calibration_status,exposure_sessions,completed_sets,load_confidence,rep_response_confidence,rir_confidence,last_exposure_at",
        )
        .eq("athlete_id", athleteId),
    ]);

    const firstError = profileResult.error ?? exerciseResult.error;
    if (firstError) {
      setAvailable(false);
      setError(firstError.message);
      setLoading(false);
      return;
    }

    setProfile(
      (profileResult.data as unknown as HealthTrainingProfileF22 | null) ?? null,
    );
    setExerciseRows(
      (exerciseResult.data ?? []) as unknown as Array<Record<string, unknown>>,
    );
    setAvailable(true);
    setLoading(false);
  }, [athleteId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const exerciseSummary = useMemo(() => {
    if (!exerciseRows.length) return emptySummary;

    const summary = { ...emptySummary };
    summary.total = exerciseRows.length;

    for (const row of exerciseRows) {
      const status = String(row.calibration_status ?? "unknown");
      if (status === "collecting") summary.collecting += 1;
      else if (status === "established") summary.established += 1;
      else if (status === "recalibrating") summary.recalibrating += 1;
      else summary.unknown += 1;

      summary.observedSets += Number(row.completed_sets ?? 0);
    }

    return summary;
  }, [exerciseRows]);

  return {
    profile,
    exerciseSummary,
    loading,
    available,
    error,
    reload,
  };
}
