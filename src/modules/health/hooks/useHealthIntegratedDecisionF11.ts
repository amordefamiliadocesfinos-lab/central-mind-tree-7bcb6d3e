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
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const db = supabase as unknown as SupabaseClient<LooseDatabase>;

export type IntegratedDecisionF11 = {
  id: string;
  scope: "nutrition_execution" | "nutrition_plan_review";
  status: "ready" | "paused";
  decisionClass: "data_quality" | "execution" | "plan_review";
  code:
    | "decision_paused"
    | "review_data_quality"
    | "review_nutrition_execution"
    | "review_nutrition_plan_candidate";
  confidence: "low" | "moderate" | "high";
  reasonCodes: string[];
  actionStatus: "none";
};

export type IntegratedDecisionRunF11 = {
  id: string;
  asOfDate: string;
  windowDays: 7 | 14 | 28;
  runStatus: "complete" | "partial" | "paused" | "failed";
  algorithmVersion: string;
  createdAt: string;
  historical: boolean;
  decisions: IntegratedDecisionF11[];
};

function errorMessage(error: { message: string } | null | undefined) {
  return error?.message ?? null;
}

export function integratedDecisionCodeLabel(code: string) {
  const labels: Record<string, string> = {
    decision_paused: "Decisão pausada",
    review_data_quality: "Revisar qualidade dos dados",
    review_nutrition_execution: "Revisar execução nutricional",
    review_nutrition_plan_candidate: "Revisão de plano elegível",
  };
  return labels[code] ?? code;
}

export function integratedReasonLabel(code: string) {
  const labels: Record<string, string> = {
    NUTRITION_DECISION_MISSING: "Decisão nutricional especialista ainda não disponível.",
    NUTRITION_DECISION_PAUSED: "A decisão nutricional especialista está pausada.",
    NUTRITION_EXECUTION_REVIEW_REQUIRED: "A execução nutricional requer revisão antes de revisar o plano.",
    NUTRITION_EXECUTION_REVIEW_PRECEDES_PLAN_REVIEW: "A execução nutricional tem prioridade sobre a revisão do plano.",
    BODY_STATE_MISSING: "Estado corporal atual ainda não disponível.",
    BODY_COVERAGE_TOO_LOW: "Cobertura corporal insuficiente para esta decisão.",
    BODY_RESPONSE_INSUFFICIENT: "Ainda não há resposta corporal comparável suficiente.",
    BODY_RESPONSE_AVAILABLE: "Há resposta corporal comparável disponível.",
    RECOVERY_STATE_MISSING: "Estado de recuperação atual ainda não disponível.",
    RECOVERY_COVERAGE_TOO_LOW: "Cobertura de recuperação insuficiente para esta decisão.",
    RECOVERY_CONTEXT_INSUFFICIENT: "Contexto de recuperação ainda insuficiente.",
    RECOVERY_CONTEXT_AVAILABLE: "Há contexto de recuperação suficiente.",
    SOURCE_DATE_MISMATCH: "As fontes não pertencem à mesma data da avaliação.",
    SOURCE_WINDOW_MISMATCH: "As fontes não pertencem à mesma janela da avaliação.",
    SOURCE_RECORD_NOT_CURRENT: "A fonte disponível não é o registro atual.",
  };
  return labels[code] ?? code;
}

export function useHealthIntegratedDecisionF11(
  athleteId: string | null | undefined,
) {
  const [run, setRun] = useState<IntegratedDecisionRunF11 | null>(null);
  const [loading, setLoading] = useState(Boolean(athleteId));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!athleteId) {
      setRun(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const today = localDateIso();

    const runResult = await db
      .from("health_integrated_decision_runs")
      .select("id,as_of_date,window_days,run_status,algorithm_version,created_at")
      .eq("athlete_id", athleteId)
      .eq("record_status", "current")
      .eq("window_days", 7)
      .lte("as_of_date", today)
      .order("as_of_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (runResult.error) {
      setRun(null);
      setError(errorMessage(runResult.error));
      setLoading(false);
      return;
    }

    const rawRun = runResult.data as {
      id: string;
      as_of_date: string;
      window_days: 7 | 14 | 28;
      run_status: "complete" | "partial" | "paused" | "failed";
      algorithm_version: string;
      created_at: string;
    } | null;

    if (!rawRun) {
      setRun(null);
      setLoading(false);
      return;
    }

    const decisionsResult = await db
      .from("health_integrated_decisions")
      .select("id,decision_scope,decision_status,decision_class,decision_code,confidence,reason_codes,action_status")
      .eq("athlete_id", athleteId)
      .eq("run_id", rawRun.id)
      .order("decision_scope", { ascending: true });

    if (decisionsResult.error) {
      setRun(null);
      setError(errorMessage(decisionsResult.error));
      setLoading(false);
      return;
    }

    const decisions = ((decisionsResult.data ?? []) as Array<{
      id: string;
      decision_scope: "nutrition_execution" | "nutrition_plan_review";
      decision_status: "ready" | "paused";
      decision_class: "data_quality" | "execution" | "plan_review";
      decision_code: IntegratedDecisionF11["code"];
      confidence: "low" | "moderate" | "high";
      reason_codes: string[];
      action_status: "none";
    }>).map((decision) => ({
      id: decision.id,
      scope: decision.decision_scope,
      status: decision.decision_status,
      decisionClass: decision.decision_class,
      code: decision.decision_code,
      confidence: decision.confidence,
      reasonCodes: decision.reason_codes ?? [],
      actionStatus: decision.action_status,
    }));

    setRun({
      id: rawRun.id,
      asOfDate: rawRun.as_of_date,
      windowDays: rawRun.window_days,
      runStatus: rawRun.run_status,
      algorithmVersion: rawRun.algorithm_version,
      createdAt: rawRun.created_at,
      historical: rawRun.as_of_date !== today,
      decisions,
    });
    setLoading(false);
  }, [athleteId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { run, loading, error, reload };
}
