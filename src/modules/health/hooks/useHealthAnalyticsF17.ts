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
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const db = supabase as unknown as SupabaseClient<LooseDatabase>;

export type AnalyticsWindowDays = 30 | 90 | 180;

export type TrainingAnalyticsPoint = {
  date: string;
  sessionCount: number;
  setCount: number;
  reps: number | null;
  kgVolume: number | null;
};

export type NutritionAnalyticsPoint = {
  date: string;
  energyKcal: number | null;
  proteinG: number | null;
  completenessStatus: string;
  activeItemCount: number;
};

export type BodyAnalyticsPoint = {
  date: string;
  weightKg: number | null;
  waistCm: number | null;
  bodyFatPct: number | null;
};

export type RecoveryAnalyticsPoint = {
  date: string;
  sleepMinutes: number | null;
  physicalRecovery: number | null;
  trainingReadiness: number | null;
  generalFatigue: number | null;
};

export type AnalyticsDomain<T> = {
  data: T[];
  error: string | null;
};

type AnalyticsState = {
  training: AnalyticsDomain<TrainingAnalyticsPoint>;
  nutrition: AnalyticsDomain<NutritionAnalyticsPoint>;
  body: AnalyticsDomain<BodyAnalyticsPoint>;
  recovery: AnalyticsDomain<RecoveryAnalyticsPoint>;
};

const emptyState: AnalyticsState = {
  training: { data: [], error: null },
  nutrition: { data: [], error: null },
  body: { data: [], error: null },
  recovery: { data: [], error: null },
};

function localIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startDateIso(windowDays: AnalyticsWindowDays) {
  const now = new Date();
  return localIsoDate(
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - (windowDays - 1),
      0,
      0,
      0,
      0,
    ),
  );
}

function startTimestamp(windowDays: AnalyticsWindowDays) {
  const iso = startDateIso(windowDays);
  return new Date(`${iso}T00:00:00`).toISOString();
}

function timestampToLocalDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value.slice(0, 10) : localIsoDate(parsed);
}

function numeric(value: unknown) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function useHealthAnalyticsF17(
  athleteId: string | null | undefined,
  windowDays: AnalyticsWindowDays,
) {
  const [state, setState] = useState<AnalyticsState>(emptyState);
  const [loading, setLoading] = useState(Boolean(athleteId));

  const reload = useCallback(async () => {
    if (!athleteId) {
      setState(emptyState);
      setLoading(false);
      return;
    }

    setLoading(true);
    const fromDate = startDateIso(windowDays);
    const fromTimestamp = startTimestamp(windowDays);

    const [
      sessionsResult,
      foodDaysResult,
      bodyAssessmentsResult,
      sleepResult,
      recoveryResult,
    ] = await Promise.all([
      db
        .from("health_workout_sessions")
        .select("id,started_at,ended_at,status")
        .eq("athlete_id", athleteId)
        .eq("record_status", "active")
        .eq("status", "completed")
        .gte("started_at", fromTimestamp)
        .order("started_at", { ascending: true })
        .limit(5000),
      db
        .from("health_food_log_days")
        .select("id,log_date,completeness_status")
        .eq("athlete_id", athleteId)
        .gte("log_date", fromDate)
        .order("log_date", { ascending: true })
        .limit(1000),
      db
        .from("health_body_assessments")
        .select("id,observed_on,observed_at,status")
        .eq("athlete_id", athleteId)
        .eq("status", "active")
        .gte("observed_on", fromDate)
        .order("observed_at", { ascending: true })
        .limit(1000),
      db
        .from("health_sleep_periods")
        .select(
          "id,sleep_date,declared_sleep_minutes,calculated_sleep_minutes,status",
        )
        .eq("athlete_id", athleteId)
        .eq("status", "active")
        .gte("sleep_date", fromDate)
        .order("sleep_date", { ascending: true })
        .limit(1000),
      db
        .from("health_recovery_checkins")
        .select(
          "id,observed_on,observed_at,metric_code,value_ordinal,status",
        )
        .eq("athlete_id", athleteId)
        .eq("status", "active")
        .gte("observed_on", fromDate)
        .in("metric_code", [
          "physical_recovery",
          "training_readiness",
          "general_fatigue",
        ])
        .order("observed_at", { ascending: true })
        .limit(5000),
    ]);

    const next: AnalyticsState = {
      training: { data: [], error: sessionsResult.error?.message ?? null },
      nutrition: { data: [], error: foodDaysResult.error?.message ?? null },
      body: { data: [], error: bodyAssessmentsResult.error?.message ?? null },
      recovery: {
        data: [],
        error: sleepResult.error?.message ?? recoveryResult.error?.message ?? null,
      },
    };

    if (!sessionsResult.error) {
      const sessions = (sessionsResult.data ?? []) as unknown as Array<{
        id: string;
        started_at: string;
        ended_at: string | null;
        status: string;
      }>;
      const sessionIds = sessions.map((item) => item.id);

      const setsResult = sessionIds.length
        ? await db
            .from("health_workout_sets")
            .select("session_id,status,load_value,load_unit,reps,completed_at")
            .eq("athlete_id", athleteId)
            .eq("status", "completed")
            .in("session_id", sessionIds)
            .order("completed_at", { ascending: true })
            .limit(10000)
        : { data: [], error: null };

      if (setsResult.error) {
        next.training.error = setsResult.error.message;
      } else {
        const dayMap = new Map<
          string,
          {
            sessionCount: number;
            setCount: number;
            reps: number;
            knownRepCount: number;
            kgVolume: number;
            knownVolumeCount: number;
          }
        >();
        const sessionDate = new Map<string, string>();

        for (const session of sessions) {
          const date = timestampToLocalDate(session.started_at);
          sessionDate.set(session.id, date);
          const current = dayMap.get(date) ?? {
            sessionCount: 0,
            setCount: 0,
            reps: 0,
            knownRepCount: 0,
            kgVolume: 0,
            knownVolumeCount: 0,
          };
          current.sessionCount += 1;
          dayMap.set(date, current);
        }

        for (const raw of (setsResult.data ?? []) as unknown as Array<{
          session_id: string;
          load_value: number | string | null;
          load_unit: string;
          reps: number | null;
        }>) {
          const date = sessionDate.get(raw.session_id);
          if (!date) continue;
          const current = dayMap.get(date);
          if (!current) continue;
          current.setCount += 1;

          if (raw.reps != null) {
            current.reps += raw.reps;
            current.knownRepCount += 1;
          }

          const load = numeric(raw.load_value);
          if (
            raw.load_unit === "kg" &&
            load != null &&
            raw.reps != null
          ) {
            current.kgVolume += load * raw.reps;
            current.knownVolumeCount += 1;
          }
        }

        next.training.data = Array.from(dayMap.entries())
          .map(([date, item]) => ({
            date,
            sessionCount: item.sessionCount,
            setCount: item.setCount,
            reps: item.knownRepCount ? item.reps : null,
            kgVolume: item.knownVolumeCount ? item.kgVolume : null,
          }))
          .sort((a, b) => a.date.localeCompare(b.date));
      }
    }

    if (!foodDaysResult.error) {
      const days = (foodDaysResult.data ?? []) as unknown as Array<{
        id: string;
        log_date: string;
        completeness_status: string;
      }>;
      const dayIds = days.map((item) => item.id);

      const mealResult = dayIds.length
        ? await db
            .from("health_meal_logs")
            .select("id,food_log_day_id")
            .eq("athlete_id", athleteId)
            .in("food_log_day_id", dayIds)
            .limit(5000)
        : { data: [], error: null };

      if (mealResult.error) {
        next.nutrition.error = mealResult.error.message;
      } else {
        const meals = (mealResult.data ?? []) as unknown as Array<{
          id: string;
          food_log_day_id: string;
        }>;
        const mealIds = meals.map((item) => item.id);
        const mealToDay = new Map(
          meals.map((item) => [item.id, item.food_log_day_id]),
        );

        const itemsResult = mealIds.length
          ? await db
              .from("health_meal_items")
              .select(
                "meal_log_id,status,energy_kcal_snapshot,protein_g_snapshot,created_at",
              )
              .eq("athlete_id", athleteId)
              .eq("status", "active")
              .gte("created_at", fromTimestamp)
              .order("created_at", { ascending: true })
              .limit(10000)
          : { data: [], error: null };

        if (itemsResult.error) {
          next.nutrition.error = itemsResult.error.message;
        } else {
          const totalsByDay = new Map<
            string,
            {
              energy: number;
              protein: number;
              energyKnown: number;
              proteinKnown: number;
              itemCount: number;
            }
          >();

          for (const raw of (itemsResult.data ?? []) as unknown as Array<{
            meal_log_id: string;
            energy_kcal_snapshot: number | string | null;
            protein_g_snapshot: number | string | null;
          }>) {
            const dayId = mealToDay.get(raw.meal_log_id);
            if (!dayId) continue;
            const current = totalsByDay.get(dayId) ?? {
              energy: 0,
              protein: 0,
              energyKnown: 0,
              proteinKnown: 0,
              itemCount: 0,
            };
            current.itemCount += 1;

            const energy = numeric(raw.energy_kcal_snapshot);
            if (energy != null) {
              current.energy += energy;
              current.energyKnown += 1;
            }

            const protein = numeric(raw.protein_g_snapshot);
            if (protein != null) {
              current.protein += protein;
              current.proteinKnown += 1;
            }

            totalsByDay.set(dayId, current);
          }

          next.nutrition.data = days.map((day) => {
            const totals = totalsByDay.get(day.id);
            const allEnergyKnown =
              Boolean(totals?.itemCount) &&
              totals?.energyKnown === totals?.itemCount;
            const allProteinKnown =
              Boolean(totals?.itemCount) &&
              totals?.proteinKnown === totals?.itemCount;

            return {
              date: day.log_date,
              energyKcal: allEnergyKnown ? totals?.energy ?? null : null,
              proteinG: allProteinKnown ? totals?.protein ?? null : null,
              completenessStatus: day.completeness_status,
              activeItemCount: totals?.itemCount ?? 0,
            };
          });
        }
      }
    }

    if (!bodyAssessmentsResult.error) {
      const assessments = (bodyAssessmentsResult.data ?? []) as unknown as Array<{
        id: string;
        observed_on: string;
        observed_at: string;
      }>;
      const assessmentIds = assessments.map((item) => item.id);

      const measurementsResult = assessmentIds.length
        ? await db
            .from("health_body_measurements")
            .select("assessment_id,metric_code,value,created_at")
            .eq("athlete_id", athleteId)
            .in("assessment_id", assessmentIds)
            .in("metric_code", ["weight_kg", "waist_cm", "body_fat_pct"])
            .order("created_at", { ascending: true })
            .limit(5000)
        : { data: [], error: null };

      if (measurementsResult.error) {
        next.body.error = measurementsResult.error.message;
      } else {
        const assessmentDate = new Map(
          assessments.map((item) => [item.id, item.observed_on]),
        );
        const dayMap = new Map<string, BodyAnalyticsPoint>();

        for (const assessment of assessments) {
          if (!dayMap.has(assessment.observed_on)) {
            dayMap.set(assessment.observed_on, {
              date: assessment.observed_on,
              weightKg: null,
              waistCm: null,
              bodyFatPct: null,
            });
          }
        }

        for (const raw of (measurementsResult.data ?? []) as unknown as Array<{
          assessment_id: string;
          metric_code: string;
          value: number | string;
        }>) {
          const date = assessmentDate.get(raw.assessment_id);
          if (!date) continue;
          const point = dayMap.get(date);
          if (!point) continue;
          const value = numeric(raw.value);
          if (raw.metric_code === "weight_kg") point.weightKg = value;
          if (raw.metric_code === "waist_cm") point.waistCm = value;
          if (raw.metric_code === "body_fat_pct") point.bodyFatPct = value;
        }

        next.body.data = Array.from(dayMap.values())
          .filter(
            (point) =>
              point.weightKg != null ||
              point.waistCm != null ||
              point.bodyFatPct != null,
          )
          .sort((a, b) => a.date.localeCompare(b.date));
      }
    }

    if (!sleepResult.error && !recoveryResult.error) {
      const recoveryMap = new Map<
        string,
        {
          sleepMinutes: number[];
          physicalRecovery: number[];
          trainingReadiness: number[];
          generalFatigue: number[];
        }
      >();

      for (const raw of (sleepResult.data ?? []) as unknown as Array<{
        sleep_date: string;
        declared_sleep_minutes: number | null;
        calculated_sleep_minutes: number | null;
      }>) {
        const current = recoveryMap.get(raw.sleep_date) ?? {
          sleepMinutes: [],
          physicalRecovery: [],
          trainingReadiness: [],
          generalFatigue: [],
        };
        const minutes =
          raw.calculated_sleep_minutes ?? raw.declared_sleep_minutes;
        if (minutes != null) current.sleepMinutes.push(minutes);
        recoveryMap.set(raw.sleep_date, current);
      }

      for (const raw of (recoveryResult.data ?? []) as unknown as Array<{
        observed_on: string;
        metric_code: string;
        value_ordinal: number | null;
      }>) {
        if (raw.value_ordinal == null) continue;
        const current = recoveryMap.get(raw.observed_on) ?? {
          sleepMinutes: [],
          physicalRecovery: [],
          trainingReadiness: [],
          generalFatigue: [],
        };
        if (raw.metric_code === "physical_recovery") {
          current.physicalRecovery.push(raw.value_ordinal);
        }
        if (raw.metric_code === "training_readiness") {
          current.trainingReadiness.push(raw.value_ordinal);
        }
        if (raw.metric_code === "general_fatigue") {
          current.generalFatigue.push(raw.value_ordinal);
        }
        recoveryMap.set(raw.observed_on, current);
      }

      next.recovery.data = Array.from(recoveryMap.entries())
        .map(([date, item]) => ({
          date,
          sleepMinutes: item.sleepMinutes.length
            ? item.sleepMinutes.reduce((sum, value) => sum + value, 0)
            : null,
          physicalRecovery: average(item.physicalRecovery),
          trainingReadiness: average(item.trainingReadiness),
          generalFatigue: average(item.generalFatigue),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    setState(next);
    setLoading(false);
  }, [athleteId, windowDays]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const coverage = useMemo(
    () => ({
      training: state.training.data.length,
      nutrition: state.nutrition.data.length,
      body: state.body.data.length,
      recovery: state.recovery.data.length,
    }),
    [state],
  );

  return {
    ...state,
    loading,
    coverage,
    reload,
  };
}
