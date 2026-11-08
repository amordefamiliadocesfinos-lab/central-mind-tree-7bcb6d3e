import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  availabilityFor,
  buildDashboardIssues,
  freshnessForDate,
  localDateIso,
  type DashboardAvailability,
  type DashboardFreshness,
} from "../dashboard/dashboardModel";

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

type DomainMeta = {
  availability: DashboardAvailability;
  freshness: DashboardFreshness;
  asOf: string | null;
  error: string | null;
  confidence: string | null;
  coverage: string | null;
  reasonCodes: string[];
};

export type DashboardTraining = DomainMeta & {
  activeSession: {
    id: string;
    status: string;
    startedAt: string;
    templateName: string | null;
  } | null;
  nextQueue: {
    id: string;
    state: string;
    queuePosition: number;
    templateName: string | null;
  } | null;
};

export type DashboardNutrition = DomainMeta & {
  daily: {
    observedMealCount: number;
    observedItemCount: number;
    energyKcal: number | null;
    proteinG: number | null;
    completenessStatus: string;
    stateStatus: string;
    confidence: string;
    reasonCodes: string[];
    stateDate: string;
  } | null;
  rolling7: {
    observedDayCount: number;
    sufficientDayCount: number;
    observationCoverageRatio: number;
    coverageStatus: string;
    confidence: string;
    reasonCodes: string[];
    windowEndDate: string;
  } | null;
  decision: {
    status: string;
    decisionClass: string;
    decisionCode: string;
    confidence: string;
    reasonCodes: string[];
    planAdjustmentStatus: string;
    asOfDate: string;
  } | null;
};

export type DashboardBody = DomainMeta & {
  state: {
    asOfDate: string;
    weightLatestKg: number | null;
    weightChangeKg: number | null;
    weightTrendKgPerWeek: number | null;
    waistLatestCm: number | null;
    bodyFatLatestPct: number | null;
    photoSetCount: number;
    latestBmi: number | null;
    coverageStatus: string;
    confidence: string;
    reasonCodes: string[];
  } | null;
};

export type DashboardRecovery = DomainMeta & {
  state: {
    asOfDate: string;
    sleepDurationObservedDays: number;
    recoveryObservedDays: number;
    fatigueObservedDays: number;
    readinessObservedDays: number;
    sleepDurationCoverage: string;
    recoveryCoverage: string;
    fatigueCoverage: string;
    readinessCoverage: string;
    averageSleepMinutes: number | null;
    averageRecovery: number | null;
    averageFatigue: number | null;
    averageReadiness: number | null;
    confidence: string;
    reasonCodes: string[];
  } | null;
};

export type DashboardExams = DomainMeta & {
  latestReport: {
    id: string;
    laboratoryName: string | null;
    collectedAt: string | null;
    resultedAt: string | null;
    createdAt: string;
    confidence: string;
  } | null;
  latestReportMarkerCount: number | null;
  longitudinalStateCount: number;
  latestLongitudinalAsOf: string | null;
  latestVital: {
    metricCode: string;
    observedAt: string;
    observedOn: string;
  } | null;
  pendingReviewCount: number;
};

export type HealthDashboardF10 = {
  training: DashboardTraining;
  nutrition: DashboardNutrition;
  body: DashboardBody;
  recovery: DashboardRecovery;
  exams: DashboardExams;
};

function errorMessage(error: { message: string } | null | undefined) {
  return error?.message ?? null;
}

function templateName(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const row = data as { health_session_templates?: { name?: unknown } | Array<{ name?: unknown }> | null };
  const related = row.health_session_templates;
  if (Array.isArray(related)) {
    const name = related[0]?.name;
    return typeof name === "string" ? name : null;
  }
  if (related && typeof related === "object" && typeof related.name === "string") {
    return related.name;
  }
  return null;
}

const emptyMeta: DomainMeta = {
  availability: "unknown",
  freshness: "not_applicable",
  asOf: null,
  error: null,
  confidence: null,
  coverage: null,
  reasonCodes: [],
};

const emptyDashboard: HealthDashboardF10 = {
  training: { ...emptyMeta, nextQueue: null, activeSession: null },
  nutrition: { ...emptyMeta, daily: null, rolling7: null, decision: null },
  body: { ...emptyMeta, state: null },
  recovery: { ...emptyMeta, state: null },
  exams: {
    ...emptyMeta,
    latestReport: null,
    latestReportMarkerCount: null,
    longitudinalStateCount: 0,
    latestLongitudinalAsOf: null,
    latestVital: null,
    pendingReviewCount: 0,
  },
};

export function useHealthDashboardF10(athleteId: string | null | undefined) {
  const [dashboard, setDashboard] = useState<HealthDashboardF10>(emptyDashboard);
  const [loading, setLoading] = useState(Boolean(athleteId));

  const reload = useCallback(async () => {
    if (!athleteId) {
      setDashboard(emptyDashboard);
      setLoading(false);
      return;
    }

    setLoading(true);
    const today = localDateIso();

    const [
      sessionResult,
      dailyResult,
      rollingResult,
      decisionResult,
      bodyResult,
      recoveryResult,
      reportResult,
      longitudinalResult,
      vitalResult,
      extractionResult,
    ] = await Promise.all([
      db.from("health_workout_sessions")
        .select("id,status,started_at,session_template_id,health_session_templates(name)")
        .eq("athlete_id", athleteId)
        .in("status", ["active", "paused"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db.from("health_nutrition_daily_states")
        .select("state_date,observed_meal_count,observed_item_count,energy_kcal_consumed,protein_g_consumed,completeness_status,state_status,confidence,reason_codes,calculated_at")
        .eq("athlete_id", athleteId)
        .eq("state_date", today)
        .maybeSingle(),
      db.from("health_nutrition_rolling_states")
        .select("window_end_date,observed_day_count,sufficient_day_count,observation_coverage_ratio,coverage_status,confidence,reason_codes,calculated_at")
        .eq("athlete_id", athleteId)
        .eq("window_days", 7)
        .lte("window_end_date", today)
        .order("window_end_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db.from("health_nutrition_decisions")
        .select("as_of_date,decision_status,decision_class,decision_code,confidence,reason_codes,plan_adjustment_status,created_at")
        .eq("athlete_id", athleteId)
        .eq("window_days", 7)
        .eq("record_status", "current")
        .lte("as_of_date", today)
        .order("as_of_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db.from("health_body_rolling_states")
        .select("as_of_date,weight_latest_kg,weight_change_kg,weight_trend_kg_per_week,waist_latest_cm,body_fat_latest_pct,photo_set_count,latest_bmi,coverage_status,confidence,reason_codes,computed_at")
        .eq("athlete_id", athleteId)
        .eq("window_days", 7)
        .lte("as_of_date", today)
        .order("as_of_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db.from("health_sleep_recovery_rolling_states")
        .select("as_of_date,sleep_duration_observed_days,recovery_observed_days,fatigue_observed_days,readiness_observed_days,sleep_duration_coverage,recovery_coverage,fatigue_coverage,readiness_coverage,average_sleep_minutes,average_recovery,average_fatigue,average_readiness,confidence,reason_codes,computed_at")
        .eq("athlete_id", athleteId)
        .eq("window_days", 7)
        .lte("as_of_date", today)
        .order("as_of_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db.from("health_lab_reports")
        .select("id,laboratory_name,collected_at,resulted_at,created_at,confidence")
        .eq("athlete_id", athleteId)
        .eq("status", "active")
        .order("collected_at", { ascending: false, nullsFirst: false })
        .order("resulted_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db.from("health_biomarker_longitudinal_states")
        .select("as_of_date", { count: "exact" })
        .eq("athlete_id", athleteId)
        .order("as_of_date", { ascending: false })
        .limit(1),
      db.from("health_vital_observations")
        .select("metric_code,observed_at,observed_on")
        .eq("athlete_id", athleteId)
        .eq("status", "active")
        .order("observed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db.from("health_clinical_document_extractions")
        .select("id", { count: "exact", head: true })
        .eq("athlete_id", athleteId)
        .in("status", ["extracted", "review_required"]),
    ]);

    const sessionError = errorMessage(sessionResult.error);
    let queueData: Record<string, unknown> | null = null;
    let queueError: string | null = null;

    if (!sessionError && !sessionResult.data) {
      const response = await db.from("health_cch_queue_entries")
        .select("id,state,queue_position,session_template_id,health_session_templates(name)")
        .eq("athlete_id", athleteId)
        .in("state", ["queued", "eligible", "prioritized"])
        .order("queue_position", { ascending: true })
        .limit(1)
        .maybeSingle();
      queueData = (response.data ?? null) as Record<string, unknown> | null;
      queueError = errorMessage(response.error);
    }

    const report = (reportResult.data ?? null) as {
      id: string;
      laboratory_name: string | null;
      collected_at: string | null;
      resulted_at: string | null;
      created_at: string;
      confidence: string;
    } | null;

    let markerCount: number | null = null;
    let markerCountError: string | null = null;
    if (report?.id) {
      const markerResult = await db.from("health_biomarker_results")
        .select("id", { count: "exact", head: true })
        .eq("athlete_id", athleteId)
        .eq("lab_report_id", report.id);
      markerCount = markerResult.count ?? 0;
      markerCountError = errorMessage(markerResult.error);
    }

    const session = (sessionResult.data ?? null) as {
      id: string;
      status: string;
      started_at: string;
      session_template_id: string | null;
      health_session_templates?: { name?: string } | Array<{ name?: string }> | null;
    } | null;

    const daily = (dailyResult.data ?? null) as {
      state_date: string;
      observed_meal_count: number;
      observed_item_count: number;
      energy_kcal_consumed: number | null;
      protein_g_consumed: number | null;
      completeness_status: string;
      state_status: string;
      confidence: string;
      reason_codes: string[];
    } | null;

    const rolling = (rollingResult.data ?? null) as {
      window_end_date: string;
      observed_day_count: number;
      sufficient_day_count: number;
      observation_coverage_ratio: number;
      coverage_status: string;
      confidence: string;
      reason_codes: string[];
    } | null;

    const decision = (decisionResult.data ?? null) as {
      as_of_date: string;
      decision_status: string;
      decision_class: string;
      decision_code: string;
      confidence: string;
      reason_codes: string[];
      plan_adjustment_status: string;
    } | null;

    const body = (bodyResult.data ?? null) as {
      as_of_date: string;
      weight_latest_kg: number | null;
      weight_change_kg: number | null;
      weight_trend_kg_per_week: number | null;
      waist_latest_cm: number | null;
      body_fat_latest_pct: number | null;
      photo_set_count: number;
      latest_bmi: number | null;
      coverage_status: string;
      confidence: string;
      reason_codes: string[];
    } | null;

    const recovery = (recoveryResult.data ?? null) as {
      as_of_date: string;
      sleep_duration_observed_days: number;
      recovery_observed_days: number;
      fatigue_observed_days: number;
      readiness_observed_days: number;
      sleep_duration_coverage: string;
      recovery_coverage: string;
      fatigue_coverage: string;
      readiness_coverage: string;
      average_sleep_minutes: number | null;
      average_recovery: number | null;
      average_fatigue: number | null;
      average_readiness: number | null;
      confidence: string;
      reason_codes: string[];
    } | null;

    const vital = (vitalResult.data ?? null) as {
      metric_code: string;
      observed_at: string;
      observed_on: string;
    } | null;

    const longitudinalLatest = ((longitudinalResult.data ?? [])[0] ?? null) as {
      as_of_date: string;
    } | null;

    const nutritionError =
      errorMessage(dailyResult.error) ??
      errorMessage(rollingResult.error) ??
      errorMessage(decisionResult.error);

    const examsError =
      errorMessage(reportResult.error) ??
      errorMessage(longitudinalResult.error) ??
      errorMessage(vitalResult.error) ??
      errorMessage(extractionResult.error) ??
      markerCountError;

    const nextDashboard: HealthDashboardF10 = {
      training: {
        availability: availabilityFor({
          hasData: Boolean(session || queueData),
          error: sessionError ?? queueError,
          notApplicable: !session && !queueData && !sessionError && !queueError,
        }),
        freshness: session ? "today" : "not_applicable",
        asOf: session?.started_at ?? null,
        error: sessionError ?? queueError,
        confidence: null,
        coverage: null,
        reasonCodes: [],
        activeSession: session ? {
          id: session.id,
          status: session.status,
          startedAt: session.started_at,
          templateName: templateName(session),
        } : null,
        nextQueue: queueData ? {
          id: String(queueData.id),
          state: String(queueData.state),
          queuePosition: Number(queueData.queue_position),
          templateName: templateName(queueData),
        } : null,
      },
      nutrition: {
        availability: availabilityFor({
          hasData: Boolean(daily || rolling || decision),
          error: nutritionError,
          explicitlyUnobserved: daily?.state_status === "unobserved" && !rolling && !decision,
        }),
        freshness: daily
          ? "today"
          : freshnessForDate(rolling?.window_end_date ?? decision?.as_of_date ?? null, today),
        asOf: daily?.state_date ?? rolling?.window_end_date ?? decision?.as_of_date ?? null,
        error: nutritionError,
        confidence: daily?.confidence ?? rolling?.confidence ?? decision?.confidence ?? null,
        coverage: rolling?.coverage_status ?? null,
        reasonCodes: daily?.reason_codes ?? rolling?.reason_codes ?? decision?.reason_codes ?? [],
        daily: daily ? {
          observedMealCount: daily.observed_meal_count,
          observedItemCount: daily.observed_item_count,
          energyKcal: daily.energy_kcal_consumed,
          proteinG: daily.protein_g_consumed,
          completenessStatus: daily.completeness_status,
          stateStatus: daily.state_status,
          confidence: daily.confidence,
          reasonCodes: daily.reason_codes ?? [],
          stateDate: daily.state_date,
        } : null,
        rolling7: rolling ? {
          observedDayCount: rolling.observed_day_count,
          sufficientDayCount: rolling.sufficient_day_count,
          observationCoverageRatio: rolling.observation_coverage_ratio,
          coverageStatus: rolling.coverage_status,
          confidence: rolling.confidence,
          reasonCodes: rolling.reason_codes ?? [],
          windowEndDate: rolling.window_end_date,
        } : null,
        decision: decision ? {
          status: decision.decision_status,
          decisionClass: decision.decision_class,
          decisionCode: decision.decision_code,
          confidence: decision.confidence,
          reasonCodes: decision.reason_codes ?? [],
          planAdjustmentStatus: decision.plan_adjustment_status,
          asOfDate: decision.as_of_date,
        } : null,
      },
      body: {
        availability: availabilityFor({
          hasData: Boolean(body),
          error: errorMessage(bodyResult.error),
          explicitlyUnobserved: body?.coverage_status === "unobserved",
        }),
        freshness: freshnessForDate(body?.as_of_date, today),
        asOf: body?.as_of_date ?? null,
        error: errorMessage(bodyResult.error),
        confidence: body?.confidence ?? null,
        coverage: body?.coverage_status ?? null,
        reasonCodes: body?.reason_codes ?? [],
        state: body ? {
          asOfDate: body.as_of_date,
          weightLatestKg: body.weight_latest_kg,
          weightChangeKg: body.weight_change_kg,
          weightTrendKgPerWeek: body.weight_trend_kg_per_week,
          waistLatestCm: body.waist_latest_cm,
          bodyFatLatestPct: body.body_fat_latest_pct,
          photoSetCount: body.photo_set_count,
          latestBmi: body.latest_bmi,
          coverageStatus: body.coverage_status,
          confidence: body.confidence,
          reasonCodes: body.reason_codes ?? [],
        } : null,
      },
      recovery: {
        availability: availabilityFor({
          hasData: Boolean(recovery),
          error: errorMessage(recoveryResult.error),
          explicitlyUnobserved: Boolean(
            recovery &&
            [recovery.sleep_duration_coverage, recovery.recovery_coverage, recovery.fatigue_coverage, recovery.readiness_coverage]
              .every((value) => value === "unobserved"),
          ),
        }),
        freshness: freshnessForDate(recovery?.as_of_date, today),
        asOf: recovery?.as_of_date ?? null,
        error: errorMessage(recoveryResult.error),
        confidence: recovery?.confidence ?? null,
        coverage: recovery?.sleep_duration_coverage ?? null,
        reasonCodes: recovery?.reason_codes ?? [],
        state: recovery ? {
          asOfDate: recovery.as_of_date,
          sleepDurationObservedDays: recovery.sleep_duration_observed_days,
          recoveryObservedDays: recovery.recovery_observed_days,
          fatigueObservedDays: recovery.fatigue_observed_days,
          readinessObservedDays: recovery.readiness_observed_days,
          sleepDurationCoverage: recovery.sleep_duration_coverage,
          recoveryCoverage: recovery.recovery_coverage,
          fatigueCoverage: recovery.fatigue_coverage,
          readinessCoverage: recovery.readiness_coverage,
          averageSleepMinutes: recovery.average_sleep_minutes,
          averageRecovery: recovery.average_recovery,
          averageFatigue: recovery.average_fatigue,
          averageReadiness: recovery.average_readiness,
          confidence: recovery.confidence,
          reasonCodes: recovery.reason_codes ?? [],
        } : null,
      },
      exams: {
        availability: availabilityFor({
          hasData: Boolean(
            report ||
            vital ||
            (longitudinalResult.count ?? 0) > 0 ||
            (extractionResult.count ?? 0) > 0,
          ),
          error: examsError,
        }),
        freshness: "not_applicable",
        asOf: report?.collected_at ?? report?.resulted_at ?? report?.created_at ?? vital?.observed_on ?? longitudinalLatest?.as_of_date ?? null,
        error: examsError,
        confidence: report?.confidence ?? null,
        coverage: null,
        reasonCodes: [],
        latestReport: report ? {
          id: report.id,
          laboratoryName: report.laboratory_name,
          collectedAt: report.collected_at,
          resultedAt: report.resulted_at,
          createdAt: report.created_at,
          confidence: report.confidence,
        } : null,
        latestReportMarkerCount: markerCount,
        longitudinalStateCount: longitudinalResult.count ?? 0,
        latestLongitudinalAsOf: longitudinalLatest?.as_of_date ?? null,
        latestVital: vital ? {
          metricCode: vital.metric_code,
          observedAt: vital.observed_at,
          observedOn: vital.observed_on,
        } : null,
        pendingReviewCount: extractionResult.count ?? 0,
      },
    };

    setDashboard(nextDashboard);
    setLoading(false);
  }, [athleteId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const issues = useMemo(() => buildDashboardIssues({
    training: {
      error: dashboard.training.error,
      hasActiveSession: Boolean(dashboard.training.activeSession),
      hasNextQueue: Boolean(dashboard.training.nextQueue),
    },
    nutrition: {
      error: dashboard.nutrition.error,
      hasDailyState: Boolean(dashboard.nutrition.daily),
      decisionStatus: dashboard.nutrition.decision?.status,
    },
    body: {
      error: dashboard.body.error,
      hasState: Boolean(dashboard.body.state),
      coverageStatus: dashboard.body.coverage,
    },
    recovery: {
      error: dashboard.recovery.error,
      hasState: Boolean(dashboard.recovery.state),
      coverages: dashboard.recovery.state
        ? [
            dashboard.recovery.state.sleepDurationCoverage,
            dashboard.recovery.state.recoveryCoverage,
            dashboard.recovery.state.fatigueCoverage,
            dashboard.recovery.state.readinessCoverage,
          ]
        : [],
    },
    exams: {
      error: dashboard.exams.error,
      pendingReviewCount: dashboard.exams.pendingReviewCount,
    },
  }), [dashboard]);

  return {
    ...dashboard,
    issues,
    loading,
    reload,
  };
}
