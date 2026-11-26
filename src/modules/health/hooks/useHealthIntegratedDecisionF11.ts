import { useCallback, useEffect, useRef, useState } from "react";
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
      health_f11_evaluate_integrated_decision: {
        Args: {
          p_athlete_id: string;
          p_as_of_date: string;
          p_window_days?: number;
        };
        Returns: string;
      };
    };
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

function isBackendUnavailableError(
  error: { message?: string; code?: string } | null | undefined,
) {
  if (!error) return false;
  const message = error.message ?? "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    (
      /health_(integrated_decision_(runs|decisions)|f11_evaluate_integrated_decision)/i.test(message) &&
      /(does not exist|schema cache|could not find)/i.test(message)
    )
  );
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
  const scope=athleteId??null;
  const empty={run:null as IntegratedDecisionRunF11|null,error:null as string|null,backendAvailable:true};
  const [snapshot,setSnapshot]=useState({scope:null as string|null,...empty,loading:false});
  const [action,setAction]=useState({scope:null as string|null,evaluating:false,error:null as string|null});
  const request=useRef(0);
  const actionEpoch=useRef(0);
  const actionLock=useRef(false);
  const currentScope=useRef<string|null|undefined>(undefined);
  const visible=snapshot.scope===scope?snapshot:{...empty,loading:Boolean(scope)};
  const visibleAction=action.scope===scope?action:{evaluating:false,error:null};
  const reload=useCallback(async()=>{
    if(currentScope.current!==scope)return;
    const token=++request.current;
    const finish=(run:IntegratedDecisionRunF11|null,error:string|null=null,backendAvailable=true)=>{
      if(token===request.current)setSnapshot({scope,run,error,backendAvailable,loading:false});
    };
    if(!athleteId){finish(null);return;}
    setSnapshot({scope,run:null,error:null,backendAvailable:true,loading:true});
    try{
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
      finish(null,errorMessage(runResult.error),!isBackendUnavailableError(runResult.error));
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
      finish(null);
      return;
    }

    const decisionsResult = await db
      .from("health_integrated_decisions")
      .select("id,decision_scope,decision_status,decision_class,decision_code,confidence,reason_codes,action_status")
      .eq("athlete_id", athleteId)
      .eq("run_id", rawRun.id)
      .order("decision_scope", { ascending: true });

    if (decisionsResult.error) {
      finish(null,errorMessage(decisionsResult.error),!isBackendUnavailableError(decisionsResult.error));
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

    finish({
      id: rawRun.id,
      asOfDate: rawRun.as_of_date,
      windowDays: rawRun.window_days,
      runStatus: rawRun.run_status,
      algorithmVersion: rawRun.algorithm_version,
      createdAt: rawRun.created_at,
      historical: rawRun.as_of_date !== today,
      decisions,
    });
    }catch(cause){
      finish(null,cause instanceof Error?cause.message:"Leitura F11 indisponível.");
    }
  },[athleteId,scope]);
  useEffect(()=>{
    currentScope.current=scope;
    actionEpoch.current++;
    actionLock.current=false;
    setAction({scope,evaluating:false,error:null});
    void reload();
    return ()=>{currentScope.current=undefined;request.current++;actionEpoch.current++;actionLock.current=false;};
  },[reload,scope]);
  const evaluate=useCallback(async()=>{
    if(!athleteId||currentScope.current!==scope||visible.loading||!visible.backendAvailable||visibleAction.evaluating||actionLock.current)
      throw new Error("Aguarde a leitura do atleta atual.");
    actionLock.current=true;
    const token=actionEpoch.current;
    const active=()=>currentScope.current===scope&&token===actionEpoch.current;
    setAction({scope,evaluating:true,error:null});
    try{
      const result=await db.rpc("health_f11_evaluate_integrated_decision",{
        p_athlete_id:athleteId,p_as_of_date:localDateIso(),p_window_days:7
      });
      if(result.error)throw new Error(result.error.message);
      if(active())await reload();
      return result.data;
    }catch(cause){
      if(active())setAction({scope,evaluating:false,error:cause instanceof Error?cause.message:"Avaliação indisponível."});
      throw cause;
    }finally{
      if(active()){actionLock.current=false;setAction(previous=>previous.scope===scope?{...previous,evaluating:false}:previous);}
    }
  },[athleteId,scope,visible.loading,visible.backendAvailable,visibleAction.evaluating,reload]);
  return {run:visible.run,loading:visible.loading,error:visible.error,backendAvailable:visible.backendAvailable,
    evaluating:visibleAction.evaluating,evaluationError:visibleAction.error,reload,evaluate};
}
