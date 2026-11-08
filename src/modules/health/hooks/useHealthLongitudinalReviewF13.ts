import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { localDateIso } from "../dashboard/dashboardModel";

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
    Functions: {
      health_f13_generate_longitudinal_review: {
        Args: {
          p_athlete_id: string;
          p_as_of_date: string;
          p_window_days?: number;
        };
        Returns: string;
      };
      health_f13_record_review_outcome: {
        Args: {
          p_review_run_id: string;
          p_outcome_code: string;
          p_target_domains?: string[];
          p_notes?: string | null;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const db = supabase as unknown as SupabaseClient<LooseDatabase>;

export type LongitudinalMetricBlock = {
  status?: "available" | "unavailable";
  current?: Record<string, unknown> | null;
  prior?: Record<string, unknown> | null;
  delta?: Record<string, unknown> | null;
};

export type LongitudinalEvidence = {
  periods?: {
    current?: { start_date?: string; end_date?: string };
    prior?: { start_date?: string; end_date?: string };
  };
  goal_context?: Record<string, unknown> | null;
  phase_context?: Record<string, unknown> | null;
  training?: LongitudinalMetricBlock;
  nutrition?: LongitudinalMetricBlock;
  body?: LongitudinalMetricBlock;
  recovery?: LongitudinalMetricBlock;
  integrated_decision_context?: {
    current_period?: Record<string, unknown> | null;
    prior_period?: Record<string, unknown> | null;
  };
  clinical_comparison_policy?: string;
  automatic_replanning?: boolean;
  causal_inference?: boolean;
};

export type LongitudinalReviewRun = {
  id: string;
  asOfDate: string;
  windowDays: number;
  currentStartDate: string;
  currentEndDate: string;
  priorStartDate: string;
  priorEndDate: string;
  runStatus: "available" | "paused";
  availableDomains: string[];
  unavailableDomains: string[];
  reasonCodes: string[];
  algorithmVersion: string;
  evidence: LongitudinalEvidence;
  createdAt: string;
  historical: boolean;
};

export type LongitudinalReviewOutcome = {
  id: string;
  reviewRunId: string;
  outcomeCode:
    | "continue_observation"
    | "review_goal"
    | "review_training"
    | "review_nutrition"
    | "review_recovery"
    | "review_multiple"
    | "insufficient_data";
  targetDomains: string[];
  notes: string | null;
  recordStatus: "current" | "superseded";
  reviewedAt: string;
};

function errorMessage(error: { message?: string } | null | undefined) {
  return error?.message ?? null;
}

function isBackendUnavailable(
  error: { message?: string; code?: string } | null | undefined,
) {
  if (!error) return false;
  const message = error.message ?? "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    (
      /health_(longitudinal_review|f13_)/i.test(message) &&
      /(does not exist|schema cache|could not find)/i.test(message)
    )
  );
}

export function longitudinalOutcomeLabel(code: string) {
  const labels: Record<string, string> = {
    continue_observation: "Continuar observando",
    review_goal: "Revisar objetivo/fase",
    review_training: "Revisar treino",
    review_nutrition: "Revisar alimentação",
    review_recovery: "Revisar recuperação",
    review_multiple: "Revisar múltiplas áreas",
    insufficient_data: "Dados insuficientes",
  };
  return labels[code] ?? code;
}

export function longitudinalDomainLabel(code: string) {
  const labels: Record<string, string> = {
    goal: "Objetivo",
    training: "Treino",
    nutrition: "Alimentação",
    body: "Evolução corporal",
    recovery: "Recuperação",
  };
  return labels[code] ?? code;
}

export function useHealthLongitudinalReviewF13(
  athleteId: string | null | undefined,
) {
  const [run, setRun] = useState<LongitudinalReviewRun | null>(null);
  const [outcome, setOutcome] = useState<LongitudinalReviewOutcome | null>(null);
  const [history, setHistory] = useState<LongitudinalReviewOutcome[]>([]);
  const [loading, setLoading] = useState(Boolean(athleteId));
  const [generating, setGenerating] = useState(false);
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendAvailable, setBackendAvailable] = useState(true);

  const reload = useCallback(async () => {
    if (!athleteId) {
      setRun(null);
      setOutcome(null);
      setHistory([]);
      setLoading(false);
      setError(null);
      setBackendAvailable(true);
      return;
    }

    setLoading(true);
    setError(null);
    const today = localDateIso();

    const runResult = await db
      .from("health_longitudinal_review_runs")
      .select(
        "id,as_of_date,window_days,current_start_date,current_end_date,prior_start_date,prior_end_date,run_status,available_domains,unavailable_domains,reason_codes,algorithm_version,evidence_snapshot,created_at",
      )
      .eq("athlete_id", athleteId)
      .eq("record_status", "current")
      .order("as_of_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (runResult.error) {
      setRun(null);
      setOutcome(null);
      setHistory([]);
      setBackendAvailable(!isBackendUnavailable(runResult.error));
      setError(errorMessage(runResult.error));
      setLoading(false);
      return;
    }

    setBackendAvailable(true);

    const rawRun = runResult.data as {
      id: string;
      as_of_date: string;
      window_days: number;
      current_start_date: string;
      current_end_date: string;
      prior_start_date: string;
      prior_end_date: string;
      run_status: "available" | "paused";
      available_domains: string[];
      unavailable_domains: string[];
      reason_codes: string[];
      algorithm_version: string;
      evidence_snapshot: LongitudinalEvidence;
      created_at: string;
    } | null;

    if (!rawRun) {
      setRun(null);
      setOutcome(null);
      setHistory([]);
      setLoading(false);
      return;
    }

    const [currentOutcomeResult, historyResult] = await Promise.all([
      db
        .from("health_longitudinal_review_outcomes")
        .select(
          "id,review_run_id,outcome_code,target_domains,notes,record_status,reviewed_at",
        )
        .eq("athlete_id", athleteId)
        .eq("review_run_id", rawRun.id)
        .eq("record_status", "current")
        .maybeSingle(),
      db
        .from("health_longitudinal_review_outcomes")
        .select(
          "id,review_run_id,outcome_code,target_domains,notes,record_status,reviewed_at",
        )
        .eq("athlete_id", athleteId)
        .order("reviewed_at", { ascending: false })
        .limit(10),
    ]);

    if (currentOutcomeResult.error || historyResult.error) {
      setError(
        errorMessage(currentOutcomeResult.error) ??
          errorMessage(historyResult.error),
      );
    }

    const mapOutcome = (value: unknown): LongitudinalReviewOutcome => {
      const item = value as {
        id: string;
        review_run_id: string;
        outcome_code: LongitudinalReviewOutcome["outcomeCode"];
        target_domains: string[];
        notes: string | null;
        record_status: "current" | "superseded";
        reviewed_at: string;
      };
      return {
        id: item.id,
        reviewRunId: item.review_run_id,
        outcomeCode: item.outcome_code,
        targetDomains: item.target_domains ?? [],
        notes: item.notes,
        recordStatus: item.record_status,
        reviewedAt: item.reviewed_at,
      };
    };

    setRun({
      id: rawRun.id,
      asOfDate: rawRun.as_of_date,
      windowDays: rawRun.window_days,
      currentStartDate: rawRun.current_start_date,
      currentEndDate: rawRun.current_end_date,
      priorStartDate: rawRun.prior_start_date,
      priorEndDate: rawRun.prior_end_date,
      runStatus: rawRun.run_status,
      availableDomains: rawRun.available_domains ?? [],
      unavailableDomains: rawRun.unavailable_domains ?? [],
      reasonCodes: rawRun.reason_codes ?? [],
      algorithmVersion: rawRun.algorithm_version,
      evidence: rawRun.evidence_snapshot ?? {},
      createdAt: rawRun.created_at,
      historical: rawRun.as_of_date !== today,
    });
    setOutcome(
      currentOutcomeResult.data
        ? mapOutcome(currentOutcomeResult.data)
        : null,
    );
    setHistory(
      ((historyResult.data ?? []) as unknown[]).map(mapOutcome),
    );
    setLoading(false);
  }, [athleteId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const generateReview = useCallback(async () => {
    if (!athleteId) throw new Error("Atleta não disponível.");
    setGenerating(true);
    setError(null);
    try {
      const result = await db.rpc("health_f13_generate_longitudinal_review", {
        p_athlete_id: athleteId,
        p_as_of_date: localDateIso(),
        p_window_days: 28,
      });

      if (result.error) {
        setBackendAvailable(!isBackendUnavailable(result.error));
        setError(result.error.message);
        throw new Error(result.error.message);
      }

      setBackendAvailable(true);
      await reload();
      return result.data;
    } finally {
      setGenerating(false);
    }
  }, [athleteId, reload]);

  const recordOutcome = useCallback(
    async ({
      outcomeCode,
      targetDomains,
      notes,
    }: {
      outcomeCode: LongitudinalReviewOutcome["outcomeCode"];
      targetDomains: string[];
      notes?: string | null;
    }) => {
      if (!run) throw new Error("Gere uma revisão longitudinal primeiro.");

      setSavingOutcome(true);
      setError(null);
      try {
        const result = await db.rpc("health_f13_record_review_outcome", {
          p_review_run_id: run.id,
          p_outcome_code: outcomeCode,
          p_target_domains: targetDomains,
          p_notes: notes ?? null,
        });

        if (result.error) {
          setBackendAvailable(!isBackendUnavailable(result.error));
          setError(result.error.message);
          throw new Error(result.error.message);
        }

        setBackendAvailable(true);
        await reload();
        return result.data;
      } finally {
        setSavingOutcome(false);
      }
    },
    [reload, run],
  );

  return {
    run,
    outcome,
    history,
    loading,
    generating,
    savingOutcome,
    error,
    backendAvailable,
    reload,
    generateReview,
    recordOutcome,
  };
}
