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

export type NutritionDecisionM7 = {
  id: string;
  athlete_id: string;
  as_of_date: string;
  window_days: 7 | 14 | 28;
  decision_status: "paused" | "ready";
  decision_class: "data_quality" | "execution" | "maintenance" | "plan_adjustment";
  decision_code:
    | "decision_paused"
    | "review_data_quality"
    | "review_energy_execution"
    | "review_protein_execution"
    | "review_energy_and_protein_execution"
    | "maintain_plan";
  target_domain: "overall" | "energy" | "protein" | "energy_and_protein";
  confidence: "low" | "moderate" | "high";
  reason_codes: string[];
  plan_adjustment_status: "paused" | "eligible";
  plan_adjustment_reason_codes: string[];
  sufficient_day_count: number;
  energy_comparable_day_count: number;
  protein_comparable_day_count: number;
  energy_target_adherence_ratio: number | null;
  protein_target_adherence_ratio: number | null;
  rolling_coverage_status: "unobserved" | "sparse" | "partial" | "complete";
  rolling_confidence: "low" | "moderate" | "high";
  algorithm_version: string;
  record_status: "current" | "superseded";
  created_at: string;
};

function todayIso() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function useHealthNutritionDecisionM7(athleteId: string | null | undefined) {
  const [decision, setDecision] = useState<NutritionDecisionM7 | null>(null);
  const [loading, setLoading] = useState(Boolean(athleteId));
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!athleteId) {
      setDecision(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: queryError } = await db
      .from("health_nutrition_decisions")
      .select("*")
      .eq("athlete_id", athleteId)
      .eq("as_of_date", todayIso())
      .eq("window_days", 7)
      .eq("record_status", "current")
      .maybeSingle();

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    setDecision(data as NutritionDecisionM7 | null);
    setLoading(false);
  }, [athleteId]);

  const evaluate = useCallback(async () => {
    if (!athleteId) return;

    setEvaluating(true);
    setError(null);

    const { error: rpcError } = await db.rpc("health_m7_evaluate_nutrition_decision", {
      p_athlete_id: athleteId,
      p_as_of_date: todayIso(),
      p_window_days: 7,
    });

    if (rpcError) {
      setError(rpcError.message);
      setEvaluating(false);
      return;
    }

    await load();
    setEvaluating(false);
  }, [athleteId, load]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    decision,
    loading,
    evaluating,
    error,
    evaluate,
    reload: load,
  };
}
