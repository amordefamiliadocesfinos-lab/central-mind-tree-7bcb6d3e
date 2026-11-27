import { useCallback, useEffect, useRef, useState } from "react";
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
    Functions: {
      health_f14_open_replanning_case: {
        Args: { p_review_run_id: string };
        Returns: string;
      };
      health_f14_record_replanning_item_decision: {
        Args: {
          p_case_id: string;
          p_domain: string;
          p_decision_code: string;
          p_notes?: string | null;
        };
        Returns: string;
      };
      health_f14_complete_replanning_case: {
        Args: { p_case_id: string };
        Returns: string;
      };
      health_f14_void_replanning_case: {
        Args: { p_case_id: string; p_reason: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const db = supabase as unknown as SupabaseClient<LooseDatabase>;

export type ReplanningDecision =
  | "pending"
  | "keep_current"
  | "revise"
  | "defer"
  | "not_applicable";

export type ReplanningCase = {
  id: string;
  sourceReviewRunId: string;
  sourceReviewOutcomeId: string;
  sourceOutcomeCode: string;
  sourceTargetDomains: string[];
  sourceSnapshot: Record<string, unknown>;
  caseStatus: "open" | "in_review" | "completed" | "voided";
  reasonCodes: string[];
  openedAt: string;
  completedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  recordStatus: "current" | "superseded";
};

export type ReplanningItem = {
  id: string;
  caseId: string;
  domain: "goal" | "training" | "nutrition" | "body" | "recovery";
  itemStatus: ReplanningDecision;
  decisionNotes: string | null;
  evidenceSnapshot: Record<string, unknown>;
  decidedAt: string | null;
  recordStatus: "current" | "superseded";
};

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
      /health_(replanning|f14_)/i.test(message) &&
      /(does not exist|schema cache|could not find)/i.test(message)
    )
  );
}

function mapCase(value: unknown): ReplanningCase {
  const row = value as {
    id: string;
    source_review_run_id: string;
    source_review_outcome_id: string;
    source_outcome_code: string;
    source_target_domains: string[];
    source_snapshot: Record<string, unknown>;
    case_status: ReplanningCase["caseStatus"];
    reason_codes: string[];
    opened_at: string;
    completed_at: string | null;
    voided_at: string | null;
    void_reason: string | null;
    record_status: ReplanningCase["recordStatus"];
  };
  return {
    id: row.id,
    sourceReviewRunId: row.source_review_run_id,
    sourceReviewOutcomeId: row.source_review_outcome_id,
    sourceOutcomeCode: row.source_outcome_code,
    sourceTargetDomains: row.source_target_domains ?? [],
    sourceSnapshot: row.source_snapshot ?? {},
    caseStatus: row.case_status,
    reasonCodes: row.reason_codes ?? [],
    openedAt: row.opened_at,
    completedAt: row.completed_at,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
    recordStatus: row.record_status,
  };
}

function mapItem(value: unknown): ReplanningItem {
  const row = value as {
    id: string;
    case_id: string;
    domain: ReplanningItem["domain"];
    item_status: ReplanningDecision;
    decision_notes: string | null;
    evidence_snapshot: Record<string, unknown>;
    decided_at: string | null;
    record_status: ReplanningItem["recordStatus"];
  };
  return {
    id: row.id,
    caseId: row.case_id,
    domain: row.domain,
    itemStatus: row.item_status,
    decisionNotes: row.decision_notes,
    evidenceSnapshot: row.evidence_snapshot ?? {},
    decidedAt: row.decided_at,
    recordStatus: row.record_status,
  };
}

export function replanningDecisionLabel(value: ReplanningDecision | string) {
  const labels: Record<string, string> = {
    pending: "Pendente",
    keep_current: "Manter atual",
    revise: "Revisar",
    defer: "Adiar",
    not_applicable: "Não se aplica",
  };
  return labels[value] ?? value;
}

export function replanningCaseStatusLabel(value: string) {
  const labels: Record<string, string> = {
    open: "Aberto",
    in_review: "Em revisão",
    completed: "Concluído",
    voided: "Anulado",
  };
  return labels[value] ?? value;
}

export function useHealthReplanningF14(
  athleteId: string | null | undefined,
) {
  const scope=athleteId??null;
  const empty={currentCase:null as ReplanningCase|null,items:[] as ReplanningItem[],history:[] as ReplanningCase[],error:null as string|null,backendAvailable:true};
  const [snapshot,setSnapshot]=useState({scope:null as string|null,...empty,loading:false});
  const [action,setAction]=useState({scope:null as string|null,saving:false,error:null as string|null});
  const request=useRef(0),epoch=useRef(0),locked=useRef(false);
  const activeScope=useRef<string|null|undefined>(undefined);
  const visible=snapshot.scope===scope?snapshot:{...empty,loading:Boolean(scope)};
  const currentAction=action.scope===scope?action:{saving:false,error:null};
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
    const [currentResult, historyResult] = await Promise.all([
      db
        .from("health_replanning_cases")
        .select(
          "id,source_review_run_id,source_review_outcome_id,source_outcome_code,source_target_domains,source_snapshot,case_status,reason_codes,opened_at,completed_at,voided_at,void_reason,record_status",
        )
        .eq("athlete_id", athleteId)
        .eq("record_status", "current")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("health_replanning_cases")
        .select(
          "id,source_review_run_id,source_review_outcome_id,source_outcome_code,source_target_domains,source_snapshot,case_status,reason_codes,opened_at,completed_at,voided_at,void_reason,record_status",
        )
        .eq("athlete_id", athleteId)
        .order("opened_at", { ascending: false })
        .limit(10),
    ]);

    if(currentResult.error||historyResult.error){
      const error=currentResult.error??historyResult.error;
      return finish({...empty,backendAvailable:!isBackendUnavailable(error),error:error?.message??"Replanejamento indisponível."});
    }
    const mappedCurrent=currentResult.data?mapCase(currentResult.data):null;
    const history=((historyResult.data??[]) as unknown[]).map(mapCase);
    if(!mappedCurrent){return finish({...empty,history});}
    const itemResult = await db
      .from("health_replanning_items")
      .select(
        "id,case_id,domain,item_status,decision_notes,evidence_snapshot,decided_at,record_status",
      )
      .eq("athlete_id", athleteId)
      .eq("case_id", mappedCurrent.id)
      .eq("record_status", "current")
      .order("created_at", { ascending: true });

    if(itemResult.error){return finish({...empty,backendAvailable:!isBackendUnavailable(itemResult.error),error:itemResult.error.message});}
    return finish({...empty,currentCase:mappedCurrent,history,items:((itemResult.data??[]) as unknown[]).map(mapItem)});
    }catch(cause){return finish({...empty,error:cause instanceof Error?cause.message:"Replanejamento indisponível."});}
  },[athleteId,scope]);
  const reload=useCallback(async()=>{
    const value=await readSnapshot();
    if(value && !value.error && value.backendAvailable && !locked.current)
      setAction(previous=>previous.scope===scope?{...previous,error:null}:previous);
  },[readSnapshot,scope]);
  useEffect(()=>{
    activeScope.current=scope;epoch.current++;locked.current=false;
    setAction({scope,saving:false,error:null});
    void reload();
    return ()=>{activeScope.current=undefined;request.current++;epoch.current++;locked.current=false;};
  },[reload,scope]);
  const runAction=useCallback(async<T,>(operation:()=>Promise<T>,confirm:(value:typeof empty,result:T)=>boolean)=>{
    if(!athleteId||activeScope.current!==scope||visible.loading||visible.error||!visible.backendAvailable||currentAction.error||locked.current)
      throw new Error("Aguarde uma leitura válida do atleta atual.");
    locked.current=true;
    const token=epoch.current;
    const active=()=>activeScope.current===scope&&token===epoch.current;
    setAction({scope,saving:true,error:null});
    try{
      const value=await operation();
      if(active()){
        const confirmed=await readSnapshot();
        if(!confirmed || confirmed.error || !confirmed.backendAvailable || !confirm(confirmed,value))
          throw new Error("Gravação não confirmada. Atualize e confira o histórico antes de repetir.");
      }
      return value;
    }catch(cause){
      if(active())setAction({scope,saving:false,error:cause instanceof Error?cause.message:"Operação indisponível."});
      throw cause;
    }finally{
      if(active()){locked.current=false;setAction(previous=>previous.scope===scope?{...previous,saving:false}:previous);}
    }
  },[athleteId,scope,visible.loading,visible.error,visible.backendAvailable,currentAction.error,readSnapshot]);
  const openCase = useCallback(
    async (reviewRunId: string) =>
      runAction(async () => {
        const result = await db.rpc("health_f14_open_replanning_case", {
          p_review_run_id: reviewRunId,
        });
        if (result.error) {
          throw new Error(result.error.message);
        }
        return result.data;
      }, (snapshot,id)=>snapshot.currentCase?.id===id && snapshot.currentCase.sourceReviewRunId===reviewRunId),
    [runAction,visible.currentCase,visible.items],
  );

  const recordDecision = useCallback(
    async ({
      caseId,
      domain,
      decision,
      notes,
    }: {
      caseId: string;
      domain: ReplanningItem["domain"];
      decision: Exclude<ReplanningDecision, "pending">;
      notes?: string | null;
    }) =>
      runAction(async () => {
        if(visible.currentCase?.id!==caseId||!["open","in_review"].includes(visible.currentCase.caseStatus)||!visible.items.some(item=>item.domain===domain))
          throw new Error("Caso ou domínio fora da leitura atual.");
        const result = await db.rpc(
          "health_f14_record_replanning_item_decision",
          {
            p_case_id: caseId,
            p_domain: domain,
            p_decision_code: decision,
            p_notes: notes ?? null,
          },
        );
        if (result.error) {
          throw new Error(result.error.message);
        }
        return result.data;
      }, (snapshot,id)=>snapshot.currentCase?.id===caseId && snapshot.items.some(item=>item.id===id && item.domain===domain && item.itemStatus===decision && item.decisionNotes===(notes??null))),
    [runAction,visible.currentCase,visible.items],
  );

  const completeCase = useCallback(
    async (caseId: string) =>
      runAction(async () => {
        if(visible.currentCase?.id!==caseId)throw new Error("Caso fora da leitura atual.");
        const result = await db.rpc("health_f14_complete_replanning_case", {
          p_case_id: caseId,
        });
        if (result.error) {
          throw new Error(result.error.message);
        }
        return result.data;
      }, (snapshot)=>snapshot.currentCase?.id===caseId && snapshot.currentCase.caseStatus==="completed"),
    [runAction,visible.currentCase,visible.items],
  );

  const voidCase = useCallback(
    async (caseId: string, reason: string) =>
      runAction(async () => {
        if(visible.currentCase?.id!==caseId)throw new Error("Caso fora da leitura atual.");
        const result = await db.rpc("health_f14_void_replanning_case", {
          p_case_id: caseId,
          p_reason: reason,
        });
        if (result.error) {
          throw new Error(result.error.message);
        }
        return result.data;
      }, (snapshot)=>[snapshot.currentCase,...snapshot.history].some(item=>item?.id===caseId && item.caseStatus==="voided")),
    [runAction,visible.currentCase,visible.items],
  );

  return {currentCase:visible.currentCase,items:visible.items,history:visible.history,loading:visible.loading,
    saving:currentAction.saving,backendAvailable:visible.backendAvailable,error:visible.error??currentAction.error,
    reload,openCase,recordDecision,completeCase,voidCase};
}
