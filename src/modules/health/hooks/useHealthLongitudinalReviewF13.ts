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
  const scope=athleteId??null;
  const empty={run:null as LongitudinalReviewRun|null,outcome:null as LongitudinalReviewOutcome|null,history:[] as LongitudinalReviewOutcome[],error:null as string|null,backendAvailable:true};
  const [snapshot,setSnapshot]=useState({scope:null as string|null,...empty,loading:false});
  const [action,setAction]=useState({scope:null as string|null,kind:null as "generate"|"outcome"|null,error:null as string|null});
  const request=useRef(0),epoch=useRef(0),locked=useRef(false);
  const activeScope=useRef<string|null|undefined>(undefined);
  const visible=snapshot.scope===scope?snapshot:{...empty,loading:Boolean(scope)};
  const currentAction=action.scope===scope?action:{kind:null,error:null};
  const readSnapshot=useCallback(async()=>{
    if(activeScope.current!==scope)return;
    const token=++request.current;
    const finish=(value:typeof empty)=>{
      if(token!==request.current)return undefined;
      setSnapshot({scope,...value,loading:false});
      return value;
    };
    if(!athleteId){return finish(empty);}
    setSnapshot({scope,...empty,loading:true});
    try{
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
      return finish({...empty,backendAvailable:!isBackendUnavailable(runResult.error),error:errorMessage(runResult.error)});
    }

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
      return finish(empty);
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

    if(currentOutcomeResult.error||historyResult.error){
      return finish({...empty,error:errorMessage(currentOutcomeResult.error)??errorMessage(historyResult.error)});
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

    const mappedRun:LongitudinalReviewRun={
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
    };
    return finish({...empty,run:mappedRun,outcome:currentOutcomeResult.data?mapOutcome(currentOutcomeResult.data):null,
      history:((historyResult.data??[]) as unknown[]).map(mapOutcome)});
    }catch(cause){return finish({...empty,error:cause instanceof Error?cause.message:"Revisão indisponível."});}
  },[athleteId,scope]);
  const reload=useCallback(async()=>{
    const value=await readSnapshot();
    if(value && !value.error && value.backendAvailable && !locked.current)
      setAction(previous=>previous.scope===scope?{...previous,error:null}:previous);
  },[readSnapshot,scope]);
  useEffect(()=>{
    activeScope.current=scope;epoch.current++;locked.current=false;
    setAction({scope,kind:null,error:null});
    void reload();
    return ()=>{activeScope.current=undefined;request.current++;epoch.current++;locked.current=false;};
  },[reload,scope]);
  const perform=useCallback(async(kind:"generate"|"outcome",operation:()=>Promise<unknown>)=>{
    if(!athleteId||activeScope.current!==scope||visible.loading||!visible.backendAvailable||visible.error||currentAction.error||locked.current)
      throw new Error("Aguarde uma leitura válida do atleta atual.");
    locked.current=true;
    const token=epoch.current;
    const active=()=>activeScope.current===scope&&token===epoch.current;
    setAction({scope,kind,error:null});
    try{
      const result=await operation();
      if(active()){
        const confirmed=await readSnapshot();
        const id=kind==="generate"?confirmed?.run?.id:confirmed?.outcome?.id;
        if(!confirmed || confirmed.error || !confirmed.backendAvailable || typeof result!=="string" || id!==result)
          throw new Error("Gravação não confirmada. Atualize e confira o histórico antes de repetir.");
      }
      return result;
    }catch(cause){
      if(active())setAction({scope,kind:null,error:cause instanceof Error?cause.message:"Operação indisponível."});
      throw cause;
    }finally{
      if(active()){locked.current=false;setAction(previous=>previous.scope===scope?{...previous,kind:null}:previous);}
    }
  },[athleteId,scope,visible.loading,visible.backendAvailable,visible.error,currentAction.error,readSnapshot]);
  const generateReview=useCallback(()=>perform("generate",async()=>{
    const result=await db.rpc("health_f13_generate_longitudinal_review",{
      p_athlete_id:athleteId!,p_as_of_date:localDateIso(),p_window_days:28
    });
    if(result.error)throw new Error(result.error.message);
    return result.data;
  }),[athleteId,perform]);
  const recordOutcome=useCallback(async({outcomeCode,targetDomains,notes}:{
    outcomeCode:LongitudinalReviewOutcome["outcomeCode"];targetDomains:string[];notes?:string|null;
  })=>{
    if(!visible.run)throw new Error("Gere uma revisão longitudinal primeiro.");
    const runId=visible.run.id;
    return perform("outcome",async()=>{
      const result=await db.rpc("health_f13_record_review_outcome",{
        p_review_run_id:runId,p_outcome_code:outcomeCode,p_target_domains:targetDomains,p_notes:notes??null
      });
      if(result.error)throw new Error(result.error.message);
      return result.data;
    });
  },[visible.run,perform]);
  return {run:visible.run,outcome:visible.outcome,history:visible.history,loading:visible.loading,
    generating:currentAction.kind==="generate",savingOutcome:currentAction.kind==="outcome",
    error:visible.error??currentAction.error,backendAvailable:visible.backendAvailable,reload,generateReview,recordOutcome};
}
