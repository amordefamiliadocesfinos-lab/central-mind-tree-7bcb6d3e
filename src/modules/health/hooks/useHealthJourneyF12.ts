import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { localDateIso } from "../dashboard/dashboardModel";
import {
  buildJourneyModel,
  type JourneyModelInput,
} from "../journey/journeyModel";
import type { IntegratedDecisionRunF11 } from "./useHealthIntegratedDecisionF11";

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

type IntegratedJourneySource = {
  backendAvailable: boolean;
  run: IntegratedDecisionRunF11 | null;
  error: string | null;
};

type JourneySourceState = Omit<JourneyModelInput, "integrated">;

const emptySources: JourneySourceState = {
  profile: {
    hasProfile: false,
    hasActiveGoal: false,
  },
  program: {
    hasProgram: false,
    programStatus: null,
    hasPublishedCurrentVersion: false,
    hasUsableQueue: false,
  },
  execution: {
    hasOpenSession: false,
    hasCompletedSession: false,
  },
  nutrition: {
    hasCurrentRolling: false,
    rollingCoverage: null,
    hasCurrentDecision: false,
    decisionStatus: null,
  },
  body: {
    hasCurrentState: false,
    coverageStatus: null,
    observationCount: 0,
  },
  recovery: {
    hasCurrentState: false,
    contextObserved: false,
  },
};

function message(error: { message: string } | null | undefined) {
  return error?.message ?? null;
}

function recoveryContextObserved(row: {
  recovery_coverage: string | null;
  fatigue_coverage: string | null;
  readiness_coverage: string | null;
  average_recovery: number | null;
  average_fatigue: number | null;
  average_readiness: number | null;
} | null) {
  if (!row) return false;
  const usable = (coverage: string | null, value: number | null) =>
    (coverage === "partial" || coverage === "complete") && value != null;

  return (
    usable(row.recovery_coverage, row.average_recovery) ||
    usable(row.fatigue_coverage, row.average_fatigue) ||
    usable(row.readiness_coverage, row.average_readiness)
  );
}

export function useHealthJourneyF12(
  athleteId: string | null | undefined,
  integrated: IntegratedJourneySource,
) {
  const [sources, setSources] = useState<JourneySourceState>(emptySources);
  const [loading, setLoading] = useState(Boolean(athleteId));

  const reload = useCallback(async () => {
    if (!athleteId) {
      setSources(emptySources);
      setLoading(false);
      return;
    }

    setLoading(true);
    const today = localDateIso();

    const [
      profileResult,
      goalResult,
      programResult,
      openSessionResult,
      completedSessionResult,
      nutritionRollingResult,
      nutritionDecisionResult,
      bodyResult,
      recoveryResult,
    ] = await Promise.all([
      db
        .from("health_athlete_profiles")
        .select("athlete_id")
        .eq("athlete_id", athleteId)
        .maybeSingle(),
      db
        .from("health_goals")
        .select("id")
        .eq("athlete_id", athleteId)
        .eq("status", "active")
        .eq("is_primary", true)
        .maybeSingle(),
      db
        .from("health_programs")
        .select("id,status,current_version_id")
        .eq("athlete_id", athleteId)
        .in("status", ["active", "draft", "paused"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("health_workout_sessions")
        .select("id,status,started_at")
        .eq("athlete_id", athleteId)
        .in("status", ["active", "paused"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("health_workout_sessions")
        .select("id,status,ended_at")
        .eq("athlete_id", athleteId)
        .eq("status", "completed")
        .order("ended_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("health_nutrition_rolling_states")
        .select("id,coverage_status,confidence,observed_day_count,sufficient_day_count")
        .eq("athlete_id", athleteId)
        .eq("window_end_date", today)
        .eq("window_days", 7)
        .maybeSingle(),
      db
        .from("health_nutrition_decisions")
        .select("id,decision_status,decision_class,decision_code,confidence,reason_codes")
        .eq("athlete_id", athleteId)
        .eq("as_of_date", today)
        .eq("window_days", 7)
        .eq("record_status", "current")
        .maybeSingle(),
      db
        .from("health_body_rolling_states")
        .select(
          "id,coverage_status,confidence,weight_observation_count,waist_observation_count,body_fat_observation_count",
        )
        .eq("athlete_id", athleteId)
        .eq("as_of_date", today)
        .eq("window_days", 7)
        .maybeSingle(),
      db
        .from("health_sleep_recovery_rolling_states")
        .select(
          "id,recovery_coverage,fatigue_coverage,readiness_coverage,average_recovery,average_fatigue,average_readiness,confidence",
        )
        .eq("athlete_id", athleteId)
        .eq("as_of_date", today)
        .eq("window_days", 7)
        .maybeSingle(),
    ]);

    const rawProgram = programResult.data as {
      id: string;
      status: string;
      current_version_id: string | null;
    } | null;

    let versionError: string | null = null;
    let queueError: string | null = null;
    let hasPublishedCurrentVersion = false;
    let hasUsableQueue = false;

    if (rawProgram?.current_version_id) {
      const [versionResult, queueResult] = await Promise.all([
        db
          .from("health_program_versions")
          .select("id,status")
          .eq("athlete_id", athleteId)
          .eq("id", rawProgram.current_version_id)
          .maybeSingle(),
        db
          .from("health_cch_queue_entries")
          .select("id")
          .eq("athlete_id", athleteId)
          .eq("program_version_id", rawProgram.current_version_id)
          .in("state", ["queued", "eligible", "prioritized"])
          .limit(1)
          .maybeSingle(),
      ]);

      versionError = message(versionResult.error);
      queueError = message(queueResult.error);
      hasPublishedCurrentVersion =
        (versionResult.data as { status?: string } | null)?.status === "published";
      hasUsableQueue = Boolean(queueResult.data);
    }

    const rawBody = bodyResult.data as {
      coverage_status: string | null;
      weight_observation_count: number | null;
      waist_observation_count: number | null;
      body_fat_observation_count: number | null;
    } | null;

    const rawRecovery = recoveryResult.data as {
      recovery_coverage: string | null;
      fatigue_coverage: string | null;
      readiness_coverage: string | null;
      average_recovery: number | null;
      average_fatigue: number | null;
      average_readiness: number | null;
    } | null;

    setSources({
      profile: {
        hasProfile: Boolean(profileResult.data),
        hasActiveGoal: Boolean(goalResult.data),
        error: message(profileResult.error) ?? message(goalResult.error),
      },
      program: {
        hasProgram: Boolean(rawProgram),
        programStatus: rawProgram?.status ?? null,
        hasPublishedCurrentVersion,
        hasUsableQueue,
        error: message(programResult.error) ?? versionError ?? queueError,
      },
      execution: {
        hasOpenSession: Boolean(openSessionResult.data),
        hasCompletedSession: Boolean(completedSessionResult.data),
        error: message(openSessionResult.error) ?? message(completedSessionResult.error),
      },
      nutrition: {
        hasCurrentRolling: Boolean(nutritionRollingResult.data),
        rollingCoverage:
          (nutritionRollingResult.data as { coverage_status?: string } | null)
            ?.coverage_status ?? null,
        hasCurrentDecision: Boolean(nutritionDecisionResult.data),
        decisionStatus:
          (nutritionDecisionResult.data as { decision_status?: string } | null)
            ?.decision_status ?? null,
        error:
          message(nutritionRollingResult.error) ??
          message(nutritionDecisionResult.error),
      },
      body: {
        hasCurrentState: Boolean(rawBody),
        coverageStatus: rawBody?.coverage_status ?? null,
        observationCount: rawBody
          ? (rawBody.weight_observation_count ?? 0) +
            (rawBody.waist_observation_count ?? 0) +
            (rawBody.body_fat_observation_count ?? 0)
          : 0,
        error: message(bodyResult.error),
      },
      recovery: {
        hasCurrentState: Boolean(rawRecovery),
        contextObserved: recoveryContextObserved(rawRecovery),
        error: message(recoveryResult.error),
      },
    });

    setLoading(false);
  }, [athleteId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const model = useMemo(
    () =>
      buildJourneyModel({
        ...sources,
        integrated: {
          backendAvailable: integrated.backendAvailable,
          hasCurrentRun: Boolean(integrated.run && !integrated.run.historical),
          runStatus:
            integrated.run && !integrated.run.historical
              ? integrated.run.runStatus
              : null,
          hasDecisions: Boolean(
            integrated.run &&
              !integrated.run.historical &&
              integrated.run.decisions.length > 0,
          ),
          error: integrated.error,
        },
      }),
    [integrated.backendAvailable, integrated.error, integrated.run, sources],
  );

  return {
    ...model,
    loading,
    reload,
  };
}
