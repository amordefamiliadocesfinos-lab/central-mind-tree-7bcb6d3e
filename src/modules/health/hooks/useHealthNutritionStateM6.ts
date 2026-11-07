import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as SupabaseClient<any>;

export type NutritionDailyStateM6 = {
  id: string;
  athlete_id: string;
  state_date: string;
  observed_meal_count: number;
  observed_item_count: number;
  energy_kcal_consumed: number | null;
  protein_g_consumed: number | null;
  carbohydrate_g_consumed: number | null;
  fat_g_consumed: number | null;
  fiber_g_consumed: number | null;
  energy_target_status: "unknown" | "not_targeted" | "below" | "in_range" | "above";
  protein_target_status: "unknown" | "not_targeted" | "below" | "in_range" | "above";
  completeness_status: "unknown" | "partial" | "complete";
  state_status: "unobserved" | "partial" | "sufficient";
  confidence: "low" | "moderate" | "high";
  reason_codes: string[];
  calculated_at: string;
};

export type NutritionRollingStateM6 = {
  id: string;
  athlete_id: string;
  window_end_date: string;
  window_days: 7 | 14 | 28;
  observed_day_count: number;
  sufficient_day_count: number;
  partial_day_count: number;
  unobserved_day_count: number;
  observation_coverage_ratio: number;
  sufficient_coverage_ratio: number;
  avg_energy_kcal: number | null;
  avg_protein_g: number | null;
  avg_carbohydrate_g: number | null;
  avg_fat_g: number | null;
  energy_comparable_day_count: number;
  energy_in_target_day_count: number;
  energy_target_adherence_ratio: number | null;
  protein_comparable_day_count: number;
  protein_in_target_day_count: number;
  protein_target_adherence_ratio: number | null;
  coverage_status: "unobserved" | "sparse" | "partial" | "complete";
  confidence: "low" | "moderate" | "high";
  reason_codes: string[];
  calculated_at: string;
};

function todayIso() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function useHealthNutritionStateM6(athleteId: string | null | undefined) {
  const [daily, setDaily] = useState<NutritionDailyStateM6 | null>(null);
  const [rolling7, setRolling7] = useState<NutritionRollingStateM6 | null>(null);
  const [loading, setLoading] = useState(Boolean(athleteId));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!athleteId) {
      setDaily(null);
      setRolling7(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const today = todayIso();

    const [dailyResult, rollingResult] = await Promise.all([
      db.from("health_nutrition_daily_states")
        .select("*")
        .eq("athlete_id", athleteId)
        .eq("state_date", today)
        .maybeSingle(),
      db.from("health_nutrition_rolling_states")
        .select("*")
        .eq("athlete_id", athleteId)
        .eq("window_end_date", today)
        .eq("window_days", 7)
        .maybeSingle(),
    ]);

    const firstError = dailyResult.error ?? rollingResult.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    setDaily(dailyResult.data as NutritionDailyStateM6 | null);
    setRolling7(rollingResult.data as NutritionRollingStateM6 | null);
    setLoading(false);
  }, [athleteId]);

  const refresh = useCallback(async () => {
    if (!athleteId) return;
    setRefreshing(true);
    setError(null);
    const today = todayIso();

    try {
      const dayResult = await db.rpc("health_m6_refresh_daily_state", {
        p_athlete_id: athleteId,
        p_state_date: today,
      });
      if (dayResult.error) throw new Error(dayResult.error.message);

      const rollingResult = await db.rpc("health_m6_refresh_rolling_state", {
        p_athlete_id: athleteId,
        p_window_end_date: today,
        p_window_days: 7,
      });
      if (rollingResult.error) throw new Error(rollingResult.error.message);

      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao atualizar estado nutricional.");
    } finally {
      setRefreshing(false);
    }
  }, [athleteId, load]);

  useEffect(() => { void load(); }, [load]);

  return { daily, rolling7, loading, refreshing, error, refresh, reload: load };
}
